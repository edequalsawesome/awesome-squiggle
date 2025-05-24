import { registerBlockStyle } from '@wordpress/blocks';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, RangeControl, ToggleControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import './style.css';

// Debug logging
console.log('🌊 Awesome Squiggle plugin loaded!');

// Generate unique animation ID for each block instance
let animationCounter = 0;
const generateAnimationId = () => `squiggle-animation-${++animationCounter}`;

// Generate SVG path data for the squiggle
const generateSquigglePath = (amplitude = 10) => {
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

// Helper function to check if current style is a squiggle style
const isSquiggleStyle = (className) => {
    return className && (
        className.includes('is-style-animated-squiggle') ||
        className.includes('is-style-static-squiggle')
    );
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
            style
        } = attributes;
        
        const isSquiggle = isSquiggleStyle(className);

        // Initialize squiggle attributes when squiggle style is applied
        if (isSquiggle && strokeWidth === undefined) {
            const newAnimationId = generateAnimationId();
            setAttributes({
                strokeWidth: 1,
                animationSpeed: 1.6,
                squiggleAmplitude: 10,
                squiggleHeight: '100px',
                animationId: newAnimationId,
                isReversed: false
            });
        }

        // Ensure each block has a unique animation ID
        if (isSquiggle && !animationId) {
            setAttributes({ animationId: generateAnimationId() });
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

        // Get squiggle line color for editor preview - same priority order as save function
        let squiggleColor = 'currentColor';
        let editorSquiggleColor = 'currentColor';
        
        if (isSquiggle) {
            console.log('🎨 DEBUG: Color attributes:', { backgroundColor, customBackgroundColor, textColor, customTextColor, style, className });
            
            if (backgroundColor) {
                squiggleColor = `var(--wp--preset--color--${backgroundColor})`;
            } else if (customBackgroundColor) {
                squiggleColor = customBackgroundColor;
            } else if (style?.color?.background) {
                squiggleColor = style.color.background;
            } else {
                const classNameColor = extractColorFromClassName(className);
                if (classNameColor) {
                    squiggleColor = classNameColor;
                } else if (textColor) {
                    squiggleColor = `var(--wp--preset--color--${textColor})`;
                } else if (customTextColor) {
                    squiggleColor = customTextColor;
                } else if (style?.color?.text) {
                    squiggleColor = style.color.text;
                }
            }
            
            editorSquiggleColor = squiggleColor;
            console.log('🎨 Final editor color:', editorSquiggleColor);
        }

        // Determine if animation should be paused based on style
        let finalPaused = false;
        if (className && className.includes('is-style-static-squiggle')) {
            finalPaused = true;
        }

        // Clean up the className to remove conflicting is-paused class when it shouldn't be there
        let cleanClassName = className;
        if (cleanClassName && cleanClassName.includes('is-paused') && !finalPaused) {
            cleanClassName = cleanClassName.replace(/\bis-paused\b/g, '').replace(/\s+/g, ' ').trim();
            // Update the className in attributes to remove the stale is-paused class
            setAttributes({ className: cleanClassName });
        }

        // If not a squiggle style, just return the normal block edit without any interference
        if (!isSquiggle) {
            return <BlockEdit {...props} />;
        }

        // For squiggle styles, render our custom squiggle directly instead of overlay approach
        // This works better inside Group/Row/Stack blocks that use flexbox
        const blockProps = useBlockProps({
            className: `wp-block-separator awesome-squiggle-wave ${className || ''}`.trim(),
            style: {
                height: squiggleHeight || '100px',
                backgroundColor: 'transparent',
                minHeight: '50px'
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
                            100% { transform: translateX(-80px); }
                        }
                        @keyframes squiggle-flow-reverse {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(80px); }
                        }
                        .awesome-squiggle-editor-preview .squiggle-path {
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
                            <path
                                d={generateSquigglePath(squiggleAmplitude || 10)}
                                fill="none"
                                stroke={editorSquiggleColor}
                                strokeWidth={strokeWidth || 1}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`squiggle-path squiggle-path-${animationId || 'default'}`}
                                style={{
                                    animation: finalPaused 
                                        ? 'none' 
                                        : `${isReversed ? 'squiggle-flow-reverse' : 'squiggle-flow'} ${animationSpeed || 1.6}s linear infinite`,
                                    transformOrigin: 'center',
                                    stroke: editorSquiggleColor,
                                    display: 'block'
                                }}
                            />
                        </svg>
                    </div>
                </div>

                {/* Add our custom squiggle-specific controls to the inspector */}
                <InspectorControls group="settings">
                    <PanelBody title={__('Squiggle Settings', 'awesome-squiggle')} initialOpen={true}>
                        <RangeControl
                            label={__('Animation Speed', 'awesome-squiggle')}
                            value={animationSpeed || 1.6}
                            onChange={(value) => setAttributes({ animationSpeed: value })}
                            min={0.5}
                            max={5}
                            step={0.1}
                            help={__('Control how fast the squiggle animates', 'awesome-squiggle')}
                        />
                        <RangeControl
                            label={__('Squiggle Amplitude', 'awesome-squiggle')}
                            value={squiggleAmplitude || 10}
                            onChange={(value) => setAttributes({ squiggleAmplitude: value })}
                            min={5}
                            max={25}
                            help={__('Adjust the height of the squiggle peaks', 'awesome-squiggle')}
                        />
                        <ToggleControl
                            label={__('Reverse Animation', 'awesome-squiggle')}
                            checked={isReversed || false}
                            onChange={() => setAttributes({ isReversed: !isReversed })}
                            help={__('Make the squiggle animate in the opposite direction', 'awesome-squiggle')}
                        />
                    </PanelBody>
                    <PanelBody title={__('Squiggle Dimensions', 'awesome-squiggle')} initialOpen={false}>
                        <RangeControl
                            label={__('Stroke Width', 'awesome-squiggle')}
                            value={strokeWidth || 1}
                            onChange={(value) => setAttributes({ strokeWidth: value })}
                            min={1}
                            max={8}
                            help={__('Adjust the thickness of the squiggle line', 'awesome-squiggle')}
                        />
                        <SelectControl
                            label={__('Squiggle Height', 'awesome-squiggle')}
                            value={squiggleHeight || '100px'}
                            options={[
                                { label: '50px', value: '50px' },
                                { label: '75px', value: '75px' },
                                { label: '100px', value: '100px' },
                                { label: '125px', value: '125px' },
                                { label: '150px', value: '150px' },
                                { label: '200px', value: '200px' }
                            ]}
                            onChange={(value) => setAttributes({ squiggleHeight: value })}
                            help={__('Set the height of the squiggle container', 'awesome-squiggle')}
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
        
        if (!isSquiggle) {
            return element;
        }

        const {
            strokeWidth = 1,
            animationSpeed = 1.6,
            squiggleAmplitude = 10,
            squiggleHeight = '100px',
            animationId = generateAnimationId(),
            isReversed,
            textColor,
            customTextColor,
            backgroundColor, 
            customBackgroundColor,
            style
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
        if (className && className.includes('is-style-static-squiggle')) {
            finalPaused = true;
        }

        // Get squiggle line color - prioritize background color settings for the line
        let squiggleColor = 'currentColor';

        console.log('🎨 SAVE DEBUG: Color attributes:', { backgroundColor, customBackgroundColor, textColor, customTextColor, style, className });

        // Check all possible color sources in priority order
        if (backgroundColor) {
            squiggleColor = `var(--wp--preset--color--${backgroundColor})`;
        } else if (customBackgroundColor) {
            squiggleColor = customBackgroundColor;
        } else if (style?.color?.background) {
            squiggleColor = style.color.background;
        } else {
            // Try to extract color from className
            const classNameColor = extractColorFromClassName(className);
            if (classNameColor) {
                squiggleColor = classNameColor;
            } else if (textColor) {
                squiggleColor = `var(--wp--preset--color--${textColor})`;
            } else if (customTextColor) {
                squiggleColor = customTextColor;
            } else if (style?.color?.text) {
                squiggleColor = style.color.text;
            }
        }

        console.log('🎨 SAVE Final color:', squiggleColor);

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

        const inlineStyles = {
            height: squiggleHeight,
            backgroundColor: 'transparent', // Container background always transparent
            [`--animation-duration-${animationId}`]: `${animationSpeed}s`,
            [`--squiggle-color-${animationId}`]: squiggleColor, // Custom CSS variable for this instance
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
                    <path
                        d={generateSquigglePath(squiggleAmplitude)}
                        fill="none"
                        stroke={squiggleColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`squiggle-path squiggle-path-${animationId}`}
                        style={{
                            animation: finalPaused 
                                ? 'none' 
                                : `${isReversed ? 'squiggle-flow-reverse' : 'squiggle-flow'} ${animationSpeed}s linear infinite`,
                            transformOrigin: 'center',
                            stroke: squiggleColor // Explicit stroke color override
                        }}
                    />
                </svg>
            </div>
        );
    },
    20
);

// Register block styles for squiggle options
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
}); 