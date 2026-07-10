import {
	useBlockProps,
	useInnerBlocksProps,
	InspectorControls,
} from '@wordpress/block-editor';
import {
	PanelBody,
	RangeControl,
	ToggleControl,
	SelectControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { generateLongWavePath, generatePixelWavePath } from '../wave-path';
import { validateNumericInput } from '../validators';
import { parseGradientStops } from '../gradient-utils';

const SHAPES = [
	{ label: __( 'Squiggle', 'awesome-squiggle' ), value: 'squiggle' },
	{ label: __( 'Zig-Zag', 'awesome-squiggle' ), value: 'zigzag' },
	{ label: __( 'Lightning', 'awesome-squiggle' ), value: 'lightning' },
	{ label: __( 'Pixel', 'awesome-squiggle' ), value: 'pixel' },
];
const SHAPE_VALUES = [ 'squiggle', 'zigzag', 'lightning', 'pixel' ];
const POSITION_VALUES = [ 'top', 'center', 'baseline', 'custom' ];
// Note: validateStringInput() in src/validators.js takes a REGEX pattern, not
// an allow-list — so we guard these enum attributes with a simple .includes().
const oneOf = ( value, allowed, fallback ) =>
	allowed.includes( value ) ? value : fallback;

export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		shape,
		squiggleAmplitude,
		pointiness,
		angle,
		strokeWidth,
		animationSpeed,
		isAnimated,
		isReversed,
		bandHeight,
		verticalPosition,
	} = attributes;

	const set = ( updates ) => setAttributes( updates );

	const wave = useMemo( () => {
		const gen =
			shape === 'pixel' ? generatePixelWavePath : generateLongWavePath;
		return gen(
			squiggleAmplitude,
			pointiness,
			angle,
			strokeWidth,
			80,
			bandHeight
		);
		// strokeWidth is the SVG stroke-width attribute, not an input to the
		// path geometry, so it is intentionally excluded from these deps.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ shape, squiggleAmplitude, pointiness, angle, bandHeight ] );

	// Editor gradient preview: resolve the chosen gradient to real stops so the
	// wave shows the gradient in-canvas (the frontend resolves it server-side).
	// A local id derived from clientId scopes the <defs> to this block instance;
	// no need to persist a gradientId — render.php generates its own runtime id.
	const editorGradients = useSelect(
		( select ) =>
			select( 'core/block-editor' ).getSettings().gradients || [],
		[]
	);
	const customGradient =
		attributes.gradient || attributes.style?.color?.gradient;
	const gradientStops = useMemo( () => {
		if ( ! customGradient ) {
			return [];
		}
		let css = customGradient;
		if ( ! css.startsWith( 'linear-gradient(' ) ) {
			// Bare slug or var(--wp--preset--gradient--slug) → look up the CSS
			// value from the editor's registered gradient presets.
			const slug = css.startsWith( 'var(' )
				? css.match( /--wp--preset--gradient--([^)]+)\)/ )?.[ 1 ]
				: css;
			css = ( editorGradients.find( ( g ) => g.slug === slug ) || {} )
				.gradient;
		}
		return css ? parseGradientStops( css ) : [];
	}, [ customGradient, editorGradients ] );
	const editorGradientId = `asquig-backdrop-grad-${ clientId }`;
	const waveStroke =
		gradientStops.length > 0
			? `url(#${ editorGradientId })`
			: 'currentColor';

	const viewBoxWidth = wave.wavelength * 80;
	const topMap = {
		top: '0%',
		center: '50%',
		baseline: '100%',
		custom: `${ attributes.verticalPositionCustom }%`,
	};
	const translateMap = {
		top: '0',
		center: '-50%',
		baseline: '-100%',
		custom: '-50%',
	};
	// Fall back to center (the PHP default) for any unexpected position value.
	const waveTop = topMap[ verticalPosition ] ?? '50%';
	const waveTranslate = translateMap[ verticalPosition ] ?? '-50%';
	let animationName = 'none';
	if ( isAnimated ) {
		animationName = isReversed ? 'wave-flow-reverse' : 'wave-flow';
	}

	// useBlockProps() already injects wp-block-awesome-squiggle-backdrop for
	// apiVersion 3 blocks; passing it again duplicated the class token.
	const blockProps = useBlockProps();
	const innerProps = useInnerBlocksProps(
		{ className: 'asquig-backdrop__content' },
		{
			template: [
				[
					'core/heading',
					{
						placeholder: __(
							'Heading with a squiggle behind it…',
							'awesome-squiggle'
						),
					},
				],
			],
		}
	);

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Wave', 'awesome-squiggle' ) }>
					<SelectControl
						label={ __( 'Shape', 'awesome-squiggle' ) }
						value={ shape }
						options={ SHAPES }
						onChange={ ( v ) => {
							const nextShape = oneOf(
								v,
								SHAPE_VALUES,
								'squiggle'
							);
							// Apply the shape's defining geometry so the
							// preset visibly changes the wave (mirrors the
							// Separator styles' pointiness/angle mapping).
							// Deliberate preset semantics: switching shape
							// resets manually-tuned pointiness/angle.
							set( {
								shape: nextShape,
								pointiness:
									nextShape === 'zigzag' ||
									nextShape === 'lightning'
										? 100
										: 0,
								angle: nextShape === 'lightning' ? 40 : 0,
							} );
						} }
					/>
					<RangeControl
						label={ __( 'Amplitude', 'awesome-squiggle' ) }
						min={ 5 }
						max={ 25 }
						value={ squiggleAmplitude }
						onChange={ ( v ) =>
							set( {
								squiggleAmplitude: validateNumericInput(
									v,
									5,
									25,
									10
								),
							} )
						}
					/>
					<RangeControl
						label={ __( 'Pointiness', 'awesome-squiggle' ) }
						min={ 0 }
						max={ 100 }
						value={ pointiness }
						onChange={ ( v ) =>
							set( {
								pointiness: validateNumericInput(
									v,
									0,
									100,
									0
								),
							} )
						}
					/>
					<RangeControl
						label={ __( 'Angle', 'awesome-squiggle' ) }
						min={ -60 }
						max={ 60 }
						value={ angle }
						onChange={ ( v ) =>
							set( {
								angle: validateNumericInput( v, -60, 60, 0 ),
							} )
						}
					/>
					<RangeControl
						label={ __( 'Stroke width', 'awesome-squiggle' ) }
						min={ 1 }
						max={ 8 }
						value={ strokeWidth }
						onChange={ ( v ) =>
							set( {
								strokeWidth: validateNumericInput( v, 1, 8, 2 ),
							} )
						}
					/>
				</PanelBody>
				<PanelBody title={ __( 'Placement', 'awesome-squiggle' ) }>
					<SelectControl
						label={ __( 'Vertical position', 'awesome-squiggle' ) }
						value={ verticalPosition }
						options={ [
							{
								label: __( 'Top', 'awesome-squiggle' ),
								value: 'top',
							},
							{
								label: __( 'Center', 'awesome-squiggle' ),
								value: 'center',
							},
							{
								label: __( 'Baseline', 'awesome-squiggle' ),
								value: 'baseline',
							},
							{
								label: __( 'Custom', 'awesome-squiggle' ),
								value: 'custom',
							},
						] }
						onChange={ ( v ) =>
							set( {
								verticalPosition: oneOf(
									v,
									POSITION_VALUES,
									'center'
								),
							} )
						}
					/>
					{ verticalPosition === 'custom' && (
						<RangeControl
							label={ __(
								'Custom position (%)',
								'awesome-squiggle'
							) }
							min={ 0 }
							max={ 100 }
							value={ attributes.verticalPositionCustom }
							onChange={ ( v ) =>
								set( {
									verticalPositionCustom:
										validateNumericInput( v, 0, 100, 50 ),
								} )
							}
						/>
					) }
					<RangeControl
						label={ __( 'Band height', 'awesome-squiggle' ) }
						min={ 20 }
						max={ 400 }
						value={ bandHeight }
						onChange={ ( v ) =>
							set( {
								bandHeight: validateNumericInput(
									v,
									20,
									400,
									100
								),
							} )
						}
					/>
					<p className="components-base-control__help">
						{ __(
							'A busy wave behind text needs enough contrast to stay readable.',
							'awesome-squiggle'
						) }
					</p>
				</PanelBody>
				<PanelBody title={ __( 'Animation', 'awesome-squiggle' ) }>
					<ToggleControl
						label={ __( 'Animate', 'awesome-squiggle' ) }
						checked={ isAnimated }
						onChange={ ( v ) => set( { isAnimated: !! v } ) }
					/>
					{ isAnimated && (
						<>
							<RangeControl
								label={ __( 'Speed (s)', 'awesome-squiggle' ) }
								min={ 0.5 }
								max={ 5 }
								step={ 0.5 }
								value={ animationSpeed }
								onChange={ ( v ) =>
									set( {
										animationSpeed: validateNumericInput(
											v,
											0.5,
											5,
											2.5
										),
									} )
								}
							/>
							<ToggleControl
								label={ __(
									'Reverse direction',
									'awesome-squiggle'
								) }
								checked={ isReversed }
								onChange={ ( v ) =>
									set( { isReversed: !! v } )
								}
							/>
						</>
					) }
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				<div
					className="asquig-backdrop__wave"
					aria-hidden="true"
					style={ {
						position: 'absolute',
						left: 0,
						right: 0,
						top: waveTop,
						height: `${ bandHeight }px`,
						transform: `translateY(${ waveTranslate })`,
						zIndex: 0,
						overflow: 'hidden',
						pointerEvents: 'none',
					} }
				>
					<svg
						viewBox={ `0 0 ${ viewBoxWidth } ${ wave.height }` }
						preserveAspectRatio="xMinYMid slice"
						aria-hidden="true"
						focusable="false"
						style={ {
							width: '100%',
							height: '100%',
							display: 'block',
						} }
					>
						{ gradientStops.length > 0 && (
							<defs>
								<linearGradient
									id={ editorGradientId }
									gradientUnits="userSpaceOnUse"
									spreadMethod="reflect"
									x1="0"
									y1="0"
									x2="40"
									y2="0"
								>
									{ gradientStops.map( ( stop, i ) => (
										<stop
											key={ i }
											offset={ stop.offset }
											stopColor={ stop.color }
										/>
									) ) }
								</linearGradient>
							</defs>
						) }
						<path
							d={ wave.d }
							fill="none"
							stroke={ waveStroke }
							strokeWidth={ strokeWidth }
							strokeLinecap="round"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
							className="wave-path"
							style={ {
								animation: isAnimated
									? `${ animationName } ${ animationSpeed }s linear infinite`
									: 'none',
							} }
						/>
					</svg>
				</div>
				<div { ...innerProps } />
			</div>
		</>
	);
}
