jest.mock( '@wordpress/blocks', () => ( { registerBlockStyle: jest.fn() } ) );
jest.mock( '@wordpress/block-editor', () => ( {
	useBlockProps: jest.fn( ( props ) => props ),
	InspectorControls: () => null,
} ) );
jest.mock( '@wordpress/components', () => ( {
	PanelBody: () => null,
	RangeControl: () => null,
	ToggleControl: () => null,
	SelectControl: () => null,
} ) );
jest.mock( '@wordpress/compose', () => ( {
	createHigherOrderComponent: ( component ) => component,
} ) );
jest.mock( '@wordpress/dom-ready', () => jest.fn() );
jest.mock( '@wordpress/hooks', () => ( { addFilter: jest.fn() } ) );
jest.mock( '@wordpress/i18n', () => ( {
	__: ( value ) => value,
	sprintf: ( value ) => value,
} ) );
jest.mock( '../backdrop', () => ( {} ) );

import { createElement, createRoot, renderToString } from '@wordpress/element';

import '../index';

const {
	useBlockProps: mockUseBlockProps,
} = require( '@wordpress/block-editor' );
const { addFilter: mockAddFilter } = require( '@wordpress/hooks' );
// eslint-disable-next-line import/no-extraneous-dependencies -- React is already installed by the WordPress test dependencies.
const { act } = require( 'react' );

global.IS_REACT_ACT_ENVIRONMENT = true;

const gradient =
	'linear-gradient(90deg, #ff0000 0%, #00ff00 20%, #0000ff 70%, #ffff00 100%)';
const separatorAttributes = {
	className: 'is-style-squiggle fixture-class',
	strokeWidth: 2,
	animationSpeed: 3,
	squiggleAmplitude: 12,
	squiggleHeight: '125px',
	animationId: 'squiggle-animation-fixture',
	isReversed: true,
	gradient,
	gradientId: 'squiggle-gradient-fixture',
	isAnimated: false,
	pointiness: 0,
	angle: 0,
};

const getFilter = ( hook, namespace ) =>
	mockAddFilter.mock.calls.find(
		( [ registeredHook, registeredNamespace ] ) =>
			registeredHook === hook && registeredNamespace === namespace
	)[ 2 ];
describe( 'editor filters', () => {
	beforeEach( () => {
		mockUseBlockProps.mockClear();
	} );

	it( 'keeps the direct legacy save output byte-stable', () => {
		const addDeprecatedSave = getFilter(
			'blocks.registerBlockType',
			'awesome-squiggle/separator-deprecated-save'
		);
		const settings = addDeprecatedSave(
			{ attributes: {}, supports: {}, deprecated: [] },
			'core/separator'
		);
		const legacySave = settings.deprecated[ 0 ].save;
		const markup = renderToString(
			legacySave( { attributes: separatorAttributes } )
		);

		expect( markup ).toMatchSnapshot();
	} );

	it( 'passes unrelated blocks through without calling separator hooks', () => {
		const withSquiggleControls = getFilter(
			'editor.BlockEdit',
			'awesome-squiggle/squiggle-controls'
		);
		const BlockEdit = () =>
			createElement( 'div', { 'data-block-edit': 'paragraph' } );
		const EnhancedBlockEdit = withSquiggleControls( BlockEdit );

		const markup = renderToString(
			createElement( EnhancedBlockEdit, {
				name: 'core/paragraph',
				attributes: {},
				setAttributes: jest.fn(),
				clientId: 'paragraph-fixture',
			} )
		);

		expect( markup ).toContain( 'data-block-edit="paragraph"' );
		expect( mockUseBlockProps ).not.toHaveBeenCalled();
	} );

	it( 'renders every parsed stop in the separator editor preview', async () => {
		const withSquiggleControls = getFilter(
			'editor.BlockEdit',
			'awesome-squiggle/squiggle-controls'
		);
		const BlockEdit = () => null;
		const EnhancedBlockEdit = withSquiggleControls( BlockEdit );

		const mountPoint = document.createElement( 'div' );
		document.body.appendChild( mountPoint );
		const root = createRoot( mountPoint );
		await act( async () => {
			root.render(
				createElement( EnhancedBlockEdit, {
					name: 'core/separator',
					attributes: separatorAttributes,
					setAttributes: jest.fn(),
					clientId: 'separator-fixture',
				} )
			);
		} );

		const stops = Array.from( mountPoint.querySelectorAll( 'stop' ) );
		expect(
			stops.map( ( stop ) => stop.getAttribute( 'stop-color' ) )
		).toEqual( [ '#ff0000', '#00ff00', '#0000ff', '#ffff00' ] );
		expect(
			stops.map( ( stop ) => stop.getAttribute( 'offset' ) )
		).toEqual( [ '0%', '20%', '70%', '100%' ] );

		await act( async () => root.unmount() );
		mountPoint.remove();
	} );

	it( 'fixes implicit positions in the separator editor preview', async () => {
		const withSquiggleControls = getFilter(
			'editor.BlockEdit',
			'awesome-squiggle/squiggle-controls'
		);
		const EnhancedBlockEdit = withSquiggleControls( () => null );
		const mountPoint = document.createElement( 'div' );
		document.body.appendChild( mountPoint );
		const root = createRoot( mountPoint );

		await act( async () => {
			root.render(
				createElement( EnhancedBlockEdit, {
					name: 'core/separator',
					attributes: {
						...separatorAttributes,
						gradient:
							'linear-gradient(90deg, #ff0000, #00ff00, #0000ff, #ffff00)',
					},
					setAttributes: jest.fn(),
					clientId: 'implicit-stop-fixture',
				} )
			);
		} );

		const offsets = Array.from( mountPoint.querySelectorAll( 'stop' ) ).map(
			( stop ) => Number.parseFloat( stop.getAttribute( 'offset' ) )
		);
		expect( offsets[ 0 ] ).toBe( 0 );
		expect( offsets[ 1 ] ).toBeCloseTo( 33.333, 3 );
		expect( offsets[ 2 ] ).toBeCloseTo( 66.667, 3 );
		expect( offsets[ 3 ] ).toBe( 100 );

		await act( async () => root.unmount() );
		mountPoint.remove();
	} );
} );
