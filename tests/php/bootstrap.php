<?php
/**
 * PHPUnit bootstrap for Awesome Squiggle renderer tests.
 *
 * Stubs WordPress functions so the renderer class can be tested
 * without a full WordPress installation.
 */

// Stub ABSPATH so the renderer file doesn't exit
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', '/tmp/' );
}

if ( ! defined( 'AWESOME_SQUIGGLE_VERSION' ) ) {
	define( 'AWESOME_SQUIGGLE_VERSION', 'test' );
}

// Stub WordPress functions used by the renderer
if ( ! function_exists( 'sanitize_html_class' ) ) {
	function sanitize_html_class( $class ) {
		return preg_replace( '/[^a-zA-Z0-9_-]/', '', $class );
	}
}

if ( ! function_exists( 'esc_attr' ) ) {
	function esc_attr( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'esc_attr__' ) ) {
	function esc_attr__( $text, $domain = 'default' ) {
		return esc_attr( $text );
	}
}

if ( ! function_exists( 'wp_style_is' ) ) {
	function wp_style_is( $handle, $list = 'enqueued' ) {
		return false;
	}
}

if ( ! function_exists( 'wp_enqueue_style' ) ) {
	function wp_enqueue_style( $handle, $src = '', $deps = array(), $ver = false, $media = 'all' ) {
		// no-op in tests
	}
}

if ( ! function_exists( 'plugin_dir_url' ) ) {
	function plugin_dir_url( $file ) {
		return 'http://example.com/wp-content/plugins/awesome-squiggle/';
	}
}

// Load the renderer
require_once dirname( __DIR__, 2 ) . '/includes/class-awesome-squiggle-renderer.php';
