import { registerBlockType } from '@wordpress/blocks';
import {
	useBlockProps,
	useInnerBlocksProps,
	InnerBlocks,
} from '@wordpress/block-editor';
import metadata from './block.json';

// Module-level constant so the template keeps a stable identity across renders
// (WordPress deep-compares templates, so this is a cleanliness/avoid-churn measure).
const BACKDROP_TEMPLATE = [
	[ 'core/heading', { placeholder: 'Heading with a squiggle behind it…' } ],
];

// Named (PascalCase) component so the hook calls satisfy react-hooks/rules-of-hooks.
function Edit() {
	// WordPress auto-generates the wp-block-awesome-squiggle-backdrop class from
	// the block name — passing it explicitly would duplicate it in the markup.
	const blockProps = useBlockProps();
	const innerProps = useInnerBlocksProps(
		{ className: 'asquig-backdrop__content' },
		{ template: BACKDROP_TEMPLATE }
	);
	return (
		<div { ...blockProps }>
			<div { ...innerProps } />
		</div>
	);
}

registerBlockType( metadata.name, {
	edit: Edit,
	// Dynamic block: render.php owns ALL frontend markup (the wrapper +
	// asquig-backdrop__content divs). save() must emit ONLY the inner blocks —
	// no wrapper — otherwise render.php would wrap the already-wrapped $content
	// and the frontend output would be double-nested.
	save: () => <InnerBlocks.Content />,
} );
