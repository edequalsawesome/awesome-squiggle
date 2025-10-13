import { registerBlockStyle } from '@wordpress/blocks';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import {
	PanelBody,
	RangeControl,
	ToggleControl,
	SelectControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useEffect, useRef, useState, useSelect } from '@wordpress/element';
import { select } from '@wordpress/data';
import './style.css';

// Security validation functions
const validateNumericInput = ( value, min, max, defaultValue ) => {
	if ( typeof value !== 'number' || isNaN( value ) ) {
		return defaultValue;
	}
	return Math.max( min, Math.min( max, value ) );
};

const validateStringInput = ( value, allowedPattern, maxLength = 100 ) => {
	if ( typeof value !== 'string' ) {
		return '';
	}

	// Limit length to prevent DoS
	value = value.substring( 0, maxLength );

	// Validate against pattern if provided
	if ( allowedPattern && ! allowedPattern.test( value ) ) {
		return '';
	}

	return value;
};

const validateGradientId = ( id ) => {
	// Only allow alphanumeric, dash, and underscore
	const allowedPattern = /^[a-zA-Z0-9_-]+$/;
	return validateStringInput( id, allowedPattern, 50 );
};

const validateAnimationId = ( id ) => {
	// Only allow alphanumeric, dash, and underscore
	const allowedPattern = /^[a-zA-Z0-9_-]+$/;
	return validateStringInput( id, allowedPattern, 50 );
};

// Development-only logging
const debugLog = ( message, ...args ) => {
	// Temporarily enable logging in all environments for debugging
	console.log( '[Awesome Squiggle]', message, ...args );
};

// Secure attribute setter
const setSecureAttributes = ( setAttributes, updates ) => {
	const secureUpdates = {};

	for ( const [ key, value ] of Object.entries( updates ) ) {
			switch ( key ) {
			case 'strokeWidth':
				secureUpdates[ key ] = validateNumericInput( value, 1, 8, 1 );
				break;
			case 'animationSpeed':
				// Convert slider value (1-10) to duration - higher numbers = faster
				// Formula: (11 - sliderValue) * 0.5 gives us 0.5s to 5s range
				const speedValue = validateNumericInput( value, 1, 10, 6 );
				const duration = ( 11 - speedValue ) * 0.5;
				secureUpdates[ key ] = duration;
				break;
			case 'squiggleAmplitude':
				// Increased range for more dramatic sparkles
				secureUpdates[ key ] = validateNumericInput( value, 8, 35, 18 );
				break;
			case 'sparkleVerticalAmplitude':
				// Vertical spread range for sparkles
				secureUpdates[ key ] = validateNumericInput( value, 0, 30, 15 );
				break;
			case 'sparkleRandomness':
				// Variance factor for sparkle timing (percent 0..200)
				secureUpdates[ key ] = validateNumericInput( value, 0, 200, 100 );
				break;
			case 'animationId':
				secureUpdates[ key ] = validateAnimationId( value );
				break;
			case 'gradientId':
				secureUpdates[ key ] = validateGradientId( value );
				break;
			case 'squiggleHeight':
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
			case 'isReversed':
				secureUpdates[ key ] = value === true;
				break;
			case 'gradient':
				secureUpdates[ key ] = value;
				break;
			default:
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
	return validateAnimationId( id );
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
	// Create a simple deterministic suffix
	let suffix = '';
	if ( gradient ) {
		// Simple hash of gradient to make it somewhat unique
		let hash = 0;
		for ( let i = 0; i < gradient.length; i++ ) {
			hash = ( hash << 5 ) - hash + gradient.charCodeAt( i );
			hash = hash & hash;
		}
		suffix = Math.abs( hash ).toString( 36 ).substring( 0, 6 );
	} else {
		// Default suffix for non-gradient cases
		suffix = 'default';
	}
	const id = `${ baseId }-${ suffix }`;
	return validateGradientId( id );
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

// Resolve a gradient slug/var/custom to a concrete CSS linear-gradient string when possible
const resolveGradientToCss = ( input ) => {
	if ( ! input ) return null;

	let value = String( input ).trim();

	// If it's a bare slug (no var()/gradient()) try the preset var first
	const looksLikeSlug =
		! value.includes( 'gradient(' ) && ! value.startsWith( 'var(' );
	if ( looksLikeSlug ) {
		// Attempt to resolve via computed style for theme-defined preset
		const varRef = `var(--wp--preset--gradient--${ value })`;
		const resolved = resolveCssVarBackgroundImage( varRef );
		if ( resolved ) return resolved;

		// Fallback to our known defaults map
		if ( wpDefaultGradients[ value ] ) return wpDefaultGradients[ value ];
	}

	// If it's a CSS var for a preset, resolve it via computed style
	if ( value.startsWith( 'var(--wp--preset--gradient--' ) ) {
		const resolved = resolveCssVarBackgroundImage( value );
		if ( resolved ) return resolved;

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
	try {
		if ( typeof window === 'undefined' || ! window.document ) return null;
		const el = document.createElement( 'div' );
		// Keep it out of flow and invisible
		el.style.position = 'absolute';
		el.style.left = '-9999px';
		el.style.top = '-9999px';
		el.style.width = '1px';
		el.style.height = '1px';
		el.style.backgroundImage = css;
		document.body.appendChild( el );
		const computed = getComputedStyle( el ).backgroundImage;
		document.body.removeChild( el );
		if ( computed && computed !== 'none' ) {
			return computed;
		}
		return null;
	} catch ( e ) {
		return null;
	}
};

// Simple gradient parser for basic linear gradients
const parseGradient = ( gradientInput ) => {
	if ( ! gradientInput ) return {
		type: 'linear',
		stops: [
			{ color: '#667eea', offset: '0%' },
			{ color: '#764ba2', offset: '100%' },
		],
	};

	// First, normalize/resolve to a concrete linear-gradient when possible
	let gradientString = resolveGradientToCss( gradientInput ) || String( gradientInput );

	if ( ! gradientString ) return null;

	// If it's still a var reference at this point and couldn't be resolved, try our mapping or fallback.
	if ( gradientString.startsWith( 'var(--wp--preset--gradient--' ) ) {
		const m = gradientString.match( /var\(--wp--preset--gradient--([^)]+)\)/ );
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
			if ( char === '(' ) parenDepth++;
			if ( char === ')' ) parenDepth--;

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

		// Process each part to extract color and percentage
		for ( const part of parts ) {
			// Skip direction part (like "135deg")
			if ( part.includes( 'deg' ) || part.includes( 'to ' ) ) continue;

			// Improved color matching - handle rgb(), rgba(), hsl(), hsla(), and hex colors
			const colorMatch = part.match(
				/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/
			);
			const percentMatch = part.match( /(\d+%)/ );

			if ( colorMatch ) {
				const color = colorMatch[ 1 ];
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
			// Simplify gradients with more than 3 stops to improve performance
			let finalStops = stops;
			if ( stops.length > 3 ) {
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

// Test gradient parsing
debugLog( '🧪 Testing gradient parsing:' );
	const testGradient1 = parseGradient(
		'luminous-vivid-amber-to-luminous-vivid-orange'
	);
	const testGradient2 = parseGradient( 'cool-to-warm-spectrum' );
debugLog( 'luminous-vivid-amber-to-luminous-vivid-orange:', testGradient1 );
debugLog( '  stops:', testGradient1?.stops );
debugLog( 'cool-to-warm-spectrum:', testGradient2 );
debugLog( '  stops:', testGradient2?.stops );

// Test the actual CSS gradient parsing
const testCss =
	'linear-gradient(135deg,rgb(74,234,220) 0%,rgb(151,120,209) 20%,rgb(207,42,186) 40%,rgb(238,44,130) 60%,rgb(251,105,98) 80%,rgb(254,248,76) 100%)';
debugLog( 'Direct CSS test:', parseGradient( testCss ) );

// Generate SVG path data for the squiggle
const generateSquigglePath = ( amplitude = 10, pathWidth = 800 ) => {
	// Security: Validate amplitude bounds
	amplitude = validateNumericInput( amplitude, 5, 25, 10 );

	const wavelength = 40;
	const width = pathWidth;
	const height = 100;
	const midY = height / 2;

	// Create smooth squiggle using cubic Bezier curves
	let d = `M-${ wavelength * 2 },${ midY }`;

	// Generate squiggle segments
	for (
		let x = -wavelength * 2;
		x <= width + wavelength * 2;
		x += wavelength
	) {
		// Alternate between down curve (peak) and up curve (trough)
		const isDownCurve =
			Math.floor( ( x + wavelength * 2 ) / wavelength ) % 2 === 0;
		const curveY = isDownCurve ? midY - amplitude : midY + amplitude;

		const cp1x = x + wavelength * 0.375;
		const cp2x = x + wavelength * 0.625;
		const endx = x + wavelength;

		d += ` C${ cp1x },${ curveY } ${ cp2x },${ curveY } ${ endx },${ midY }`;
	}

	return d;
};

// Generate SVG path data for the zig-zag (Charlie Brown stripe style)
const generateZigzagPath = ( amplitude = 15, pathWidth = 800 ) => {
	// Security: Validate amplitude bounds
	amplitude = validateNumericInput( amplitude, 5, 25, 15 );

	const wavelength = 40; // Match squiggle wavelength for consistent appearance
	const width = pathWidth;
	const height = 100;
	const midY = height / 2;

	// Create sharp zig-zag pattern using straight lines
	let d = `M-${ wavelength * 2 },${ midY }`;

	// Generate zig-zag segments
	for (
		let x = -wavelength * 2;
		x <= width + wavelength * 2;
		x += wavelength
	) {
		// Alternate between up and down peaks for sharp angles
		const isUpPeak =
			Math.floor( ( x + wavelength * 2 ) / wavelength ) % 2 === 0;
		const peakY = isUpPeak ? midY - amplitude : midY + amplitude;

		// Sharp angle to peak
		const peakX = x + wavelength / 2;
		d += ` L${ peakX },${ peakY }`;

		// Sharp angle back to center at end of segment
		const endX = x + wavelength;
		d += ` L${ endX },${ midY }`;
	}

	return d;
};

// Generate SVG elements for sparkles pattern
const generateSparkleElements = ( sparkleSize = 18, verticalAmplitude = 15, containerWidth = 800, randomness = 100 ) => {
	// Security: Validate bounds
	sparkleSize = validateNumericInput( sparkleSize, 8, 35, 18 );
	verticalAmplitude = validateNumericInput( verticalAmplitude, 0, 30, 15 );
	containerWidth = validateNumericInput( containerWidth, 300, 5000, 800 );
	// Randomness controls variance of delay/duration (0%..200%)
	randomness = validateNumericInput( randomness, 0, 200, 100 );

	const spacing = 50; // Better spacing for clean look
	const height = 100;
	const midY = height / 2;

	// Create sparkles pattern using multiple star/sparkle shapes
	const sparkleElements = [];
	let sparkleIndex = 0;

	// Calculate effective container boundaries to avoid half-sparkles
	const sparkleRadius = sparkleSize; // Maximum extent of a sparkle from its center
	const effectiveStart = sparkleRadius; // Start far enough from edge
	const effectiveEnd = containerWidth - sparkleRadius; // End far enough from edge
	
	// Only generate sparkles if we have enough space
	if ( effectiveEnd <= effectiveStart ) {
		// Container too small for sparkles, return empty array
		return sparkleElements;
	}

	// Generate sparkles with proper boundaries to avoid half-sparkles
	for ( let x = effectiveStart; x <= effectiveEnd; x += spacing ) {
		// Create Y variation based on vertical amplitude for pattern creation
		const waveFrequency = 0.008; // Smooth wave pattern
		const offsetY = Math.sin( x * waveFrequency ) * verticalAmplitude;
		const sparkleY = midY + offsetY;

		// Create a 4-pointed star sparkle shape - consistent size for twinkling
		const size = sparkleSize;
		const innerSize = size * 0.3; // Star inner radius

		// Consistent rotation for all sparkles
		const rotation = 0;

		// Calculate points for a 4-pointed star
		const points = [];
		for ( let i = 0; i < 8; i++ ) {
			const angle = ( Math.PI * 2 * i ) / 8 + ( rotation * Math.PI ) / 180;
			const radius = i % 2 === 0 ? size : innerSize;
			const px = x + Math.cos( angle ) * radius;
			const py = sparkleY + Math.sin( angle ) * radius;
			points.push( `${ px },${ py }` );
		}

		// Calculate deterministic timing for star twinkling (avoids validation errors)
		const seed = (x + sparkleIndex * 17) % 1600; // base 0..1600ms
		const delayMs = Math.max(0, Math.round(seed * (randomness / 100))); // scale by randomness
		const baseVar = (sparkleIndex * 67) % 800; // 0..800ms variance
		const durationMs = 1200 + Math.max(0, Math.round(baseVar * (randomness / 100))); // 1.2s..(up to 2.0s*scale)
		
		// Create sparkle element data
		sparkleElements.push({
			points: points.join(' '),
			style: {
				animationDelay: `${delayMs}ms`,
				animationDuration: `${durationMs}ms`,
			}
		});
		
		sparkleIndex++;
	}

	return sparkleElements;
};

// Helper function to check if current style is a squiggle style
const isSquiggleStyle = ( className ) => {
	return (
		className &&
		( className.includes( 'is-style-animated-squiggle' ) ||
			className.includes( 'is-style-static-squiggle' ) )
	);
};

// Helper function to check if current style is a zig-zag style
const isZigzagStyle = ( className ) => {
	return (
		className &&
		( className.includes( 'is-style-animated-zigzag' ) ||
			className.includes( 'is-style-static-zigzag' ) )
	);
};

// Helper function to check if current style is a sparkle style
const isSparkleStyle = ( className ) => {
	return (
		className &&
		( className.includes( 'is-style-animated-sparkle' ) ||
			className.includes( 'is-style-static-sparkle' ) )
	);
};

// Helper function to check if current style is animated (not static)
const isAnimatedStyle = ( className ) => {
	return (
		className &&
		( className.includes( 'is-style-animated-squiggle' ) ||
			className.includes( 'is-style-animated-zigzag' ) ||
			className.includes( 'is-style-animated-sparkle' ) )
	);
};

// Helper function to check if current style is any custom style (squiggle, zig-zag, or sparkle)
const isCustomStyle = ( className ) => {
	return (
		isSquiggleStyle( className ) ||
		isZigzagStyle( className ) ||
		isSparkleStyle( className )
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
				// Squiggle-specific attributes with defaults to avoid interference
				strokeWidth: {
					type: 'number',
					default: undefined, // No default to avoid interference
				},
				animationSpeed: {
					type: 'number',
					default: undefined,
				},
				squiggleAmplitude: {
					type: 'number',
					default: undefined,
				},
				sparkleVerticalAmplitude: {
					type: 'number',
					default: undefined,
				},
				sparkleRandomness: {
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
	return ( props ) => {
		const { attributes, setAttributes, name, clientId } = props;

		// ALL hooks must be declared at the top level, before ANY conditional logic
		const blockInitializedRef = useRef( false );
		const gradientIdRefHook = useRef( attributes?.gradientId );
		
		// Container width measurement for dynamic sparkle generation
		const [containerWidth, setContainerWidth] = useState(800);
		const containerRef = useRef(null);

		// Pre-calculate values needed for useBlockProps
		const {
			className = '',
			squiggleHeight = '100px',
			animationSpeed = 1.6,
			isReversed = false,
		} = attributes || {};
		const isSquiggle = isSquiggleStyle( className );
		const isZigzag = isZigzagStyle( className );
		const isSparkle = isSparkleStyle( className );
		const isCustom = isCustomStyle( className );
		const isAnimated = isAnimatedStyle( className );

		// Determine if animation should be paused based on style
		let finalPaused = false;
		if (
			className &&
			( className.includes( 'is-style-static-squiggle' ) ||
				className.includes( 'is-style-static-zigzag' ) ||
				className.includes( 'is-style-static-sparkle' ) )
		) {
			finalPaused = true;
		}

		// Calculate animation name
		const animationName = finalPaused
			? 'none'
			: isZigzag
			? isReversed
				? 'zigzag-flow-reverse'
				: 'zigzag-flow'
			: isReversed
			? 'squiggle-flow-reverse'
			: 'squiggle-flow';

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
				const isZigzag = isZigzagStyle( attributes?.className );

				// Generate new gradient ID if:
				// 1. No gradient ID exists, OR
				// 2. The gradient content has changed
				if (
					newGradient &&
					( ! attributes?.gradientId ||
						newGradient !== currentGradient )
				) {
					const newGradientId = generateGradientId(
						isZigzag ? 'zigzag' : 'squiggle',
						newGradient,
						clientId
					);
					newUpdates.gradientId = newGradientId;
					debugLog(
						'🎨 Generated new gradient ID for gradient change:',
						{
							oldGradient: currentGradient,
							newGradient: newGradient,
							oldId: attributes?.gradientId,
							newId: newGradientId,
						}
					);
				}
			}

			// Call the original setAttributes
			setAttributes( newUpdates );
		};

		// Return early for non-separator blocks AFTER all hooks are declared
		if ( name !== 'core/separator' ) {
			return <BlockEdit { ...props } />;
		}

		const {
			strokeWidth,
			squiggleAmplitude,
			sparkleVerticalAmplitude,
			sparkleRandomness,
			animationId,
			textColor,
			customTextColor,
			backgroundColor,
			customBackgroundColor,
			style,
			gradient,
			gradientId,
		} = attributes;

		// Initialize custom style attributes when custom style is applied
		if ( isCustom && strokeWidth === undefined ) {
			const defaultAmplitude = isSparkle ? 18 : isZigzag ? 15 : 10; // Sparkle gets largest default amplitude
			const newAnimationId = generateAnimationId(
				isZigzag ? 'zigzag' : 'squiggle',
				clientId,
				1,
				defaultAmplitude
			);
			const currentGradient = gradient || style?.color?.gradient || '';
			const newGradientId = generateGradientId(
				isZigzag ? 'zigzag' : 'squiggle',
				currentGradient,
				clientId
			);
			setSecureAttributes( setAttributes, {
				strokeWidth: 1,
				animationSpeed: 6, // Default to speed level 6 (which converts to 2.5s duration)
				squiggleAmplitude: defaultAmplitude,
				sparkleVerticalAmplitude: isSparkle ? 15 : undefined,
				squiggleHeight: '100px',
				animationId: newAnimationId,
				isReversed: false,
				gradientId: newGradientId,
			} );
		}

		// Ensure each block has a unique animation ID
		if ( isCustom && ! animationId ) {
			const patternType = isSparkle ? 'sparkle' : isZigzag ? 'zigzag' : 'squiggle';
			const defaultAmplitude = isSparkle ? 18 : isZigzag ? 15 : 10;
			setSecureAttributes( setAttributes, {
				animationId: generateAnimationId(
					patternType,
					clientId,
					strokeWidth || 1,
					squiggleAmplitude || defaultAmplitude
				),
			} );
		}

		// Ensure each block has a unique gradient ID
		if ( isCustom && ! gradientId ) {
			setSecureAttributes( setAttributes, {
				gradientId: generateGradientId(
					isZigzag ? 'zigzag' : 'squiggle',
					'',
					''
				),
			} );
		}

		// Hooks already declared at the top of the component

		// Regenerate gradient ID when switching between squiggle and zigzag to avoid conflicts
		if (
			isCustom &&
			gradientId &&
			( ( isSquiggle && gradientId.includes( 'zigzag' ) ) ||
				( isZigzag && gradientId.includes( 'squiggle' ) ) )
		) {
			const newGradientId = generateGradientId(
				isZigzag ? 'zigzag' : 'squiggle',
				'',
				''
			);
			setSecureAttributes( setAttributes, { gradientId: newGradientId } );
			debugLog(
				'🔄 Regenerated gradient ID for style switch:',
				newGradientId
			);
		}

		// Detect if this is a fresh block that needs ID generation
		useEffect( () => {
			debugLog( '🔍 Block initialization check:', {
				isCustom,
				clientId,
				blockInitialized: blockInitializedRef.current,
				currentGradientId: gradientId,
				hasGradient: !! ( gradient || style?.color?.gradient ),
				gradientIdRef: gradientIdRefHook.current,
			} );

			// If this is a custom style block with gradient but the gradient ID hasn't changed from our ref,
			// it might be a duplicate
			if ( isCustom && gradientId && ! blockInitializedRef.current ) {
				// Check if another block already has this gradient ID
				const allBlocks = select( 'core/block-editor' ).getBlocks();
				const otherBlocksWithSameId = allBlocks.filter(
					( block ) =>
						block.clientId !== clientId &&
						block.attributes.gradientId === gradientId
				);

				if ( otherBlocksWithSameId.length > 0 ) {
					debugLog(
						'🔄 Duplicate gradient ID detected on initialization, regenerating'
					);
					const defaultAmplitude = isSparkle ? 18 : isZigzag ? 15 : 10;
					const newAnimationId = generateAnimationId(
						isSparkle ? 'sparkle' : isZigzag ? 'zigzag' : 'squiggle',
						clientId,
						strokeWidth || 1,
						squiggleAmplitude || defaultAmplitude
					);
					const newGradientId = generateGradientId(
						isZigzag ? 'zigzag' : 'squiggle',
						'',
						clientId
					);
					setSecureAttributes( setAttributes, {
						animationId: newAnimationId,
						gradientId: newGradientId,
					} );
					gradientIdRefHook.current = newGradientId;
				}
			}

			blockInitializedRef.current = true;
			gradientIdRefHook.current = gradientId;
		}, [ clientId, isCustom, gradientId, isZigzag, setAttributes ] );

		// Track if this block was just duplicated
		const wasDuplicated = useRef( false );

		// Only check for duplicates ONCE when block is first created
		useEffect( () => {
			if (
				isCustom &&
				gradientId &&
				! wasDuplicated.current &&
				! blockInitializedRef.current
			) {
				// Small delay to let editor settle
				const timeoutId = setTimeout( () => {
					// Mark that we've checked
					wasDuplicated.current = true;

					// Check if this gradient ID is already in use by another block
					const allGradients = document.querySelectorAll(
						`linearGradient[id="${ gradientId }"]`
					);

					// If we find more than one gradient definition, it's a duplicate
					if ( allGradients.length > 1 ) {
						// This is a duplicate - generate a new ID
						const newGradientId = generateGradientId(
							isZigzag ? 'zigzag' : 'squiggle',
							'',
							''
						);
						setSecureAttributes( setAttributes, {
							gradientId: newGradientId,
						} );
						debugLog(
							'🔄 Detected duplicate gradient ID on new block, generated new one:',
							newGradientId
						);
					}
				}, 200 );

				return () => clearTimeout( timeoutId );
			}
		}, [] ); // Empty deps - check only once on mount

		// Ensure gradient ID exists when gradient is present
		useEffect( () => {
			const customGradient = gradient || style?.color?.gradient;
			if ( isCustom && customGradient && ! gradientId ) {
				const newGradientId = generateGradientId(
					isZigzag ? 'zigzag' : 'squiggle',
					'',
					''
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

		// Container width measurement for dynamic path generation
		useEffect( () => {
			if ( ! isCustom || ! containerRef.current ) {
				return;
			}

			const observer = new ResizeObserver( ( entries ) => {
				for ( const entry of entries ) {
					const newWidth = entry.contentRect.width;
					if ( newWidth !== containerWidth ) {
						setContainerWidth( newWidth );
					}
				}
			} );

			observer.observe( containerRef.current );

			return () => {
				observer.disconnect();
			};
		}, [ isCustom, containerWidth ] );

		// Remove this overly aggressive duplicate check that runs too often
		// and causes gradient IDs to regenerate during block validation

		// Extract color information from WordPress classes (same logic as save)
		const extractColorFromClassName = ( className ) => {
			if ( ! className ) return null;

			// Look for background color classes (has-{color}-background-color)
			const bgColorMatch = className.match(
				/has-([a-zA-Z0-9-]+)-background-color/
			);
			if ( bgColorMatch ) {
				const colorSlug = bgColorMatch[ 1 ];
				return `var(--wp--preset--color--${ colorSlug })`;
			}

			// Look for text color classes (has-{color}-color)
			const textColorMatch = className.match(
				/has-([a-zA-Z0-9-]+)-color(?!\s*background)/
			);
			if ( textColorMatch ) {
				const colorSlug = textColorMatch[ 1 ];
				return `var(--wp--preset--color--${ colorSlug })`;
			}

			return null;
		};

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
				// Ensure we have a gradient ID when using gradients
				if ( ! gradientId ) {
					const newGradientId = generateGradientId(
						isZigzag ? 'zigzag' : 'squiggle',
						'',
						''
					);
					setSecureAttributes( setAttributes, {
						gradientId: newGradientId,
					} );
					debugLog(
						'🆕 Generated gradient ID for new gradient:',
						newGradientId
					);
				}

				finalGradient = customGradient;
				// Always use the current gradientId for the editor
				// Only use existing gradientId, don't generate new ones in the editor preview
				if ( gradientId ) {
					editorLineColor = `url(#${ gradientId })`;
				} else {
					// If no gradientId yet, the useEffect will handle generating it
					editorLineColor = 'currentColor';
				}
				const parsedGradient = parseGradient( customGradient );
				debugLog(
					'🎨 GRADIENT DEBUG: Using gradient:',
					customGradient,
					'Parsed:',
					parsedGradient
				);
				debugLog( '🎨 GRADIENT STOPS:', parsedGradient?.stops );
				debugLog(
					'🎨 GRADIENT ID for',
					isZigzag ? 'ZIGZAG' : 'SQUIGGLE',
					':',
					gradientId
				);
			} else {
				// Use solid color logic
				if ( backgroundColor ) {
					lineColor = `var(--wp--preset--color--${ backgroundColor })`;
				} else if ( customBackgroundColor ) {
					lineColor = customBackgroundColor;
				} else if ( style?.color?.background ) {
					lineColor = style.color.background;
				} else {
					const classNameColor =
						extractColorFromClassName( className );
					if ( classNameColor ) {
						lineColor = classNameColor;
					} else if ( textColor ) {
						lineColor = `var(--wp--preset--color--${ textColor })`;
					} else if ( customTextColor ) {
						lineColor = customTextColor;
					} else if ( style?.color?.text ) {
						lineColor = style.color.text;
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

		// finalPaused is already calculated at the top with hooks

		// Clean up the className to remove conflicting is-paused class when it shouldn't be there
		let cleanClassName = className;
		if (
			cleanClassName &&
			cleanClassName.includes( 'is-paused' ) &&
			! finalPaused
		) {
			cleanClassName = cleanClassName
				.replace( /\bis-paused\b/g, '' )
				.replace( /\s+/g, ' ' )
				.trim();
			// Update the className in attributes to remove the stale is-paused class
			setAttributes( { className: cleanClassName } );
		}

		// If not a custom style, just return the normal block edit but still use our gradient wrapper
		if ( ! isCustom ) {
			return (
				<BlockEdit
					{ ...props }
					setAttributes={ setAttributesWithGradientCheck }
				/>
			);
		}

		// blockProps already declared at the top with hooks

		return (
			<>
				{ /* Render the original block edit hidden to preserve all standard WordPress controls */ }
				<div style={ { display: 'none' } }>
					<BlockEdit
						{ ...props }
						setAttributes={ setAttributesWithGradientCheck }
					/>
				</div>

				<style>
					{ `
                        @keyframes squiggle-flow {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(80px); }
                        }
                        @keyframes squiggle-flow-reverse {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(-80px); }
                        }
                        @keyframes zigzag-flow {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(80px); }
                        }
                        @keyframes zigzag-flow-reverse {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(-80px); }
                        }
                        @keyframes sparkle-shimmer {
                            0% { opacity: 0.3; }
                            50% { opacity: 1; }
                            100% { opacity: 0.3; }
                        }
                        .awesome-squiggle-editor-preview .squiggle-path,
                        .awesome-squiggle-editor-preview .zigzag-path {
                            transform-origin: center;
                            animation: var(--animation-name, squiggle-flow) var(--animation-duration, 1.6s) linear infinite;
                        }
                        .awesome-squiggle-editor-preview .sparkle-element {
                            animation: sparkle-shimmer var(--animation-duration, 1.6s) ease-in-out infinite;
                        }
                    ` }
				</style>
				<div { ...blockProps }>
					<div
						ref={ containerRef }
						className="awesome-squiggle-editor-preview"
						style={ {
							width: '100%',
							height: '100%',
							backgroundColor: 'transparent',
							display: 'flex',
							alignItems: 'center',
						} }
					>
						<svg
							key={ `svg-${ gradientId || 'default' }` }
							viewBox={ `0 0 ${ Math.max( 800, containerWidth + 100 ) } 100` }
							preserveAspectRatio="none"
							role="img"
							aria-label={ __(
								`Decorative ${ isSparkle ? 'sparkle' : isZigzag ? 'zigzag' : 'wavy' } divider`,
								'awesome-squiggle'
							) }
							aria-describedby={ `squiggle-desc-${ animationId || 'default' }` }
							style={ {
								width: '100%',
								height: '100%',
								display: 'block',
							} }
						>
							<title>
								{ __(
									`${ isSparkle ? 'Sparkle' : isZigzag ? 'Zigzag' : 'Wavy' } separator`,
									'awesome-squiggle'
								) }
							</title>
							<desc id={ `squiggle-desc-${ animationId || 'default' }` }>
								{ __(
									`A decorative ${ isSparkle ? 'sparkle' : isZigzag ? 'zigzag' : 'wavy' } pattern used as a visual divider between content sections.${ 
										isAnimated && !finalPaused ? ' This pattern includes gentle animation.' : ''
									}`,
									'awesome-squiggle'
								) }
							</desc>
							{ finalGradient &&
								gradientId &&
								( () => {
									const gradientData =
										parseGradient( finalGradient );
									// Use the actual gradientId if available, or use the generated one from editorLineColor
									const svgGradientId = gradientId;
									debugLog(
										'🎨 SVG GRADIENT DATA:',
										gradientData
									);
									debugLog(
										'🎨 SVG GRADIENT ID:',
										svgGradientId
									);
									return (
										<defs>
											<linearGradient
												id={ svgGradientId }
												x1="0%"
												y1="0%"
												x2="100%"
												y2="0%"
											>
												{ gradientData?.stops?.length >
												0
													? gradientData.stops.map(
															( stop, index ) => {
																debugLog(
																	`🎨 SVG STOP ${ index }:`,
																	stop
																);
																return (
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
																);
															}
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
										</defs>
									);
								} )() }
							{ isSparkle ? (
								<g
									className={ `sparkle-group sparkle-group-${
										animationId || 'default'
									}` }
									fill={ editorLineColor }
								>
									{ generateSparkleElements(
										squiggleAmplitude || 18,
										sparkleVerticalAmplitude || 15,
										Math.max( 800, containerWidth + 100 ),
										sparkleRandomness ?? 100
									).map( ( sparkle, index ) => (
										<polygon
											key={ index }
											points={ sparkle.points }
											className="sparkle-element"
											style={ sparkle.style }
										/>
									) ) }
								</g>
							) : (
								<path
									d={
										isZigzag
											? generateZigzagPath(
													squiggleAmplitude || 15,
													Math.max( 800, containerWidth + 100 )
											  )
											: generateSquigglePath(
													squiggleAmplitude || 10,
													Math.max( 800, containerWidth + 100 )
											  )
									}
									fill="none"
									stroke={ editorLineColor }
									strokeWidth={ strokeWidth || 1 }
									strokeLinecap="round"
									strokeLinejoin="round"
									className={ `${
										isZigzag ? 'zigzag' : 'squiggle'
									}-path ${
										isZigzag ? 'zigzag' : 'squiggle'
									}-path-${ animationId || 'default' }` }
									style={ {
										transformOrigin: 'center',
										stroke: editorLineColor,
										display: 'block',
										animation: finalPaused
											? 'none'
											: `${
													isZigzag
														? isReversed
															? 'zigzag-flow-reverse'
															: 'zigzag-flow'
														: isReversed
														? 'squiggle-flow-reverse'
														: 'squiggle-flow'
											  } ${
													animationSpeed || 1.6
											  }s linear infinite`,
									} }
								/>
							) }
						</svg>
					</div>
				</div>

				{ /* Add our custom pattern-specific controls to the inspector */ }
				<InspectorControls group="settings">
					<PanelBody
						title={ __(
							isSparkle
								? 'Sparkle Settings'
								: isZigzag
								? 'Zig-Zag Settings'
								: 'Squiggle Settings',
							'awesome-squiggle'
						) }
						initialOpen={ true }
					>
						{ isAnimated && (
							<>
								<RangeControl
									label={ __(
										'Animation Speed',
										'awesome-squiggle'
									) }
									value={
										animationSpeed
											? Math.round(
													11 - animationSpeed / 0.5
											  )
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
									// Enhanced accessibility
									help={ (() => {
										const speedValue = animationSpeed ? Math.round(11 - animationSpeed / 0.5) : 6;
										const speedDescription = speedValue <= 3 ? __('slow', 'awesome-squiggle') : 
																speedValue <= 7 ? __('medium', 'awesome-squiggle') : 
																__('fast', 'awesome-squiggle');
										const baseHelp = isSparkle
											? __('Control how fast the sparkles animate (higher = faster)', 'awesome-squiggle')
											: isZigzag
											? __('Control how fast the zig-zag animates (higher = faster)', 'awesome-squiggle')
											: __('Control how fast the squiggle animates (higher = faster)', 'awesome-squiggle');
										return sprintf(
											__('%s Current speed: %s. Use arrow keys or drag to adjust. Hold Shift + arrow keys for larger increments.', 'awesome-squiggle'),
											baseHelp,
											speedDescription
										);
									})() }
									aria-describedby="speed-help"
									onKeyDown={ ( e ) => {
										const currentValue = animationSpeed ? Math.round(11 - animationSpeed / 0.5) : 6;
										if ( e.shiftKey && e.key === 'ArrowLeft' ) {
											e.preventDefault();
											const newValue = Math.max( 1, currentValue - 5 );
											setSecureAttributes( setAttributes, {
												animationSpeed: newValue,
											} );
										} else if ( e.shiftKey && e.key === 'ArrowRight' ) {
											e.preventDefault();
											const newValue = Math.min( 10, currentValue + 5 );
											setSecureAttributes( setAttributes, {
												animationSpeed: newValue,
											} );
										}
									} }
								/>
								<div id="speed-help" className="screen-reader-text">
									{ __( 'Hold Shift and use arrow keys for larger increments', 'awesome-squiggle' ) }
								</div>
								<ToggleControl
									label={ __(
										'Reverse Animation',
										'awesome-squiggle'
									) }
									checked={ isReversed || false }
									onChange={ () =>
										setSecureAttributes( setAttributes, {
											isReversed: ! isReversed,
										} )
									}
									help={ __(
										isSparkle
											? 'Make the sparkles animate in the opposite direction'
											: isZigzag
											? 'Make the zig-zag animate in the opposite direction'
											: 'Make the squiggle animate in the opposite direction',
										'awesome-squiggle'
									) }
								/>
							</>
						) }
						<RangeControl
							label={ __(
								isSparkle
									? 'Sparkle Size'
									: isZigzag
									? 'Zig-Zag Amplitude'
									: 'Squiggle Amplitude',
								'awesome-squiggle'
							) }
							value={
								squiggleAmplitude ||
								( isSparkle ? 18 : isZigzag ? 15 : 10 )
							}
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									squiggleAmplitude: value,
								} )
							}
							min={ isSparkle ? 8 : 5 }
							max={ isSparkle ? 35 : 25 }
							// Enhanced accessibility
							help={ (() => {
								const currentValue = squiggleAmplitude || ( isSparkle ? 18 : isZigzag ? 15 : 10 );
								const minVal = isSparkle ? 8 : 5;
								const maxVal = isSparkle ? 35 : 25;
								const range = maxVal - minVal;
								const percentage = Math.round(((currentValue - minVal) / range) * 100);
								const sizeDescription = percentage <= 33 ? __('small', 'awesome-squiggle') : 
														percentage <= 66 ? __('medium', 'awesome-squiggle') : 
														__('large', 'awesome-squiggle');
								const baseHelp = isSparkle
									? __('Adjust the size of the sparkles (higher = more dramatic)', 'awesome-squiggle')
									: isZigzag
									? __('Adjust the height of the zig-zag peaks', 'awesome-squiggle')
									: __('Adjust the height of the squiggle peaks', 'awesome-squiggle');
								return sprintf(
									__('%s Current size: %s (%d). Use arrow keys or drag to adjust. Hold Shift + arrow keys for larger increments.', 'awesome-squiggle'),
									baseHelp,
									sizeDescription,
									currentValue
								);
							})() }
							aria-describedby="amplitude-help"
							onKeyDown={ ( e ) => {
								const currentValue = squiggleAmplitude || ( isSparkle ? 18 : isZigzag ? 15 : 10 );
								const jumpSize = isSparkle ? 5 : 3;
								const minVal = isSparkle ? 8 : 5;
								const maxVal = isSparkle ? 35 : 25;
								if ( e.shiftKey && e.key === 'ArrowLeft' ) {
									e.preventDefault();
									const newValue = Math.max( minVal, currentValue - jumpSize );
									setSecureAttributes( setAttributes, {
										squiggleAmplitude: newValue,
									} );
								} else if ( e.shiftKey && e.key === 'ArrowRight' ) {
									e.preventDefault();
									const newValue = Math.min( maxVal, currentValue + jumpSize );
									setSecureAttributes( setAttributes, {
										squiggleAmplitude: newValue,
									} );
								}
							} }
						/>
						<div id="amplitude-help" className="screen-reader-text">
							{ __( 'Hold Shift and use arrow keys for larger increments', 'awesome-squiggle' ) }
						</div>
						{ isSparkle && (
							<>
								<RangeControl
									label={ __(
										'Sparkle Vertical Spread',
										'awesome-squiggle'
									) }
									value={ sparkleVerticalAmplitude || 15 }
									onChange={ ( value ) =>
										setSecureAttributes( setAttributes, {
											sparkleVerticalAmplitude: value,
										} )
									}
									min={ 0 }
									max={ 30 }
									// Enhanced accessibility
									help={ (() => {
										const currentValue = sparkleVerticalAmplitude || 15;
										const percentage = Math.round((currentValue / 30) * 100);
										const spreadDescription = percentage <= 25 ? __('minimal', 'awesome-squiggle') : 
																percentage <= 50 ? __('moderate', 'awesome-squiggle') : 
																percentage <= 75 ? __('wide', 'awesome-squiggle') : 
																__('maximum', 'awesome-squiggle');
										return sprintf(
											__('Control how high and low the sparkles spread from the center line. Current spread: %s (%d). Use arrow keys or drag to adjust. Hold Shift + arrow keys for larger increments.', 'awesome-squiggle'),
											spreadDescription,
											currentValue
										);
									})() }
									aria-describedby="vertical-spread-help"
									onKeyDown={ ( e ) => {
										const currentValue = sparkleVerticalAmplitude || 15;
										if ( e.shiftKey && e.key === 'ArrowLeft' ) {
											e.preventDefault();
											const newValue = Math.max( 0, currentValue - 5 );
											setSecureAttributes( setAttributes, {
												sparkleVerticalAmplitude: newValue,
											} );
										} else if ( e.shiftKey && e.key === 'ArrowRight' ) {
											e.preventDefault();
											const newValue = Math.min( 30, currentValue + 5 );
											setSecureAttributes( setAttributes, {
												sparkleVerticalAmplitude: newValue,
											} );
										}
									} }
								/>
								<div id="vertical-spread-help" className="screen-reader-text">
									{ __( 'Hold Shift and use arrow keys for larger increments', 'awesome-squiggle' ) }
								</div>
								<RangeControl
									label={ __( 'Twinkle Randomness', 'awesome-squiggle' ) }
									value={ (attributes?.sparkleRandomness ?? 100) }
									onChange={ ( value ) => setSecureAttributes( setAttributes, { sparkleRandomness: value } ) }
									min={ 0 }
									max={ 200 }
									help={ __( 'Controls how varied the sparkle twinkle timing is. 0% = uniform, 100% = normal, 200% = highly varied.', 'awesome-squiggle' ) }
								/>
							</>
						) }
					</PanelBody>
					<PanelBody
						title={ __(
							isSparkle
								? 'Sparkle Dimensions'
								: isZigzag
								? 'Zig-Zag Dimensions'
								: 'Squiggle Dimensions',
							'awesome-squiggle'
						) }
						initialOpen={ false }
					>
						{ ! isSparkle && (
							<>
								<RangeControl
									label={ __(
										'Stroke Width',
										'awesome-squiggle'
									) }
									value={ strokeWidth || 1 }
									onChange={ ( value ) =>
										setSecureAttributes( setAttributes, {
											strokeWidth: value,
										} )
									}
									min={ 1 }
									max={ 8 }
									// Enhanced accessibility
									help={ (() => {
										const currentValue = strokeWidth || 1;
										const percentage = Math.round(((currentValue - 1) / 7) * 100);
										const widthDescription = percentage <= 25 ? __('thin', 'awesome-squiggle') : 
																percentage <= 50 ? __('medium', 'awesome-squiggle') : 
																percentage <= 75 ? __('thick', 'awesome-squiggle') : 
																__('very thick', 'awesome-squiggle');
										const baseHelp = isZigzag
											? __('Adjust the thickness of the zig-zag line', 'awesome-squiggle')
											: __('Adjust the thickness of the squiggle line', 'awesome-squiggle');
										return sprintf(
											__('%s Current width: %s (%dpx). Use arrow keys or drag to adjust. Hold Shift + arrow keys for larger increments.', 'awesome-squiggle'),
											baseHelp,
											widthDescription,
											currentValue
										);
									})() }
									aria-describedby="stroke-width-help"
									onKeyDown={ ( e ) => {
										const currentValue = strokeWidth || 1;
										if ( e.shiftKey && e.key === 'ArrowLeft' ) {
											e.preventDefault();
											const newValue = Math.max( 1, currentValue - 2 );
											setSecureAttributes( setAttributes, {
												strokeWidth: newValue,
											} );
										} else if ( e.shiftKey && e.key === 'ArrowRight' ) {
											e.preventDefault();
											const newValue = Math.min( 8, currentValue + 2 );
											setSecureAttributes( setAttributes, {
												strokeWidth: newValue,
											} );
										}
									} }
								/>
								<div id="stroke-width-help" className="screen-reader-text">
									{ __( 'Hold Shift and use arrow keys for larger increments', 'awesome-squiggle' ) }
								</div>
							</>
						) }
						<SelectControl
							label={ __(
								isSparkle
									? 'Sparkle Height'
									: isZigzag
									? 'Zig-Zag Height'
									: 'Squiggle Height',
								'awesome-squiggle'
							) }
							value={ squiggleHeight || '100px' }
							options={ [
								{ label: '50px', value: '50px' },
								{ label: '75px', value: '75px' },
								{ label: '100px', value: '100px' },
								{ label: '125px', value: '125px' },
								{ label: '150px', value: '150px' },
								{ label: '200px', value: '200px' },
							] }
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									squiggleHeight: value,
								} )
							}
							help={ __(
								isSparkle
									? 'Set the height of the sparkle container'
									: isZigzag
									? 'Set the height of the zig-zag container'
									: 'Set the height of the squiggle container',
								'awesome-squiggle'
							) }
						/>
					</PanelBody>
				</InspectorControls>
			</>
		);
	};
}, 'withSquiggleControls' );

// Apply the squiggle controls enhancement to separator blocks
addFilter(
	'editor.BlockEdit',
	'awesome-squiggle/squiggle-controls',
	withSquiggleControls,
	20
);

// Override the save element for squiggle separators
addFilter(
	'blocks.getSaveElement',
	'awesome-squiggle/separator-squiggle-save',
	( element, blockType, attributes ) => {
		if ( blockType.name !== 'core/separator' ) {
			return element;
		}

		// Check both element props and attributes for className (fixes alignfull/alignwide)
		const className = element?.props?.className || attributes?.className || '';
		const isSquiggle = isSquiggleStyle( className );
		const isZigzag = isZigzagStyle( className );
		const isSparkle = isSparkleStyle( className );
		const isCustom = isCustomStyle( className );

		if ( ! isCustom ) {
			return element;
		}

		const {
			strokeWidth = 1,
			animationSpeed = 2.5, // Default duration for speed level 6
			squiggleAmplitude = isSparkle ? 18 : isZigzag ? 15 : 10,
			sparkleVerticalAmplitude = 15,
			sparkleRandomness = 100,
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
		} = attributes;

		debugLog( '🎨 SAVE FUNCTION - Block attributes:', {
			gradient,
			gradientId,
			style: style?.color?.gradient,
			className,
		} );

		// Extract color information from WordPress classes
		const extractColorFromClassName = ( className ) => {
			if ( ! className ) return null;

			// Look for background color classes (has-{color}-background-color)
			const bgColorMatch = className.match(
				/has-([a-zA-Z0-9-]+)-background-color/
			);
			if ( bgColorMatch ) {
				const colorSlug = bgColorMatch[ 1 ];
				return `var(--wp--preset--color--${ colorSlug })`;
			}

			// Look for text color classes (has-{color}-color)
			const textColorMatch = className.match(
				/has-([a-zA-Z0-9-]+)-color(?!\s*background)/
			);
			if ( textColorMatch ) {
				const colorSlug = textColorMatch[ 1 ];
				return `var(--wp--preset--color--${ colorSlug })`;
			}

			return null;
		};

		// Determine if animation should be paused based on style
		let finalPaused = false;
		if (
			className &&
			( className.includes( 'is-style-static-squiggle' ) ||
				className.includes( 'is-style-static-zigzag' ) ||
				className.includes( 'is-style-static-sparkle' ) )
		) {
			finalPaused = true;
		}

		// Get line color - prioritize background color settings for the line
		let lineColor = 'currentColor';
		let finalGradient = null;

		debugLog( '🎨 SAVE DEBUG: Color attributes:', {
			backgroundColor,
			customBackgroundColor,
			textColor,
			customTextColor,
			style,
			className,
			gradient,
		} );
		debugLog( '🎨 SAVE DEBUG: Pattern type:', {
			isSquiggle,
			isZigzag,
			isSparkle,
			gradientId,
		} );

		// Check if gradient should be used - check all possible gradient sources
		const customGradient = gradient || style?.color?.gradient;

		// Variable to store the gradient ID consistently
		let usedGradientId = null;

		if ( customGradient ) {
			// Always use the stored gradient ID, never generate in save
			if ( gradientId ) {
				usedGradientId = gradientId;
				finalGradient = customGradient;
				lineColor = `url(#${ usedGradientId })`;
				const parsedGradient = parseGradient( customGradient );
				debugLog(
					'🎨 SAVE GRADIENT DEBUG: Using gradient:',
					customGradient,
					'Parsed:',
					parsedGradient
				);
				debugLog( '🎨 SAVE GRADIENT STOPS:', parsedGradient?.stops );
				debugLog(
					'🎨 SAVE GRADIENT ID for',
					isZigzag ? 'ZIGZAG' : 'SQUIGGLE',
					':',
					usedGradientId
				);
			} else {
				// If no gradient ID but has gradient, use solid color fallback
				debugLog(
					'⚠️ WARNING: Gradient exists but no gradientId stored'
				);
				lineColor = 'currentColor';
			}
		} else {
			// Check all possible color sources in priority order
			if ( backgroundColor ) {
				lineColor = `var(--wp--preset--color--${ backgroundColor })`;
			} else if ( customBackgroundColor ) {
				lineColor = customBackgroundColor;
			} else if ( style?.color?.background ) {
				lineColor = style.color.background;
			} else {
				// Try to extract color from className
				const classNameColor = extractColorFromClassName( className );
				if ( classNameColor ) {
					lineColor = classNameColor;
				} else if ( textColor ) {
					lineColor = `var(--wp--preset--color--${ textColor })`;
				} else if ( customTextColor ) {
					lineColor = customTextColor;
				} else if ( style?.color?.text ) {
					lineColor = style.color.text;
				}
			}
		}

		debugLog(
			'🎨 SAVE Final color:',
			lineColor,
			'Gradient:',
			finalGradient
		);

		// Build class names that preserve WordPress's color support
		// Clean up duplicate class names and ensure proper ordering
		let classNames = [ 'wp-block-separator', 'awesome-squiggle-wave' ];

		// Parse existing className to avoid duplicates
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

		// Add animation state
		if ( finalPaused && ! classNames.includes( 'is-paused' ) ) {
			classNames.push( 'is-paused' );
		}

		// Remove any duplicates and join
		const combinedClassName = [ ...new Set( classNames ) ].join( ' ' );

		// Determine animation name based on pattern type and direction
		let animationName;
		if ( finalPaused ) {
			animationName = 'none';
		} else if ( isZigzag ) {
			animationName = isReversed ? 'zigzag-flow-reverse' : 'zigzag-flow';
		} else if ( isSparkle ) {
			animationName = 'none'; // Sparkles don't use group animation, individual elements twinkle via CSS
		} else {
			animationName = isReversed
				? 'squiggle-flow-reverse'
				: 'squiggle-flow';
		}

		const inlineStyles = {
			height: squiggleHeight,
			backgroundColor: 'transparent', // Container background always transparent
			[ `--animation-duration` ]: `${ animationSpeed }s`,
			[ `--animation-name` ]: animationName,
		};

		// Merge any existing styles but exclude the color object and override background
		if ( style ) {
			const { color, ...otherStyles } = style;
			Object.assign( inlineStyles, otherStyles );
			inlineStyles.backgroundColor = 'transparent';
		}

		// Data attributes for frontend sparkle regeneration
		const sparkleDataAttrs = isSparkle
			? {
                // Clamp to validated ranges to keep frontend logic safe
                'data-sparkle-size': String(
                    Math.max( 8, Math.min( 35, squiggleAmplitude || 18 ) )
                ),
                'data-sparkle-vertical-amplitude': String(
                    Math.max(
                        0,
                        Math.min( 30, sparkleVerticalAmplitude || 15 )
                    )
                ),
				'data-animation-speed': String(
					Math.max( 0.5, Math.min( 5, animationSpeed || 1.6 ) )
				),
				'data-sparkle-randomness': String(
					Math.max( 0, Math.min( 200, (attributes?.sparkleRandomness ?? 100) ) )
				),
			}
			: {};

		// Use a wider viewBox to minimize stretching on wide screens
		const viewBoxWidth = 2400;

		return (
			<div className={ combinedClassName } style={ inlineStyles } { ...sparkleDataAttrs }>
				<svg
					viewBox={ `0 0 ${ viewBoxWidth } 100` }
					preserveAspectRatio="none"
					role="img"
					aria-label={ __(
						`Decorative ${ isSparkle ? 'sparkle' : isZigzag ? 'zigzag' : 'wavy' } divider`,
						'awesome-squiggle'
					) }
					aria-describedby={ `squiggle-desc-${ animationId || 'default' }` }
					style={ {
						width: '100%',
						height: '100%',
						display: 'block',
					} }
				>
					<title>
						{ __(
							`${ isSparkle ? 'Sparkle' : isZigzag ? 'Zigzag' : 'Wavy' } separator`,
							'awesome-squiggle'
						) }
					</title>
					<desc id={ `squiggle-desc-${ animationId || 'default' }` }>
						{ __(
							`A decorative ${ isSparkle ? 'sparkle' : isZigzag ? 'zigzag' : 'wavy' } pattern used as a visual divider between content sections.${ 
								finalPaused ? '' : ' This pattern includes gentle animation.'
							}`,
							'awesome-squiggle'
						) }
					</desc>
					{ finalGradient &&
						usedGradientId &&
						( () => {
							const gradientData = parseGradient( finalGradient );
							debugLog(
								'🎨 SAVE SVG GRADIENT DATA:',
								gradientData
							);
							debugLog(
								'🎨 SAVE SVG GRADIENT ID:',
								usedGradientId
							);
							return (
								<defs>
									<linearGradient
										id={ usedGradientId }
										x1="0%"
										y1="0%"
										x2="100%"
										y2="0%"
									>
										{ gradientData?.stops?.length > 0
											? gradientData.stops.map(
													( stop, index ) => {
														debugLog(
															`🎨 SAVE SVG STOP ${ index }:`,
															stop
														);
														return (
															<stop
																key={ index }
																offset={
																	stop.offset
																}
																stopColor={
																	stop.color
																}
															/>
														);
													}
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
								</defs>
							);
						} )() }
					{ isSparkle ? (
						<g
							className={ `sparkle-group ${
								animationId
									? `sparkle-group-${ animationId }`
									: ''
							}` }
							fill={ lineColor }
							style={ {
								transformOrigin: 'center',
								animation: 'none', // Sparkle groups don't animate - individual elements do
							} }
						>
								{ generateSparkleElements(
									squiggleAmplitude,
									sparkleVerticalAmplitude,
									viewBoxWidth,
									sparkleRandomness
								).map( ( sparkle, index ) => (
								<polygon
									key={ index }
									points={ sparkle.points }
									className="sparkle-element"
									style={ sparkle.style }
								/>
							) ) }
						</g>
					) : (
						<path
							d={
								isZigzag
									? generateZigzagPath( squiggleAmplitude, viewBoxWidth )
									: generateSquigglePath( squiggleAmplitude, viewBoxWidth )
							}
							fill="none"
							stroke={ lineColor }
							strokeWidth={ strokeWidth }
							strokeLinecap="round"
							strokeLinejoin="round"
							className={ `${
								isZigzag ? 'zigzag' : 'squiggle'
							}-path ${
								animationId
									? `${
											isZigzag ? 'zigzag' : 'squiggle'
									  }-path-${ animationId }`
									: ''
							}` }
							style={ {
								transformOrigin: 'center',
								stroke: lineColor,
								display: 'block',
								animation: finalPaused
									? 'none'
									: `${ animationName } ${ animationSpeed }s linear infinite`,
							} }
						/>
					) }
				</svg>
			</div>
		);
	},
	20
);

// Register block styles for squiggle and zig-zag options
wp.domReady( () => {
	// Animated Squiggle Style
	registerBlockStyle( 'core/separator', {
		name: 'animated-squiggle',
		label: __( 'Animated Squiggle', 'awesome-squiggle' ),
		isDefault: false,
	} );

	// Static Squiggle Style
	registerBlockStyle( 'core/separator', {
		name: 'static-squiggle',
		label: __( 'Static Squiggle', 'awesome-squiggle' ),
		isDefault: false,
	} );

	// Animated Zig-Zag Style
	registerBlockStyle( 'core/separator', {
		name: 'animated-zigzag',
		label: __( 'Animated Zig-Zag', 'awesome-squiggle' ),
		isDefault: false,
	} );

	// Static Zig-Zag Style
	registerBlockStyle( 'core/separator', {
		name: 'static-zigzag',
		label: __( 'Static Zig-Zag', 'awesome-squiggle' ),
		isDefault: false,
	} );

	// Animated Sparkle Style
	registerBlockStyle( 'core/separator', {
		name: 'animated-sparkle',
		label: __( 'Animated Sparkle', 'awesome-squiggle' ),
		isDefault: false,
	} );

	// Static Sparkle Style
	registerBlockStyle( 'core/separator', {
		name: 'static-sparkle',
		label: __( 'Static Sparkle', 'awesome-squiggle' ),
		isDefault: false,
	} );
} );
