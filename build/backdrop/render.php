<?php
/**
 * Frontend render for awesome-squiggle/backdrop.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    InnerBlocks saved markup.
 * @var WP_Block $block      Block instance.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$color = Awesome_Squiggle_Renderer::resolve_line_color( $attributes );

$svg = Awesome_Squiggle_Renderer::build_wave_svg( array(
	'shape'            => Awesome_Squiggle_Renderer::backdrop_resolve_shape( $attributes['shape'] ?? 'squiggle' ),
	'amplitude'        => $attributes['squiggleAmplitude'] ?? 10,
	'pointiness'       => $attributes['pointiness'] ?? 0,
	'angle'            => $attributes['angle'] ?? 0,
	'stroke_width'     => $attributes['strokeWidth'] ?? 2,
	'animation_speed'  => $attributes['animationSpeed'] ?? 2.5,
	'is_animated'      => $attributes['isAnimated'] ?? true,
	'is_reversed'      => $attributes['isReversed'] ?? false,
	'line_color'       => $color['line_color'],
	'gradient_data'    => $color['gradient_data'],
	'gradient_id'      => $color['gradient_id'] !== '' ? $color['gradient_id'] : Awesome_Squiggle_Renderer::validate_id( $attributes['gradientId'] ?? '' ),
	'animation_id'     => Awesome_Squiggle_Renderer::validate_id( $attributes['animationId'] ?? '' ),
	'container_height' => (int) Awesome_Squiggle_Renderer::validate_numeric( $attributes['bandHeight'] ?? 100, 20, 400, 100 ),
) );

$wave_style = Awesome_Squiggle_Renderer::backdrop_wave_layer_style(
	$attributes['verticalPosition'] ?? 'center',
	$attributes['verticalPositionCustom'] ?? 50,
	$attributes['bandHeight'] ?? 100
);

// get_block_wrapper_attributes() already includes the wp-block-awesome-squiggle-backdrop
// class (auto-generated from the block name) plus any alignment/spacing support classes.
$wrapper_attributes = get_block_wrapper_attributes( array(
	'class' => 'wp-block-awesome-squiggle-backdrop',
) );

printf(
	'<div %1$s><div class="asquig-backdrop__wave" aria-hidden="true" style="%2$s">%3$s</div><div class="asquig-backdrop__content">%4$s</div></div>',
	$wrapper_attributes,        // get_block_wrapper_attributes() returns escaped output.
	esc_attr( $wave_style ),
	$svg,                       // build_wave_svg() output is internally escaped.
	$content                    // InnerBlocks content already sanitized by WP.
);
