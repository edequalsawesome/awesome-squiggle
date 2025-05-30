import { registerBlockStyle } from '@wordpress/blocks';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, RangeControl, ToggleControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
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
    if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
        console.log(message, ...args);
    }
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

// Generate unique animation ID for each block instance
let animationCounter = 0;
const generateAnimationId = () => {
    const id = `squiggle-animation-${++animationCounter}`;
    return validateAnimationId(id);
};

// Generate unique gradient ID for each block instance
let gradientCounter = 0;
const generateGradientId = (patternType = 'squiggle') => {
    const id = `${patternType}-gradient-${++gradientCounter}`;
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

// Add squiggle-specific attributes to separator block (only when needed)
addFilter(
    'blocks.registerBlockType',
    'awesome-squiggle/separator-squiggle-attributes',
    (settings, name) => {
        if (name !== 'core/separator') {
            return settings;
        }

        // Only add our attributes, don't modify existing block behavior
        return {
            ...settings,
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
                gradient: {
                    type: 'string',
                    default: undefined
                },
                gradientId: {
                    type: 'string',
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
        const { attributes, setAttributes, name } = props;
        
        if (name !== 'core/separator') {
            return <BlockEdit {...props} />;
        }

        const { 
            className, 
            strokeWidth, 
            animationSpeed, 
            squiggleAmplitude, 
            squiggleHeight,
            animationId,
            isReversed,
            textColor,
            customTextColor,
            backgroundColor, 
            customBackgroundColor,
            style,
            gradient,
            gradientId
        } = attributes;
        
        const isSquiggle = isSquiggleStyle(className);
        const isZigzag = isZigzagStyle(className);
        const isCustom = isCustomStyle(className);
        const isAnimated = isAnimatedStyle(className);

        // Initialize custom style attributes when custom style is applied
        if (isCustom && strokeWidth === undefined) {
            const newAnimationId = generateAnimationId();
            const newGradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle');
            const defaultAmplitude = isZigzag ? 15 : 10; // Zig-zag gets slightly larger default amplitude
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
            setSecureAttributes(setAttributes, { animationId: generateAnimationId() });
        }

        // Ensure each block has a unique gradient ID
        if (isCustom && !gradientId) {
            setSecureAttributes(setAttributes, { gradientId: generateGradientId(isZigzag ? 'zigzag' : 'squiggle') });
        }

        // Regenerate gradient ID when switching between squiggle and zigzag to avoid conflicts
        if (isCustom && gradientId && (
            (isSquiggle && gradientId.includes('zigzag')) || 
            (isZigzag && gradientId.includes('squiggle'))
        )) {
            const newGradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle');
            setSecureAttributes(setAttributes, { gradientId: newGradientId });
            debugLog('🔄 Regenerated gradient ID for style switch:', newGradientId);
        }

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
            
            // Check if gradient should be used - auto-enable if gradient is present
            if ((gradient) && gradient) {
                finalGradient = gradient;
                editorLineColor = `url(#${gradientId})`;
                const parsedGradient = parseGradient(gradient);
                debugLog('🎨 GRADIENT DEBUG: Using gradient:', gradient, 'Parsed:', parsedGradient);
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

        // Determine if animation should be paused based on style
        let finalPaused = false;
        if (className && (className.includes('is-style-static-squiggle') || className.includes('is-style-static-zigzag'))) {
            finalPaused = true;
        }

        // Clean up the className to remove conflicting is-paused class when it shouldn't be there
        let cleanClassName = className;
        if (cleanClassName && cleanClassName.includes('is-paused') && !finalPaused) {
            cleanClassName = cleanClassName.replace(/\bis-paused\b/g, '').replace(/\s+/g, ' ').trim();
            // Update the className in attributes to remove the stale is-paused class
            setAttributes({ className: cleanClassName });
        }

        // If not a custom style, just return the normal block edit without any interference
        if (!isCustom) {
            return <BlockEdit {...props} />;
        }

        // For custom styles, render our custom pattern directly instead of overlay approach
        // This works better inside Group/Row/Stack blocks that use flexbox
        const blockProps = useBlockProps({
            className: `wp-block-separator awesome-squiggle-wave ${className || ''}`.trim(),
            style: {
                height: squiggleHeight || '100px',
                backgroundColor: 'transparent',
                minHeight: '50px',
                [`--animation-duration`]: `${animationSpeed || 1.6}s`,
                [`--animation-name`]: finalPaused 
                    ? 'none' 
                    : (isZigzag ? (isReversed ? 'zigzag-flow-reverse' : 'zigzag-flow') : (isReversed ? 'squiggle-flow-reverse' : 'squiggle-flow'))
            }
        });

        return (
            <>
                {/* Render the original block edit hidden to preserve all standard WordPress controls */}
                <div style={{ display: 'none' }}>
                    <BlockEdit {...props} />
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
                        .awesome-squiggle-editor-preview .squiggle-path,
                        .awesome-squiggle-editor-preview .zigzag-path {
                            transform-origin: center;
                            animation: var(--animation-name, squiggle-flow) var(--animation-duration, 1.6s) linear infinite;
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
                            {finalGradient && (() => {
                                const gradientData = parseGradient(finalGradient);
                                debugLog('🎨 SVG GRADIENT DATA:', gradientData);
                                debugLog('🎨 SVG GRADIENT ID:', gradientId);
                                return (
                                    <defs>
                                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
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
            animationId = generateAnimationId(),
            isReversed,
            textColor,
            customTextColor,
            backgroundColor, 
            customBackgroundColor,
            style,
            gradient,
            gradientId = generateGradientId(isZigzag ? 'zigzag' : 'squiggle')
        } = attributes;

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

        // Check if gradient should be used - auto-enable if gradient is present
        if ((gradient) && gradient) {
            finalGradient = gradient;
            lineColor = `url(#${gradientId})`;
            const parsedGradient = parseGradient(gradient);
            debugLog('🎨 SAVE GRADIENT DEBUG: Using gradient:', gradient, 'Parsed:', parsedGradient);
            debugLog('🎨 SAVE GRADIENT STOPS:', parsedGradient?.stops);
            debugLog('🎨 SAVE GRADIENT ID for', isZigzag ? 'ZIGZAG' : 'SQUIGGLE', ':', gradientId);
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
            [`--animation-name`]: animationName,
            [`--line-color-${animationId}`]: lineColor, // Custom CSS variable for this instance
        };

        // Merge any existing styles but override background to stay transparent
        if (style) {
            Object.assign(inlineStyles, style);
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
                    {finalGradient && (() => {
                        const gradientData = parseGradient(finalGradient);
                        debugLog('🎨 SAVE SVG GRADIENT DATA:', gradientData);
                        debugLog('🎨 SAVE SVG GRADIENT ID:', gradientId);
                        return (
                            <defs>
                                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
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
                        className={`${isZigzag ? 'zigzag' : 'squiggle'}-path ${isZigzag ? 'zigzag' : 'squiggle'}-path-${animationId}`}
                        style={{
                            transformOrigin: 'center',
                            stroke: lineColor,
                            display: 'block',
                            animation: finalPaused 
                                ? 'none' 
                                : `${animationName} ${animationSpeed}s linear infinite`
                        }}
                    />
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