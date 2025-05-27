# Awesome Squiggle

A WordPress plugin that adds animated and static squiggle and zig-zag styles to the core Separator block. Transform boring horizontal lines into beautiful, flowing wave dividers or sharp, dynamic zig-zag patterns.

## Features

- Four custom styles for the core Separator block:
  - **Animated Squiggle**: Smooth, continuously flowing wave animation
  - **Static Squiggle**: Beautiful wave shape without animation
  - **Animated Zig-Zag**: Sharp, angular pattern with flowing animation (Charlie Brown stripe style)
  - **Static Zig-Zag**: Angular zig-zag pattern without animation
- Customizable pattern properties:
  - Animation speed (0.5-5 seconds)
  - Wave/zig-zag amplitude (5-25px) 
  - Stroke width (1-8px)
  - Container height (50px-200px)
  - Reverse animation direction
- Enhanced WordPress color support:
  - Inherits colors from theme color palette
  - Supports background color settings (primary color source)
  - Text color settings (fallback color source)
  - Custom color picker integration
  - Real-time color updates in editor
  - Proper color inheritance from parent blocks
- Responsive design that works in any layout
- Lightweight (pure CSS/SVG animation)
- No external dependencies
- Works inside Group, Row, Stack, and other layout blocks
- Non-intrusive: doesn't interfere with standard Separator block functionality

## Recent Updates

### Version 1.1.0
- **New Zig-Zag Styles**: Added animated and static zig-zag patterns with sharp, angular design
- **Improved Color Handling**: Enhanced color inheritance and real-time editor updates
- **Better Block Compatibility**: Fixed issues with Group blocks and other layout containers
- **Non-Intrusive Design**: Custom attributes only apply when using squiggle/zig-zag styles
- **Enhanced Editor Experience**: Real-time preview updates and better visual feedback
- **Debugging Improvements**: Added comprehensive logging for troubleshooting

## Installation

1. Download the plugin files
2. Upload the `awesome-squiggle` folder to the `/wp-content/plugins/` directory
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Run `npm install` in the plugin directory
5. Run `npm run build` to build the assets

## Usage

1. Add a core **Separator** block to your content
2. In the block toolbar, click the **Styles** button (or use the Styles panel in the sidebar)
3. Select from the available custom styles:
   - **"Animated Squiggle"** - Smooth flowing wave
   - **"Static Squiggle"** - Wave without animation
   - **"Animated Zig-Zag"** - Sharp angular pattern with animation
   - **"Static Zig-Zag"** - Angular pattern without animation
4. Customize the pattern using the new settings panel in the block sidebar
5. Apply colors using WordPress's standard color controls

## Customization Options

When a custom style is applied, you'll find these options in the block sidebar:

### Squiggle/Zig-Zag Settings
- **Animation Speed**: Control how fast the pattern flows (0.5-5 seconds)
- **Pattern Amplitude**: Adjust the height of the peaks (5-25px)
  - Squiggle: Smooth wave height
  - Zig-Zag: Sharp angle height
- **Reverse Animation**: Make the pattern animate in the opposite direction

### Pattern Dimensions
- **Stroke Width**: Adjust the thickness of the line (1-8px)
- **Pattern Height**: Set the height of the container (50px-200px)

### Colors
Use WordPress's standard color controls with enhanced support:
- **Background Color**: Primary color source for the pattern line
- **Text Color**: Alternative color source for the pattern line
- **Custom Colors**: Use the color picker for exact color control
- **Theme Colors**: Full integration with your theme's color palette

## Technical Details

### Color Priority
The plugin uses the following color priority order:
1. Background Color (WordPress preset or custom)
2. Custom Background Color
3. Inline Background Color Style
4. Text Color (WordPress preset or custom)
5. Custom Text Color
6. Inline Text Color Style
7. Falls back to `currentColor`

### Animation Performance
- Pure CSS animations for optimal performance
- SVG-based patterns for crisp rendering at any size
- Unique animation IDs prevent conflicts between multiple instances
- Lightweight implementation with minimal DOM impact

### Block Compatibility
- Works seamlessly with Group, Row, Stack, and Column blocks
- Non-intrusive: only adds custom attributes when custom styles are used
- Preserves all standard Separator block functionality
- Compatible with WordPress's block editor and full-site editing

## Development

```bash
# Install dependencies
npm install

# Start development mode
npm start

# Build for production
npm run build
```

### Development Notes
- The plugin uses WordPress hooks to extend the core Separator block
- Custom attributes are only added when needed to avoid interference
- Real-time editor preview matches frontend output exactly
- Comprehensive debugging available via browser console

## Browser Support

- Modern browsers with CSS animation support
- SVG support required for pattern rendering
- Graceful degradation for older browsers

## License

This project is licensed under the GPL v3 License - see the LICENSE.md file for details. 