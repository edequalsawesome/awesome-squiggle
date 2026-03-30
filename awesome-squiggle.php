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

        // Check if this is a pattern-based block (new) or legacy path-based block
        // Pattern-based blocks use preserveAspectRatio with "slice" mode and <pattern> element
        // Legacy blocks use preserveAspectRatio="none" and direct <path> element
        $is_pattern_based = (strpos($block_content, 'xMidYMid slice') !== false) ||
                           (strpos($block_content, 'xMinYMid slice') !== false) ||
                           (strpos($block_content, '<pattern') !== false);
        $is_legacy = (strpos($block_content, 'preserveAspectRatio="none"') !== false) ||
                     (!$is_pattern_based && strpos($block_content, '<path') !== false);

        // For legacy path-based blocks, apply viewBox fix for proper wave rendering
        if ($is_legacy) {
            // Fix viewBox to zoom in on the actual wave portion
            // This ensures the wave fills the container height properly
            $amplitude = isset($attrs['squiggleAmplitude']) ? intval($attrs['squiggleAmplitude']) : 15;
            $amplitude = max(5, min(25, $amplitude)); // Clamp to valid range
            $stroke_width = isset($attrs['strokeWidth']) ? intval($attrs['strokeWidth']) : 1;
            $stroke_width = max(1, min(8, $stroke_width)); // Clamp to valid range

            $padding = max($stroke_width * 2, 5);
            $viewbox_min_y = 50 - $amplitude - $padding;
            $viewbox_height = ($amplitude * 2) + ($padding * 2);

            // Replace viewBox with calculated one
            // Use 4800 for alignfull/alignwide (wide/ultra-wide screens), 800 for normal width
            // Check both className and align attribute (WordPress stores alignment separately)
            $is_full_width = (strpos($className, 'alignfull') !== false) ||
                             (isset($attrs['align']) && $attrs['align'] === 'full');
            $is_wide_width = (strpos($className, 'alignwide') !== false) ||
                             (isset($attrs['align']) && $attrs['align'] === 'wide');
            $viewbox_width = ($is_full_width || $is_wide_width) ? 4800 : 800;

            // Match ANY viewBox format and replace with correct calculated values
            // This fixes both old format (0 0 width 100) and new format (0 minY width height)
            $block_content = preg_replace(
                '/viewBox="[^"]*"/',
                'viewBox="0 ' . $viewbox_min_y . ' ' . $viewbox_width . ' ' . $viewbox_height . '"',
                $block_content,
                1
            );

            // Add data attribute to flag legacy blocks for potential JS migration
            if (strpos($block_content, 'data-legacy-format') === false) {
                $processor = new WP_HTML_Tag_Processor( $block_content );
                if ( $processor->next_tag( array( 'class_name' => 'awesome-squiggle-wave' ) ) ) {
                    $processor->set_attribute( 'data-legacy-format', 'true' );
                }
                $block_content = $processor->get_updated_html();
            }
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
