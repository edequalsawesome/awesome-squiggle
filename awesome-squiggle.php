<?php
/**
 * Plugin Name: Awesome Squiggle
 * Plugin URI: https://github.com/edequalsawesome/awesome-squiggle
 * Description: Adds animated squiggle variations to the core WordPress separator block
 * Version: 1.2.17
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
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Server-side validation for squiggle IDs
 * Provides security hardening against client-side manipulation
 */
function validate_squiggle_id( $id, $type = 'animation' ) {
	// Strict server-side validation
	if ( ! preg_match( '/^[a-zA-Z0-9_-]{1,50}$/', $id ) ) {
		// Generate secure fallback
		return $type . '-' . wp_generate_uuid4();
	}
	return sanitize_key( $id );
}

/**
 * Validate block attributes for security
 * Ensures animation and gradient IDs are properly sanitized
 */
function awesome_squiggle_validate_block_attributes( $attributes ) {
	if ( isset( $attributes['animationId'] ) ) {
		$attributes['animationId'] = validate_squiggle_id( $attributes['animationId'], 'animation' );
	}
	if ( isset( $attributes['gradientId'] ) ) {
		$attributes['gradientId'] = validate_squiggle_id( $attributes['gradientId'], 'gradient' );
	}
	return $attributes;
}

/**
 * WordPress-specific security enhancements
 */

/**
 * Check if current user has permission to edit blocks
 *
 * @return bool True if user can edit blocks, false otherwise
 */
function awesome_squiggle_user_can_edit_blocks() {
	return current_user_can( 'edit_posts' ) || current_user_can( 'edit_pages' );
}

/**
 * Validate user permissions for block operations
 *
 * @param array $attributes Block attributes to validate
 * @return array|WP_Error Validated attributes or error
 */
function awesome_squiggle_validate_block_save( $attributes ) {
	if ( ! awesome_squiggle_user_can_edit_blocks() ) {
		return new WP_Error( 'insufficient_permissions', 'User cannot edit blocks' );
	}

	return awesome_squiggle_validate_block_attributes( $attributes );
}

/**
 * Verify nonce for AJAX operations (future-proofing)
 *
 * @param string $nonce Nonce value to verify
 * @param string $action Action name for nonce verification
 * @return void Dies if nonce verification fails
 */
function awesome_squiggle_verify_nonce( $nonce, $action = 'awesome_squiggle_action' ) {
	if ( ! wp_verify_nonce( $nonce, $action ) ) {
		wp_die( 'Security check failed', 'Security Error', array( 'response' => 403 ) );
	}
}

/**
 * Enhanced capability check for REST API operations
 *
 * @param WP_REST_Request $request The REST request
 * @return bool|WP_Error True if user can edit, error otherwise
 */
function awesome_squiggle_check_rest_permissions( $request ) {
	if ( ! awesome_squiggle_user_can_edit_blocks() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to edit blocks.', array( 'status' => 403 ) );
	}

	return true;
}

/**
 * Initialize the Awesome Squiggle plugin
 */
function awesome_squiggle_init() {
	// Security improvement: Check if file exists before reading
	$block_json_path = __DIR__ . '/build/block.json';

	if ( ! file_exists( $block_json_path ) ) {
		return;
	}

	// Security improvement: Validate file contents
	$block_json_content = file_get_contents( $block_json_path );
	if ( $block_json_content === false ) {
		return;
	}

	$block_json = json_decode( $block_json_content, true );
	if ( ! $block_json || json_last_error() !== JSON_ERROR_NONE ) {
		return;
	}

	// Register our block variation and filters
	register_block_type( __DIR__ . '/build' );
}
add_action( 'init', 'awesome_squiggle_init' );

/**
 * Add frontend styles for squiggle separators - load on all pages to ensure compatibility
 */
function awesome_squiggle_enqueue_frontend_styles() {
	wp_enqueue_style(
		'awesome-squiggle-frontend',
		plugin_dir_url( __FILE__ ) . 'build/style-index.css',
		array(),
		'1.2.17'
	);
}
add_action( 'wp_enqueue_scripts', 'awesome_squiggle_enqueue_frontend_styles' );

/**
 * Filter separator block content on frontend to ensure squiggle styles are applied
 * Enhanced with additional security validation
 */
function awesome_squiggle_filter_separator_content( $block_content, $block ) {
	if ( $block['blockName'] !== 'core/separator' ) {
		return $block_content;
	}

	// Enhanced security: Validate block structure
	if ( ! is_array( $block ) || ! isset( $block['attrs'] ) ) {
		return $block_content;
	}

	$attrs = $block['attrs'] ?? array();

	// Enhanced sanitization of all attributes
	$className = isset( $attrs['className'] ) ? sanitize_html_class( $attrs['className'] ) : '';

	// Validate all custom attributes with enhanced security
	if ( isset( $attrs['animationId'] ) ) {
		$attrs['animationId'] = validate_squiggle_id( $attrs['animationId'], 'animation' );
	}

	if ( isset( $attrs['gradientId'] ) ) {
		$attrs['gradientId'] = validate_squiggle_id( $attrs['gradientId'], 'gradient' );
	}

	// Additional sanitization for style attributes
	if ( isset( $attrs['style'] ) && is_array( $attrs['style'] ) ) {
		$attrs['style'] = array_map( 'sanitize_text_field', $attrs['style'] );
	}

	// Sanitize color attributes
	if ( isset( $attrs['backgroundColor'] ) ) {
		$attrs['backgroundColor'] = sanitize_html_class( $attrs['backgroundColor'] );
	}

	if ( isset( $attrs['textColor'] ) ) {
		$attrs['textColor'] = sanitize_html_class( $attrs['textColor'] );
	}

	if ( isset( $attrs['customBackgroundColor'] ) ) {
		$attrs['customBackgroundColor'] = sanitize_hex_color( $attrs['customBackgroundColor'] );
	}

	if ( isset( $attrs['customTextColor'] ) ) {
		$attrs['customTextColor'] = sanitize_hex_color( $attrs['customTextColor'] );
	}

	// Security validation: Final validation with existing function
	$attrs = awesome_squiggle_validate_block_attributes( $attrs );

	if ( strpos( $className, 'is-style-' ) !== false &&
		( strpos( $className, 'squiggle' ) !== false || strpos( $className, 'zigzag' ) !== false || strpos( $className, 'sparkle' ) !== false ) ) {

		// Ensure our CSS class is included
		if ( strpos( $block_content, 'awesome-squiggle-wave' ) === false ) {
			$block_content = str_replace(
				'wp-block-separator',
				'wp-block-separator awesome-squiggle-wave',
				$block_content
			);
		}

		// Security: Validate and sanitize any ID attributes in the output
		if ( isset( $attrs['animationId'] ) ) {
			$validated_animation_id = validate_squiggle_id( $attrs['animationId'], 'animation' );
			// Replace any instances of the original ID with the validated one
			if ( $attrs['animationId'] !== $validated_animation_id ) {
				$block_content = str_replace( $attrs['animationId'], $validated_animation_id, $block_content );
			}
		}

		if ( isset( $attrs['gradientId'] ) ) {
			$validated_gradient_id = validate_squiggle_id( $attrs['gradientId'], 'gradient' );
			// Replace any instances of the original ID with the validated one
			if ( $attrs['gradientId'] !== $validated_gradient_id ) {
				$block_content = str_replace( $attrs['gradientId'], $validated_gradient_id, $block_content );
			}
		}
	}

	return $block_content;
}
add_filter( 'render_block', 'awesome_squiggle_filter_separator_content', 10, 2 );

/**
 * Server-side validation hook for REST API requests
 * Enhanced with permission checks and comprehensive validation
 */
function awesome_squiggle_validate_rest_block_attributes( $prepared_post, $request ) {
	// Enhanced security: Check user permissions first
	$permission_check = awesome_squiggle_check_rest_permissions( $request );
	if ( is_wp_error( $permission_check ) ) {
		return $permission_check;
	}

	// Additional security: Validate request source
	if ( ! $request instanceof WP_REST_Request ) {
		return new WP_Error( 'invalid_request', 'Invalid request format', array( 'status' => 400 ) );
	}

	// Only process if post content contains squiggle blocks
	if ( isset( $prepared_post->post_content ) &&
		( strpos( $prepared_post->post_content, 'is-style-animated-squiggle' ) !== false ||
		strpos( $prepared_post->post_content, 'is-style-static-squiggle' ) !== false ||
		strpos( $prepared_post->post_content, 'is-style-animated-zigzag' ) !== false ||
		strpos( $prepared_post->post_content, 'is-style-static-zigzag' ) !== false ||
		strpos( $prepared_post->post_content, 'is-style-animated-sparkle' ) !== false ||
		strpos( $prepared_post->post_content, 'is-style-static-sparkle' ) !== false ) ) {

		// Enhanced security: Validate content length to prevent DoS
		if ( strlen( $prepared_post->post_content ) > 1000000 ) { // 1MB limit
			return new WP_Error( 'content_too_large', 'Post content exceeds size limit', array( 'status' => 413 ) );
		}

		// Parse blocks and validate attributes
		$blocks = parse_blocks( $prepared_post->post_content );
		if ( $blocks === false ) {
			return new WP_Error( 'invalid_blocks', 'Unable to parse block content', array( 'status' => 400 ) );
		}

		$blocks                      = array_map( 'awesome_squiggle_validate_parsed_blocks', $blocks );
		$prepared_post->post_content = serialize_blocks( $blocks );
	}

	return $prepared_post;
}

/**
 * Recursively validate block attributes in parsed blocks
 * Enhanced with additional security checks
 */
function awesome_squiggle_validate_parsed_blocks( $block ) {
	// Enhanced security: Validate block structure
	if ( ! is_array( $block ) || ! isset( $block['blockName'] ) ) {
		return $block;
	}

	// Validate separator blocks with squiggle styles
	if ( $block['blockName'] === 'core/separator' &&
		isset( $block['attrs']['className'] ) &&
		( strpos( $block['attrs']['className'], 'squiggle' ) !== false ||
		strpos( $block['attrs']['className'], 'zigzag' ) !== false ||
		strpos( $block['attrs']['className'], 'sparkle' ) !== false ) ) {

		// Use enhanced validation with permission checks
		$validated_attrs = awesome_squiggle_validate_block_save( $block['attrs'] );

		// Handle validation errors gracefully
		if ( is_wp_error( $validated_attrs ) ) {
			// Log error and return sanitized version            $block['attrs'] = awesome_squiggle_validate_block_attributes($block['attrs']);
		} else {
			$block['attrs'] = $validated_attrs;
		}
	}

	// Recursively validate inner blocks
	if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
		$block['innerBlocks'] = array_map( 'awesome_squiggle_validate_parsed_blocks', $block['innerBlocks'] );
	}

	return $block;
}

add_filter( 'rest_pre_insert_post', 'awesome_squiggle_validate_rest_block_attributes', 10, 2 );
