# Squiggle Backdrop Block — Design Spec

> Playback update: the original animation toggle and infinite-only preview below are superseded by the native Off / Once / Loop controls. Once plays one cycle per page load and holds the final position.
**Date:** 2026-06-29
**Status:** Approved (brainstorming) — pending implementation plan
**Plugin:** `awesome-squiggle`

## Summary

Add a new, additive block — **`awesome-squiggle/backdrop`** — that paints a single
animated wave band *behind* nested content. It serves two authoring cases with one
block:

1. **Behind a heading** — wrap a single Heading; the wave slides behind the text like an
   animated highlighter/strike.
2. **Behind a section** — wrap a Group (or multiple blocks); the wave slides behind/around
   the section.

The existing four Separator styles (squiggle / zig-zag / lightning / pixel) and all their
controls are **unchanged**. This block is new and lives alongside them. Frontend is pure
SVG + CSS, zero JavaScript. The wave is **animated by default** (CSS keyframes), with the
existing animation toggle / speed / direction controls and `prefers-reduced-motion` guard.

## Non-goals (YAGNI)

- No dynamic wrap-around-text reactivity (the squiggle does not dodge or reflow around
  glyphs — that is the JS-requiring case explicitly deferred).
- No per-letter or per-word effects.
- No multiple stacked bands / tiled field (band-only for v1; tiled field is a future
  revisit if density is ever wanted).
- No changes to the existing Separator-styles block.

## Architecture

New block `awesome-squiggle/backdrop`:

- **Container block** using `InnerBlocks`. Author nests a Heading (behind-heading) or a
  Group / multiple blocks (behind-section). Same block, both jobs.
- **Reuses the existing wave-path generator as the single source of truth.** The PHP
  renderer's `generate_long_wave_path()` and `generate_pixel_wave_path()` are called
  unchanged; the backdrop drops the resulting `<svg>` into an absolutely-positioned layer
  instead of a standalone separator row.
- **Dynamic render** via the renderer class (`save → null`, PHP emits the full SVG on the
  frontend), matching the existing plugin pattern. Zero frontend JS.

### Layering (the no-JS core)

```
.wp-block-awesome-squiggle-backdrop      position: relative
  ├ .asquig-backdrop__wave  (decorative)  position:absolute; inset:0; z-index:0; aria-hidden="true"
  └ .asquig-backdrop__content (InnerBlocks) position:relative; z-index:1
```

The wave is scoped *inside* the block's own stacking context, so it sits behind the
nested content and affects nothing else on the page. (The z-index-clamps-to-nearest-context
behavior works in our favor here.)

### Background-color interaction (important)

If a nested Group has an **opaque** background color, that background paints over the wave
and hides it. Two supported ways the animated wave shows; author picks per placement via a
**padding** control on the Backdrop block plus the nested block's own background opacity:

1. **Padding frame (works with opaque inner bg):** the Backdrop block has padding, so the
   animated wave fills the block's box and the nested content sits inset on top — the wave
   slides out around the edges of the colored content.
2. **Show-through (transparent / tinted inner bg):** if the nested block background is
   transparent or semi-transparent, the wave is visible directly behind the content. This
   is the default for a plain heading with no background.

## Controls (sidebar)

Reused from the Separator block (familiar, same code paths):

- **Shape** — squiggle / zig-zag / lightning / pixel
- **Color / gradient** — existing WordPress color + gradient support
- **Amplitude, pointiness, angle, stroke width**
- **Animation toggle, speed, direction** — animated ON by default

New, backdrop-specific:

- **Vertical position** of the band within the block (top / center / baseline / custom %).
  Default: center.
- **Band height** — how tall the wave's drawing area is.
- **Padding** — standard WordPress spacing support, drives the "padding frame" layering.

## Editor experience

- `InnerBlocks` with the animated wave rendered live behind the nested content in the
  editor preview (reuses the existing editor SVG preview code).
- **"Wrap in Squiggle Backdrop" block transform** — select an existing Heading (or any
  block) and wrap it in a Backdrop in one click, instead of building the nesting by hand.
- Sidebar **contrast help text**: a busy/animated wave behind text needs enough contrast to
  stay readable (same spirit as Awesome Ambiance's backdrop help text).

## Accessibility & frontend

- Wave layer is `aria-hidden="true"`, decorative only (matches existing plugin).
- Respects `prefers-reduced-motion` — reuses the existing guard; motion stops, wave stays.
- Single wave band behind heading text reads like a strikethrough — readable. Behind a
  multi-line section it is one wave across the band's vertical position.

## Testing

- **PHP unit tests** for the new render path, reusing the existing renderer test harness
  (`tests/`): correct SVG emitted, color/gradient resolution, vertical-position + band-height
  applied, `save → null`, `aria-hidden` present.
- **JS validator tests** extending `src/__tests__/validators.test.js` for the new
  vertical-position and band-height inputs (range clamping, bad input rejection).
- **Manual visual QA** on the live site: heading case + section case (opaque group +
  transparent group), reduced-motion check.

## Open implementation questions (for the plan, not blocking)

- Exact DOM/attribute parity between editor preview and PHP render to keep one source of
  truth for the wave SVG.
- Whether vertical-position is implemented by translating the SVG within the band or by
  sizing/positioning the absolute layer — pick whichever keeps the path generator untouched.
- Class-name prefix (`asquig-backdrop__*` proposed) — confirm against existing
  `awesome-squiggle` conventions during the plan.
