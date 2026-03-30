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
 * Requires at least: 6.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * 
 * Source Code: Human-readable source code for all compiled JavaScript and CSS files
 * is located in the /src/ directory. Build process uses @wordpress/scripts and Webpack.
 * See readme.txt for complete build instructions.
 */

// Prevent direct access
if (!defined('ABSPATH')) {
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
add_action('init', 'awesome_squiggle_init');

/**
 * Enqueue frontend styles on all pages
 * block.json only loads styles when the registered block is present,
 * but this plugin extends core/separator (not its own block),
 * so the style won't auto-load on frontend pages with squiggle separators.
 */
function awesome_squiggle_enqueue_frontend_styles() {
    wp_enqueue_style(
        'awesome-squiggle-frontend',
        plugin_dir_url( __FILE__ ) . 'build/style-index.css',
        array(),
        AWESOME_SQUIGGLE_VERSION
    );
}
add_action( 'wp_enqueue_scripts', 'awesome_squiggle_enqueue_frontend_styles' );

/**
 * Filter separator block content on frontend to ensure squiggle styles are applied
 */
function awesome_squiggle_filter_separator_content($block_content, $block) {
    if ($block['blockName'] !== 'core/separator') {
        return $block_content;
    }

    // Check if this is a squiggle or zig-zag separator
    $attrs = $block['attrs'] ?? array();
    $className = $attrs['className'] ?? '';

    // sanitize_html_class() only handles a single class, so split and rejoin
    $className = implode(' ', array_map('sanitize_html_class', explode(' ', $className)));

    if (strpos($className, 'is-style-') !== false &&
        (strpos($className, 'squiggle') !== false || strpos($className, 'zigzag') !== false || strpos($className, 'lightning') !== false)) {

        // Ensure our CSS class is included via WP_HTML_Tag_Processor (safe DOM manipulation)
        if (strpos($block_content, 'awesome-squiggle-wave') === false) {
            $processor = new WP_HTML_Tag_Processor( $block_content );
            if ( $processor->next_tag( array( 'class_name' => 'wp-block-separator' ) ) ) {
                $processor->add_class( 'awesome-squiggle-wave' );
            }
            $block_content = $processor->get_updated_html();
        }

    }

    return $block_content;
}
add_filter('render_block', 'awesome_squiggle_filter_separator_content', 10, 2);

/**
 * Clean up hooks on plugin deactivation
 */
function awesome_squiggle_deactivate() {
    remove_filter( 'render_block', 'awesome_squiggle_filter_separator_content' );
}
register_deactivation_hook( __FILE__, 'awesome_squiggle_deactivate' );
