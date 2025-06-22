import { registerBlockStyle } from '@wordpress/blocks';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, RangeControl, ToggleControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useEffect, useRef, useSelect } from '@wordpress/element';
import { select } from '@wordpress/data';
import './style.css';

// Security validation functions
const validateNumericInput = (value, min, max, defaultValue) => {
    if (typeof value !== 'number' || isNaN(value)) {
        return defaultValue;
    }
    return Math.max(min, Math.min(max, value));
};

const validateStringInput = (value, allowedPattern, maxLength = 100) => {
    if (typeof value !== 'string') {
        return '';
    }
    
    // Limit length to prevent DoS
    value = value.substring(0, maxLength);
    
    // Validate against pattern if provided
    if (allowedPattern && !allowedPattern.test(value)) {
        return '';
    }
    
    return value;
};

const validateGradientId = (id) => {
    // Only allow alphanumeric, dash, and underscore
    const allowedPattern = /^[a-zA-Z0-9_-]+$/;
    return validateStringInput(id, allowedPattern, 50);
};

const validateAnimationId = (id) => {
    // Only allow alphanumeric, dash, and underscore
    const allowedPattern = /^[a-zA-Z0-9_-]+$/;
    return validateStringInput(id, allowedPattern, 50);
};

// Development-only logging
const debugLog = (message, ...args) => {
    // Temporarily enable logging in all environments for debugging
    console.log('[Awesome Squiggle]', message, ...args);
};

// Secure attribute setter
const setSecureAttributes = (setAttributes, updates) => {
    const secureUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
        switch (key) {
            case 'strokeWidth':
                secureUpdates[key] = validateNumericInput(value, 1, 8, 1);
                break;
            case 'animationSpeed':
                // Convert slider value (1-10) to duration - higher numbers = faster
                // Formula: (11 - sliderValue) * 0.5 gives us 0.5s to 5s range
                const speedValue = validateNumericInput(value, 1, 10, 6);
                const duration = (11 - speedValue) * 0.5;
                secureUpdates[key] = duration;
                break;
            case 'squiggleAmplitude':
                secureUpdates[key] = validateNumericInput(value, 5, 25, 10);
                break;
            case 'animationId':
                secureUpdates[key] = validateAnimationId(value);
                break;
            case 'gradientId':
                secureUpdates[key] = validateGradientId(value);
                break;
            case 'squiggleHeight':
                // Validate against allowed height values
                const allowedHeights = ['50px', '75px', '100px', '125px', '150px', '200px'];
                secureUpdates[key] = allowedHeights.includes(value) ? value : '100px';
                break;
            case 'isReversed':
                secureUpdates[key] = value === true;
                break;
            case 'hasFairySparkles':
                secureUpdates[key] = value === true;
                break;
            case 'gradient':
                secureUpdates[key] = value;
                break;
            default:
                secureUpdates[key] = value;
        }
    }
    
    setAttributes(secureUpdates);
};

// Debug logging
debugLog('🌊 Awesome Squiggle plugin loaded!');

// Generate deterministic animation ID for each block instance
const generateAnimationId = (patternType = 'squiggle', clientId = '', strokeWidth = 1, amplitude = 10) => {
    // Create deterministic ID based on block characteristics
    const baseId = `${patternType}-animation`;
    // Use a simple hash of the key characteristics
    const idString = `${patternType}-${strokeWidth}-${amplitude}-${clientId}`;
    let hash = 0;
    for (let i = 0; i < idString.length; i++) {
        hash = ((hash << 5) - hash) + idString.charCodeAt(i);
        hash = hash & hash;
    }
    const suffix = Math.abs(hash).toString(36).substring(0, 6);
    const id = `${baseId}-${suffix}`;
    return validateAnimationId(id);
};

// Generate deterministic gradient ID to ensure save function stability  
const generateGradientId = (patternType = 'squiggle', gradient = '', clientId = '') => {
    // Use a fixed counter approach to ensure uniqueness but determinism
    // This will be set once when gradient is first applied and then remain stable
    const baseId = `${patternType}-gradient`;
    // Create a simple deterministic suffix
    let suffix = '';
    if (gradient) {
        // Simple hash of gradient to make it somewhat unique
        let hash = 0;
        for (let i = 0; i < gradient.length; i++) {
            hash = ((hash << 5) - hash) + gradient.charCodeAt(i);
            hash = hash & hash;
        }
        suffix = Math.abs(hash).toString(36).substring(0, 6);
    } else {
        // Default suffix for non-gradient cases
        suffix = 'default';
    }
    const id = `${baseId}-${suffix}`;
    return validateGradientId(id);
};

// WordPress default gradients mapping with optimized versions
const wpDefaultGradients = {
    'vivid-cyan-blue-to-vivid-purple': 'linear-gradient(135deg,rgba(6,147,227,1) 0%,rgb(155,81,224) 100%)',
    'light-green-cyan-to-vivid-green-cyan': 'linear-gradient(135deg,rgb(122,220,180) 0%,rgb(0,208,130) 100%)',
    'luminous-vivid-amber-to-luminous-vivid-orange': 'linear-gradient(135deg,rgba(252,185,0,1) 0%,rgba(255,105,0,1) 100%)',
    'luminous-vivid-orange-to-vivid-red': 'linear-gradient(135deg,rgba(255,105,0,1) 0%,rgb(207,46,46) 100%)',
    'very-light-gray-to-cyan-bluish-gray': 'linear-gradient(135deg,rgb(238,238,238) 0%,rgb(169,184,195) 100%)',
    'cool-to-warm-spectrum': 'linear-gradient(135deg,rgb(74,234,220) 0%,rgb(238,44,130) 50%,rgb(254,248,76) 100%)', // Optimized to 3 stops
    'blush-light-purple': 'linear-gradient(135deg,rgb(255,206,236) 0%,rgb(152,150,240) 100%)',
    'blush-bordeaux': 'linear-gradient(135deg,rgb(254,205,165) 0%,rgb(254,45,45) 50%,rgb(107,0,62) 100%)',
    'luminous-dusk': 'linear-gradient(135deg,rgb(255,203,112) 0%,rgb(199,81,192) 50%,rgb(65,88,208) 100%)',
    'pale-ocean': 'linear-gradient(135deg,rgb(255,245,203) 0%,rgb(182,227,212) 50%,rgb(51,167,181) 100%)',
    'electric-grass': 'linear-gradient(135deg,rgb(202,248,128) 0%,rgb(113,206,126) 100%)',
    'midnight': 'linear-gradient(135deg,rgb(2,3,129) 0%,rgb(40,116,252) 100%)'
};

// Simple gradient parser for basic linear gradients
const parseGradient = (gradientString) => {
    if (!gradientString) return null;
    
    // Handle WordPress preset gradient slugs directly
    if (wpDefaultGradients[gradientString]) {
        gradientString = wpDefaultGradients[gradientString];
    }
    
    // Handle WordPress preset gradients (var(--wp--preset--gradient--name))
    if (gradientString.startsWith('var(--wp--preset--gradient--')) {
        const gradientName = gradientString.match(/var\(--wp--preset--gradient--([^)]+)\)/)?.[1];
        if (gradientName && wpDefaultGradients[gradientName]) {
            gradientString = wpDefaultGradients[gradientName];
        } else {
            // Fallback for unknown preset gradients
            return {
                type: 'linear',
                stops: [
                    { color: '#667eea', offset: '0%' },
                    { color: '#764ba2', offset: '100%' }
                ]
            };
        }
    }
    
    // Handle CSS linear-gradient syntax - improved regex to handle nested parentheses
    const linearMatch = gradientString.match(/linear-gradient\((.*)\)$/);
    if (linearMatch) {
        const content = linearMatch[1];
        debugLog('🔍 Parsing gradient content:', content);
        
        // Split by commas but be careful about commas inside rgb() functions
        const parts = [];
        let currentPart = '';
        let parenDepth = 0;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if (char === '(') parenDepth++;
            if (char === ')') parenDepth--;
            
            if (char === ',' && parenDepth === 0) {
                parts.push(currentPart.trim());
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        if (currentPart.trim()) {
            parts.push(currentPart.trim());
        }
        
        debugLog('🔍 Gradient parts:', parts);
        
        const stops = [];
        
        // Process each part to extract color and percentage
        for (const part of parts) {
            // Skip direction part (like "135deg")
            if (part.includes('deg') || part.includes('to ')) continue;
            
            // Improved color matching - handle rgb(), rgba(), hsl(), hsla(), and hex colors
            const colorMatch = part.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
            const percentMatch = part.match(/(\d+%)/);
            
            if (colorMatch) {
                const color = colorMatch[1];
                const offset = percentMatch ? percentMatch[1] : (stops.length === 0 ? '0%' : '100%');
                stops.push({ color, offset });
                debugLog('🔍 Found stop:', { color, offset });
            }
        }
        
        if (stops.length >= 2) {
            // Simplify gradients with more than 3 stops to improve performance
            let finalStops = stops;
            if (stops.length > 3) {
                // Keep first, middle, and last stops for smooth performance
                const firstStop = stops[0];
                const middleIndex = Math.floor(stops.length / 2);
                const middleStop = stops[middleIndex];
                const lastStop = stops[stops.length - 1];
                
                finalStops = [
                    firstStop,
                    { ...middleStop, offset: '50%' }, // Normalize middle to 50%
                    lastStop
                ];
                debugLog('🔍 Simplified gradient from', stops.length, 'to', finalStops.length, 'stops');
            }
            
            debugLog('🔍 Returning parsed stops:', finalStops);
            return {
                type: 'linear',
                stops: finalStops
            };
        }
        
        debugLog('🔍 Fallback: not enough stops found');
    }
    
    // Fallback for any other format
    return {
        type: 'linear',
        stops: [
            { color: '#667eea', offset: '0%' },
            { color: '#764ba2', offset: '100%' }
        ]
    };
};

// Test gradient parsing
debugLog('🧪 Testing gradient parsing:');
const testGradient1 = parseGradient('luminous-vivid-amber-to-luminous-vivid-orange');
const testGradient2 = parseGradient('cool-to-warm-spectrum');
debugLog('luminous-vivid-amber-to-luminous-vivid-orange:', testGradient1);
debugLog('  stops:', testGradient1?.stops);
debugLog('cool-to-warm-spectrum:', testGradient2);
debugLog('  stops:', testGradient2?.stops);

// Test the actual CSS gradient parsing
const testCss = 'linear-gradient(135deg,rgb(74,234,220) 0%,rgb(151,120,209) 20%,rgb(207,42,186) 40%,rgb(238,44,130) 60%,rgb(251,105,98) 80%,rgb(254,248,76) 100%)';
debugLog('Direct CSS test:', parseGradient(testCss));

// Generate SVG path data for the squiggle
const generateSquigglePath = (amplitude = 10) => {
    // Security: Validate amplitude bounds
    amplitude = validateNumericInput(amplitude, 5, 25, 10);
    
    const wavelength = 40;
    const width = 800;
    const height = 100;
    const midY = height / 2;
    
    // Create smooth squiggle using cubic Bezier curves
    let d = `M-${wavelength * 2},${midY}`;
    
    // Generate squiggle segments
    for (let x = -wavelength * 2; x <= width + wavelength * 2; x += wavelength) {
        // Alternate between down curve (peak) and up curve (trough)
        const isDownCurve = Math.floor((x + wavelength * 2) / wavelength) % 2 === 0;
        const curveY = isDownCurve ? midY - amplitude : midY + amplitude;
        
        const cp1x = x + wavelength * 0.375;
        const cp2x = x + wavelength * 0.625;
        const endx = x + wavelength;
        
        d += ` C${cp1x},${curveY} ${cp2x},${curveY} ${endx},${midY}`;
    }
    
    return d;
};

// Generate SVG path data for the zig-zag (Charlie Brown stripe style)
const generateZigzagPath = (amplitude = 15) => {
    // Security: Validate amplitude bounds
    amplitude = validateNumericInput(amplitude, 5, 25, 15);
    
    const wavelength = 30; // Narrower than squiggle for more angular feel
    const width = 800;
    const height = 100;
    const midY = height / 2;
    
    // Create sharp zig-zag pattern using straight lines
    let d = `M-${wavelength * 2},${midY}`;
    
    // Generate zig-zag segments
    for (let x = -wavelength * 2; x <= width + wavelength * 2; x += wavelength) {
        // Alternate between up and down peaks for sharp angles
        const isUpPeak = Math.floor((x + wavelength * 2) / wavelength) % 2 === 0;
        const peakY = isUpPeak ? midY - amplitude : midY + amplitude;
        
        // Sharp angle to peak
        const peakX = x + wavelength / 2;
        d += ` L${peakX},${peakY}`;
        
        // Sharp angle back to center at end of segment
        const endX = x + wavelength;
        d += ` L${endX},${midY}`;
    }
    
    return d;
};

// Deterministic random function based on seed
const seededRandom = (seed) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

// Generate fairy sparkles positioned around the path following the wave contour
const generateFairySparkles = (isZigzag = false, amplitude = 10, animationId = '') => {
    const sparkles = [];
    const pathWidth = 800;
    const pathHeight = 100;
    const midY = pathHeight / 2;
    
    // Wave parameters (matching the path generation)
    const wavelength = isZigzag ? 30 : 40;
    const sparkleCount = 12; // More sparkles for better coverage
    
    // Create a deterministic seed from animationId
    let seed = 12345; // default seed
    if (animationId) {
        for (let i = 0; i < animationId.length; i++) {
            seed = ((seed << 5) - seed) + animationId.charCodeAt(i);
            seed = seed & seed; // Convert to 32bit integer
        }
    }
    
    // Generate sparkles at specific wave features (peaks, valleys, and mid-points)
    for (let i = 0; i < sparkleCount; i++) {
        // Use seeded random for consistent positioning
        const randomX = seededRandom(seed + i * 7) - 0.5; // -0.5 to 0.5
        const randomY = seededRandom(seed + i * 11) - 0.5; // different offset for Y
        
        // Position sparkles at wave features rather than evenly spaced
        const wavePosition = (i / sparkleCount) * (pathWidth + wavelength * 4) - wavelength * 2;
        const baseX = wavePosition + randomX * 15;
        
        // Calculate the wave Y position at this X coordinate
        let waveY;
        if (isZigzag) {
            // For zigzag: sharp peaks and valleys
            const adjustedX = baseX + wavelength * 2;
            const cyclePosition = adjustedX % wavelength;
            const isUpPeak = Math.floor(adjustedX / wavelength) % 2 === 0;
            
            if (cyclePosition < wavelength / 2) {
                // Rising to peak
                const progress = cyclePosition / (wavelength / 2);
                waveY = midY + (isUpPeak ? -amplitude * progress : amplitude * progress);
            } else {
                // Falling from peak
                const progress = (cyclePosition - wavelength / 2) / (wavelength / 2);
                waveY = midY + (isUpPeak ? -amplitude * (1 - progress) : amplitude * (1 - progress));
            }
        } else {
            // For squiggle: smooth sine-like curve - match the actual squiggle generation
            const adjustedX = baseX + wavelength * 2;
            const segmentIndex = Math.floor(adjustedX / wavelength);
            const isDownCurve = segmentIndex % 2 === 0;
            const segmentProgress = (adjustedX % wavelength) / wavelength;
            
            // Use cubic bezier approximation to match the actual squiggle path
            let curveY;
            if (segmentProgress < 0.5) {
                // First half of curve
                curveY = isDownCurve ? midY - amplitude * (segmentProgress * 2) : midY + amplitude * (segmentProgress * 2);
            } else {
                // Second half of curve
                curveY = isDownCurve ? midY - amplitude * (2 - segmentProgress * 2) : midY + amplitude * (2 - segmentProgress * 2);
            }
            waveY = curveY;
        }
        
        // Create sparkles both above and below the wave at various positions
        const sparklePositions = [
            { offset: -15, side: 'above' },   // Above the wave
            { offset: 15, side: 'below' },    // Below the wave
            { offset: -8, side: 'near-above' }, // Closer to wave, above
            { offset: 8, side: 'near-below' }   // Closer to wave, below
        ];
        
        // Use different positioning patterns for variety
        const positionIndex = i % sparklePositions.length;
        const sparklePos = sparklePositions[positionIndex];
        const y = waveY + sparklePos.offset + randomY * 6;
        
        // Skip sparkles that would be too far outside the viewable area
        if (baseX < -50 || baseX > pathWidth + 50 || y < 10 || y > 90) {
            continue;
        }
        
        // Create different sized sparkles for visual interest
        const sizes = [2, 3, 4];
        const size = sizes[i % sizes.length];
        
        // Create star shape using path
        const starPath = createStarPath(size);
        
        sparkles.push({
            x: baseX,
            y: y,
            size: size,
            path: starPath,
            animationDelay: (i * 0.15) + 's', // Varied timing
            id: `sparkle-${animationId}-${i}`
        });
    }
    
    return sparkles;
};

// Create a simple star/sparkle shape
const createStarPath = (size = 3) => {
    const outerRadius = size;
    const innerRadius = size * 0.4;
    const points = 4; // 4-pointed star for simplicity
    
    let path = '';
    
    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        if (i === 0) {
            path += `M ${x} ${y}`;
        } else {
            path += ` L ${x} ${y}`;
        }
    }
    
    path += ' Z';
    return path;
};

// Helper function to check if current style is a squiggle style
const isSquiggleStyle = (className) => {
    return className && (
        className.includes('is-style-animated-squiggle') ||
        className.includes('is-style-static-squiggle')
    );
};

// Helper function to check if current style is a zig-zag style
const isZigzagStyle = (className) => {
    return className && (
        className.includes('is-style-animated-zigzag') ||
        className.includes('is-style-static-zigzag')
    );
};

// Helper function to check if current style is animated (not static)
const isAnimatedStyle = (className) => {
    return className && (
        className.includes('is-style-animated-squiggle') ||
        className.includes('is-style-animated-zigzag')
    );
};

// Helper function to check if current style is any custom style (squiggle or zig-zag)
const isCustomStyle = (className) => {
    return isSquiggleStyle(className) || isZigzagStyle(className);
};

// Add squiggle-specific attributes and gradient support to separator block
addFilter(
    'blocks.registerBlockType',
    'awesome-squiggle/separator-squiggle-attributes',
    (settings, name) => {
        if (name !== 'core/separator') {
            return settings;
        }

        // Enable gradient support for separators and add our attributes
        return {
            ...settings,
            supports: {
                ...settings.supports,
                color: {
                    ...settings.supports?.color,
                    gradients: true // Enable gradient support
                }
            },
            attributes: {
                ...settings.attributes,
                // Squiggle-specific attributes with defaults to avoid interference
                strokeWidth: {
                    type: 'number',
                    default: undefined // No default to avoid interference
                },
                animationSpeed: {
                    type: 'number',
                    default: undefined
                },
                squiggleAmplitude: {
                    type: 'number',
                    default: undefined
                },
                squiggleHeight: {
                    type: 'string',
                    default: undefined
                },
                animationId: {
                    type: 'string',
                    default: undefined
                },
                isReversed: {
                    type: 'boolean',
                    default: undefined
                },
                gradientId: {
                    type: 'string',
                    default: undefined
                },
                hasFairySparkles: {
                    type: 'boolean',
                    default: undefined
                }
            }
        };
    },
    20
);


// Enhanced separator edit component
const withSquiggleControls = createHigherOrderComponent((BlockEdit) => {
    return (props) => {
        const { attributes, setAttributes, name, clientId } = props;
        
        // ALL hooks must be declared at the top level, before ANY conditional logic
        const blockInitialized = useRef(false);
        const gradientIdRef = useRef(attributes?.gradientId);
        const blockInitializedRef = useRef(false);
        const gradientIdRefHook = useRef(attributes?.gradientId);
        
        // Pre-calculate values needed for useBlockProps
        const { className = '', squiggleHeight = '100px', animationSpeed = 1.6, isReversed = false } = attributes || {};
        const isSquiggle = isSquiggleStyle(className);
        const isZigzag = isZigzagStyle(className);
        const isCustom = isCustomStyle(className);
        const isAnimated = isAnimatedStyle(className);
        
        // Determine if animation should be paused based on style
        let finalPaused = false;
        if (className && (className.includes('is-style-static-squiggle') || className.includes('is-style-static-zigzag'))) {
            finalPaused = true;
        }
        
        // Calculate animation name
        const animationName = finalPaused 
            ? 'none' 
            : (isZigzag ? (isReversed ? 'zigzag-flow-reverse' : 'zigzag-flow') : (isReversed ? 'squiggle-flow-reverse' : 'squiggle-flow'));
        
        // useBlockProps must be called unconditionally
        const blockProps = useBlockProps({
            className: isCustom ? `wp-block-separator awesome-squiggle-wave ${className}`.trim() : '',
            style: isCustom ? {
                height: squiggleHeight,
                backgroundColor: 'transparent',
                minHeight: '50px',
                [`--animation-duration`]: `${animationSpeed}s`,
                [`--animation-name`]: animationName
            } : {}
        });
        
        // Create a wrapper for setAttributes to intercept gradient changes
        const setAttributesWithGradientCheck = (updates) => {
            const newUpdates = { ...updates };
            
            // Check if gradient is being set or changed
            if (updates.gradient || updates.style?.color?.gradient) {
                const newGradient = updates.gradient || updates.style?.color?.gradient;
                const currentGradient = attributes.gradient || attributes.style?.color?.gradient;
                const isZigzag = isZigzagStyle(attributes?.className);
                
                // Generate new gradient ID if:
                // 1. No gradient ID exists, OR
                // 2. The gradient content has changed
                if (newGradient && (!attributes?.gradientId || newGradient !== currentGradient)) {
                    const newGradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle', newGradient, clientId);
                    newUpdates.gradientId = newGradientId;
                    debugLog('🎨 Generated new gradient ID for gradient change:', {
                        oldGradient: currentGradient,
                        newGradient: newGradient,
                        oldId: attributes?.gradientId,
                        newId: newGradientId
                    });
                }
            }
            
            // Call the original setAttributes
            setAttributes(newUpdates);
        };
        
        // Return early for non-separator blocks AFTER all hooks are declared
        if (name !== 'core/separator') {
            return <BlockEdit {...props} />;
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
            hasFairySparkles
        } = attributes;

        // Initialize custom style attributes when custom style is applied
        if (isCustom && strokeWidth === undefined) {
            const defaultAmplitude = isZigzag ? 15 : 10; // Zig-zag gets slightly larger default amplitude
            const newAnimationId = generateAnimationId(isZigzag ? 'zigzag' : 'squiggle', clientId, 1, defaultAmplitude);
            const currentGradient = gradient || style?.color?.gradient || '';
            const newGradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle', currentGradient, clientId);
            setSecureAttributes(setAttributes, {
                strokeWidth: 1,
                animationSpeed: 6, // Default to speed level 6 (which converts to 2.5s duration)
                squiggleAmplitude: defaultAmplitude,
                squiggleHeight: '100px',
                animationId: newAnimationId,
                isReversed: false,
                gradientId: newGradientId
            });
        }

        // Ensure each block has a unique animation ID
        if (isCustom && !animationId) {
            const patternType = isZigzag ? 'zigzag' : 'squiggle';
            const defaultAmplitude = isZigzag ? 15 : 10;
            setSecureAttributes(setAttributes, { animationId: generateAnimationId(patternType, clientId, strokeWidth || 1, squiggleAmplitude || defaultAmplitude) });
        }

        // Ensure each block has a unique gradient ID
        if (isCustom && !gradientId) {
            setSecureAttributes(setAttributes, { gradientId: generateGradientId(isZigzag ? 'zigzag' : 'squiggle', '', '') });
        }

        // Hooks already declared at the top of the component

        // Regenerate gradient ID when switching between squiggle and zigzag to avoid conflicts
        if (isCustom && gradientId && (
            (isSquiggle && gradientId.includes('zigzag')) || 
            (isZigzag && gradientId.includes('squiggle'))
        )) {
            const newGradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle', '', '');
            setSecureAttributes(setAttributes, { gradientId: newGradientId });
            debugLog('🔄 Regenerated gradient ID for style switch:', newGradientId);
        }
        
        // Detect if this is a fresh block that needs ID generation
        useEffect(() => {
            debugLog('🔍 Block initialization check:', {
                isCustom,
                clientId,
                blockInitialized: blockInitializedRef.current,
                currentGradientId: gradientId,
                hasGradient: !!(gradient || style?.color?.gradient),
                gradientIdRef: gradientIdRefHook.current
            });
            
            // If this is a custom style block with gradient but the gradient ID hasn't changed from our ref,
            // it might be a duplicate
            if (isCustom && gradientId && !blockInitializedRef.current) {
                // Check if another block already has this gradient ID
                const allBlocks = select('core/block-editor').getBlocks();
                const otherBlocksWithSameId = allBlocks.filter(block => 
                    block.clientId !== clientId && 
                    block.attributes.gradientId === gradientId
                );
                
                if (otherBlocksWithSameId.length > 0) {
                    debugLog('🔄 Duplicate gradient ID detected on initialization, regenerating');
                    const defaultAmplitude = isZigzag ? 15 : 10;
                    const newAnimationId = generateAnimationId(isZigzag ? 'zigzag' : 'squiggle', clientId, strokeWidth || 1, squiggleAmplitude || defaultAmplitude);
                    const newGradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle', '', clientId);
                    setSecureAttributes(setAttributes, { 
                        animationId: newAnimationId,
                        gradientId: newGradientId 
                    });
                    gradientIdRefHook.current = newGradientId;
                }
            }
            
            blockInitializedRef.current = true;
            gradientIdRefHook.current = gradientId;
        }, [clientId, isCustom, gradientId, isZigzag, setAttributes]);
        
        // Track if this block was just duplicated
        const wasDuplicated = useRef(false);
        
        // Only check for duplicates ONCE when block is first created
        useEffect(() => {
            if (isCustom && gradientId && !wasDuplicated.current && !blockInitializedRef.current) {
                // Small delay to let editor settle
                const timeoutId = setTimeout(() => {
                    // Mark that we've checked
                    wasDuplicated.current = true;
                    
                    // Check if this gradient ID is already in use by another block
                    const allGradients = document.querySelectorAll(`linearGradient[id="${gradientId}"]`);
                    
                    // If we find more than one gradient definition, it's a duplicate
                    if (allGradients.length > 1) {
                        // This is a duplicate - generate a new ID
                        const newGradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle', '', '');
                        setSecureAttributes(setAttributes, { gradientId: newGradientId });
                        debugLog('🔄 Detected duplicate gradient ID on new block, generated new one:', newGradientId);
                    }
                }, 200);
                
                return () => clearTimeout(timeoutId);
            }
        }, []); // Empty deps - check only once on mount
        
        // Ensure gradient ID exists when gradient is present
        useEffect(() => {
            const customGradient = gradient || style?.color?.gradient;
            if (isCustom && customGradient && !gradientId) {
                const newGradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle', '', '');
                setSecureAttributes(setAttributes, { gradientId: newGradientId });
                debugLog('🆕 Generated gradient ID for existing gradient:', newGradientId);
            }
        }, [isCustom, gradient, style?.color?.gradient, gradientId, isZigzag, setAttributes]);
        
        // Remove this overly aggressive duplicate check that runs too often
        // and causes gradient IDs to regenerate during block validation

        // Extract color information from WordPress classes (same logic as save)
        const extractColorFromClassName = (className) => {
            if (!className) return null;
            
            // Look for background color classes (has-{color}-background-color)
            const bgColorMatch = className.match(/has-([a-zA-Z0-9-]+)-background-color/);
            if (bgColorMatch) {
                const colorSlug = bgColorMatch[1];
                return `var(--wp--preset--color--${colorSlug})`;
            }
            
            // Look for text color classes (has-{color}-color)
            const textColorMatch = className.match(/has-([a-zA-Z0-9-]+)-color(?!\s*background)/);
            if (textColorMatch) {
                const colorSlug = textColorMatch[1];
                return `var(--wp--preset--color--${colorSlug})`;
            }
            
            return null;
        };

        // Get line color for editor preview - same priority order as save function
        let lineColor = 'currentColor';
        let editorLineColor = 'currentColor';
        let finalGradient = null;
        
        if (isCustom) {
            debugLog('🎨 DEBUG: Color attributes:', { backgroundColor, customBackgroundColor, textColor, customTextColor, style, className, gradient });
            debugLog('🎨 DEBUG: Pattern type:', { isSquiggle, isZigzag, gradientId });
            
            // Check if gradient should be used - check all possible gradient sources
            const customGradient = gradient || style?.color?.gradient;
            
            if (customGradient) {
                // Ensure we have a gradient ID when using gradients
                if (!gradientId) {
                    const newGradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle', '', '');
                    setSecureAttributes(setAttributes, { gradientId: newGradientId });
                    debugLog('🆕 Generated gradient ID for new gradient:', newGradientId);
                }
                
                finalGradient = customGradient;
                // Always use the current gradientId for the editor
                // Only use existing gradientId, don't generate new ones in the editor preview
                if (gradientId) {
                    editorLineColor = `url(#${gradientId})`;   
                } else {
                    // If no gradientId yet, the useEffect will handle generating it
                    editorLineColor = 'currentColor';
                } 
                const parsedGradient = parseGradient(customGradient);
                debugLog('🎨 GRADIENT DEBUG: Using gradient:', customGradient, 'Parsed:', parsedGradient);
                debugLog('🎨 GRADIENT STOPS:', parsedGradient?.stops);
                debugLog('🎨 GRADIENT ID for', isZigzag ? 'ZIGZAG' : 'SQUIGGLE', ':', gradientId);
            } else {
                // Use solid color logic
                if (backgroundColor) {
                    lineColor = `var(--wp--preset--color--${backgroundColor})`;
                } else if (customBackgroundColor) {
                    lineColor = customBackgroundColor;
                } else if (style?.color?.background) {
                    lineColor = style.color.background;
                } else {
                    const classNameColor = extractColorFromClassName(className);
                    if (classNameColor) {
                        lineColor = classNameColor;
                    } else if (textColor) {
                        lineColor = `var(--wp--preset--color--${textColor})`;
                    } else if (customTextColor) {
                        lineColor = customTextColor;
                    } else if (style?.color?.text) {
                        lineColor = style.color.text;
                    }
                }
                editorLineColor = lineColor;
            }
            
            debugLog('🎨 Final editor color:', editorLineColor, 'Gradient:', finalGradient);
        }

        // finalPaused is already calculated at the top with hooks

        // Clean up the className to remove conflicting is-paused class when it shouldn't be there
        let cleanClassName = className;
        if (cleanClassName && cleanClassName.includes('is-paused') && !finalPaused) {
            cleanClassName = cleanClassName.replace(/\bis-paused\b/g, '').replace(/\s+/g, ' ').trim();
            // Update the className in attributes to remove the stale is-paused class
            setAttributes({ className: cleanClassName });
        }

        // If not a custom style, just return the normal block edit but still use our gradient wrapper
        if (!isCustom) {
            return <BlockEdit {...props} setAttributes={setAttributesWithGradientCheck} />;
        }

        // blockProps already declared at the top with hooks

        return (
            <>
                {/* Render the original block edit hidden to preserve all standard WordPress controls */}
                <div style={{ display: 'none' }}>
                    <BlockEdit {...props} setAttributes={setAttributesWithGradientCheck} />
                </div>
                
                <style>
                    {`
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
                            100% { transform: translateX(60px); }
                        }
                        @keyframes zigzag-flow-reverse {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(-60px); }
                        }
                        @keyframes fairy-twinkle {
                            0% { opacity: 0.3; transform: scale(0.8); }
                            50% { opacity: 1; transform: scale(1.2); }
                            100% { opacity: 0.3; transform: scale(0.8); }
                        }
                        .awesome-squiggle-editor-preview .squiggle-path,
                        .awesome-squiggle-editor-preview .zigzag-path {
                            transform-origin: center;
                            animation: var(--animation-name, squiggle-flow) var(--animation-duration, 1.6s) linear infinite;
                        }
                        .awesome-squiggle-editor-preview .fairy-sparkle {
                            transform-origin: center;
                        }
                    `}
                </style>
                <div {...blockProps}>
                    <div 
                        className="awesome-squiggle-editor-preview"
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'transparent',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <svg
                            key={`svg-${gradientId || 'default'}`}
                            viewBox="0 0 800 100"
                            preserveAspectRatio="none"
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'block'
                            }}
                            aria-hidden="true"
                            role="presentation"
                        >
                            {finalGradient && gradientId && (() => {
                                const gradientData = parseGradient(finalGradient);
                                // Use the actual gradientId if available, or use the generated one from editorLineColor
                                const svgGradientId = gradientId;
                                debugLog('🎨 SVG GRADIENT DATA:', gradientData);
                                debugLog('🎨 SVG GRADIENT ID:', svgGradientId);
                                return (
                                    <defs>
                                        <linearGradient id={svgGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                                            {gradientData?.stops?.length > 0 ? gradientData.stops.map((stop, index) => {
                                                debugLog(`🎨 SVG STOP ${index}:`, stop);
                                                return <stop key={index} offset={stop.offset} stopColor={stop.color} />;
                                            }) : [
                                                <stop key="fallback-0" offset="0%" stopColor="#ff6b35" />,
                                                <stop key="fallback-1" offset="100%" stopColor="#f7931e" />
                                            ]}
                                        </linearGradient>
                                    </defs>
                                );
                            })()}
                            <path
                                d={isZigzag ? generateZigzagPath(squiggleAmplitude || 15) : generateSquigglePath(squiggleAmplitude || 10)}
                                fill="none"
                                stroke={editorLineColor}
                                strokeWidth={strokeWidth || 1}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`${isZigzag ? 'zigzag' : 'squiggle'}-path ${isZigzag ? 'zigzag' : 'squiggle'}-path-${animationId || 'default'}`}
                                style={{
                                    transformOrigin: 'center',
                                    stroke: editorLineColor,
                                    display: 'block',
                                    animation: finalPaused 
                                        ? 'none' 
                                        : `${isZigzag ? (isReversed ? 'zigzag-flow-reverse' : 'zigzag-flow') : (isReversed ? 'squiggle-flow-reverse' : 'squiggle-flow')} ${animationSpeed || 1.6}s linear infinite`
                                }}
                            />
                            {hasFairySparkles && (() => {
                                const sparkles = generateFairySparkles(isZigzag, squiggleAmplitude || (isZigzag ? 15 : 10), animationId || 'default');
                                return sparkles.map((sparkle) => (
                                    <g key={sparkle.id} transform={`translate(${sparkle.x}, ${sparkle.y})`}>
                                        <path
                                            d={sparkle.path}
                                            fill={editorLineColor}
                                            className="fairy-sparkle editor-sparkle"
                                            style={{
                                                opacity: 0.7,
                                                animation: finalPaused 
                                                    ? 'none'
                                                    : `fairy-twinkle 2s ease-in-out infinite`,
                                                animationDelay: sparkle.animationDelay
                                            }}
                                        />
                                    </g>
                                ));
                            })()}
                        </svg>
                    </div>
                </div>

                {/* Add our custom pattern-specific controls to the inspector */}
                <InspectorControls group="settings">
                    <PanelBody title={__(isZigzag ? 'Zig-Zag Settings' : 'Squiggle Settings', 'awesome-squiggle')} initialOpen={true}>
                        {isAnimated && (
                            <>
                                <RangeControl
                                    label={__('Animation Speed', 'awesome-squiggle')}
                                    value={animationSpeed ? Math.round(11 - (animationSpeed / 0.5)) : 6}
                                    onChange={(value) => setSecureAttributes(setAttributes, { animationSpeed: value })}
                                    min={1}
                                    max={10}
                                    step={1}
                                    help={__(isZigzag ? 'Control how fast the zig-zag animates (higher = faster)' : 'Control how fast the squiggle animates (higher = faster)', 'awesome-squiggle')}
                                />
                                <ToggleControl
                                    label={__('Reverse Animation', 'awesome-squiggle')}
                                    checked={isReversed || false}
                                    onChange={() => setSecureAttributes(setAttributes, { isReversed: !isReversed })}
                                    help={__(isZigzag ? 'Make the zig-zag animate in the opposite direction' : 'Make the squiggle animate in the opposite direction', 'awesome-squiggle')}
                                />
                            </>
                        )}
                        <RangeControl
                            label={__(isZigzag ? 'Zig-Zag Amplitude' : 'Squiggle Amplitude', 'awesome-squiggle')}
                            value={squiggleAmplitude || (isZigzag ? 15 : 10)}
                            onChange={(value) => setSecureAttributes(setAttributes, { squiggleAmplitude: value })}
                            min={5}
                            max={25}
                            help={__(isZigzag ? 'Adjust the height of the zig-zag peaks' : 'Adjust the height of the squiggle peaks', 'awesome-squiggle')}
                        />
                        <ToggleControl
                            label={__('Fairy Sparkles', 'awesome-squiggle')}
                            checked={hasFairySparkles || false}
                            onChange={() => setSecureAttributes(setAttributes, { hasFairySparkles: !hasFairySparkles })}
                            help={__(isZigzag ? 'Add magical sparkles around the zig-zag' : 'Add magical sparkles around the squiggle', 'awesome-squiggle')}
                        />
                    </PanelBody>
                    <PanelBody title={__(isZigzag ? 'Zig-Zag Dimensions' : 'Squiggle Dimensions', 'awesome-squiggle')} initialOpen={false}>
                        <RangeControl
                            label={__('Stroke Width', 'awesome-squiggle')}
                            value={strokeWidth || 1}
                            onChange={(value) => setSecureAttributes(setAttributes, { strokeWidth: value })}
                            min={1}
                            max={8}
                            help={__(isZigzag ? 'Adjust the thickness of the zig-zag line' : 'Adjust the thickness of the squiggle line', 'awesome-squiggle')}
                        />
                        <SelectControl
                            label={__(isZigzag ? 'Zig-Zag Height' : 'Squiggle Height', 'awesome-squiggle')}
                            value={squiggleHeight || '100px'}
                            options={[
                                { label: '50px', value: '50px' },
                                { label: '75px', value: '75px' },
                                { label: '100px', value: '100px' },
                                { label: '125px', value: '125px' },
                                { label: '150px', value: '150px' },
                                { label: '200px', value: '200px' }
                            ]}
                            onChange={(value) => setSecureAttributes(setAttributes, { squiggleHeight: value })}
                            help={__(isZigzag ? 'Set the height of the zig-zag container' : 'Set the height of the squiggle container', 'awesome-squiggle')}
                        />
                    </PanelBody>
                </InspectorControls>
            </>
        );
    };
}, 'withSquiggleControls');

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
    (element, blockType, attributes) => {
        if (blockType.name !== 'core/separator') {
            return element;
        }

        const { className } = attributes;
        const isSquiggle = isSquiggleStyle(className);
        const isZigzag = isZigzagStyle(className);
        const isCustom = isCustomStyle(className);
        
        if (!isCustom) {
            return element;
        }

        const {
            strokeWidth = 1,
            animationSpeed = 2.5, // Default duration for speed level 6
            squiggleAmplitude = isZigzag ? 15 : 10,
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
            hasFairySparkles
        } = attributes;
        
        debugLog('🎨 SAVE FUNCTION - Block attributes:', { 
            gradient, 
            gradientId, 
            style: style?.color?.gradient,
            className 
        });

        // Extract color information from WordPress classes
        const extractColorFromClassName = (className) => {
            if (!className) return null;
            
            // Look for background color classes (has-{color}-background-color)
            const bgColorMatch = className.match(/has-([a-zA-Z0-9-]+)-background-color/);
            if (bgColorMatch) {
                const colorSlug = bgColorMatch[1];
                return `var(--wp--preset--color--${colorSlug})`;
            }
            
            // Look for text color classes (has-{color}-color)
            const textColorMatch = className.match(/has-([a-zA-Z0-9-]+)-color(?!\s*background)/);
            if (textColorMatch) {
                const colorSlug = textColorMatch[1];
                return `var(--wp--preset--color--${colorSlug})`;
            }
            
            return null;
        };

        // Determine if animation should be paused based on style
        let finalPaused = false;
        if (className && (className.includes('is-style-static-squiggle') || className.includes('is-style-static-zigzag'))) {
            finalPaused = true;
        }

        // Get line color - prioritize background color settings for the line
        let lineColor = 'currentColor';
        let finalGradient = null;

        debugLog('🎨 SAVE DEBUG: Color attributes:', { backgroundColor, customBackgroundColor, textColor, customTextColor, style, className, gradient });
        debugLog('🎨 SAVE DEBUG: Pattern type:', { isSquiggle, isZigzag, gradientId });

        // Check if gradient should be used - check all possible gradient sources
        const customGradient = gradient || style?.color?.gradient;
        
        // Variable to store the gradient ID consistently
        let usedGradientId = null;
        
        if (customGradient) {
            // Always use the stored gradient ID, never generate in save
            if (gradientId) {
                usedGradientId = gradientId;
                finalGradient = customGradient;
                lineColor = `url(#${usedGradientId})`;
                const parsedGradient = parseGradient(customGradient);
                debugLog('🎨 SAVE GRADIENT DEBUG: Using gradient:', customGradient, 'Parsed:', parsedGradient);
                debugLog('🎨 SAVE GRADIENT STOPS:', parsedGradient?.stops);
                debugLog('🎨 SAVE GRADIENT ID for', isZigzag ? 'ZIGZAG' : 'SQUIGGLE', ':', usedGradientId);
            } else {
                // If no gradient ID but has gradient, use solid color fallback
                debugLog('⚠️ WARNING: Gradient exists but no gradientId stored');
                lineColor = 'currentColor';
            }
        } else {
            // Check all possible color sources in priority order
            if (backgroundColor) {
                lineColor = `var(--wp--preset--color--${backgroundColor})`;
            } else if (customBackgroundColor) {
                lineColor = customBackgroundColor;
            } else if (style?.color?.background) {
                lineColor = style.color.background;
            } else {
                // Try to extract color from className
                const classNameColor = extractColorFromClassName(className);
                if (classNameColor) {
                    lineColor = classNameColor;
                } else if (textColor) {
                    lineColor = `var(--wp--preset--color--${textColor})`;
                } else if (customTextColor) {
                    lineColor = customTextColor;
                } else if (style?.color?.text) {
                    lineColor = style.color.text;
                }
            }
        }

        debugLog('🎨 SAVE Final color:', lineColor, 'Gradient:', finalGradient);

        // Build class names that preserve WordPress's color support
        // Clean up duplicate class names and ensure proper ordering
        let classNames = ['wp-block-separator', 'awesome-squiggle-wave'];
        
        // Parse existing className to avoid duplicates
        if (className) {
            const existingClasses = className.split(' ').filter(cls => 
                cls && 
                cls !== 'wp-block-separator' && 
                cls !== 'awesome-squiggle-wave'
            );
            classNames.push(...existingClasses);
        }
        
        // Add animation state
        if (finalPaused && !classNames.includes('is-paused')) {
            classNames.push('is-paused');
        }

        // Remove any duplicates and join
        const combinedClassName = [...new Set(classNames)].join(' ');

        // Determine animation name based on pattern type and direction
        let animationName;
        if (finalPaused) {
            animationName = 'none';
        } else if (isZigzag) {
            animationName = isReversed ? 'zigzag-flow-reverse' : 'zigzag-flow';
        } else {
            animationName = isReversed ? 'squiggle-flow-reverse' : 'squiggle-flow';
        }

        const inlineStyles = {
            height: squiggleHeight,
            backgroundColor: 'transparent', // Container background always transparent
            [`--animation-duration`]: `${animationSpeed}s`,
            [`--animation-name`]: animationName
        };

        // Merge any existing styles but exclude the color object and override background
        if (style) {
            const { color, ...otherStyles } = style;
            Object.assign(inlineStyles, otherStyles);
            inlineStyles.backgroundColor = 'transparent';
        }

        return (
            <div 
                className={combinedClassName}
                style={inlineStyles}
            >
                <svg
                    viewBox="0 0 800 100"
                    preserveAspectRatio="none"
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block'
                    }}
                    aria-hidden="true"
                    role="presentation"
                >
                    {finalGradient && usedGradientId && (() => {
                        const gradientData = parseGradient(finalGradient);
                        debugLog('🎨 SAVE SVG GRADIENT DATA:', gradientData);
                        debugLog('🎨 SAVE SVG GRADIENT ID:', usedGradientId);
                        return (
                            <defs>
                                <linearGradient id={usedGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                                    {gradientData?.stops?.length > 0 ? gradientData.stops.map((stop, index) => {
                                        debugLog(`🎨 SAVE SVG STOP ${index}:`, stop);
                                        return <stop key={index} offset={stop.offset} stopColor={stop.color} />;
                                    }) : [
                                        <stop key="fallback-0" offset="0%" stopColor="#ff6b35" />,
                                        <stop key="fallback-1" offset="100%" stopColor="#f7931e" />
                                    ]}
                                </linearGradient>
                            </defs>
                        );
                    })()}
                    <path
                        d={isZigzag ? generateZigzagPath(squiggleAmplitude) : generateSquigglePath(squiggleAmplitude)}
                        fill="none"
                        stroke={lineColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`${isZigzag ? 'zigzag' : 'squiggle'}-path ${animationId ? `${isZigzag ? 'zigzag' : 'squiggle'}-path-${animationId}` : ''}`}
                        style={{
                            transformOrigin: 'center',
                            stroke: lineColor,
                            display: 'block',
                            animation: finalPaused 
                                ? 'none' 
                                : `${animationName} ${animationSpeed}s linear infinite`
                        }}
                    />
                    {hasFairySparkles && (() => {
                        const sparkles = generateFairySparkles(isZigzag, squiggleAmplitude, animationId || 'default');
                        return sparkles.map((sparkle) => (
                            <g key={sparkle.id} transform={`translate(${sparkle.x}, ${sparkle.y})`}>
                                <path
                                    d={sparkle.path}
                                    fill={lineColor}
                                    className="fairy-sparkle frontend-sparkle"
                                    style={{
                                        opacity: 0.7,
                                        animation: finalPaused 
                                            ? 'none'
                                            : `fairy-twinkle 2s ease-in-out infinite`,
                                        animationDelay: sparkle.animationDelay
                                    }}
                                />
                            </g>
                        ));
                    })()}
                </svg>
            </div>
        );
    },
    20
);

// Register block styles for squiggle and zig-zag options
wp.domReady(() => {
    // Animated Squiggle Style
    registerBlockStyle('core/separator', {
        name: 'animated-squiggle',
        label: __('Animated Squiggle', 'awesome-squiggle'),
        isDefault: false
    });

    // Static Squiggle Style  
    registerBlockStyle('core/separator', {
        name: 'static-squiggle',
        label: __('Static Squiggle', 'awesome-squiggle'),
        isDefault: false
    });

    // Animated Zig-Zag Style
    registerBlockStyle('core/separator', {
        name: 'animated-zigzag',
        label: __('Animated Zig-Zag', 'awesome-squiggle'),
        isDefault: false
    });

    // Static Zig-Zag Style  
    registerBlockStyle('core/separator', {
        name: 'static-zigzag',
        label: __('Static Zig-Zag', 'awesome-squiggle'),
        isDefault: false
    });
}); 