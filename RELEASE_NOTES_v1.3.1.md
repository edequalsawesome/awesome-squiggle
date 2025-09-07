# Awesome Squiggle v1.3.1

## Highlights

- Full Width Fix: `.alignfull` separators break out of global site padding wrappers
- Theme Preset Gradients: Resolves `theme.json` gradient presets via CSS variables for any theme slug
- Sparkle Controls on Frontend: Sparkle Size and Vertical Spread now apply on the frontend (saved as data attributes)
- Sparkle Animation Speed: Editor speed controls shimmer tempo on the frontend
- Twinkle Randomness: New control (0–200%) to tune sparkle timing variance
- Editor Preview Parity: Sparkle preview width matches frontend for centered layout

## Notes

- Requires WordPress 6.0+; tested up to 6.8
- No external dependencies; all assets located in `build/`
- Install the attached `awesome-squiggle.zip` via Plugins → Add New → Upload Plugin

## Changes

- Alignfull breakout CSS for common block-theme padding wrappers
- Gradient resolver: compute `var(--wp--preset--gradient--<slug>)` to concrete linear-gradient before parsing
- Save markup now includes:
  - `data-sparkle-size`
  - `data-sparkle-vertical-amplitude`
  - `data-animation-speed`
  - `data-sparkle-randomness`
- Frontend script consumes the above to generate sparkles with consistent size/spread/speed/randomness
- Editor preview uses the same effective width as frontend so sparkles align visually

