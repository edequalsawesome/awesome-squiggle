<?php
/** Run on WordPress 7.0+: wp eval-file tests/wp-visibility.php */

$callback = array( 'Awesome_Squiggle_Renderer', 'render_block' );
if ( 9 !== has_filter( 'render_block', $callback ) || false !== has_filter( 'render_block_core/separator', $callback ) ) {
	throw new RuntimeException( 'Squiggle must render before core block supports.' );
}

foreach ( array( false, array( 'viewport' => array( 'mobile' => false ) ), null ) as $visibility ) {
	$attrs = array( 'className' => 'is-style-squiggle', 'metadata' => array( 'blockVisibility' => $visibility ) );
	$html = do_blocks( '<!-- wp:separator ' . wp_json_encode( $attrs ) . ' --><hr class="wp-block-separator is-style-squiggle"/><!-- /wp:separator -->' );
	if ( false === $visibility ) {
		if ( '' !== $html ) {
			throw new RuntimeException( 'A fully hidden separator was resurrected.' );
		}
	} else {
		if ( false === strpos( $html, '<svg' ) ) {
			throw new RuntimeException( 'Visible separator lost its SVG.' );
		}
		$hidden_class = false !== strpos( $html, 'wp-block-hidden-mobile' );
		if ( is_array( $visibility ) !== $hidden_class ) {
			throw new RuntimeException( 'Core viewport visibility was not preserved.' );
		}
	}
}
if ( 'unchanged' !== Awesome_Squiggle_Renderer::render_block( 'unchanged', array() ) ) {
	throw new RuntimeException( 'A block without a name was changed.' );
}
WP_CLI::success( 'Core full-block and viewport visibility survive Squiggle rendering.' );
