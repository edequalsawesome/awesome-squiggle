<?php
/**
 * Plugin Name: Awesome Squiggle
 * Plugin URI: https://github.com/edequalsawesome/awesome-squiggle
 * Description: Adds animated squiggle variations to the core WordPress separator block
 * Version: 1.2.16
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

/**
 * Server-side validation for squiggle IDs
 * Provides security hardening against client-side manipulation
 */
function validate_squiggle_id($id, $type = 'animation') {
    // Strict server-side validation
    if (!preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $id)) {
        // Generate secure fallback
        return $type . '-' . wp_generate_uuid4();
    }
    return sanitize_key($id);
}

/**
 * Validate block attributes for security
 * Ensures animation and gradient IDs are properly sanitized
 */
function awesome_squiggle_validate_block_attributes($attributes) {
    if (isset($attributes['animationId'])) {
        $attributes['animationId'] = validate_squiggle_id($attributes['animationId'], 'animation');
    }
    if (isset($attributes['gradientId'])) {
        $attributes['gradientId'] = validate_squiggle_id($attributes['gradientId'], 'gradient');
    }
    return $attributes;
}

/**
 * Initialize the Awesome Squiggle plugin
 */
function awesome_squiggle_init() {
    // Security improvement: Check if file exists before reading
    $block_json_path = __DIR__ . '/build/block.json';
    
    if (!file_exists($block_json_path)) {        return;
    }
    
    // Security improvement: Validate file contents
    $block_json_content = file_get_contents($block_json_path);
    if ($block_json_content === false) {        return;
    }
    
    $block_json = json_decode($block_json_content, true);
    if (!$block_json || json_last_error() !== JSON_ERROR_NONE) {        return;
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
        '1.2.16'
    );
}
add_action('wp_enqueue_scripts', 'awesome_squiggle_enqueue_frontend_styles');

/**
 * Add frontend JavaScript for sparkle separators - only load when needed
 */
function awesome_squiggle_enqueue_frontend_scripts() {
    // Only enqueue if the current post contains sparkle separators
    global $post;
    
    if ($post && ( 
        strpos($post->post_content, 'is-style-animated-sparkle') !== false || 
        strpos($post->post_content, 'is-style-static-sparkle') !== false 
    )) {
        wp_enqueue_script(
            'awesome-squiggle-frontend',
            plugin_dir_url(__FILE__) . 'build/frontend.js',
            array(),
            '1.2.16',
            true
        );
    }
}
add_action('wp_enqueue_scripts', 'awesome_squiggle_enqueue_frontend_scripts');

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
    
    // Security validation: Validate block attributes server-side
    $attrs = awesome_squiggle_validate_block_attributes($attrs);
    
    if (strpos($className, 'is-style-') !== false && 
        (strpos($className, 'squiggle') !== false || strpos($className, 'zigzag') !== false || strpos($className, 'sparkle') !== false)) {
        
        // Ensure our CSS class is included
        if (strpos($block_content, 'awesome-squiggle-wave') === false) {
            $block_content = str_replace(
                'wp-block-separator',
                'wp-block-separator awesome-squiggle-wave',
                $block_content
            );
        }
        
        // Security: Validate and sanitize any ID attributes in the output
        if (isset($attrs['animationId'])) {
            $validated_animation_id = validate_squiggle_id($attrs['animationId'], 'animation');
            // Replace any instances of the original ID with the validated one
            if ($attrs['animationId'] !== $validated_animation_id) {
                $block_content = str_replace($attrs['animationId'], $validated_animation_id, $block_content);
            }
        }
        
        if (isset($attrs['gradientId'])) {
            $validated_gradient_id = validate_squiggle_id($attrs['gradientId'], 'gradient');
            // Replace any instances of the original ID with the validated one
            if ($attrs['gradientId'] !== $validated_gradient_id) {
                $block_content = str_replace($attrs['gradientId'], $validated_gradient_id, $block_content);
            }
        }
    }
    
    return $block_content;
}
add_filter('render_block', 'awesome_squiggle_filter_separator_content', 10, 2);

/**
 * Server-side validation hook for REST API requests
 * Validates block attributes when saving posts
 */
function awesome_squiggle_validate_rest_block_attributes($prepared_post, $request) {
    // Only process if post content contains squiggle blocks
    if (isset($prepared_post->post_content) && 
        (strpos($prepared_post->post_content, 'is-style-animated-squiggle') !== false ||
         strpos($prepared_post->post_content, 'is-style-static-squiggle') !== false ||
         strpos($prepared_post->post_content, 'is-style-animated-zigzag') !== false ||
         strpos($prepared_post->post_content, 'is-style-static-zigzag') !== false ||
         strpos($prepared_post->post_content, 'is-style-animated-sparkle') !== false ||
         strpos($prepared_post->post_content, 'is-style-static-sparkle') !== false)) {
        
        // Parse blocks and validate attributes
        $blocks = parse_blocks($prepared_post->post_content);
        $blocks = array_map('awesome_squiggle_validate_parsed_blocks', $blocks);
        $prepared_post->post_content = serialize_blocks($blocks);
    }
    
    return $prepared_post;
}

/**
 * Recursively validate block attributes in parsed blocks
 */
function awesome_squiggle_validate_parsed_blocks($block) {
    // Validate separator blocks with squiggle styles
    if ($block['blockName'] === 'core/separator' && 
        isset($block['attrs']['className']) &&
        (strpos($block['attrs']['className'], 'squiggle') !== false ||
         strpos($block['attrs']['className'], 'zigzag') !== false ||
         strpos($block['attrs']['className'], 'sparkle') !== false)) {
        
        $block['attrs'] = awesome_squiggle_validate_block_attributes($block['attrs']);
    }
    
    // Recursively validate inner blocks
    if (!empty($block['innerBlocks'])) {
        $block['innerBlocks'] = array_map('awesome_squiggle_validate_parsed_blocks', $block['innerBlocks']);
    }
    
    return $block;
}

add_filter('rest_pre_insert_post', 'awesome_squiggle_validate_rest_block_attributes', 10, 2); 