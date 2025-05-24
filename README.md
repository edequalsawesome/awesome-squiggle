# Awesome Squiggle

A WordPress block that creates an animated sine wave divider. This block can be used as a standalone block or as a variation of the core Separator block.

## Features

- Smooth, continuously flowing sine wave animation
- Customizable wave properties:
  - Stroke color
  - Stroke width
  - Animation speed
  - Wave amplitude
  - Pause/play toggle
- Responsive design
- Seamless integration with WordPress core Separator block
- Lightweight (pure CSS/SVG animation)
- No external dependencies

## Installation

1. Download the plugin files
2. Upload the `awesome-squiggle` folder to the `/wp-content/plugins/` directory
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Run `npm install` in the plugin directory
5. Run `npm run build` to build the assets

## Usage

### As a Standalone Block

1. Click the "+" button to add a new block
2. Search for "Animated Wave Divider"
3. Select the block to add it to your content
4. Use the block settings in the sidebar to customize the wave

### As a Separator Variation

1. Add a core Separator block
2. In the block toolbar, click the "Styles" button
3. Select "Animated Wave" from the available styles
4. Customize the wave using the block settings

## Customization

The wave divider can be customized using the following options:

- **Wave Color**: Choose any color for the wave
- **Stroke Width**: Adjust the thickness of the wave (1-5px)
- **Animation Speed**: Control how fast the wave flows (0.5-5s)
- **Wave Amplitude**: Change the height of the wave (5-20px)
- **Pause Animation**: Toggle the animation on/off

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