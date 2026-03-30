<?php
/**
 * WP-CLI command to migrate legacy Awesome Squiggle blocks to the new format.
 *
 * Usage:
 *   wp awesome-squiggle migrate-legacy --dry-run
 *   wp awesome-squiggle migrate-legacy
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

/**
 * Awesome Squiggle migration commands.
 */
class Awesome_Squiggle_CLI_Command {

	// WARNING: These keys are used in SQL LIKE clauses — keep them as hardcoded strings.

	/**
	 * Legacy class name to new format mapping.
	 *
	 * @var array
	 */
	private $migration_map = array(
		'is-style-animated-squiggle' => array(
			'className'  => 'is-style-squiggle',
			'isAnimated' => true,
			'pointiness' => 0,
			'angle'      => 0,
		),
		'is-style-static-squiggle'   => array(
			'className'  => 'is-style-squiggle',
			'isAnimated' => false,
			'pointiness' => 0,
			'angle'      => 0,
		),
		'is-style-animated-zigzag'   => array(
			'className'  => 'is-style-zigzag',
			'isAnimated' => true,
			'pointiness' => 100,
			'angle'      => 0,
		),
		'is-style-static-zigzag'     => array(
			'className'  => 'is-style-zigzag',
			'isAnimated' => false,
			'pointiness' => 100,
			'angle'      => 0,
		),
	);

	/**
	 * Migrate legacy Awesome Squiggle blocks to the new format.
	 *
	 * Finds posts containing legacy class names (is-style-animated-squiggle,
	 * is-style-static-squiggle, is-style-animated-zigzag, is-style-static-zigzag)
	 * and updates them to use the new format.
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Show what would change without saving.
	 *
	 * [--post-types=<types>]
	 * : Comma-separated list of post types to scan. Default: post,page,wp_block.
	 *
	 * ## EXAMPLES
	 *
	 *     # Preview changes
	 *     wp awesome-squiggle migrate-legacy --dry-run
	 *
	 *     # Run the migration
	 *     wp awesome-squiggle migrate-legacy
	 *
	 *     # Include custom post types
	 *     wp awesome-squiggle migrate-legacy --post-types=post,page,wp_block,product,portfolio
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Associative arguments.
	 */
	public function __invoke( $args, $assoc_args ) {
		$dry_run    = WP_CLI\Utils\get_flag_value( $assoc_args, 'dry-run', false );
		$post_types = WP_CLI\Utils\get_flag_value( $assoc_args, 'post-types', 'post,page,wp_block' );

		if ( $dry_run ) {
			WP_CLI::log( '🏃 Dry run mode — no changes will be saved.' );
		}

		// Query for posts containing any legacy class name.
		global $wpdb;

		$legacy_classes = array_keys( $this->migration_map );
		$where_clauses  = array();
		foreach ( $legacy_classes as $class ) {
			$where_clauses[] = $wpdb->prepare( 'post_content LIKE %s', '%' . $wpdb->esc_like( $class ) . '%' );
		}

		// Build post type IN clause with proper escaping
		$type_list       = array_map( 'trim', explode( ',', $post_types ) );
		$type_placeholders = implode( ',', array_fill( 0, count( $type_list ), '%s' ) );

		$sql   = $wpdb->prepare(
			"SELECT ID, post_title, post_content FROM {$wpdb->posts} WHERE (" . implode( ' OR ', $where_clauses ) . ") AND post_status != 'trash' AND post_type IN ($type_placeholders)", // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- dynamic clauses with esc_like and prepare
			...$type_list
		);
		$posts = $wpdb->get_results( $sql ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		WP_CLI::log( sprintf( 'Scanning post types: %s', implode( ', ', $type_list ) ) );

		if ( empty( $posts ) ) {
			WP_CLI::success( 'No posts found with legacy Awesome Squiggle blocks.' );
			return;
		}

		WP_CLI::log( sprintf( 'Found %d post(s) with legacy Awesome Squiggle blocks.', count( $posts ) ) );

		$posts_updated      = 0;
		$posts_would_update = 0;
		$blocks_migrated    = 0;

		foreach ( $posts as $post ) {
			$blocks         = parse_blocks( $post->post_content );
			$migrated_count = 0;
			$blocks         = $this->migrate_blocks( $blocks, $migrated_count );

			if ( $migrated_count === 0 ) {
				WP_CLI::log( sprintf( '  Post #%d "%s" — no separator blocks needed migration.', $post->ID, $post->post_title ) );
				continue;
			}

			$new_content = serialize_blocks( $blocks );

			if ( $dry_run ) {
				WP_CLI::log( sprintf(
					'  Post #%d "%s" — would migrate %d block(s).',
					$post->ID,
					$post->post_title,
					$migrated_count
				) );
				$posts_would_update++;
			} else {
				$result = wp_update_post(
					array(
						'ID'           => $post->ID,
						'post_content' => wp_slash( $new_content ),
					),
					true
				);

				if ( is_wp_error( $result ) ) {
					WP_CLI::warning( sprintf(
						'  Post #%d "%s" — failed to update: %s',
						$post->ID,
						$post->post_title,
						$result->get_error_message()
					) );
					continue;
				}

				WP_CLI::log( sprintf(
					'  Post #%d "%s" — migrated %d block(s).',
					$post->ID,
					$post->post_title,
					$migrated_count
				) );
				$posts_updated++;
			}

			$blocks_migrated += $migrated_count;
		}

		if ( $dry_run ) {
			WP_CLI::success( sprintf(
				'Dry run complete. Would update %d block(s) across %d post(s).',
				$blocks_migrated,
				$posts_would_update
			) );
		} else {
			WP_CLI::success( sprintf(
				'Migration complete. Updated %d block(s) across %d post(s).',
				$blocks_migrated,
				$posts_updated
			) );
		}
	}

	/**
	 * Recursively migrate blocks, including innerBlocks.
	 *
	 * @param array $blocks         Array of parsed blocks.
	 * @param int   $migrated_count Running count of migrated blocks (passed by reference).
	 * @return array Modified blocks.
	 */
	private function migrate_blocks( $blocks, &$migrated_count ) {
		foreach ( $blocks as &$block ) {
			// Recurse into innerBlocks.
			if ( ! empty( $block['innerBlocks'] ) ) {
				$block['innerBlocks'] = $this->migrate_blocks( $block['innerBlocks'], $migrated_count );
			}

			// Only process core/separator blocks.
			if ( $block['blockName'] !== 'core/separator' ) {
				continue;
			}

			$class_name = $block['attrs']['className'] ?? '';
			$matched    = null;

			foreach ( $this->migration_map as $legacy_class => $new_format ) {
				if ( strpos( $class_name, $legacy_class ) !== false ) {
					$matched = $legacy_class;
					break;
				}
			}

			if ( ! $matched ) {
				continue;
			}

			$new_format = $this->migration_map[ $matched ];

			// Update attrs className: replace legacy class with new class.
			$block['attrs']['className'] = str_replace( $matched, $new_format['className'], $block['attrs']['className'] );

			// Set new attributes.
			$block['attrs']['isAnimated'] = $new_format['isAnimated'];
			$block['attrs']['pointiness'] = $new_format['pointiness'];
			$block['attrs']['angle']      = $new_format['angle'];

			// Update innerHTML and innerContent: replace legacy class in the HTML strings.
			if ( isset( $block['innerHTML'] ) ) {
				$block['innerHTML'] = str_replace( $matched, $new_format['className'], $block['innerHTML'] );
			}

			if ( ! empty( $block['innerContent'] ) ) {
				foreach ( $block['innerContent'] as $i => $content ) {
					if ( is_string( $content ) ) {
						$block['innerContent'][ $i ] = str_replace( $matched, $new_format['className'], $content );
					}
				}
			}

			$migrated_count++;
		}

		return $blocks;
	}
}

WP_CLI::add_command( 'awesome-squiggle migrate-legacy', 'Awesome_Squiggle_CLI_Command' );
