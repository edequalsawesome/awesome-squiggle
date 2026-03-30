<?php
/**
 * Plugin Name: Awesome Squiggle
 * Plugin URI: https://github.com/edequalsawesome/awesome-squiggle
 * Description: Adds animated squiggle variations to the core WordPress separator block
 * Version: 2026.03.10
 * Author: eD! Thomas
 * Author URI: https://edequalsaweso.me
 * License: GPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: awesome-squiggle
 * Requires at least: 6.3
 * Tested up to: 6.8
 * Requires PHP: 7.4
 * 
 * Source Code: Human-readable source code for all compiled JavaScript and CSS files
 * is located in the /src/ directory. Build process uses @wordpress/scripts and Webpack.
 * See readme.txt for complete build instructions.
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Register WP-CLI migration command
if ( defined( 'WP_CLI' ) && WP_CLI ) {
    require_once __DIR__ . '/scripts/migrate-legacy-blocks.php';
}

define( 'AWESOME_SQUIGGLE_VERSION', '2026.03.10' );

/**
 * Initialize the Awesome Squiggle plugin
 */
function awesome_squiggle_init() {
    register_block_type( __DIR__ . '/build' );
}
add_action( 'init', 'awesome_squiggle_init' );

/**
 * Filter separator block content on frontend to ensure squiggle styles are applied.
 * Also conditionally enqueues frontend CSS only when a squiggle separator is rendered.
 */
function awesome_squiggle_filter_separator_content( $block_content, $block ) {
    if ( $block['blockName'] !== 'core/separator' ) {
        return $block_content;
    }

    $attrs = $block['attrs'] ?? array();
    $className = $attrs['className'] ?? '';
    $className = implode( ' ', array_map( 'sanitize_html_class', explode( ' ', $className ) ) );

    // Match exact current style tokens only — not legacy substrings like animated-squiggle
    $class_list = explode( ' ', $className );
    if ( array_intersect( $class_list, array( 'is-style-squiggle', 'is-style-zigzag', 'is-style-lightning' ) ) ) {

        // Enqueue frontend styles only when a squiggle separator is actually rendered
        if ( ! wp_style_is( 'awesome-squiggle-frontend', 'enqueued' ) ) {
            wp_enqueue_style(
                'awesome-squiggle-frontend',
                plugin_dir_url( __FILE__ ) . 'build/style-index.css',
                array(),
                AWESOME_SQUIGGLE_VERSION
            );
        }

        // Ensure our CSS class is included
        if ( strpos( $block_content, 'awesome-squiggle-wave' ) === false ) {
            $processor = new WP_HTML_Tag_Processor( $block_content );
            if ( $processor->next_tag( array( 'class_name' => 'wp-block-separator' ) ) ) {
                $processor->add_class( 'awesome-squiggle-wave' );
            }
            $block_content = $processor->get_updated_html();
        }
    }

    return $block_content;
}
add_filter( 'render_block', 'awesome_squiggle_filter_separator_content', 10, 2 );
