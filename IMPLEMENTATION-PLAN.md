# Awesome Squiggle v2.0 Implementation Plan

## Overview

This document outlines the architectural changes to transform Awesome Squiggle from a style-based system to a slider-based parametric wave generator. The changes will simplify the user experience while providing more creative control.

---

## Version Numbering Change

Moving from semantic versioning (1.3.2) to date-based versioning.

### Format: `YYYY.MM.DD`

Example: `2026.01.12`

### Compatibility Notes

- WordPress.org allows date-based versions (no explicit prohibition in guidelines)
- PHP's `version_compare()` handles this format correctly
- `2026.01.12` > `1.3.2` so upgrades will work properly
- Tags must contain only numbers and periods (compliant)

### Files to Update

- `package.json` - version field
- `awesome-squiggle.php` - plugin header Version
- `src/block.json` - version field
- `readme.txt` - Stable tag and changelog

---

## Phase 1: Remove Sparkles (Separate Plugin)

### Rationale

| Aspect | Squiggle/Zig-Zag | Sparkles |
|--------|------------------|----------|
| SVG Type | `<path>` strokes | `<polygon>` fills |
| Frontend JS | None needed | Required (regeneration) |
| Animation | CSS translate | CSS opacity |
| Concept | Wavy line separator | Decorative star field |
| Controls | Amplitude, pointiness, angle | Size, spread, randomness |

Sparkles are fundamentally different and warrant their own plugin.

### Files to Modify

#### `src/index.js`
- Remove `isSparkleStyle()` function (~line 584)
- Remove `generateSparkleElements()` function (~lines 477-547)
- Remove sparkle-specific attribute defaults (~lines 787-788)
- Remove sparkle controls from inspector panel (~lines 1529-1589)
- Remove sparkle rendering logic from `withSquiggleControls` HOC
- Remove sparkle block style registrations

#### `src/style.css`
- Remove `.sparkle-element` styles (~lines 60-96)
- Remove `sparkle-shimmer` keyframes (~lines 166-176)
- Remove sparkle-specific responsive styles

#### `src/frontend.js`
- This entire file can be removed (only used for sparkle regeneration)

#### `awesome-squiggle.php`
- Remove sparkle-related enqueue logic
- Remove `frontend.js` script registration

#### `webpack.config.js`
- Remove frontend.js entry point if configured

### New Plugin: Awesome Sparkles

Create separately with extracted sparkle code. Migration notice in Awesome Squiggle for users with existing sparkle blocks.

---

## Phase 2: Consolidate Block Styles

### Current Styles (Remove)

```
is-style-animated-squiggle
is-style-static-squiggle
is-style-animated-zigzag
is-style-static-zigzag
is-style-animated-sparkle  (removed in Phase 1)
is-style-static-sparkle    (removed in Phase 1)
```

### New Styles (Shape Presets Only)

```
is-style-squiggle   -> pointiness: 0%, angle: 0°
is-style-zigzag     -> pointiness: 100%, angle: 0°
is-style-lightning  -> pointiness: 100%, angle: 40°
```

### Animation Becomes a Toggle

Animation state moves from style identity to boolean attribute with inspector toggle.

---

## Phase 3: New Attribute Schema

### Attributes to Add

```javascript
attributes: {
    // NEW: Parametric wave controls
    pointiness: {
        type: 'number',
        default: 0  // Set by style selection
    },
    angle: {
        type: 'number',
        default: 0  // Set by style selection
    },

    // NEW: Animation as toggle (replaces style-based)
    isAnimated: {
        type: 'boolean',
        default: true
    },

    // EXISTING: Keep these
    amplitude: {
        type: 'number',
        default: 10
    },
    animationSpeed: {
        type: 'number',
        default: 6
    },
    reverseAnimation: {
        type: 'boolean',
        default: false
    },
    strokeWidth: {
        type: 'number',
        default: 1
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
}
```

### Attributes to Remove

None explicitly removed, but the style-based animation detection logic goes away.

---

## Phase 4: Unified Path Generation

### Current State

Two separate functions:
- `generateSquigglePath()` - cubic Bezier curves
- `generateZigzagPath()` - straight lines

### New State

Single parameterized function:

```javascript
/**
 * Generate a wave path with variable pointiness and angle
 *
 * @param {number} width - Container width
 * @param {number} amplitude - Wave height (5-25px)
 * @param {number} pointiness - 0 = smooth curves, 100 = sharp points
 * @param {number} angle - Peak angle in degrees (-60 to +60)
 * @returns {string} SVG path d attribute
 */
function generateWavePath(width, amplitude, pointiness = 0, angle = 0) {
    const wavelength = 40;
    const midY = 50;
    const pathWidth = Math.max(800, width + 200);
    const startX = -wavelength * 2;

    // Convert angle to radians
    const angleRad = (angle * Math.PI) / 180;

    // Calculate horizontal offset for angled peaks
    const xOffset = amplitude * Math.sin(angleRad);
    const yMultiplier = Math.cos(angleRad);

    let path = `M ${startX},${midY}`;
    let isUpPeak = true;

    for (let x = startX; x < pathWidth; x += wavelength) {
        const peakX = x + wavelength / 2 + (isUpPeak ? xOffset : -xOffset);
        const peakY = isUpPeak
            ? midY - (amplitude * yMultiplier)
            : midY + (amplitude * yMultiplier);
        const endX = x + wavelength;

        if (pointiness >= 100) {
            // Pure zig-zag: straight lines
            path += ` L ${peakX},${peakY} L ${endX},${midY}`;
        } else if (pointiness <= 0) {
            // Pure squiggle: cubic Bezier curves
            const cp1x = x + wavelength * 0.375;
            const cp2x = x + wavelength * 0.625;
            path += ` C ${cp1x},${peakY} ${cp2x},${peakY} ${endX},${midY}`;
        } else {
            // Hybrid: quadratic Bezier with tightness based on pointiness
            // Higher pointiness = control point closer to peak
            const tension = pointiness / 100;
            const cpX = peakX;
            const cpY = peakY;

            // Quadratic curve through the peak point
            // As tension increases, curve gets tighter around peak
            const qcp1x = x + (peakX - x) * (0.5 + tension * 0.4);
            const qcp1y = midY + (peakY - midY) * (0.7 + tension * 0.3);
            const qcp2x = peakX + (endX - peakX) * (0.5 - tension * 0.4);
            const qcp2y = midY + (peakY - midY) * (0.7 + tension * 0.3);

            path += ` Q ${qcp1x},${qcp1y} ${peakX},${peakY}`;
            path += ` Q ${qcp2x},${qcp2y} ${endX},${midY}`;
        }

        isUpPeak = !isUpPeak;
    }

    return path;
}
```

### Visual Examples

```
Pointiness: 0%, Angle: 0° (Squiggle)
    ╭──╮    ╭──╮    ╭──╮
────╯  ╰────╯  ╰────╯  ╰────

Pointiness: 100%, Angle: 0° (Zig-Zag)
    /\      /\      /\
───/  \────/  \────/  \────

Pointiness: 100%, Angle: 40° (Lightning)
     /\       /\       /\
────/  \────-/  \────-/  \────
   (peaks lean right)
```

---

## Phase 5: Updated Inspector Controls

### Panel Layout

```
┌─────────────────────────────────────────┐
│ Wave Settings                           │
├─────────────────────────────────────────┤
│ Amplitude                    [====○===] │
│ 10px                              5-25  │
│                                         │
│ Pointiness                   [○=======] │
│ 0% (Smooth)                      0-100  │
│                                         │
│ Angle                        [====○===] │
│ 0°                             -60-+60  │
│                                         │
│ ──────────────────────────────────────  │
│                                         │
│ [✓] Animate                             │
│                                         │
│ Speed                        [=====○==] │
│ 6 (Medium)                        1-10  │
│                                         │
│ [ ] Reverse Direction                   │
├─────────────────────────────────────────┤
│ Dimensions                              │
├─────────────────────────────────────────┤
│ Stroke Width                 [○=======] │
│ 1px                               1-8   │
│                                         │
│ Height                       [▼ 100px ] │
│                                         │
└─────────────────────────────────────────┘
```

### Control Definitions

```javascript
// Pointiness slider
<RangeControl
    label="Pointiness"
    value={pointiness}
    onChange={(value) => setSecureAttributes({ pointiness: value })}
    min={0}
    max={100}
    step={5}
    help={getPointinessLabel(pointiness)} // "Smooth" / "Rounded" / "Sharp"
/>

// Angle slider
<RangeControl
    label="Angle"
    value={angle}
    onChange={(value) => setSecureAttributes({ angle: value })}
    min={-60}
    max={60}
    step={5}
    help={getAngleLabel(angle)} // "Left lean" / "Vertical" / "Right lean"
/>

// Animate toggle
<ToggleControl
    label="Animate"
    checked={isAnimated}
    onChange={(value) => setAttributes({ isAnimated: value })}
/>

// Conditional: only show when animated
{isAnimated && (
    <>
        <RangeControl label="Speed" ... />
        <ToggleControl label="Reverse Direction" ... />
    </>
)}
```

---

## Phase 6: Style Registration with Defaults

### Style Definitions

```javascript
wp.blocks.registerBlockStyle('core/separator', {
    name: 'squiggle',
    label: 'Squiggle',
    isDefault: false
});

wp.blocks.registerBlockStyle('core/separator', {
    name: 'zigzag',
    label: 'Zig-Zag',
    isDefault: false
});

wp.blocks.registerBlockStyle('core/separator', {
    name: 'lightning',
    label: 'Lightning',
    isDefault: false
});
```

### Style Change Handler

When user selects a style, set appropriate defaults:

```javascript
// In the HOC, detect style changes
useEffect(() => {
    const currentStyle = getBlockStyle(className);

    if (currentStyle === 'squiggle' && !hasUserModified) {
        setAttributes({
            pointiness: 0,
            angle: 0,
            amplitude: 10
        });
    } else if (currentStyle === 'zigzag' && !hasUserModified) {
        setAttributes({
            pointiness: 100,
            angle: 0,
            amplitude: 15
        });
    } else if (currentStyle === 'lightning' && !hasUserModified) {
        setAttributes({
            pointiness: 100,
            angle: 40,
            amplitude: 15
        });
    }
}, [className]);
```

---

## Phase 7: CSS Updates

### Remove

- All `is-style-animated-*` and `is-style-static-*` selectors
- Separate animation keyframes for squiggle vs zigzag (they're identical anyway)

### Simplify To

```css
/* Base wave path styles */
.is-style-squiggle .wave-path,
.is-style-zigzag .wave-path,
.is-style-lightning .wave-path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
}

/* Animated state (default) */
.awesome-squiggle-wave:not(.is-static) .wave-path {
    animation: wave-flow var(--animation-duration, 2.5s) linear infinite;
}

/* Reverse animation */
.awesome-squiggle-wave.is-reversed:not(.is-static) .wave-path {
    animation-name: wave-flow-reverse;
}

/* Static state */
.awesome-squiggle-wave.is-static .wave-path {
    animation: none;
}

/* Single set of keyframes */
@keyframes wave-flow {
    from { transform: translateX(0); }
    to { transform: translateX(-80px); }
}

@keyframes wave-flow-reverse {
    from { transform: translateX(-80px); }
    to { transform: translateX(0); }
}
```

### Class Application Logic

```javascript
// In render/save
const wrapperClasses = classnames('awesome-squiggle-wave', {
    'is-static': !isAnimated,
    'is-reversed': reverseAnimation && isAnimated
});
```

---

## Phase 8: Backwards Compatibility

### Migration Strategy

Existing blocks with old style classes need to continue working.

```javascript
// Migration helper in HOC
function migrateOldStyles(className, attributes) {
    if (className?.includes('is-style-animated-squiggle')) {
        return {
            newClassName: className.replace('is-style-animated-squiggle', 'is-style-squiggle'),
            newAttributes: { ...attributes, isAnimated: true, pointiness: 0 }
        };
    }
    if (className?.includes('is-style-static-squiggle')) {
        return {
            newClassName: className.replace('is-style-static-squiggle', 'is-style-squiggle'),
            newAttributes: { ...attributes, isAnimated: false, pointiness: 0 }
        };
    }
    if (className?.includes('is-style-animated-zigzag')) {
        return {
            newClassName: className.replace('is-style-animated-zigzag', 'is-style-zigzag'),
            newAttributes: { ...attributes, isAnimated: true, pointiness: 100 }
        };
    }
    if (className?.includes('is-style-static-zigzag')) {
        return {
            newClassName: className.replace('is-style-static-zigzag', 'is-style-zigzag'),
            newAttributes: { ...attributes, isAnimated: false, pointiness: 100 }
        };
    }
    // Sparkle styles - show admin notice to install Awesome Sparkles
    if (className?.includes('sparkle')) {
        return { needsSparklePlugin: true };
    }
    return null;
}
```

### CSS Fallbacks

Keep old class selectors for one major version cycle:

```css
/* DEPRECATED: Remove in v2027.x */
.is-style-animated-squiggle .squiggle-path,
.is-style-animated-zigzag .zigzag-path {
    animation: wave-flow var(--animation-duration, 2.5s) linear infinite;
}

.is-style-static-squiggle .squiggle-path,
.is-style-static-zigzag .zigzag-path {
    animation: none;
}
```

---

## Phase 9: Testing Checklist

### Functional Tests

- [ ] New block with Squiggle style renders correctly
- [ ] New block with Zig-Zag style renders correctly
- [ ] New block with Lightning style renders correctly
- [ ] Pointiness slider smoothly transitions 0% to 100%
- [ ] Angle slider creates proper peak offsets -60° to +60°
- [ ] Animate toggle enables/disables animation
- [ ] Speed slider affects animation duration
- [ ] Reverse toggle changes animation direction
- [ ] All controls work with gradients
- [ ] All controls work with solid colors

### Migration Tests

- [ ] Existing `is-style-animated-squiggle` blocks display correctly
- [ ] Existing `is-style-static-squiggle` blocks display correctly
- [ ] Existing `is-style-animated-zigzag` blocks display correctly
- [ ] Existing `is-style-static-zigzag` blocks display correctly
- [ ] Existing sparkle blocks show admin notice

### Accessibility Tests

- [ ] `prefers-reduced-motion` disables all animations
- [ ] High contrast mode increases stroke width
- [ ] Keyboard navigation works for all controls

### Performance Tests

- [ ] No perceptible lag when adjusting sliders
- [ ] Frontend renders without JavaScript (sparkles removed)
- [ ] No layout shift on page load

---

## Implementation Order

1. **Phase 1**: Remove Sparkles (separate PR/branch)
2. **Phase 2-3**: New attributes and style consolidation
3. **Phase 4**: Unified path generation function
4. **Phase 5**: Updated inspector controls
5. **Phase 6**: Style registration with defaults
6. **Phase 7**: CSS cleanup
7. **Phase 8**: Migration logic and deprecation notices
8. **Phase 9**: Testing

---

## File Change Summary

| File | Changes |
|------|---------|
| `package.json` | Version to date format |
| `awesome-squiggle.php` | Version, remove sparkle logic, add migration notices |
| `src/block.json` | Version, new attributes |
| `src/index.js` | Major refactor: unified path gen, new controls, style handling |
| `src/style.css` | Simplify selectors, remove sparkle styles |
| `src/frontend.js` | DELETE (sparkles only) |
| `readme.txt` | Version, changelog, update description |

---

## Estimated Code Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| `src/index.js` lines | ~2,144 | ~1,600 | -25% |
| `src/style.css` lines | ~334 | ~250 | -25% |
| Block styles | 6 | 3 | -50% |
| Frontend JS | 164 lines | 0 | -100% |
| Inspector controls | 7-8 | 8-9 | Similar |

The codebase gets smaller while functionality increases.
