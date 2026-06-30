import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import metadata from './block.json';
import Edit from './edit';

registerBlockType( metadata.name, {
	edit: Edit,
	// Dynamic block: render.php owns ALL frontend markup (the wrapper +
	// asquig-backdrop__content divs). save() must emit ONLY the inner blocks —
	// no wrapper — otherwise render.php would wrap the already-wrapped $content
	// and the frontend output would be double-nested.
	save: () => <InnerBlocks.Content />,
} );
