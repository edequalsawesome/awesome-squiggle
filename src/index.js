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
				// Amplitude range for squiggle/zigzag waves
				secureUpdates[ key ] = validateNumericInput( value, 5, 25, 10 );
				break;
			case 'pointiness':
				// Pointiness range: 0 (smooth curves) to 100 (sharp angles)
				secureUpdates[ key ] = validateNumericInput( value, 0, 100, 0 );
				break;
			case 'angle':
				// Angle range: -60 to +60 degrees
				secureUpdates[ key ] = validateNumericInput( value, -60, 60, 0 );
				break;
			case 'isAnimated':
				secureUpdates[ key ] = value === true;
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
// LEGACY: Kept for backwards compatibility, use generateWavePath for new code
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

/**
 * Generate a unified wave path with variable pointiness and angle
 * This replaces both generateSquigglePath and generateZigzagPath
 *
 * @param {number} amplitude - Wave height (5-25px)
 * @param {number} pathWidth - Width of the path
 * @param {number} pointiness - 0 = smooth curves (squiggle), 100 = sharp points (zigzag)
 * @param {number} angle - Peak angle in degrees (-60 to +60)
 * @returns {string} SVG path d attribute
 */
const generateWavePath = ( amplitude = 10, pathWidth = 800, pointiness = 0, angle = 0 ) => {
	// Security: Validate all inputs
	amplitude = validateNumericInput( amplitude, 5, 25, 10 );
	pointiness = validateNumericInput( pointiness, 0, 100, 0 );
	angle = validateNumericInput( angle, -60, 60, 0 );

	const wavelength = 40;
	const width = pathWidth;
	const height = 100;
	const midY = height / 2;

	// Convert angle to radians for offset calculation
	const angleRad = ( angle * Math.PI ) / 180;

	// Calculate horizontal offset for angled peaks
	const xOffset = amplitude * Math.sin( angleRad );
	const yMultiplier = Math.cos( angleRad );

	// Start path
	let d = `M-${ wavelength * 2 },${ midY }`;
	let isUpPeak = true;

	// Generate wave segments
	for (
		let x = -wavelength * 2;
		x <= width + wavelength * 2;
		x += wavelength
	) {
		// Calculate peak position with angle offset
		const peakX = x + wavelength / 2 + ( isUpPeak ? xOffset : -xOffset );
		const peakY = isUpPeak
			? midY - ( amplitude * yMultiplier )
			: midY + ( amplitude * yMultiplier );
		const endX = x + wavelength;

		if ( pointiness >= 100 ) {
			// Pure zig-zag: straight lines to peak and back
			d += ` L${ peakX },${ peakY } L${ endX },${ midY }`;
		} else if ( pointiness <= 0 ) {
			// Pure squiggle: smooth cubic Bezier curves
			const cp1x = x + wavelength * 0.375;
			const cp2x = x + wavelength * 0.625;
			d += ` C${ cp1x },${ peakY } ${ cp2x },${ peakY } ${ endX },${ midY }`;
		} else {
			// Hybrid: quadratic Bezier with tightness based on pointiness
			// Higher pointiness = tighter curve around peak
			const tension = pointiness / 100;

			// Calculate quadratic control points that blend between smooth and sharp
			const qcp1x = x + ( peakX - x ) * ( 0.5 + tension * 0.4 );
			const qcp1y = midY + ( peakY - midY ) * ( 0.7 + tension * 0.3 );
			const qcp2x = peakX + ( endX - peakX ) * ( 0.5 - tension * 0.4 );
			const qcp2y = midY + ( peakY - midY ) * ( 0.7 + tension * 0.3 );

			d += ` Q${ qcp1x },${ qcp1y } ${ peakX },${ peakY }`;
			d += ` Q${ qcp2x },${ qcp2y } ${ endX },${ midY }`;
		}

		isUpPeak = ! isUpPeak;
	}

	return d;
};

/**
 * Generate a long continuous wave path with many wavelengths
 * Uses The Outline's technique: a long path that extends beyond the viewBox
 * and gets clipped naturally - no pattern tiling seams
 *
 * @param {number} amplitude - Wave height (5-25px)
 * @param {number} pointiness - 0 = smooth curves (squiggle), 100 = sharp points (zigzag)
 * @param {number} angle - Peak angle in degrees (-60 to +60)
 * @param {number} strokeWidth - Line thickness (for padding calculation)
 * @param {number} repetitions - Number of wavelengths to generate (default 50)
 * @param {number} containerHeight - Height of the container (default 100)
 * @returns {Object} { d: string, height: number, wavelength: number, totalWidth: number }
 */
const generateLongWavePath = ( amplitude = 10, pointiness = 0, angle = 0, strokeWidth = 1, repetitions = 50, containerHeight = 100 ) => {
	// Security: Validate all inputs
	amplitude = validateNumericInput( amplitude, 5, 25, 10 );
	pointiness = validateNumericInput( pointiness, 0, 100, 0 );
	angle = validateNumericInput( angle, -60, 60, 0 );
	strokeWidth = validateNumericInput( strokeWidth, 1, 8, 1 );

	const wavelength = 40;
	// Use the container height directly so viewBox matches container - no scaling issues
	const height = containerHeight;
	const midY = height / 2;
	const totalWidth = wavelength * repetitions;

	// Convert angle to radians for offset calculation
	const angleRad = ( angle * Math.PI ) / 180;
	const xOffset = amplitude * Math.sin( angleRad );
	const yMultiplier = Math.cos( angleRad );
	const adjustedAmplitude = amplitude * yMultiplier;

	// Start before the viewBox to ensure animation loops seamlessly
	const startX = -wavelength * 2;
	let d = `M${ startX },${ midY }`;

	// Generate many wavelengths
	for ( let i = 0; i < repetitions + 4; i++ ) {
		const baseX = startX + ( i * wavelength );
		const isUpPeak = i % 2 === 0;

		if ( pointiness >= 100 ) {
			// Pure zigzag: straight lines to peaks
			const peakX = baseX + wavelength / 2 + ( isUpPeak ? xOffset : -xOffset );
			const peakY = isUpPeak ? midY - adjustedAmplitude : midY + adjustedAmplitude;
			const endX = baseX + wavelength;
			d += ` L${ peakX },${ peakY } L${ endX },${ midY }`;
		} else if ( pointiness <= 0 ) {
			// Pure squiggle: smooth cubic Bezier curves
			// Use original control point positions (0.375 and 0.625) for correct curve shape
			const peakY = isUpPeak ? midY - adjustedAmplitude : midY + adjustedAmplitude;
			const cp1x = baseX + wavelength * 0.375;
			const cp2x = baseX + wavelength * 0.625;
			const endX = baseX + wavelength;
			d += ` C${ cp1x },${ peakY } ${ cp2x },${ peakY } ${ endX },${ midY }`;
		} else {
			// Hybrid: quadratic curves with variable tension
			const tension = pointiness / 100;
			const peakX = baseX + wavelength / 2 + ( isUpPeak ? xOffset * tension : -xOffset * tension );
			const peakY = isUpPeak ? midY - adjustedAmplitude : midY + adjustedAmplitude;
			const endX = baseX + wavelength;

			// Quadratic control points - blend between smooth (0.375/0.625) and sharp (0.5)
			const qcp1x = baseX + wavelength * ( 0.375 + tension * 0.125 );
			const qcp2x = baseX + wavelength * ( 0.625 - tension * 0.125 );

			d += ` Q${ qcp1x },${ peakY } ${ peakX },${ peakY }`;
			d += ` Q${ qcp2x },${ peakY } ${ endX },${ midY }`;
		}
	}

	return { d, height, wavelength, totalWidth };
};

// Helper function to check if current style is a squiggle style (new or legacy)
const isSquiggleStyle = ( className ) => {
	return (
		className &&
		( className.includes( 'is-style-squiggle' ) ||
			// Legacy support
			className.includes( 'is-style-animated-squiggle' ) ||
			className.includes( 'is-style-static-squiggle' ) )
	);
};

// Helper function to check if current style is a zig-zag style (new or legacy)
const isZigzagStyle = ( className ) => {
	return (
		className &&
		( className.includes( 'is-style-zigzag' ) ||
			// Legacy support
			className.includes( 'is-style-animated-zigzag' ) ||
			className.includes( 'is-style-static-zigzag' ) )
	);
};

// Helper function to check if current style is a lightning style
const isLightningStyle = ( className ) => {
	return className && className.includes( 'is-style-lightning' );
};

// Helper function to check if legacy animated style (for migration)
const isLegacyAnimatedStyle = ( className ) => {
	return (
		className &&
		( className.includes( 'is-style-animated-squiggle' ) ||
			className.includes( 'is-style-animated-zigzag' ) )
	);
};

// Helper function to check if legacy static style (for migration)
const isLegacyStaticStyle = ( className ) => {
	return (
		className &&
		( className.includes( 'is-style-static-squiggle' ) ||
			className.includes( 'is-style-static-zigzag' ) )
	);
};

// Helper function to check if any legacy style
const isLegacyStyle = ( className ) => {
	return isLegacyAnimatedStyle( className ) || isLegacyStaticStyle( className );
};

// Helper function to check if current style is any custom style (squiggle, zig-zag, or lightning)
const isCustomStyle = ( className ) => {
	return (
		isSquiggleStyle( className ) ||
		isZigzagStyle( className ) ||
		isLightningStyle( className )
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
				// NEW: Animation as toggle (replaces style-based animated/static)
				isAnimated: {
					type: 'boolean',
					default: true, // Animation on by default
				},
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
				// NEW: Pattern-based rendering flag for migration
				patternBased: {
					type: 'boolean',
					default: true, // New blocks default to pattern-based
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
		
		// Container width measurement for dynamic viewBox sizing
		const [containerWidth, setContainerWidth] = useState(800);
		const containerRef = useRef(null);

		// Pre-calculate values needed for useBlockProps
		const {
			className = '',
			squiggleHeight = '100px',
			animationSpeed = 1.6,
			isReversed = false,
			// NEW: Parametric wave controls (with defaults based on style)
			isAnimated: isAnimatedAttr,
			pointiness: pointinessAttr,
			angle: angleAttr,
		} = attributes || {};

		const isSquiggle = isSquiggleStyle( className );
		const isZigzag = isZigzagStyle( className );
		const isLightning = isLightningStyle( className );
		const isCustom = isCustomStyle( className );
		const isLegacy = isLegacyStyle( className );

		// For legacy styles, determine animation from class name; for new styles, use attribute
		const isAnimated = isLegacy
			? isLegacyAnimatedStyle( className )
			: ( isAnimatedAttr !== undefined ? isAnimatedAttr : true );

		// Calculate effective pointiness and angle based on style (defaults if not set)
		const effectivePointiness = pointinessAttr !== undefined
			? pointinessAttr
			: ( isZigzag || isLightning ? 100 : 0 );
		const effectiveAngle = angleAttr !== undefined
			? angleAttr
			: ( isLightning ? 40 : 0 );

		// Determine if animation should be paused (either explicitly disabled or legacy static style)
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
			// Calculate defaults based on style
			const defaultAmplitude = ( isZigzag || isLightning ) ? 15 : 10;
			const defaultPointiness = ( isZigzag || isLightning ) ? 100 : 0;
			const defaultAngle = isLightning ? 40 : 0;
			// For legacy styles, infer animation from class; for new styles, default to true
			const defaultIsAnimated = isLegacy ? isLegacyAnimatedStyle( className ) : true;

			const patternType = isLightning ? 'lightning' : ( isZigzag ? 'zigzag' : 'squiggle' );
			const newAnimationId = generateAnimationId(
				patternType,
				clientId,
				1,
				defaultAmplitude
			);
			const currentGradient = gradient || style?.color?.gradient || '';
			const newGradientId = generateGradientId(
				patternType,
				currentGradient,
				clientId
			);
			setSecureAttributes( setAttributes, {
				strokeWidth: 1,
				animationSpeed: 6, // Default to speed level 6 (which converts to 2.5s duration)
				squiggleAmplitude: defaultAmplitude,
				squiggleHeight: '100px',
				animationId: newAnimationId,
				isReversed: false,
				gradientId: newGradientId,
				// NEW: Parametric wave defaults based on style
				pointiness: defaultPointiness,
				angle: defaultAngle,
				isAnimated: defaultIsAnimated,
			} );
		}

		// Ensure each block has a unique animation ID
		if ( isCustom && ! animationId ) {
			const patternType = isZigzag ? 'zigzag' : 'squiggle';
			const defaultAmplitude = isZigzag ? 15 : 10;
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

		// MIGRATION: Convert legacy styles to new parametric styles
		// This runs once when a legacy block is opened in the editor
		if ( isLegacy && className ) {
			// Determine the new style and animation state based on legacy class
			let newClassName = className;
			let newIsAnimated = true;

			if ( className.includes( 'is-style-animated-squiggle' ) ) {
				newClassName = className.replace( 'is-style-animated-squiggle', 'is-style-squiggle' );
				newIsAnimated = true;
			} else if ( className.includes( 'is-style-static-squiggle' ) ) {
				newClassName = className.replace( 'is-style-static-squiggle', 'is-style-squiggle' );
				newIsAnimated = false;
			} else if ( className.includes( 'is-style-animated-zigzag' ) ) {
				newClassName = className.replace( 'is-style-animated-zigzag', 'is-style-zigzag' );
				newIsAnimated = true;
			} else if ( className.includes( 'is-style-static-zigzag' ) ) {
				newClassName = className.replace( 'is-style-static-zigzag', 'is-style-zigzag' );
				newIsAnimated = false;
			}

			// Apply migration - this converts the block to new format
			if ( newClassName !== className ) {
				debugLog( '🔄 MIGRATION: Converting legacy style to new format:', {
					oldClassName: className,
					newClassName,
					newIsAnimated,
				} );

				// Set pointiness based on pattern type (zigzag = 100, squiggle = 0)
				const newPointiness = newClassName.includes( 'is-style-zigzag' ) ? 100 : 0;

				setSecureAttributes( setAttributes, {
					className: newClassName,
					isAnimated: newIsAnimated,
					pointiness: newPointiness,
					angle: 0,
				} );
			}
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
					const defaultAmplitude = isZigzag ? 15 : 10;
					const newAnimationId = generateAnimationId(
						isZigzag ? 'zigzag' : 'squiggle',
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
                        /* Wave animation - shifts by exactly 1 full wave cycle (80px = 2 half-wavelengths) for seamless loop */
                        @keyframes wave-flow {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(-80px); }
                        }
                        @keyframes wave-flow-reverse {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(80px); }
                        }
                        /* Legacy keyframes for backwards compatibility */
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
                        .awesome-squiggle-editor-preview .wave-path {
                            transform-origin: left center;
                        }
                    ` }
				</style>
				<div { ...blockProps }>
					{ /* Long path SVG rendering - uses The Outline's technique for seamless animation */ }
					{ ( () => {
						const effectiveAmplitude = squiggleAmplitude || 15;
						const effectiveStrokeWidth = strokeWidth || 1;
						// Parse container height from squiggleHeight (e.g., "100px" -> 100)
						const containerHeight = parseInt( squiggleHeight, 10 ) || 100;

						// Generate long continuous wave path (no pattern tiling = no seams)
						// Use 150 repetitions = 6000px to cover ultra-wide screens (4K+)
						// Pass containerHeight so the wave is drawn to fit exactly
						const { d: wavePath, height: waveHeight, wavelength, totalWidth } =
							generateLongWavePath(
								effectiveAmplitude,
								effectivePointiness,
								effectiveAngle,
								effectiveStrokeWidth,
								150, // 150 wavelengths = 6000px of wave for 4K+ support
								containerHeight
							);

						// ViewBox width is very wide to ensure horizontal clipping, not vertical scaling
						// Height matches container exactly so no vertical scaling occurs
						const viewBoxWidth = wavelength * 150; // Match the path length

						return (
					<div
						ref={ containerRef }
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
							key={ `svg-${ gradientId || 'default' }-${ animationId || 'default' }` }
							viewBox={ `0 0 ${ viewBoxWidth } ${ waveHeight }` }
							preserveAspectRatio="xMidYMid slice"
							role="img"
							aria-label={ __(
								`Decorative ${ isZigzag ? 'zigzag' : 'wavy' } divider`,
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
									`${ isZigzag ? 'Zigzag' : 'Wavy' } separator`,
									'awesome-squiggle'
								) }
							</title>
							<desc id={ `squiggle-desc-${ animationId || 'default' }` }>
								{ __(
									`A decorative ${ isZigzag ? 'zigzag' : 'wavy' } pattern used as a visual divider between content sections.${
										isAnimated && !finalPaused ? ' This pattern includes gentle animation.' : ''
									}`,
									'awesome-squiggle'
								) }
							</desc>
							<defs>
								{ /* Gradient definition if using gradient stroke */ }
								{ finalGradient && gradientId && ( () => {
									const gradientData = parseGradient( finalGradient );
									debugLog( '🎨 LONG PATH GRADIENT DATA:', gradientData );
									// Use userSpaceOnUse with repeat so gradient is visible within viewport
									// 320px = 8 wavelengths = nice visible gradient span that repeats smoothly
									const gradientSpan = 320;
									return (
										<linearGradient
											id={ gradientId }
											gradientUnits="userSpaceOnUse"
											spreadMethod="repeat"
											x1="0"
											y1="0"
											x2={ gradientSpan }
											y2="0"
										>
											{ gradientData?.stops?.length > 0
												? gradientData.stops.map( ( stop, index ) => (
													<stop
														key={ index }
														offset={ stop.offset }
														stopColor={ stop.color }
													/>
												) )
												: [
													<stop key="fallback-0" offset="0%" stopColor="#ff6b35" />,
													<stop key="fallback-1" offset="100%" stopColor="#f7931e" />,
												]
											}
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
								className={ `wave-path wave-path-${ animationId || 'default' }` }
								style={ {
									animation: finalPaused
										? 'none'
										: `${ isReversed ? 'wave-flow-reverse' : 'wave-flow' } ${ animationSpeed || 1.6 }s linear infinite`,
								} }
							/>
						</svg>
					</div>
						);
					} )() }
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
							value={ squiggleAmplitude || ( ( isZigzag || isLightning ) ? 15 : 10 ) }
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									squiggleAmplitude: value,
								} )
							}
							min={ 5 }
							max={ 25 }
							help={ __( 'Adjust the height of the wave peaks (5-25px)', 'awesome-squiggle' ) }
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
							help={ (() => {
								const p = effectivePointiness;
								const desc = p <= 20 ? __( 'Smooth curves', 'awesome-squiggle' ) :
											p <= 40 ? __( 'Rounded waves', 'awesome-squiggle' ) :
											p <= 60 ? __( 'Moderate sharpness', 'awesome-squiggle' ) :
											p <= 80 ? __( 'Pointed peaks', 'awesome-squiggle' ) :
											__( 'Sharp zig-zag', 'awesome-squiggle' );
								return sprintf( __( '%s (%d%%)', 'awesome-squiggle' ), desc, p );
							})() }
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
							help={ (() => {
								const a = effectiveAngle;
								const desc = a < -20 ? __( 'Left lean', 'awesome-squiggle' ) :
											a > 20 ? __( 'Right lean', 'awesome-squiggle' ) :
											__( 'Vertical peaks', 'awesome-squiggle' );
								return sprintf( __( '%s (%d\u00b0)', 'awesome-squiggle' ), desc, a );
							})() }
						/>

						{ /* Animation toggle */ }
						<ToggleControl
							label={ __( 'Animate', 'awesome-squiggle' ) }
							checked={ isAnimated }
							onChange={ ( value ) =>
								setSecureAttributes( setAttributes, {
									isAnimated: value,
								} )
							}
							help={ __( 'Enable or disable wave animation', 'awesome-squiggle' ) }
						/>

						{ /* Animation controls - only shown when animated */ }
						{ isAnimated && (
							<>
								<RangeControl
									label={ __( 'Animation Speed', 'awesome-squiggle' ) }
									value={ animationSpeed ? Math.round( 11 - animationSpeed / 0.5 ) : 6 }
									onChange={ ( value ) =>
										setSecureAttributes( setAttributes, {
											animationSpeed: value,
										} )
									}
									min={ 1 }
									max={ 10 }
									step={ 1 }
									help={ (() => {
										const speedValue = animationSpeed ? Math.round( 11 - animationSpeed / 0.5 ) : 6;
										const desc = speedValue <= 3 ? __( 'slow', 'awesome-squiggle' ) :
													speedValue <= 7 ? __( 'medium', 'awesome-squiggle' ) :
													__( 'fast', 'awesome-squiggle' );
										return sprintf( __( 'Current: %s (higher = faster)', 'awesome-squiggle' ), desc );
									})() }
								/>
								<ToggleControl
									label={ __( 'Reverse Direction', 'awesome-squiggle' ) }
									checked={ isReversed || false }
									onChange={ () =>
										setSecureAttributes( setAttributes, {
											isReversed: ! isReversed,
										} )
									}
									help={ __( 'Animate in the opposite direction', 'awesome-squiggle' ) }
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
						<SelectControl
							label={ __(
								isZigzag
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
								isZigzag
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
		const isLightning = isLightningStyle( className );
		const isLegacy = isLegacyStyle( className );
		const isCustom = isCustomStyle( className );

		if ( ! isCustom ) {
			return element;
		}

		const {
			strokeWidth = 1,
			animationSpeed = 2.5, // Default duration for speed level 6
			squiggleAmplitude = 15, // Match PHP default
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
			// NEW: Parametric wave controls
			isAnimated: isAnimatedAttr,
			pointiness: pointinessAttr,
			angle: angleAttr,
		} = attributes;

		// Calculate effective values for pointiness and angle
		const effectivePointiness = pointinessAttr !== undefined
			? pointinessAttr
			: ( isZigzag || isLightning ? 100 : 0 );
		const effectiveAngle = angleAttr !== undefined
			? angleAttr
			: ( isLightning ? 40 : 0 );

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

		// Determine if animation should be paused
		// For legacy styles, check class name; for new styles, use isAnimated attribute
		const isAnimated = isLegacy
			? isLegacyAnimatedStyle( className )
			: ( isAnimatedAttr !== undefined ? isAnimatedAttr : true );
		const finalPaused = ! isAnimated;

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

		// Determine animation name - use legacy names for legacy styles, unified for new styles
		let animationName;
		if ( finalPaused ) {
			animationName = 'none';
		} else if ( isLegacy ) {
			// Legacy styles use pattern-specific animation names for backwards compatibility
			if ( isZigzag ) {
				animationName = isReversed ? 'zigzag-flow-reverse' : 'zigzag-flow';
			} else {
				animationName = isReversed ? 'squiggle-flow-reverse' : 'squiggle-flow';
			}
		} else {
			// New styles use unified animation names
			animationName = isReversed ? 'wave-flow-reverse' : 'wave-flow';
		}

		// Determine path class name - use legacy names for legacy styles
		const pathClassName = isLegacy
			? ( isZigzag
				? `zigzag-path ${ animationId ? `zigzag-path-${ animationId }` : '' }`
				: `squiggle-path ${ animationId ? `squiggle-path-${ animationId }` : '' }` )
			: `wave-path ${ animationId ? `wave-path-${ animationId }` : '' }`;

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

		// Check if this is a new-style block (long path approach) or legacy path-based
		// New blocks use the long path technique for consistent appearance at all widths
		const useLongPathBased = ! isLegacy && attributes.patternBased !== false;

		// Parse container height from squiggleHeight (e.g., "100px" -> 100)
		const containerHeight = parseInt( squiggleHeight, 10 ) || 100;

		// Generate the appropriate SVG content based on rendering mode
		if ( useLongPathBased ) {
			// LONG PATH RENDERING: Uses The Outline's technique - a long continuous path
			// that extends beyond the viewBox and gets clipped naturally (no seams!)
			// Pass containerHeight so wave is drawn at exact container size (no vertical scaling)
			const { d: wavePath, height: waveHeight, wavelength } =
				generateLongWavePath(
					squiggleAmplitude,
					effectivePointiness,
					effectiveAngle,
					strokeWidth,
					150, // 150 wavelengths = 6000px of wave for 4K+ ultra-wide support
					containerHeight
				);

			// ViewBox width matches full path length for proper horizontal clipping
			// Height matches container exactly so no vertical scaling occurs
			const viewBoxWidth = wavelength * 150;

			return (
				<div className={ combinedClassName } style={ inlineStyles }>
					<svg
						viewBox={ `0 0 ${ viewBoxWidth } ${ waveHeight }` }
						preserveAspectRatio="xMidYMid slice"
						role="img"
						aria-label={ __(
							`Decorative ${ isZigzag ? 'zigzag' : 'wavy' } divider`,
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
								`${ isZigzag ? 'Zigzag' : 'Wavy' } separator`,
								'awesome-squiggle'
							) }
						</title>
						<desc id={ `squiggle-desc-${ animationId || 'default' }` }>
							{ __(
								`A decorative ${ isZigzag ? 'zigzag' : 'wavy' } pattern used as a visual divider between content sections.${
									finalPaused ? '' : ' This pattern includes gentle animation.'
								}`,
								'awesome-squiggle'
							) }
						</desc>
						<defs>
							{ /* Gradient definition if using gradient stroke */ }
							{ finalGradient && usedGradientId && ( () => {
								const gradientData = parseGradient( finalGradient );
								// Use userSpaceOnUse with repeat so gradient is visible within viewport
								// 320px = 8 wavelengths = nice visible gradient span that repeats smoothly
								const gradientSpan = 320;
								return (
									<linearGradient
										id={ usedGradientId }
										gradientUnits="userSpaceOnUse"
										spreadMethod="repeat"
										x1="0"
										y1="0"
										x2={ gradientSpan }
										y2="0"
									>
										{ gradientData?.stops?.length > 0
											? gradientData.stops.map( ( stop, index ) => (
												<stop
													key={ index }
													offset={ stop.offset }
													stopColor={ stop.color }
												/>
											) )
											: [
												<stop key="fallback-0" offset="0%" stopColor="#ff6b35" />,
												<stop key="fallback-1" offset="100%" stopColor="#f7931e" />,
											]
										}
									</linearGradient>
								);
							} )() }
						</defs>
						{ /* Long continuous path - animation shifts by exactly 1 wavelength (40px) */ }
						<path
							d={ wavePath }
							fill="none"
							stroke={ lineColor }
							strokeWidth={ strokeWidth }
							strokeLinecap="round"
							strokeLinejoin="round"
							className={ `wave-path wave-path-${ animationId || 'default' }` }
							style={ {
								animation: finalPaused
									? 'none'
									: `${ animationName } ${ animationSpeed }s linear infinite`,
							} }
						/>
					</svg>
				</div>
			);
		}

		// LEGACY PATH-BASED RENDERING: For backwards compatibility with old blocks
		// Uses stretched path with preserveAspectRatio="none"
		const pathWidth = 9600; // Wide enough for any screen
		const isAlignFull = ( className && className.includes( 'alignfull' ) ) ||
							( attributes.align === 'full' );
		const isAlignWide = ( className && className.includes( 'alignwide' ) ) ||
							( attributes.align === 'wide' );
		// Use wider viewBox for full/wide alignments to prevent gaps
		const viewBoxWidth = ( isAlignFull || isAlignWide ) ? 4800 : 800;
		const padding = Math.max( strokeWidth * 2, 5 );
		const viewBoxMinY = 50 - squiggleAmplitude - padding;
		const viewBoxHeight = ( squiggleAmplitude * 2 ) + ( padding * 2 );

		return (
			<div className={ combinedClassName } style={ inlineStyles }>
				<svg
					viewBox={ `0 ${ viewBoxMinY } ${ viewBoxWidth } ${ viewBoxHeight }` }
					preserveAspectRatio="none"
					role="img"
					aria-label={ __(
						`Decorative ${ isZigzag ? 'zigzag' : 'wavy' } divider`,
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
							`${ isZigzag ? 'Zigzag' : 'Wavy' } separator`,
							'awesome-squiggle'
						) }
					</title>
					<desc id={ `squiggle-desc-${ animationId || 'default' }` }>
						{ __(
							`A decorative ${ isZigzag ? 'zigzag' : 'wavy' } pattern used as a visual divider between content sections.${
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
					<path
						d={
							isLegacy
								? ( isZigzag
									? generateZigzagPath( squiggleAmplitude, pathWidth )
									: generateSquigglePath( squiggleAmplitude, pathWidth ) )
								: generateWavePath(
									squiggleAmplitude,
									pathWidth,
									effectivePointiness,
									effectiveAngle
								)
						}
						fill="none"
						stroke={ lineColor }
						strokeWidth={ strokeWidth }
						strokeLinecap="round"
						strokeLinejoin="round"
						className={ pathClassName }
						style={ {
							transformOrigin: 'center',
							stroke: lineColor,
							display: 'block',
							animation: finalPaused
								? 'none'
								: `${ animationName } ${ animationSpeed }s linear infinite`,
						} }
					/>
				</svg>
			</div>
		);
	},
	20
);

// Register block styles - shape presets only, animation is now a toggle
wp.domReady( () => {
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
} );
