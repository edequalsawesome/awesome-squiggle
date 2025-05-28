<?php
/**
 * Plugin Name: Awesome Squiggle
 * Plugin URI: https://github.com/edequalsawesome/awesome-squiggle
 * Description: Adds animated squiggle variations to the core WordPress separator block
 * Version: 1.2.5
 * Author: eD! Thomas
 * Author URI: https://edequalsaweso.me
 * License: GPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: awesome-squiggle
 * Requires at least: 6.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Initialize the Awesome Squiggle plugin
 */
function awesome_squiggle_init() {
    // Security improvement: Check if file exists before reading
    $block_json_path = __DIR__ . '/build/block.json';
    
    if (!file_exists($block_json_path)) {
        error_log('Awesome Squiggle: block.json file not found at ' . $block_json_path);
        return;
    }
    
    // Security improvement: Validate file contents
    $block_json_content = file_get_contents($block_json_path);
    if ($block_json_content === false) {
        error_log('Awesome Squiggle: Failed to read block.json');
        return;
    }
    
    $block_json = json_decode($block_json_content, true);
    if (!$block_json || json_last_error() !== JSON_ERROR_NONE) {
        error_log('Awesome Squiggle: Invalid JSON in block.json - ' . json_last_error_msg());
        return;
    }

    // Register our block variation and filters
    register_block_type(__DIR__ . '/build');
}
add_action('init', 'awesome_squiggle_init');

/**
 * Add frontend styles for squiggle separators - load on all pages to ensure compatibility
 */
function awesome_squiggle_enqueue_frontend_styles() {
    wp_enqueue_style(
        'awesome-squiggle-frontend',
        plugin_dir_url(__FILE__) . 'build/style-index.css',
        array(),
        '1.2.5'
    );
}
add_action('wp_enqueue_scripts', 'awesome_squiggle_enqueue_frontend_styles');

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
    
    // Security improvement: Sanitize className before processing
    $className = sanitize_html_class($className);
    
    if (strpos($className, 'is-style-') !== false && 
        (strpos($className, 'squiggle') !== false || strpos($className, 'zigzag') !== false)) {
        
        // Ensure our CSS class is included
        if (strpos($block_content, 'awesome-squiggle-wave') === false) {
            $block_content = str_replace(
                'wp-block-separator',
                'wp-block-separator awesome-squiggle-wave',
                $block_content
            );
        }
    }
    
    return $block_content;
}
add_filter('render_block', 'awesome_squiggle_filter_separator_content', 10, 2); 