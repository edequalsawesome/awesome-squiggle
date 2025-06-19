# Awesome Squiggle

A WordPress plugin that adds animated and static squiggle styles to the core Separator block. Transform boring horizontal lines into beautiful, flowing wave dividers.

## Features

- Four squiggle styles for the core Separator block:
  - **Animated Squiggle**: Smooth, continuously flowing wave animation
  - **Static Squiggle**: Beautiful wave shape without animation
  - **Animated Zig-Zag**: Sharp, angular Charlie Brown-style animation
  - **Static Zig-Zag**: Angular divider without animation
- Customizable wave properties:
  - Animation speed (0.5-5 seconds)
  - Wave amplitude (5-25px) 
  - Stroke width (1-8px)
  - Container height (50px-200px)
  - Reverse animation direction
- Full WordPress color support:
  - Inherits colors from theme color palette
  - Supports background color settings
  - Custom color picker integration
  - **Gradient support** with optimized performance
- Responsive design that works in any layout
- Lightweight (pure CSS/SVG animation)
- No external dependencies
- Works inside Group, Row, Stack, and other layout blocks
- **Performance optimized** for smooth rendering

## Installation

1. Download the plugin files
2. Upload the `awesome-squiggle` folder to the `/wp-content/plugins/` directory
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Run `npm install` in the plugin directory
5. Run `npm run build` to build the assets

## Usage

1. Add a core **Separator** block to your content
2. In the block toolbar, click the **Styles** button (or use the Styles panel in the sidebar)
3. Select from four available styles:
   - **"Animated Squiggle"** - Smooth flowing waves
   - **"Static Squiggle"** - Curved waves without animation
   - **"Animated Zig-Zag"** - Sharp angular animation
   - **"Static Zig-Zag"** - Angular divider without animation
4. Customize using the **Squiggle Settings** panel in the block sidebar
5. Apply colors using WordPress's standard color controls or enable gradient mode for colorful effects

## Customization Options

When a squiggle or zig-zag style is applied, you'll find these options in the block sidebar:

### Squiggle/Zig-Zag Settings
- **Animation Speed**: Control how fast the pattern flows (0.5-5 seconds)
- **Pattern Amplitude**: Adjust the height of the wave/zig-zag peaks (5-25px)  
- **Reverse Animation**: Make the pattern animate in the opposite direction

### Pattern Dimensions
- **Stroke Width**: Adjust the thickness of the line (1-8px)
- **Pattern Height**: Set the height of the container (50px-200px)

### Colors & Gradients
Use WordPress's standard color controls or enable gradient mode:
- **Background Color**: Sets the line color
- **Text Color**: Alternative way to set the line color
- **Custom Colors**: Use the color picker for exact color control
- **Gradient Mode**: Enable beautiful gradient effects with optimized performance
- **Gradient Picker**: Choose from WordPress preset gradients or create custom ones

## Development

```bash
# Install dependencies
npm install

# Start development mode
npm start

# Build for production
npm run build

# Secure production build (recommended for deployment)
npm run build:production
```

## Security Features

Version 1.2.5 includes comprehensive security enhancements:

- **Input Validation**: All user inputs are validated and bounded to prevent malicious data
- **Production Security**: Debug code is automatically stripped from production builds
- **Pattern Validation**: IDs and identifiers follow strict alphanumeric patterns
- **File Security**: Enhanced PHP file validation and JSON parsing with proper error handling
- **WordPress Integration**: Uses WordPress sanitization functions for maximum compatibility
- **Development vs Production**: Clear separation between development debugging and production deployments

For production deployments, always use:
```bash
npm run build:production
```

This ensures all debugging code is removed and the plugin is optimized for security and performance.

## Changelog

### Version 1.2.13
- **Fixed Color Controls**: Restored all WordPress native color controls including background color, text color, and custom color picker
- **Enhanced Gradient Support**: Added proper WordPress core gradient support through block supports system
- **Improved User Experience**: Users now have access to all standard WordPress color features alongside custom gradient functionality
- **Better Architecture**: Uses WordPress core color support system instead of custom implementation for maximum compatibility

### Version 1.2.11
- **WordPress.org Compliance Enhancement**: Added comprehensive source code documentation for all compiled JavaScript and CSS files
- **Build Process Documentation**: Included detailed build instructions and source file locations in readme.txt
- **Plugin Packaging**: Fixed plugin ZIP generation to include source files (`src/` directory) alongside built files
- **Repository Transparency**: Added public GitHub repository link for enhanced open source compliance
- **Review Requirements**: Addressed all WordPress.org plugin review feedback regarding human-readable code access

### Version 1.2.10
- **Animation Direction Enhancement**: Reversed default animation directions for improved visual flow
- **User Experience**: Standard animations now flow left-to-right, reverse toggle enables right-to-left motion
- **Consistency Improvement**: Both squiggle and zigzag patterns follow the new directional logic

### Version 1.2.9
- **WordPress Plugin Checker Compliance**: Added proper `readme.txt` file with all required WordPress plugin repository headers
- **Plugin Repository Ready**: Includes "Tested up to", "License", "Stable Tag", and properly formatted short description
- **Documentation Enhancement**: Maintains both GitHub README.md and WordPress readme.txt for complete compatibility
- **Standards Compliance**: Meets all WordPress.org plugin submission requirements

### Version 1.2.8
- **Production Build Enhancement**: Added automated debug statement stripping for WordPress Plugin Checker compliance
- **Development Workflow**: New `npm run build:production` script removes error_log() calls while preserving security checks
- **Developer Tools**: Added `npm run restore-debug` script for easy development mode restoration
- **Plugin Compliance**: Eliminates WordPress.org plugin review warnings about logging statements

### Version 1.2.7
- **Animation Speed Enhancement**: Improved animation speed slider logic for more intuitive control
- **User Experience**: Higher slider values now correspond to faster animations (inverted duration logic)
- **Performance**: Optimized animation timing calculations for smoother visual feedback

### Version 1.2.6
- **UI Simplification**: Removed manual gradient toggle for improved user experience
- **Automatic Gradients**: Gradients now work automatically when selected from WordPress color controls
- **Streamlined Interface**: Simplified settings panel with fewer confusing options

### Version 1.2.5
- **Security Enhancements**: Comprehensive security improvements across the entire plugin
- **Input Validation**: Added robust validation for all user inputs with bounds checking
- **Production Builds**: Implemented secure production builds that strip debug code
- **PHP Security**: Enhanced file validation, JSON parsing, and input sanitization
- **JavaScript Security**: Added secure attribute handling and pattern validation
- **Development Tools**: New production build script for secure deployments
- **Documentation**: Added comprehensive security documentation and maintenance guidelines

### Version 1.2.1
- **Gradient Auto-Detection**: Fixed gradient functionality for zigzag patterns
- **Improved Gradient Logic**: Gradients now automatically work when selected from WordPress color controls
- **Enhanced Pattern Support**: Both squiggle and zigzag patterns now have identical gradient capabilities
- **Better Debugging**: Added pattern-specific gradient debugging and ID generation

### Version 1.2.0
- **Gradient Support**: Added full gradient support with WordPress preset gradients
- **Performance Optimizations**: Optimized gradient rendering for smooth, instant display
- **Improved Parsing**: Fixed gradient parsing issues for complex multi-stop gradients
- **Enhanced UX**: Eliminated rendering delays and visual flashes during gradient loading
- **Better Compatibility**: Improved performance across all devices and browsers

### Version 1.1.0
- **Zig-Zag Patterns**: Added animated and static zig-zag styles
- **Enhanced Controls**: Improved customization options and settings panels
- **Color Support**: Full WordPress color palette integration
- **Responsive Design**: Better handling of different container sizes

### Version 1.0.0
- **Initial Release**: Animated and static squiggle separators
- **Core Features**: Basic customization and WordPress integration

## License

This project is licensed under the GPL v3 License - see the LICENSE.md file for details. 