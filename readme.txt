=== Awesome Squiggle ===
Contributors: eDThomas
Donate link: https://edequalsaweso.me
Tags: separator, block, blocks, gutenberg, gutenberg blocks
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.3.1
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Adds animated squiggle and zigzag styles to the core WordPress separator block with full customization options.

== Description ==

Transform boring horizontal separators into beautiful, flowing wave dividers! Awesome Squiggle adds animated and static squiggle styles to the core WordPress Separator block.

**Features:**

* Six unique styles for the core Separator block:
  * **Animated Squiggle**: Smooth, continuously flowing wave animation
  * **Static Squiggle**: Beautiful wave shape without animation
  * **Animated Zig-Zag**: Sharp, angular Charlie Brown-style animation
  * **Static Zig-Zag**: Angular divider without animation
  * **Animated Sparkle**: Glittering, shimmering sparkle animation
  * **Static Sparkle**: Decorative sparkle pattern without animation

* **Customizable wave properties:**
  * Animation speed (0.5-5 seconds)
  * Wave amplitude (5-25px) 
  * Stroke width (1-8px)
  * Container height (50px-200px)
  * Reverse animation direction

* **Full WordPress color support:**
  * Inherits colors from theme color palette
  * Supports background color settings
  * Custom color picker integration
  * **Gradient support** with optimized performance

* **Performance optimized:**
  * Responsive design that works in any layout
  * Lightweight (pure CSS/SVG animation)
  * No external dependencies
  * Works inside Group, Row, Stack, and other layout blocks

== Installation ==

1. Upload the `awesome-squiggle` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Add a core Separator block to your content
4. In the block toolbar, click the Styles button
5. Select from six available squiggle/zigzag/sparkle styles
6. Customize using the Squiggle Settings panel in the block sidebar

== Frequently Asked Questions ==

= How do I use the squiggle separators? =

Add a core Separator block to your content, then in the block toolbar click the "Styles" button and select from the six available squiggle, zigzag, and sparkle styles.

= Can I customize the animation speed? =

Yes! When a squiggle or zigzag style is applied, you'll find animation speed controls in the block sidebar under "Squiggle Settings".

= Do gradients work with the patterns? =

Absolutely! The plugin has full gradient support. Simply select a gradient from WordPress's color controls and it will automatically apply to your squiggle pattern.

= Will this affect my site's performance? =

No, the plugin uses pure CSS/SVG animations and is highly optimized for performance. It's lightweight with no external dependencies.

== Screenshots ==

1. Four available squiggle and zigzag styles in the block toolbar
2. Customization options in the block sidebar
3. Example of animated squiggle separator
4. Example of zigzag pattern with gradient colors

== Changelog ==

= 1.3.1 =
* Full Width Fix: Ensure alignfull separators break out of global site padding wrappers
* Theme Preset Gradients: Resolve theme.json gradient presets via CSS variables for any theme slug
* Sparkle Controls on Frontend: Sparkle Size and Sparkle Vertical Spread now apply on the frontend (saved as data attributes)
* Sparkle Animation Speed: Editor speed now controls frontend shimmer timing
* Twinkle Randomness: New control to tune sparkle timing variance (0–200%)
* Editor Preview Parity: Sparkle preview width matches frontend for centered layout
* Packaging: Updated built assets and ZIP for distribution

= 1.3.0 =
* Dynamic Sparkle Generation: Sparkles now automatically scale based on container width for responsive display
* Alignment Fix: Fixed alignfull and alignwide classes not generating correctly on frontend
* Alignfull Breakout: Added CSS to break full-width separators out of global padding wrappers for true edge-to-edge display
* Color Override Enhancement: Added aggressive CSS overrides to prevent background color blocks from appearing
* Half-Sparkle Prevention: Sparkles now respect container boundaries and never appear as partial elements
* ResizeObserver Integration: Added automatic sparkle regeneration when container size changes
* Frontend Script Optimization: Conditional loading of frontend scripts only when sparkle styles are present
* Webpack Multi-Entry: Added support for separate frontend JavaScript bundle
* Theme Gradient Compatibility: Gradient presets from theme.json now resolve via CSS variables, supporting custom slugs across themes

= 1.2.15 =
* New Sparkle Divider: Added animated and static sparkle/glitter variations to the separator block
* Enhanced Gradient System: Improved deterministic gradient ID generation for better performance and uniqueness
* Optimized Animations: Refined CSS animations and added sparkle shimmer effects
* Better Block Identification: Enhanced block instance tracking to prevent ID conflicts
* Webpack Configuration: Optimized build configuration for improved bundle size
* Code Refactoring: Improved debug logging and gradient ID generation for better performance

= 1.2.13 =
* Fixed Color Controls: Restored all WordPress native color controls including background color, text color, and custom color picker
* Enhanced Gradient Support: Added proper WordPress core gradient support through block supports system
* Improved User Experience: Users now have access to all standard WordPress color features alongside custom gradient functionality
* Better Architecture: Uses WordPress core color support system instead of custom implementation for maximum compatibility

= 1.2.11 =
* WordPress.org Compliance Enhancement: Added comprehensive source code documentation for all compiled JavaScript and CSS files
* Build Process Documentation: Included detailed build instructions and source file locations in readme.txt
* Plugin Packaging: Fixed plugin ZIP generation to include source files (`src/` directory) alongside built files
* Repository Transparency: Added public GitHub repository link for enhanced open source compliance
* Review Requirements: Addressed all WordPress.org plugin review feedback regarding human-readable code access

= 1.2.10 =
* Animation Direction Enhancement: Reversed default animation directions for improved visual flow
* User Experience: Standard animations now flow left-to-right, reverse toggle enables right-to-left motion
* Consistency Improvement: Both squiggle and zigzag patterns follow the new directional logic

= 1.2.9 =
* WordPress Plugin Checker Compliance: Added proper readme.txt file with all required WordPress plugin repository headers
* Plugin Repository Ready: Includes "Tested up to", "License", "Stable Tag", and properly formatted short description
* Documentation Enhancement: Maintains both GitHub README.md and WordPress readme.txt for complete compatibility
* Standards Compliance: Meets all WordPress.org plugin submission requirements

= 1.2.8 =
* Production Build Enhancement: Added automated debug statement stripping for WordPress Plugin Checker compliance
* Development Workflow: New build:production script removes error_log() calls while preserving security checks
* Developer Tools: Added restore-debug script for easy development mode restoration
* Plugin Compliance: Eliminates WordPress.org plugin review warnings about logging statements

= 1.2.7 =
* Animation Speed Enhancement: Improved animation speed slider logic for more intuitive control
* User Experience: Higher slider values now correspond to faster animations (inverted duration logic)
* Performance: Optimized animation timing calculations for smoother visual feedback

= 1.2.6 =
* UI Simplification: Removed manual gradient toggle for improved user experience
* Automatic Gradients: Gradients now work automatically when selected from WordPress color controls
* Streamlined Interface: Simplified settings panel with fewer confusing options

= 1.2.5 =
* Security Enhancements: Comprehensive security improvements across the entire plugin
* Input Validation: Added robust validation for all user inputs with bounds checking
* Production Builds: Implemented secure production builds that strip debug code
* PHP Security: Enhanced file validation, JSON parsing, and input sanitization
* JavaScript Security: Added secure attribute handling and pattern validation

*For older version history, see changelog.txt*

== Source Code ==

This plugin includes compiled/minified JavaScript and CSS files in the `build/` directory. The human-readable source code is available in the `src/` directory of this plugin.

**Build Process:**
This plugin uses WordPress Scripts (@wordpress/scripts) and Webpack for building. To build from source:

1. Install Node.js (version 18 or higher recommended)
2. Navigate to the plugin directory
3. Run `npm install` to install dependencies
4. Run `npm run build` for development build or `npm run build:production` for production build

**Source Code Location:**
- JavaScript source: `src/index.js`
- CSS source: `src/style.css`
- Block configuration: `src/block.json`

**Development:**
- Run `npm run start` for development with hot reloading
- Run `npm run lint:js` and `npm run lint:css` for code linting

The complete source code is maintained in this plugin package. All compressed files in the `build/` directory are generated from the human-readable source files in the `src/` directory using the build process described above.

**Public Repository:**
The plugin source code is also available at: https://github.com/edequalsawesome/awesome-squiggle

== Upgrade Notice ==

= 1.3.1 =
Fixes full-width behavior in block themes and improves compatibility with theme-defined gradient presets. Also brings sparkle controls (size/spread/speed/randomness) to the frontend and aligns editor preview with frontend.

= 1.3.0 =
Major responsive enhancement! Sparkles now automatically scale with container width and respect alignment boundaries. Fixed frontend alignment classes and enhanced color override system for perfect display.

= 1.2.15 =
Exciting new update! Added animated and static sparkle/glitter divider styles. Improved gradient system performance and optimized animations. Six unique separator styles now available.

= 1.2.13 =
Major color control fix. Custom gradients now work properly with full WordPress color controls restored. All color options including gradients, background colors, and custom colors are now available.

= 1.2.11 =
WordPress.org compliance update. Added comprehensive source code documentation and fixed plugin packaging to include all source files for reviewer transparency.

= 1.2.10 =
Animation direction enhancement. Standard animations now flow left-to-right for improved visual flow.

= 1.2.9 =
WordPress Plugin Checker compliance update. Added proper readme.txt file for WordPress.org submission readiness.

= 1.2.8 =
Important update for WordPress Plugin Checker compliance. Production builds now automatically strip debug code while preserving all functionality. 
