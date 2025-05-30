=== Awesome Squiggle ===
Contributors: edequalsawesome
Donate link: https://edequalsaweso.me
Tags: separator, block, blocks, gutenberg, gutenberg blocks
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.2.10
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Adds animated squiggle and zigzag styles to the core WordPress separator block with full customization options.

== Description ==

Transform boring horizontal separators into beautiful, flowing wave dividers! Awesome Squiggle adds animated and static squiggle styles to the core WordPress Separator block.

**Features:**

* Four squiggle styles for the core Separator block:
  * **Animated Squiggle**: Smooth, continuously flowing wave animation
  * **Static Squiggle**: Beautiful wave shape without animation
  * **Animated Zig-Zag**: Sharp, angular Charlie Brown-style animation
  * **Static Zig-Zag**: Angular divider without animation

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
5. Select from four available squiggle/zigzag styles
6. Customize using the Squiggle Settings panel in the block sidebar

== Frequently Asked Questions ==

= How do I use the squiggle separators? =

Add a core Separator block to your content, then in the block toolbar click the "Styles" button and select from the four available squiggle and zigzag styles.

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

== Upgrade Notice ==

= 1.2.10 =
Animation direction enhancement. Standard animations now flow left-to-right for improved visual flow.

= 1.2.9 =
WordPress Plugin Checker compliance update. Added proper readme.txt file for WordPress.org submission readiness.

= 1.2.8 =
Important update for WordPress Plugin Checker compliance. Production builds now automatically strip debug code while preserving all functionality. 