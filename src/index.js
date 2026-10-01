import { registerBlockStyle } from '@wordpress/blocks';
import {
	useBlockProps,
	InspectorControls,
	store as blockEditorStore,
	getGradientValueBySlug,
} from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import {
	PanelBody,
	RangeControl,
	ToggleControl,
	SelectControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useEffect, useMemo } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import './style.css';
import './backdrop';

import {
	debugLog,
	validateNumericInput,
	validateStringInput,
	validateId,
	validateColorValue,
} from './validators';

import { generateLongWavePath, generatePixelWavePath } from './wave-path';
import {
	parseGradientStops,
	presetSlugFromGradientValue,
	isParserSafeGradientCss,
} from './gradient-utils';

// Cache for resolved CSS variable values — avoids repeated DOM element creation
const resolvedCssVarCache = new Map();

// Animation speed conversion: slider (1-10) ↔ CSS duration (0.5s-5s)
// Higher slider value = faster animation = shorter duration
const sliderToDuration = ( slider ) => ( 11 - slider ) * 0.5;
const durationToSlider = ( duration ) => Math.round( 11 - duration / 0.5 );

// Attribute setter with validation and clamping
const setSecureAttributes = ( setAttributes, updates ) => {
	const secureUpdates = {};

	for ( const [ key, value ] of Object.entries( updates ) ) {
		switch ( key ) {
			case 'strokeWidth':
				secureUpdates[ key ] = validateNumericInput( value, 1, 8, 1 );
				break;
			case 'animationSpeed':
				secureUpdates[ key ] = sliderToDuration(
					validateNumericInput( value, 1, 10, 6 )
				);
				break;
			case 'squiggleAmplitude':
				// Amplitude range for squiggle/zigzag waves
				secureUpdates[ key ] = validateNumericInput( value, 5, 25, 10 );
				break;
			case 'pointiness':
				// Pointiness range: 0 (smooth curves) to 100 (sharp angles)
				secureUpdates[ key ] = validateNumericInput( value, 0, 100, 0 );
				break;
			case 'angle':
				// Angle range: -60 to +60 degrees
				secureUpdates[ key ] = validateNumericInput(
					value,
					-60,
					60,
					0
				);
				break;
			case 'animationRepeat':
				secureUpdates[ key ] = value === 'once' ? 'once' : 'loop';
				break;
			case 'isAnimated':
				secureUpdates[ key ] = value === true;
				break;
			case 'animationId':
				secureUpdates[ key ] = validateId( value );
				break;
			case 'gradientId':
				secureUpdates[ key ] = validateId( value );
				break;
			case 'squiggleHeight': {
				// Validate against allowed height values
				const allowedHeights = [
					'50px',
					'75px',
					'100px',
					'125px',
					'150px',
					'200px',
				];
				secureUpdates[ key ] = allowedHeights.includes( value )
					? value
					: '100px';
				break;
			}
			case 'isReversed':
				secureUpdates[ key ] = value === true;
				break;
			case 'gradient':
				// Allow linear/radial gradients, WP preset vars, and known slugs
				if (
					typeof value === 'string' &&
					( /^linear-gradient\(/.test( value ) ||
						/^var\(--wp--preset--gradient--[a-zA-Z0-9-]+\)$/.test(
							value
						) ||
						/^[a-zA-Z0-9-]+$/.test( value ) )
				) {
					secureUpdates[ key ] = value;
				}
				break;
			default:
				// Intentional passthrough: attributes not listed above (e.g., WordPress
				// core attrs like className, align) are passed without extra validation.
				// These are either validated by WordPress itself or are non-security-sensitive.
				secureUpdates[ key ] = value;
		}
	}

	setAttributes( secureUpdates );
};

// Debug logging
debugLog( '🌊 Awesome Squiggle plugin loaded!' );

// Generate deterministic animation ID for each block instance
const generateAnimationId = (
	patternType = 'squiggle',
	clientId = '',
	strokeWidth = 1,
	amplitude = 10
) => {
	// Create deterministic ID based on block characteristics
	const baseId = `${ patternType }-animation`;
	// Use a simple hash of the key characteristics
	const idString = `${ patternType }-${ strokeWidth }-${ amplitude }-${ clientId }`;
	let hash = 0;
	for ( let i = 0; i < idString.length; i++ ) {
		hash = ( hash << 5 ) - hash + idString.charCodeAt( i );
		hash = hash & hash;
	}
	const suffix = Math.abs( hash ).toString( 36 ).substring( 0, 6 );
	const id = `${ baseId }-${ suffix }`;
	return validateId( id );
};

// Generate deterministic gradient ID to ensure save function stability
const generateGradientId = (
	patternType = 'squiggle',
	gradient = '',
	clientId = ''
) => {
	// Use a fixed counter approach to ensure uniqueness but determinism
	// This will be set once when gradient is first applied and then remain stable
	const baseId = `${ patternType }-gradient`;
	// Create a deterministic suffix that includes clientId for uniqueness
	let suffix = '';
	// Combine gradient and clientId for unique hash per block instance
	const hashInput = `${ gradient }-${ clientId }`;
	let hash = 0;
	for ( let i = 0; i < hashInput.length; i++ ) {
		hash = ( hash << 5 ) - hash + hashInput.charCodeAt( i );
		hash = hash & hash;
	}
	suffix = Math.abs( hash ).toString( 36 ).substring( 0, 8 );
	const id = `${ baseId }-${ suffix }`;
	return validateId( id );
};

// WordPress default gradients mapping with optimized versions
const wpDefaultGradients = {
	'vivid-cyan-blue-to-vivid-purple':
		'linear-gradient(135deg,rgba(6,147,227,1) 0%,rgb(155,81,224) 100%)',
	'light-green-cyan-to-vivid-green-cyan':
		'linear-gradient(135deg,rgb(122,220,180) 0%,rgb(0,208,130) 100%)',
	'luminous-vivid-amber-to-luminous-vivid-orange':
		'linear-gradient(135deg,rgba(252,185,0,1) 0%,rgba(255,105,0,1) 100%)',
	'luminous-vivid-orange-to-vivid-red':
		'linear-gradient(135deg,rgba(255,105,0,1) 0%,rgb(207,46,46) 100%)',
	'very-light-gray-to-cyan-bluish-gray':
		'linear-gradient(135deg,rgb(238,238,238) 0%,rgb(169,184,195) 100%)',
	'cool-to-warm-spectrum':
		'linear-gradient(135deg,rgb(74,234,220) 0%,rgb(238,44,130) 50%,rgb(254,248,76) 100%)', // Optimized to 3 stops
	'blush-light-purple':
		'linear-gradient(135deg,rgb(255,206,236) 0%,rgb(152,150,240) 100%)',
	'blush-bordeaux':
		'linear-gradient(135deg,rgb(254,205,165) 0%,rgb(254,45,45) 50%,rgb(107,0,62) 100%)',
	'luminous-dusk':
		'linear-gradient(135deg,rgb(255,203,112) 0%,rgb(199,81,192) 50%,rgb(65,88,208) 100%)',
	'pale-ocean':
		'linear-gradient(135deg,rgb(255,245,203) 0%,rgb(182,227,212) 50%,rgb(51,167,181) 100%)',
	'electric-grass':
		'linear-gradient(135deg,rgb(202,248,128) 0%,rgb(113,206,126) 100%)',
	midnight: 'linear-gradient(135deg,rgb(2,3,129) 0%,rgb(40,116,252) 100%)',
};

// Editor-preview-only fast path: answer a preset gradient from the editor's own
// settings instead of creating a throwaway element and forcing a style recalc.
//
// This deliberately does NOT live inside resolveGradientToCss(). That resolver is
// also reached by deprecatedFullSvgSave(), whose whole job is regenerating
// byte-identical markup so block validation recognises existing posts. Authored
// CSS and computed CSS differ in spacing and color format, so routing the legacy
// path through this would invalidate saved blocks on open.
// The palette is passed in rather than read from the store here, so the caller
// can subscribe to it. Reading it imperatively inside a useMemo would leave the
// preview stale when the palette changes but the gradient value does not.
const resolvePresetGradientForPreview = ( value, gradients ) => {
	const slug = presetSlugFromGradientValue( value );
	if ( ! slug ) {
		return null;
	}

	if ( ! Array.isArray( gradients ) ) {
		return null;
	}

	const css = getGradientValueBySlug( gradients, slug );
	return isParserSafeGradientCss( css ) ? css : null;
};

// Resolve a gradient slug/var/custom to a concrete CSS linear-gradient string when possible
const resolveGradientToCss = ( input ) => {
	if ( ! input ) {
		return null;
	}

	const value = String( input ).trim();

	// If it's a bare slug (no var()/gradient()) try the preset var first
	const looksLikeSlug =
		! value.includes( 'gradient(' ) && ! value.startsWith( 'var(' );
	if ( looksLikeSlug ) {
		// Attempt to resolve via computed style for theme-defined preset
		const varRef = `var(--wp--preset--gradient--${ value })`;
		const resolved = resolveCssVarBackgroundImage( varRef );
		if ( resolved ) {
			return resolved;
		}

		// Fallback to our known defaults map
		if ( wpDefaultGradients[ value ] ) {
			return wpDefaultGradients[ value ];
		}
	}

	// If it's a CSS var for a preset, resolve it via computed style
	if ( value.startsWith( 'var(--wp--preset--gradient--' ) ) {
		const resolved = resolveCssVarBackgroundImage( value );
		if ( resolved ) {
			return resolved;
		}

		// As a fallback, extract slug and map if we know it
		const m = value.match( /var\(--wp--preset--gradient--([^)]+)\)/ );
		if ( m && wpDefaultGradients[ m[ 1 ] ] ) {
			return wpDefaultGradients[ m[ 1 ] ];
		}
	}

	// If it's already a concrete linear-gradient, return as-is
	if ( value.startsWith( 'linear-gradient(' ) ) {
		return value;
	}

	return null;
};

// Helper: resolve a CSS background-image using computed styles
const resolveCssVarBackgroundImage = ( css ) => {
	if ( typeof window === 'undefined' || ! window.document ) {
		return null;
	}
	if ( resolvedCssVarCache.has( css ) ) {
		return resolvedCssVarCache.get( css );
	}
	// Only allow CSS var() references and gradient functions — reject anything else
	if ( ! /^(var\(|linear-gradient\(|radial-gradient\()/.test( css ) ) {
		return null;
	}
	if ( /url\s*\(/i.test( css ) ) {
		return null;
	}

	const el = document.createElement( 'div' );
	el.style.position = 'absolute';
	el.style.left = '-9999px';
	el.style.top = '-9999px';
	el.style.width = '1px';
	el.style.height = '1px';
	el.style.backgroundImage = css;

	try {
		document.body.appendChild( el );
		const computed = getComputedStyle( el ).backgroundImage;
		if ( computed && computed !== 'none' ) {
			resolvedCssVarCache.set( css, computed );
			return computed;
		}
		resolvedCssVarCache.set( css, null );
		return null;
	} catch ( e ) {
		return null;
	} finally {
		if ( el.parentNode ) {
			el.parentNode.removeChild( el );
		}
	}
};

// Simple gradient parser for basic linear gradients
// legacyStopParsing: used ONLY by deprecatedFullSvgSave() — reproduces the
// historical (buggy) stop extraction so old direct deprecated-save output
// stays byte-identical. New rendering paths use the shared current parser.
const parseGradient = ( gradientInput, legacyStopParsing = false ) => {
	if ( ! gradientInput ) {
		return {
			type: 'linear',
			stops: [
				{ color: '#667eea', offset: '0%' },
				{ color: '#764ba2', offset: '100%' },
			],
		};
	}

	// First, normalize/resolve to a concrete linear-gradient when possible
	let gradientString =
		resolveGradientToCss( gradientInput ) || String( gradientInput );

	if ( ! gradientString ) {
		return null;
	}

	// If it's still a var reference at this point and couldn't be resolved, try our mapping or fallback.
	if ( gradientString.startsWith( 'var(--wp--preset--gradient--' ) ) {
		const m = gradientString.match(
			/var\(--wp--preset--gradient--([^)]+)\)/
		);
		if ( m && wpDefaultGradients[ m[ 1 ] ] ) {
			gradientString = wpDefaultGradients[ m[ 1 ] ];
		} else {
			return {
				type: 'linear',
				stops: [
					{ color: '#667eea', offset: '0%' },
					{ color: '#764ba2', offset: '100%' },
				],
			};
		}
	}

	if ( ! legacyStopParsing ) {
		const stops = parseGradientStops( gradientString );
		if ( stops.length >= 2 ) {
			return { type: 'linear', stops };
		}
		return parseGradient( null );
	}

	// Handle CSS linear-gradient syntax - improved regex to handle nested parentheses
	const linearMatch = gradientString.match( /linear-gradient\((.*)\)$/ );
	if ( linearMatch ) {
		const content = linearMatch[ 1 ];
		debugLog( '🔍 Parsing gradient content:', content );

		// Split by commas but be careful about commas inside rgb() functions
		const parts = [];
		let currentPart = '';
		let parenDepth = 0;

		for ( let i = 0; i < content.length; i++ ) {
			const char = content[ i ];
			if ( char === '(' ) {
				parenDepth++;
			}
			if ( char === ')' ) {
				parenDepth--;
			}

			if ( char === ',' && parenDepth === 0 ) {
				parts.push( currentPart.trim() );
				currentPart = '';
			} else {
				currentPart += char;
			}
		}
		if ( currentPart.trim() ) {
			parts.push( currentPart.trim() );
		}

		debugLog( '🔍 Gradient parts:', parts );

		const stops = [];

		// Process each part to extract color and percentage.
		// Parts without a color token (direction tokens like "135deg" /
		// "to bottom") are skipped. Checking for the color FIRST — instead of
		// substring-matching "deg" — keeps valid stops like
		// hsl(30deg 100% 50%) from being dropped.
		for ( const part of parts ) {
			if (
				legacyStopParsing &&
				( part.includes( 'deg' ) || part.includes( 'to ' ) )
			) {
				// Historical behavior: any part containing "deg"/"to " was
				// treated as a direction token and dropped.
				continue;
			}

			const colorMatch = part.match(
				/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/
			);

			if ( colorMatch ) {
				const color = colorMatch[ 1 ];
				// Match the stop position in the part WITH THE COLOR REMOVED,
				// so percentages inside the color function (rgb(100% 0% 0%))
				// are not mistaken for the offset. Supports decimal offsets.
				// (Legacy mode keeps the historical whole-part integer match.)
				const remainder = legacyStopParsing
					? part
					: part.replace( color, '' );
				const percentMatch = legacyStopParsing
					? part.match( /(\d+%)/ )
					: remainder.match( /(\d+(?:\.\d+)?%)/ );
				const offset = percentMatch
					? percentMatch[ 1 ]
					: stops.length === 0
					? '0%'
					: '100%';
				stops.push( { color, offset } );
				debugLog( '🔍 Found stop:', { color, offset } );
			}
		}

		if ( stops.length >= 2 ) {
			// The direct deprecated-save function retains its historical lossy
			// parsing so its old output stays byte-identical.
			let finalStops = stops;
			if ( legacyStopParsing && stops.length > 3 ) {
				// Keep first, middle, and last stops for smooth performance
				const firstStop = stops[ 0 ];
				const middleIndex = Math.floor( stops.length / 2 );
				const middleStop = stops[ middleIndex ];
				const lastStop = stops[ stops.length - 1 ];

				finalStops = [
					firstStop,
					{ ...middleStop, offset: '50%' }, // Normalize middle to 50%
					lastStop,
				];
				debugLog(
					'🔍 Simplified gradient from',
					stops.length,
					'to',
					finalStops.length,
					'stops'
				);
			}

			debugLog( '🔍 Returning parsed stops:', finalStops );
			return {
				type: 'linear',
				stops: finalStops,
			};
		}

		debugLog( '🔍 Fallback: not enough stops found' );
	}

	// Fallback for any other format
	return {
		type: 'linear',
		stops: [
			{ color: '#667eea', offset: '0%' },
			{ color: '#764ba2', offset: '100%' },
		],
	};
};

// Exact class token check — matches the PHP has_class() helper
const hasClass = ( className, target ) =>
	typeof className === 'string' &&
	className.split( /\s+/ ).includes( target );

const isSquiggleStyle = ( className ) =>
	hasClass( className, 'is-style-squiggle' );
const isZigzagStyle = ( className ) => hasClass( className, 'is-style-zigzag' );
const isLightningStyle = ( className ) =>
	hasClass( className, 'is-style-lightning' );
const isPixelStyle = ( className ) => hasClass( className, 'is-style-pixel' );

// Extract color information from WordPress classes.
// Priority: background-color classes first, then text-color.
// This matches the resolve_line_color() priority chain in the PHP renderer
// where background takes precedence over text color for separator strokes.
const extractColorFromClassName = ( classNameStr ) => {
	if ( ! classNameStr ) {
		return null;
	}

	// Look for background color classes (has-{color}-background-color)
	const bgColorMatch = classNameStr.match(
		/has-([a-zA-Z0-9-]+)-background-color/
	);
	if ( bgColorMatch ) {
		const colorSlug = bgColorMatch[ 1 ];
		return `var(--wp--preset--color--${ colorSlug })`;
	}

	// Look for text color classes (has-{color}-color)
	const textColorMatch = classNameStr.match(
		/has-([a-zA-Z0-9-]+)-color(?!\s*background)/
	);
	if ( textColorMatch ) {
		const colorSlug = textColorMatch[ 1 ];
		return `var(--wp--preset--color--${ colorSlug })`;
	}

	return null;
};

// Get the display name for the current wave style
const getStyleName = ( className ) => {
	if ( isPixelStyle( className ) ) {
		return __( 'pixel', 'awesome-squiggle' );
	}
	if ( isLightningStyle( className ) ) {
		return __( 'lightning', 'awesome-squiggle' );
	}
	if ( isZigzagStyle( className ) ) {
		return __( 'zig-zag', 'awesome-squiggle' );
	}
	return __( 'squiggle', 'awesome-squiggle' );
};

// Helper function to check if current style is any custom style
const isCustomStyle = ( className ) => {
	return (
		isSquiggleStyle( className ) ||
		isZigzagStyle( className ) ||
		isLightningStyle( className ) ||
		isPixelStyle( className )
	);
};

// Add squiggle-specific attributes and gradient support to separator block
addFilter(
	'blocks.registerBlockType',
	'awesome-squiggle/separator-squiggle-attributes',
	( settings, name ) => {
		if ( name !== 'core/separator' ) {
			return settings;
		}

		// Enable gradient support for separators and add our attributes
		return {
			...settings,
			supports: {
				...settings.supports,
				color: {
					...settings.supports?.color,
					gradients: true, // Enable gradient support
				},
			},
			attributes: {
				...settings.attributes,
				// NEW: Parametric wave controls
				pointiness: {
					type: 'number',
					default: undefined, // Set by style selection (0 for squiggle, 100 for zigzag/lightning)
				},
				angle: {
					type: 'number',
					default: undefined, // Set by style selection (0 for squiggle/zigzag, 40 for lightning)
				},
				// NEW: Animation playback control (replaces style-based animated/static)
				isAnimated: {
					type: 'boolean',
					default: true, // Animation on by default
				},
				animationRepeat: { type: 'string', default: 'loop' },
				// EXISTING: Core wave attributes
				strokeWidth: {
					type: 'number',
					default: undefined,
				},
				animationSpeed: {
					type: 'number',
					default: undefined,
				},
				squiggleAmplitude: {
					type: 'number',
					default: undefined,
				},
				squiggleHeight: {
					type: 'string',
					default: undefined,
				},
				animationId: {
					type: 'string',
					default: undefined,
				},
				isReversed: {
					type: 'boolean',
					default: undefined,
				},
				gradientId: {
					type: 'string',
					default: undefined,
				},
			},
		};
	},
	20
);

// Enhanced separator edit component
const withSquiggleControls = createHigherOrderComponent( ( BlockEdit ) => {
	const SquiggleEdit = ( props ) => {
		const { attributes, setAttributes, clientId } = props;

		// This component is rendered only for core/separator. Keeping its hooks
		// here lets the HOC wrapper pass ordinary blocks through without hooks.

		// Pre-calculate values needed for useBlockProps
		const {
			className = '',
			squiggleHeight = '100px',
			animationSpeed = 2.5,
			isReversed = false,
			// NEW: Parametric wave controls (with defaults based on style)
			isAnimated: isAnimatedAttr,
			animationRepeat = 'loop',
			pointiness: pointinessAttr,
			angle: angleAttr,
		} = attributes || {};

		const isSquiggle = isSquiggleStyle( className );
		const isZigzag = isZigzagStyle( className );
		const isLightning = isLightningStyle( className );
		const isPixel = isPixelStyle( className );
		const isCustom = isCustomStyle( className );

		// Determine animation state from attribute (defaults to true)
		const isAnimated = isAnimatedAttr !== undefined ? isAnimatedAttr : true;

		// Calculate effective pointiness and angle based on style (defaults if not set)
		const effectivePointiness =
			pointinessAttr !== undefined
				? pointinessAttr
				: isZigzag || isLightning
				? 100
				: 0;
		const effectiveAngle =
			angleAttr !== undefined ? angleAttr : isLightning ? 40 : 0;

		// Determine if animation should be paused
		const finalPaused = ! isAnimated;

		// Calculate animation name (unified for all wave types)
		const animationName = finalPaused
			? 'none'
			: isReversed
			? 'wave-flow-reverse'
			: 'wave-flow';

		// useBlockProps must be called unconditionally
		const blockProps = useBlockProps( {
			className: isCustom
				? `wp-block-separator awesome-squiggle-wave ${ className }`.trim()
				: '',
			style: isCustom
				? {
						height: squiggleHeight,
						backgroundColor: 'transparent',
						minHeight: '50px',
						[ `--animation-duration` ]: `${ animationSpeed }s`,
						[ `--animation-name` ]: animationName,
				  }
				: {},
		} );

		// Create a wrapper for setAttributes to intercept gradient changes
		const setAttributesWithGradientCheck = ( updates ) => {
			const newUpdates = { ...updates };

			// Check if gradient is being set or changed
			if ( updates.gradient || updates.style?.color?.gradient ) {
				const newGradient =
					updates.gradient || updates.style?.color?.gradient;
				const currentGradient =
					attributes.gradient || attributes.style?.color?.gradient;
				const isZigzagForGradient = isZigzagStyle(
					attributes?.className
				);

				// Generate new gradient ID if:
				// 1. No gradient ID exists, OR
				// 2. The gradient content has changed
				if (
					newGradient &&
					( ! attributes?.gradientId ||
						newGradient !== currentGradient )
				) {
					const newGradientId = generateGradientId(
						isZigzagForGradient ? 'zigzag' : 'squiggle',
						newGradient,
						clientId
					);
					newUpdates.gradientId = newGradientId;
					debugLog(
						'🎨 Generated new gradient ID for gradient change:',
						{
							oldGradient: currentGradient,
							newGradient,
							oldId: attributes?.gradientId,
							newId: newGradientId,
						}
					);
				}
			}

			// Route through validation before setting
			setSecureAttributes( setAttributes, newUpdates );
		};

		const {
			strokeWidth,
			squiggleAmplitude,
			animationId,
			textColor,
			customTextColor,
			backgroundColor,
			customBackgroundColor,
			style,
			gradient,
			gradientId,
		} = attributes;

		// Note: The following 3 useEffect hooks are intentionally separate.
		// Each has distinct dependency arrays and triggering conditions — merging
		// them would cause expensive operations (ID generation, class cleanup) to
		// run on unrelated attribute changes.

		// Clear resolved CSS var cache on mount — theme/global style changes
		// trigger a full editor reload, so clearing on mount is sufficient.
		useEffect( () => {
			resolvedCssVarCache.clear();
		}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

		// Initialize custom block attributes via effect (not during render)
		useEffect( () => {
			if ( ! isCustom ) {
				return;
			}

			const batchUpdates = {};
			const patternType = isPixel
				? 'pixel'
				: isLightning
				? 'lightning'
				: isZigzag
				? 'zigzag'
				: 'squiggle';

			if ( strokeWidth === undefined ) {
				// Full initialization for new blocks
				const defaultAmplitude = isZigzag || isLightning ? 15 : 10;
				const defaultPointiness = isZigzag || isLightning ? 100 : 0;
				const defaultAngle = isLightning ? 40 : 0;
				const currentGradient =
					gradient || style?.color?.gradient || '';

				Object.assign( batchUpdates, {
					strokeWidth: isPixel ? 2 : 1,
					animationSpeed: 6,
					squiggleAmplitude: defaultAmplitude,
					squiggleHeight: '100px',
					animationId: generateAnimationId(
						patternType,
						clientId,
						1,
						defaultAmplitude
					),
					isReversed: false,
					gradientId: generateGradientId(
						patternType,
						currentGradient,
						clientId
					),
					pointiness: defaultPointiness,
					angle: defaultAngle,
				} );
			} else {
				// Ensure IDs exist for existing blocks
				if ( ! animationId ) {
					const defaultAmplitude = isZigzag || isLightning ? 15 : 10;
					batchUpdates.animationId = generateAnimationId(
						patternType,
						clientId,
						strokeWidth || 1,
						squiggleAmplitude || defaultAmplitude
					);
				}
				if ( ! gradientId ) {
					const currentGradientForId =
						gradient || style?.color?.gradient || '';
					batchUpdates.gradientId = generateGradientId(
						patternType,
						currentGradientForId,
						clientId
					);
				}
				// Regenerate gradient ID when switching between squiggle and zigzag
				if (
					gradientId &&
					( ( isSquiggle && gradientId.includes( 'zigzag' ) ) ||
						( isZigzag && gradientId.includes( 'squiggle' ) ) )
				) {
					const currentGradientForId =
						gradient || style?.color?.gradient || '';
					batchUpdates.gradientId = generateGradientId(
						patternType,
						currentGradientForId,
						clientId
					);
					debugLog(
						'🔄 Regenerated gradient ID for style switch:',
						batchUpdates.gradientId
					);
				}
			}

			if ( Object.keys( batchUpdates ).length > 0 ) {
				setSecureAttributes( setAttributes, batchUpdates );
			}
		}, [
			isCustom,
			strokeWidth,
			animationId,
			gradientId,
			isSquiggle,
			isZigzag,
			isLightning,
			isPixel,
			clientId,
		] ); // eslint-disable-line react-hooks/exhaustive-deps

		// Ensure gradient ID exists when gradient is present
		useEffect( () => {
			const customGradient = gradient || style?.color?.gradient;
			if ( isCustom && customGradient && ! gradientId ) {
				const newGradientId = generateGradientId(
					isZigzag ? 'zigzag' : 'squiggle',
					customGradient,
					clientId
				);
				setSecureAttributes( setAttributes, {
					gradientId: newGradientId,
				} );
				debugLog(
					'🆕 Generated gradient ID for existing gradient:',
					newGradientId
				);
			}
		}, [
			isCustom,
			gradient,
			style?.color?.gradient,
			gradientId,
			isZigzag,
			setAttributes,
		] );

		// Remove this overly aggressive duplicate check that runs too often
		// and causes gradient IDs to regenerate during block validation

		// Get line color for editor preview - same priority order as save function
		let lineColor = 'currentColor';
		let editorLineColor = 'currentColor';
		let finalGradient = null;

		if ( isCustom ) {
			debugLog( '🎨 DEBUG: Color attributes:', {
				backgroundColor,
				customBackgroundColor,
				textColor,
				customTextColor,
				style,
				className,
				gradient,
			} );
			debugLog( '🎨 DEBUG: Pattern type:', {
				isSquiggle,
				isZigzag,
				gradientId,
			} );

			// Check if gradient should be used - check all possible gradient sources
			const customGradient = gradient || style?.color?.gradient;

			if ( customGradient ) {
				finalGradient = customGradient;
				// Use gradient ID if available; the initialization effect will generate one if missing
				if ( gradientId ) {
					editorLineColor = `url(#${ gradientId })`;
				} else {
					editorLineColor = 'currentColor';
				}
				debugLog(
					'🎨 GRADIENT DEBUG: Using gradient:',
					customGradient
				);
				debugLog(
					'🎨 GRADIENT ID for',
					isZigzag ? 'ZIGZAG' : 'SQUIGGLE',
					':',
					gradientId
				);
			} else {
				// Use solid color logic with validation to prevent injection
				if ( backgroundColor ) {
					lineColor = validateColorValue(
						`var(--wp--preset--color--${ backgroundColor })`
					);
				} else if ( customBackgroundColor ) {
					lineColor = validateColorValue( customBackgroundColor );
				} else if ( style?.color?.background ) {
					lineColor = validateColorValue( style.color.background );
				} else {
					const classNameColor =
						extractColorFromClassName( className );
					if ( classNameColor ) {
						lineColor = validateColorValue( classNameColor );
					} else if ( textColor ) {
						lineColor = validateColorValue(
							`var(--wp--preset--color--${ textColor })`
						);
					} else if ( customTextColor ) {
						lineColor = validateColorValue( customTextColor );
					} else if ( style?.color?.text ) {
						lineColor = validateColorValue( style.color.text );
					}
				}
				editorLineColor = lineColor;
			}

			debugLog(
				'🎨 Final editor color:',
				editorLineColor,
				'Gradient:',
				finalGradient
			);
		}

		// Clean up stale is-paused class via effect (not during render)
		useEffect( () => {
			if (
				className &&
				className.includes( 'is-paused' ) &&
				! finalPaused
			) {
				const cleanClassName = className
					.replace( /\bis-paused\b/g, '' )
					.replace( /\s+/g, ' ' )
					.trim();
				setAttributes( { className: cleanClassName } );
			}
		}, [ className, finalPaused, setAttributes ] );

		// Memoize SVG path generation — must be called unconditionally (React hooks rules)
		const effectiveAmplitude = squiggleAmplitude || 15;
		const effectiveStrokeWidth = strokeWidth || 1;
		const containerHeight = parseInt( squiggleHeight, 10 ) || 100;

		const wavePathData = useMemo( () => {
			const generator = isPixel
				? generatePixelWavePath
				: generateLongWavePath;
			return generator(
				effectiveAmplitude,
				effectivePointiness,
				effectiveAngle,
				effectiveStrokeWidth,
				80,
				containerHeight
			);
		}, [
			effectiveAmplitude,
			effectivePointiness,
			effectiveAngle,
			effectiveStrokeWidth,
			containerHeight,
			isPixel,
		] );

		// Memoize gradient parsing to avoid re-parsing on every render
		// Subscribed, not read imperatively: switching theme or editing global
		// styles changes the palette while the block's own gradient value stays
		// the same, and the preview has to follow.
		const editorGradients = useSelect(
			( s ) => s( blockEditorStore ).getSettings()?.gradients,
			[]
		);

		const parsedGradientData = useMemo( () => {
			if ( ! finalGradient ) {
				return null;
			}

			// Presets resolve from settings; everything else (and any authored
			// form our parser handles differently from the computed one) falls
			// through to the original resolution path.
			const preset = resolvePresetGradientForPreview(
				finalGradient,
				editorGradients
			);
			return parseGradient( preset || finalGradient );
		}, [ finalGradient, editorGradients ] );

		// If not a custom style, just return the normal block edit but still use our gradient wrapper
		if ( ! isCustom ) {
			return (
				<BlockEdit
					{ ...props }
					setAttributes={ setAttributesWithGradientCheck }
				/>
			);
		}

		const { d: wavePath, height: waveHeight, wavelength } = wavePathData;
		const viewBoxWidth = wavelength * 80;

		return (
			<>
				{ /*
				 * WORKAROUND: Render the original BlockEdit in a hidden wrapper.
				 * This preserves WordPress's built-in color, gradient, and alignment
				 * controls (which live inside BlockEdit) while we render our own
				 * SVG preview. There is no cleaner Gutenberg extension point for
				 * replacing the visual output while keeping the inspector controls.
				 * If a better API becomes available, this should be replaced.
				 */ }
				<div style={ { display: 'none' } } aria-hidden="true">
					<BlockEdit
						{ ...props }
						setAttributes={ setAttributesWithGradientCheck }
					/>
				</div>
				<div { ...blockProps }>
					<div
						className="awesome-squiggle-editor-preview"
						style={ {
							width: '100%',
							height: '100%',
							backgroundColor: 'transparent',
							display: 'flex',
							alignItems: 'center',
							overflow: 'hidden',
						} }
					>
						<svg
							key={ `svg-${ gradientId || 'default' }-${
								animationId || 'default'
							}-${ finalPaused ? 'off' : animationRepeat }` }
							viewBox={ `0 0 ${ viewBoxWidth } ${ waveHeight }` }
							preserveAspectRatio="xMinYMid slice"
							aria-hidden="true"
							focusable="false"
							style={ {
								width: '100%',
								height: '100%',
								display: 'block',
							} }
						>
							<defs>
								{ /* Gradient definition if using gradient stroke */ }
								{ finalGradient &&
									gradientId &&
									( () => {
										debugLog(
											'🎨 LONG PATH GRADIENT DATA:',
											parsedGradientData
										);
										// Use userSpaceOnUse with reflect for smooth color transitions
										// Gradient span of 40px = one half of reflection cycle
										// Full reflection cycle = 80px = animation distance
										// This ensures seamless looping with smooth color oscillation
										const gradientSpan = 40;
										return (
											<linearGradient
												id={ gradientId }
												gradientUnits="userSpaceOnUse"
												spreadMethod="reflect"
												x1="0"
												y1="0"
												x2={ gradientSpan }
												y2="0"
											>
												{ parsedGradientData?.stops
													?.length > 0
													? parsedGradientData.stops.map(
															( stop, index ) => (
																<stop
																	key={
																		index
																	}
																	offset={
																		stop.offset
																	}
																	stopColor={
																		stop.color
																	}
																/>
															)
													  )
													: [
															<stop
																key="fallback-0"
																offset="0%"
																stopColor="#ff6b35"
															/>,
															<stop
																key="fallback-1"
																offset="100%"
																stopColor="#f7931e"
															/>,
													  ] }
											</linearGradient>
										);
									} )() }
							</defs>
							{ /* Long continuous path - animation shifts by exactly 1 wavelength */ }
							<path
								d={ wavePath }
								fill="none"
								stroke={ editorLineColor }
								strokeWidth={ effectiveStrokeWidth }
								strokeLinecap="round"
								strokeLinejoin="round"
								vectorEffect="non-scaling-stroke"
								className={ `wave-path wave-path-${
									animationId || 'default'
								}` }
								style={ {
									animation: finalPaused
										? 'none'
										: `${
												isReversed
													? 'wave-flow-reverse'
													: 'wave-flow'
										  } ${
												animationSpeed || 1.6
										  }s linear ${
												animationRepeat === 'once'
													? '1 forwards'
													: 'infinite'
										  }`,
								} }
							/>
						</svg>
					</div>
				</div>

				{ /* Add our custom pattern-specific controls to the inspector */ }
				<InspectorControls group="settings">
					<PanelBody
						title={ __( 'Wave Settings', 'awesome-squiggle' ) }
						initialOpen={ true }
					>
						{ /* Amplitude slider */ }
						<RangeControl
							label={ __( 'Amplitude', 'awesome-squiggle' ) }
							value={
								squiggleAmplitude ||
								( isZigzag || isLightning ? 15 : 10 )
							}
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									squiggleAmplitude: value,
								} )
							}
							min={ 5 }
							max={ 25 }
							help={ __(
								'Adjust the height of the wave peaks (5–25px)',
								'awesome-squiggle'
							) }
						/>

						{ /* Pointiness slider */ }
						<RangeControl
							label={ __( 'Pointiness', 'awesome-squiggle' ) }
							value={ effectivePointiness }
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									pointiness: value,
								} )
							}
							min={ 0 }
							max={ 100 }
							step={ 5 }
							help={ ( () => {
								const p = effectivePointiness;
								const desc =
									p <= 20
										? __(
												'Smooth curves',
												'awesome-squiggle'
										  )
										: p <= 40
										? __(
												'Rounded waves',
												'awesome-squiggle'
										  )
										: p <= 60
										? __(
												'Moderate sharpness',
												'awesome-squiggle'
										  )
										: p <= 80
										? __(
												'Pointed peaks',
												'awesome-squiggle'
										  )
										: __(
												'Sharp zig-zag',
												'awesome-squiggle'
										  );
								return sprintf(
									__( '%s (%d%%)', 'awesome-squiggle' ),
									desc,
									p
								);
							} )() }
						/>

						{ /* Angle slider */ }
						<RangeControl
							label={ __( 'Angle', 'awesome-squiggle' ) }
							value={ effectiveAngle }
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									angle: value,
								} )
							}
							min={ -60 }
							max={ 60 }
							step={ 5 }
							help={ ( () => {
								const a = effectiveAngle;
								const desc =
									a < -20
										? __( 'Left lean', 'awesome-squiggle' )
										: a > 20
										? __( 'Right lean', 'awesome-squiggle' )
										: __(
												'Vertical peaks',
												'awesome-squiggle'
										  );
								return sprintf(
									__( '%s (%d\u00b0)', 'awesome-squiggle' ),
									desc,
									a
								);
							} )() }
						/>

						<SelectControl
							label={ __( 'Animation', 'awesome-squiggle' ) }
							value={
								isAnimated
									? ( animationRepeat === 'once' &&
											'once' ) ||
									  'loop'
									: 'off'
							}
							options={ [
								{
									label: __( 'Off', 'awesome-squiggle' ),
									value: 'off',
								},
								{
									label: __( 'Once', 'awesome-squiggle' ),
									value: 'once',
								},
								{
									label: __( 'Loop', 'awesome-squiggle' ),
									value: 'loop',
								},
							] }
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									isAnimated: value !== 'off',
									animationRepeat:
										value === 'once' ? 'once' : 'loop',
								} )
							}
						/>
						{ /* Animation controls - only shown when animated */ }
						{ isAnimated && (
							<>
								<RangeControl
									label={ __(
										'Animation Speed',
										'awesome-squiggle'
									) }
									value={
										animationSpeed
											? durationToSlider( animationSpeed )
											: 6
									}
									onChange={ ( value ) =>
										setSecureAttributes( setAttributes, {
											animationSpeed: value,
										} )
									}
									min={ 1 }
									max={ 10 }
									step={ 1 }
									help={ ( () => {
										const speedValue = animationSpeed
											? durationToSlider( animationSpeed )
											: 6;
										const desc =
											speedValue <= 3
												? __(
														'slow',
														'awesome-squiggle'
												  )
												: speedValue <= 7
												? __(
														'medium',
														'awesome-squiggle'
												  )
												: __(
														'fast',
														'awesome-squiggle'
												  );
										return sprintf(
											__(
												'Current: %s (higher = faster)',
												'awesome-squiggle'
											),
											desc
										);
									} )() }
								/>
								<ToggleControl
									label={ __(
										'Reverse Direction',
										'awesome-squiggle'
									) }
									checked={ isReversed || false }
									onChange={ () =>
										setSecureAttributes( setAttributes, {
											isReversed: ! isReversed,
										} )
									}
									help={ __(
										'Animate in the opposite direction',
										'awesome-squiggle'
									) }
								/>
							</>
						) }
					</PanelBody>
					<PanelBody
						title={ __( 'Dimensions', 'awesome-squiggle' ) }
						initialOpen={ false }
					>
						<RangeControl
							label={ __( 'Stroke Width', 'awesome-squiggle' ) }
							value={ strokeWidth || 1 }
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									strokeWidth: value,
								} )
							}
							min={ 1 }
							max={ 8 }
							help={ ( () => {
								const currentValue = strokeWidth || 1;
								const percentage = Math.round(
									( ( currentValue - 1 ) / 7 ) * 100
								);
								const widthDescription =
									percentage <= 25
										? __( 'thin', 'awesome-squiggle' )
										: percentage <= 50
										? __( 'medium', 'awesome-squiggle' )
										: percentage <= 75
										? __( 'thick', 'awesome-squiggle' )
										: __(
												'very thick',
												'awesome-squiggle'
										  );
								const styleName = getStyleName( className );
								const baseHelp = sprintf(
									__(
										'Adjust the thickness of the %s line',
										'awesome-squiggle'
									),
									styleName
								);
								return sprintf(
									__(
										'%s Current width: %s (%dpx). Use arrow keys or drag to adjust. Hold Shift + arrow keys for larger increments.',
										'awesome-squiggle'
									),
									baseHelp,
									widthDescription,
									currentValue
								);
							} )() }
							onKeyDown={ ( e ) => {
								const currentValue = strokeWidth || 1;
								if ( e.shiftKey && e.key === 'ArrowLeft' ) {
									e.preventDefault();
									const newValue = Math.max(
										1,
										currentValue - 2
									);
									setSecureAttributes( setAttributes, {
										strokeWidth: newValue,
									} );
								} else if (
									e.shiftKey &&
									e.key === 'ArrowRight'
								) {
									e.preventDefault();
									const newValue = Math.min(
										8,
										currentValue + 2
									);
									setSecureAttributes( setAttributes, {
										strokeWidth: newValue,
									} );
								}
							} }
						/>
						<SelectControl
							label={ sprintf(
								__( '%s Height', 'awesome-squiggle' ),
								getStyleName( className )
									.charAt( 0 )
									.toUpperCase() +
									getStyleName( className ).slice( 1 )
							) }
							value={ squiggleHeight || '100px' }
							options={ [
								{
									label: __(
										'Extra Small (50px)',
										'awesome-squiggle'
									),
									value: '50px',
								},
								{
									label: __(
										'Small (75px)',
										'awesome-squiggle'
									),
									value: '75px',
								},
								{
									label: __(
										'Medium (100px)',
										'awesome-squiggle'
									),
									value: '100px',
								},
								{
									label: __(
										'Large (125px)',
										'awesome-squiggle'
									),
									value: '125px',
								},
								{
									label: __(
										'Extra Large (150px)',
										'awesome-squiggle'
									),
									value: '150px',
								},
								{
									label: __(
										'Jumbo (200px)',
										'awesome-squiggle'
									),
									value: '200px',
								},
							] }
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									squiggleHeight: value,
								} )
							}
							help={ sprintf(
								__(
									'Set the height of the %s container',
									'awesome-squiggle'
								),
								getStyleName( className )
							) }
						/>
					</PanelBody>
				</InspectorControls>
			</>
		);
	};

	return ( props ) => {
		if ( props.name !== 'core/separator' ) {
			return <BlockEdit { ...props } />;
		}

		return <SquiggleEdit { ...props } />;
	};
}, 'withSquiggleControls' );

// Apply the squiggle controls enhancement to separator blocks
addFilter(
	'editor.BlockEdit',
	'awesome-squiggle/squiggle-controls',
	withSquiggleControls,
	20
);

// ─── Deprecated save format (full SVG in post_content) ───
// This preserves the old save output so existing blocks don't show
// "unexpected content" validation errors in the editor.
const deprecatedFullSvgSave = ( element, blockType, attributes ) => {
	if ( blockType.name !== 'core/separator' ) {
		return element;
	}

	const className = element?.props?.className || attributes?.className || '';
	const isZigzag = isZigzagStyle( className );
	const isLightning = isLightningStyle( className );
	const isPixel = isPixelStyle( className );
	const isCustom = isCustomStyle( className );

	if ( ! isCustom ) {
		return element;
	}

	const {
		strokeWidth = 1,
		animationSpeed = 2.5,
		squiggleAmplitude,
		squiggleHeight = '100px',
		animationId,
		isReversed,
		textColor,
		customTextColor,
		backgroundColor,
		customBackgroundColor,
		style,
		gradient,
		gradientId,
		isAnimated: isAnimatedAttr,
		pointiness: pointinessAttr,
		angle: angleAttr,
	} = attributes;

	const effectiveAmplitudeDefault = isZigzag || isLightning ? 15 : 10;
	const effectivePointiness =
		pointinessAttr !== undefined
			? pointinessAttr
			: isZigzag || isLightning
			? 100
			: 0;
	const effectiveAngle =
		angleAttr !== undefined ? angleAttr : isLightning ? 40 : 0;
	const isAnimated = isAnimatedAttr !== undefined ? isAnimatedAttr : true;
	const finalPaused = ! isAnimated;

	let lineColor = 'currentColor';
	let finalGradient = null;
	const customGradient = gradient || style?.color?.gradient;
	let usedGradientId = null;
	let parsedGradientData = null;

	if ( customGradient ) {
		if ( gradientId ) {
			usedGradientId = gradientId;
			finalGradient = customGradient;
			lineColor = `url(#${ usedGradientId })`;
			parsedGradientData = parseGradient( customGradient, true );
		} else {
			lineColor = 'currentColor';
		}
	} else if ( backgroundColor ) {
		lineColor = validateColorValue(
			`var(--wp--preset--color--${ backgroundColor })`
		);
	} else if ( customBackgroundColor ) {
		lineColor = validateColorValue( customBackgroundColor );
	} else if ( style?.color?.background ) {
		lineColor = validateColorValue( style.color.background );
	} else {
		const classNameColor = extractColorFromClassName( className );
		if ( classNameColor ) {
			lineColor = validateColorValue( classNameColor );
		} else if ( textColor ) {
			lineColor = validateColorValue(
				`var(--wp--preset--color--${ textColor })`
			);
		} else if ( customTextColor ) {
			lineColor = validateColorValue( customTextColor );
		} else if ( style?.color?.text ) {
			lineColor = validateColorValue( style.color.text );
		}
	}

	const classNames = [ 'wp-block-separator', 'awesome-squiggle-wave' ];
	if ( attributes.align ) {
		classNames.push( `align${ attributes.align }` );
	}
	if ( className ) {
		const existingClasses = className
			.split( ' ' )
			.filter(
				( cls ) =>
					cls &&
					cls !== 'wp-block-separator' &&
					cls !== 'awesome-squiggle-wave'
			);
		classNames.push( ...existingClasses );
	}
	if ( finalPaused && ! classNames.includes( 'is-paused' ) ) {
		classNames.push( 'is-paused' );
	}
	const combinedClassName = [ ...new Set( classNames ) ].join( ' ' );

	const animationName = finalPaused
		? 'none'
		: isReversed
		? 'wave-flow-reverse'
		: 'wave-flow';
	const inlineStyles = {
		height: squiggleHeight,
		backgroundColor: 'transparent',
		[ `--animation-duration` ]: `${ animationSpeed }s`,
		[ `--animation-name` ]: animationName,
	};

	if ( style ) {
		const { color, spacing, ...otherStyles } = style;
		Object.assign( inlineStyles, otherStyles );
		inlineStyles.backgroundColor = 'transparent';
	}

	const containerHeight = parseInt( squiggleHeight, 10 ) || 100;
	const generator = isPixel ? generatePixelWavePath : generateLongWavePath;
	const {
		d: wavePath,
		height: waveHeight,
		wavelength,
	} = generator(
		squiggleAmplitude || effectiveAmplitudeDefault,
		effectivePointiness,
		effectiveAngle,
		strokeWidth,
		80,
		containerHeight
	);
	const viewBoxWidth = wavelength * 80;

	return (
		<div
			className={ combinedClassName }
			style={ inlineStyles }
			role="separator"
			aria-label="Decorative separator"
		>
			<svg
				viewBox={ `0 0 ${ viewBoxWidth } ${ waveHeight }` }
				preserveAspectRatio="xMinYMid slice"
				aria-hidden="true"
				focusable="false"
				style={ { width: '100%', height: '100%', display: 'block' } }
			>
				<defs>
					{ finalGradient &&
						usedGradientId &&
						( () => {
							const gradientData = parsedGradientData;
							const gradientSpan = 40;
							return (
								<linearGradient
									id={ usedGradientId }
									gradientUnits="userSpaceOnUse"
									spreadMethod="reflect"
									x1="0"
									y1="0"
									x2={ gradientSpan }
									y2="0"
								>
									{ gradientData?.stops?.length > 0
										? gradientData.stops.map(
												( stop, index ) => (
													<stop
														key={ index }
														offset={ stop.offset }
														stopColor={ stop.color }
													/>
												)
										  )
										: [
												<stop
													key="fallback-0"
													offset="0%"
													stopColor="#ff6b35"
												/>,
												<stop
													key="fallback-1"
													offset="100%"
													stopColor="#f7931e"
												/>,
										  ] }
								</linearGradient>
							);
						} )() }
				</defs>
				<path
					d={ wavePath }
					fill="none"
					stroke={ lineColor }
					strokeWidth={ strokeWidth }
					strokeLinecap="round"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
					className={ `wave-path wave-path-${
						animationId || 'default'
					}` }
					style={ {
						animation: finalPaused
							? 'none'
							: `${ animationName } ${ animationSpeed }s linear infinite`,
					} }
				/>
			</svg>
		</div>
	);
};

// Register deprecated save format so old blocks pass validation
addFilter(
	'blocks.registerBlockType',
	'awesome-squiggle/separator-deprecated-save',
	( settings, name ) => {
		if ( name !== 'core/separator' ) {
			return settings;
		}

		return {
			...settings,
			deprecated: [
				...( settings.deprecated || [] ),
				{
					attributes: settings.attributes,
					supports: settings.supports,
					save( { attributes: deprecatedAttributes } ) {
						// Reconstruct the element stub that the old filter expected
						const element = {
							props: {
								className:
									deprecatedAttributes?.className || '',
							},
						};
						return deprecatedFullSvgSave(
							element,
							{ name: 'core/separator' },
							deprecatedAttributes
						);
					},
					migrate( attributes ) {
						return attributes;
					},
				},
			],
		};
	},
	// Run after our attribute filter (priority 20) so attributes are available
	21
);

// Save element — minimal markup, PHP handles all frontend rendering
addFilter(
	'blocks.getSaveElement',
	'awesome-squiggle/separator-squiggle-save',
	( element, blockType, attributes ) => {
		if ( blockType.name !== 'core/separator' ) {
			return element;
		}

		const className =
			element?.props?.className || attributes?.className || '';
		if ( ! isCustomStyle( className ) ) {
			return element;
		}

		// Build class names (same logic as before, just no SVG)
		const classNames = [ 'wp-block-separator', 'awesome-squiggle-wave' ];

		if ( attributes.align ) {
			classNames.push( `align${ attributes.align }` );
		}

		if ( className ) {
			const existingClasses = className
				.split( ' ' )
				.filter(
					( cls ) =>
						cls &&
						cls !== 'wp-block-separator' &&
						cls !== 'awesome-squiggle-wave'
				);
			classNames.push( ...existingClasses );
		}

		const isAnimated =
			attributes.isAnimated !== undefined ? attributes.isAnimated : true;
		if ( ! isAnimated && ! classNames.includes( 'is-paused' ) ) {
			classNames.push( 'is-paused' );
		}

		const combinedClassName = [ ...new Set( classNames ) ].join( ' ' );

		// Minimal output — PHP render_block generates the full SVG on the frontend
		return (
			<div
				className={ combinedClassName }
				role="separator"
				aria-label="Decorative separator"
			/>
		);
	},
	20
);

// Register block styles - shape presets only, animation uses playback controls
domReady( () => {
	// Squiggle Style (smooth curves, pointiness: 0)
	registerBlockStyle( 'core/separator', {
		name: 'squiggle',
		label: __( 'Squiggle', 'awesome-squiggle' ),
		isDefault: false,
	} );

	// Zig-Zag Style (sharp angles, pointiness: 100)
	registerBlockStyle( 'core/separator', {
		name: 'zigzag',
		label: __( 'Zig-Zag', 'awesome-squiggle' ),
		isDefault: false,
	} );

	// Lightning Style (sharp angles with tilt, pointiness: 100, angle: 40)
	registerBlockStyle( 'core/separator', {
		name: 'lightning',
		label: __( 'Lightning', 'awesome-squiggle' ),
		isDefault: false,
	} );

	// Pixel Style (8-bit staircase wave, Scott Pilgrim aesthetic)
	registerBlockStyle( 'core/separator', {
		name: 'pixel',
		label: __( 'Pixel', 'awesome-squiggle' ),
		isDefault: false,
	} );
} );
