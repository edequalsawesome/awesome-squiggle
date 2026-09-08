<?php
/**
 * Plugin Name: Awesome Squiggle
 * Plugin URI: https://github.com/edequalsawesome/awesome-squiggle
 * Description: Adds animated squiggle variations to the core WordPress separator block
 * Version: 2026.07.001
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

define( 'AWESOME_SQUIGGLE_VERSION', '2026.07.001' );

// Load the PHP dynamic renderer
require_once __DIR__ . '/includes/class-awesome-squiggle-renderer.php';

// Register WP-CLI migration command.
// file_exists guard: the migration script is optional at runtime, so a partial
// deploy (e.g. plugin-zip excluding scripts/) must never fatal WP-CLI bootstrap.
if ( defined( 'WP_CLI' ) && WP_CLI && file_exists( __DIR__ . '/scripts/migrate-legacy-blocks.php' ) ) {
    require_once __DIR__ . '/scripts/migrate-legacy-blocks.php';
}

/**
 * Initialize the Awesome Squiggle plugin
 */
function awesome_squiggle_init() {
    register_block_type( __DIR__ . '/build' );
    // NOTE: the backdrop block deliberately has NO editorScript of its own —
    // its editor code is bundled into build/index.js (src/index.js imports
    // ./backdrop). A second editorScript handle would double-register the
    // block and double-apply the separator HOC/filters. If the separator-styles
    // block is ever excluded (e.g. allowed_block_types_all), the backdrop's
    // editor UI goes with it.
    register_block_type( __DIR__ . '/build/backdrop' );
}
add_action( 'init', 'awesome_squiggle_init' );

/**
 * Filter separator block content on frontend — PHP dynamic render generates
 * all SVG markup from block attributes, replacing JS save output entirely.
 */
// Let core's priority-10 block supports apply visibility to the final SVG wrapper.
add_filter( 'render_block', array( 'Awesome_Squiggle_Renderer', 'render_block' ), 9, 2 );
