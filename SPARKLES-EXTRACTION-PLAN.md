# Awesome Sparkles Extraction Plan

## Overview

This document outlines how to extract the Sparkles feature from Awesome Squiggle into a standalone WordPress plugin called "Awesome Sparkles".

---

## New Plugin Details

### Plugin Header

```php
/**
 * Plugin Name:       Awesome Sparkles
 * Plugin URI:        https://github.com/[username]/awesome-sparkles
 * Description:       Add animated sparkle separators to your WordPress site. Extends the core Separator block with twinkling star patterns.
 * Version:           2026.01.12
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            [Author Name]
 * Author URI:        [Author URI]
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       awesome-sparkles
 */
```

### Block Styles to Register

```
is-style-animated-sparkle  -> isAnimated: true
is-style-static-sparkle    -> isAnimated: false
```

Or simplified (matching Awesome Squiggle v2 pattern):

```
is-style-sparkle  -> with Animate toggle
```

---

## Files to Extract

### From `src/index.js`

#### Functions to Copy

| Function | Lines | Purpose |
|----------|-------|---------|
| `generateSparkleElements()` | 477-547 | Creates SVG polygon stars |
| `isSparkleStyle()` | 584-593 | Style detection helper |

#### Attribute Definitions

```javascript
// Sparkle-specific attributes
sparkleSize: {
    type: 'number',
    default: 18
},
sparkleVerticalAmplitude: {
    type: 'number',
    default: 15
},
sparkleRandomness: {
    type: 'number',
    default: 100
},
animationSpeed: {
    type: 'number',
    default: 6
},
isAnimated: {
    type: 'boolean',
    default: true
},
height: {
    type: 'number',
    default: 100
},
animationId: {
    type: 'string',
    default: ''
},
gradientId: {
    type: 'string',
    default: ''
}
```

#### Inspector Controls to Copy

From lines 1529-1589:
- Sparkle Size slider (8-35px)
- Sparkle Vertical Spread slider (0-30px)
- Twinkle Randomness slider (0-200%)
- Animation Speed slider (1-10)
- Height dropdown (50-200px)

### From `src/style.css`

#### Styles to Copy

```css
/* Sparkle container (~lines 60-72) */
.is-style-sparkle .sparkle-container,
.is-style-animated-sparkle .sparkle-container,
.is-style-static-sparkle .sparkle-container {
    /* container styles */
}

/* Sparkle elements (~lines 73-96) */
.sparkle-element {
    fill: currentColor;
    opacity: 0.8;
}

/* Sparkle animation keyframes (~lines 166-176) */
@keyframes sparkle-shimmer {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}

/* Static sparkle override */
.is-style-static-sparkle .sparkle-element,
.is-style-sparkle.is-static .sparkle-element {
    animation: none;
    opacity: 0.8;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    .sparkle-element {
        animation: none !important;
        opacity: 0.8;
    }
}
```

### From `src/frontend.js`

**Copy entire file** - this is sparkle-specific:
- `handleAllSparkles()` function
- `updateSparkles()` function
- ResizeObserver logic
- Window resize debounce handler

### From `awesome-squiggle.php`

#### Functions to Adapt

- `awesome_squiggle_enqueue_block_editor_assets()` - rename and adapt
- `awesome_squiggle_register_block_styles()` - sparkle styles only
- `awesome_squiggle_filter_separator_content()` - sparkle rendering
- Validation functions (copy as-is, rename prefix)

---

## New Repository Structure

```
awesome-sparkles/
├── awesome-sparkles.php          # Main plugin file
├── src/
│   ├── index.js                  # Block extension (sparkles only)
│   ├── style.css                 # Sparkle styles
│   ├── frontend.js               # Dynamic sparkle regeneration
│   └── block.json                # Block metadata
├── build/                        # Compiled assets (gitignored)
├── scripts/
│   └── strip-debug.js            # Production build script
├── package.json
├── webpack.config.js
├── readme.txt                    # WordPress.org readme
├── CLAUDE.md                     # AI assistant instructions
├── CHANGELOG.md
└── .gitignore
```

---

## Code Simplifications in New Plugin

### Removed Complexity

Since sparkles is standalone, we can remove:
- Style detection for squiggle/zigzag
- Path generation functions (generateSquigglePath, generateZigzagPath)
- Stroke width control (sparkles are filled, not stroked)
- Multiple SVG type handling

### Estimated Size

| File | Awesome Squiggle | Awesome Sparkles |
|------|------------------|------------------|
| index.js | ~2,144 lines | ~600-800 lines |
| style.css | ~334 lines | ~150 lines |
| frontend.js | 164 lines | 164 lines (same) |
| PHP | ~211 lines | ~150 lines |

---

## Potential Enhancements for Sparkles

Once extracted, the plugin could evolve independently:

### New Features to Consider

1. **Star Point Count** - 4, 6, 8, or more points
2. **Star Rotation** - individual or synchronized rotation
3. **Color Variation** - multi-color sparkles within one block
4. **Density Control** - sparkles per 100px
5. **Size Variation** - min/max size range for variety
6. **Burst Patterns** - clustered vs evenly spaced

### Alternative Applications

Sparkles could extend beyond separators:
- Background decoration block
- Heading decoration
- Button hover effects
- Hero section accents

---

## Migration Strategy

### In Awesome Squiggle v2

Add deprecation notice for sparkle blocks:

```php
function awesome_squiggle_sparkle_deprecation_notice() {
    global $post;

    if (!$post || !has_blocks($post->post_content)) {
        return;
    }

    // Check for sparkle blocks
    if (strpos($post->post_content, 'is-style-animated-sparkle') !== false ||
        strpos($post->post_content, 'is-style-static-sparkle') !== false) {

        add_action('admin_notices', function() {
            ?>
            <div class="notice notice-warning">
                <p>
                    <strong>Awesome Squiggle:</strong>
                    Sparkle separators have moved to a dedicated plugin.
                    <a href="<?php echo admin_url('plugin-install.php?s=awesome-sparkles&tab=search&type=term'); ?>">
                        Install Awesome Sparkles
                    </a>
                    to continue using sparkle separators.
                </p>
            </div>
            <?php
        });
    }
}
add_action('admin_init', 'awesome_squiggle_sparkle_deprecation_notice');
```

### Backwards Compatibility Period

1. **Awesome Squiggle v2.0** (2026.01.xx)
   - Remove sparkle controls from editor
   - Keep sparkle CSS for frontend rendering (existing blocks still display)
   - Show admin notice recommending Awesome Sparkles

2. **Awesome Squiggle v2026.07.xx** (6 months later)
   - Remove sparkle CSS entirely
   - Existing sparkle blocks render as plain separators
   - Clear migration path complete

### User Communication

- Changelog entry explaining the split
- Blog post / documentation update
- WordPress.org plugin description update
- GitHub release notes

---

## Development Steps

### Phase 1: Create New Repository

```bash
# Create new repo
mkdir awesome-sparkles
cd awesome-sparkles
git init

# Set up structure
mkdir -p src scripts
touch awesome-sparkles.php
touch src/index.js src/style.css src/frontend.js src/block.json
touch package.json webpack.config.js readme.txt

# Copy package.json base and modify
# Copy webpack.config.js and modify entry points
```

### Phase 2: Extract Code

1. Copy `generateSparkleElements()` to new `src/index.js`
2. Copy sparkle-specific attributes
3. Copy sparkle inspector controls
4. Build new HOC wrapper (simplified, sparkles-only)
5. Copy sparkle CSS to new `src/style.css`
6. Copy `frontend.js` as-is
7. Create new `awesome-sparkles.php` with adapted hooks

### Phase 3: Test Standalone

1. Install new plugin on test site
2. Verify sparkle blocks render correctly
3. Verify editor controls work
4. Verify frontend regeneration works
5. Test with existing sparkle blocks (created with old plugin)

### Phase 4: Clean Awesome Squiggle

1. Remove sparkle code from `src/index.js`
2. Remove sparkle CSS from `src/style.css`
3. Remove `src/frontend.js` entirely
4. Remove sparkle enqueue from PHP
5. Add deprecation notice
6. Update version to 2026.xx.xx

### Phase 5: Release

1. Release Awesome Sparkles v2026.01.xx
2. Release Awesome Squiggle v2026.01.xx (sans sparkles)
3. Update WordPress.org listings
4. Announce split to users

---

## WordPress.org Submission

### New Plugin Listing

Awesome Sparkles will need to go through the WordPress.org plugin review process:

1. Submit to wordpress.org/plugins
2. Wait for review (typically 1-5 days)
3. Receive SVN access
4. Deploy initial version

### Plugin Description

```
=== Awesome Sparkles ===
Contributors: [username]
Tags: separator, sparkles, animation, block, stars
Requires at least: 6.0
Tested up to: 6.4
Stable tag: 2026.01.12
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add beautiful animated sparkle separators to your WordPress site.

== Description ==

Awesome Sparkles extends the core WordPress Separator block with
twinkling star patterns. Add visual interest to your pages with
customizable sparkle effects.

**Features:**

* Animated or static sparkle patterns
* Adjustable sparkle size (8-35px)
* Vertical spread control
* Randomized twinkle timing
* Full color and gradient support
* Respects reduced motion preferences

**Previously part of Awesome Squiggle** - This plugin was extracted
from Awesome Squiggle to provide a focused, standalone sparkle
separator experience.

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/awesome-sparkles`
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Add a Separator block and select the "Sparkle" style

== Changelog ==

= 2026.01.12 =
* Initial release (extracted from Awesome Squiggle)
```

---

## Timeline Suggestion

| Phase | Description |
|-------|-------------|
| 1 | Create awesome-sparkles repo, set up build tooling |
| 2 | Extract and adapt sparkle code |
| 3 | Test standalone functionality |
| 4 | Submit to WordPress.org for review |
| 5 | Clean sparkles from awesome-squiggle |
| 6 | Release both plugins |
| 7 | Monitor for issues, support users |
