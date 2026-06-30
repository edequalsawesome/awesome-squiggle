import { createBlock } from '@wordpress/blocks';

// __experimentalConvert is the correct API for "wrap N selected blocks into one
// container" transforms — it is how core Group, Cover, and other container blocks
// implement wrapping. The standard `transform` callback form is a 1-to-1 (or N-to-1)
// mapping but does NOT support preserving the originals as inner blocks of the new
// container. __experimentalConvert has been stable in practice since WP 5.x and is
// the documented approach for this pattern in @wordpress/blocks >= 11.
//
// Each selected block is re-created via createBlock() so that nested innerBlocks are
// preserved (shallow copy of block.innerBlocks is not sufficient for deeply nested
// selections).

const transforms = {
	from: [
		{
			type: 'block',
			blocks: [ '*' ],
			isMultiBlock: true,
			__experimentalConvert: ( blocks ) =>
				createBlock(
					'awesome-squiggle/backdrop',
					{},
					blocks.map( ( b ) =>
						createBlock( b.name, b.attributes, b.innerBlocks )
					)
				),
		},
	],
};

export default transforms;
