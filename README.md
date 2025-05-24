# Awesome Squiggle

A WordPress plugin that adds animated and static squiggle styles to the core Separator block. Transform boring horizontal lines into beautiful, flowing wave dividers.

## Features

- Two squiggle styles for the core Separator block:
  - **Animated Squiggle**: Smooth, continuously flowing wave animation
  - **Static Squiggle**: Beautiful wave shape without animation
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
- Responsive design that works in any layout
- Lightweight (pure CSS/SVG animation)
- No external dependencies
- Works inside Group, Row, Stack, and other layout blocks

## Installation

1. Download the plugin files
2. Upload the `awesome-squiggle` folder to the `/wp-content/plugins/` directory
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Run `npm install` in the plugin directory
5. Run `npm run build` to build the assets

## Usage

1. Add a core **Separator** block to your content
2. In the block toolbar, click the **Styles** button (or use the Styles panel in the sidebar)
3. Select either **"Animated Squiggle"** or **"Static Squiggle"** from the available styles
4. Customize the squiggle using the new **Squiggle Settings** panel in the block sidebar
5. Apply colors using WordPress's standard color controls (background color, text color, or custom colors)

## Customization Options

When a squiggle style is applied, you'll find these options in the block sidebar:

### Squiggle Settings
- **Animation Speed**: Control how fast the wave flows (0.5-5 seconds)
- **Squiggle Amplitude**: Adjust the height of the wave peaks (5-25px)  
- **Reverse Animation**: Make the squiggle animate in the opposite direction

### Squiggle Dimensions
- **Stroke Width**: Adjust the thickness of the squiggle line (1-8px)
- **Squiggle Height**: Set the height of the squiggle container (50px-200px)

### Colors
Use WordPress's standard color controls:
- **Background Color**: Sets the squiggle line color
- **Text Color**: Alternative way to set the squiggle line color
- **Custom Colors**: Use the color picker for exact color control

## Development

```bash
# Install dependencies
npm install

# Start development mode
npm start

# Build for production
npm run build
```

## License

This project is licensed under the GPL-2.0-or-later License - see the LICENSE file for details. 