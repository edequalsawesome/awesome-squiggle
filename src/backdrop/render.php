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

// get_block_wrapper_attributes() already includes the wp-block-awesome-squiggle-backdrop
// class (auto-generated from the block name) plus any alignment/spacing support classes.
$wrapper_attributes = get_block_wrapper_attributes();

// Wave layer is added in Task 4; for now just wrap the content.
// NOTE for Task 4: the decorative wave element must carry aria-hidden="true"
// (and focusable="false" if it is an SVG) so assistive tech ignores it.
printf(
	'<div %s><div class="asquig-backdrop__content">%s</div></div>',
	$wrapper_attributes, // Full attribute string; each value already escaped by WP. Safe to output.
	$content // Intentional unescaped output: $content is the rendered InnerBlocks markup (trusted block HTML). Escaping it would break nested blocks.
);
