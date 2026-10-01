# Squiggle Backdrop Block Implementation Plan

> Playback update: the original animation toggle and infinite-only preview below are superseded by the native Off / Once / Loop controls. Once plays one cycle per page load and holds the final position.
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new additive block `awesome-squiggle/backdrop` that paints a single animated wave band behind nested content (a heading or a whole section), reusing the plugin's existing wave-path generator and SVG-assembly machinery.

**Architecture:** An `InnerBlocks` container block. The wrapper + SVG layer render dynamically in PHP (`render.php`); the nested blocks save their own markup (`InnerBlocks.Content`) and arrive as `$content`. The wave SVG is positioned `absolute; inset:0; z-index:0` inside the block's own stacking context, with content at `z-index:1` on top. Pure SVG+CSS on the frontend, animated by default via the plugin's existing CSS keyframes (shared `style-index.css`).

**Tech Stack:** WordPress block API v3, `@wordpress/scripts` (webpack), PHP 7.4+, Jest (JS unit), PHPUnit (PHP unit).

## Global Constraints

- Plugin requires WordPress >= 6.3, PHP >= 7.4. (`awesome-squiggle.php` header.)
- License GPL-3.0-or-later; text domain `awesome-squiggle`.
- Zero frontend JavaScript — all animation is CSS.
- Decorative SVG must be `aria-hidden="true"`; respect `prefers-reduced-motion`.
- The existing `awesome-squiggle/separator-styles` block and its four styles MUST remain unchanged in behavior. Refactors must keep existing PHPUnit + Jest suites green.
- All numeric/color/id inputs validated via the existing validators (`Awesome_Squiggle_Renderer::validate_*` in PHP, `src/validators.js` in JS). No raw attribute interpolation into markup.
- Use `trash`, not `rm`, for any file deletion.
- Build with `npm run build`; never hand-edit `build/`.

---

### Task 1: Extract a shared wave-SVG builder in PHP (refactor, no behavior change)

Pull the SVG-assembly portion of `render_block()` into a reusable static method so the new block and the separator share one source of truth. Behavior of the separator must not change.

**Files:**
- Modify: `includes/class-awesome-squiggle-renderer.php` (`render_block`, add `build_wave_svg`)
- Test: `tests/php/RendererTest.php` (existing PHPUnit harness — pure `PHPUnit\Framework\TestCase`, WP functions stubbed in `tests/php/bootstrap.php`; tests call static methods directly, no WordPress runtime)

**Interfaces:**
- Produces: `Awesome_Squiggle_Renderer::build_wave_svg( array $args ): string` returning a complete `<svg>…</svg>` string. `$args` keys: `shape` (`'squiggle'|'zigzag'|'lightning'|'pixel'`), `amplitude` (float), `pointiness` (float), `angle` (float), `stroke_width` (float), `animation_speed` (float), `is_animated` (bool), `is_reversed` (bool), `line_color` (string, pre-resolved/validated), `gradient_data` (array|null), `gradient_id` (string), `animation_id` (string), `container_height` (int). Returns the `<svg>` only (no outer wrapper `<div>`).

- [ ] **Step 1: Write the failing test**

Add to `tests/php/RendererTest.php` (it auto-discovers via the `tests/php` directory in `phpunit.xml`):

```php
public function test_build_wave_svg_emits_svg_with_path_and_aria_hidden() {
    $svg = Awesome_Squiggle_Renderer::build_wave_svg( array(
        'shape'            => 'squiggle',
        'amplitude'       => 10,
        'pointiness'      => 0,
        'angle'           => 0,
        'stroke_width'    => 1,
        'animation_speed' => 2.5,
        'is_animated'     => true,
        'is_reversed'     => false,
        'line_color'      => 'currentColor',
        'gradient_data'   => null,
        'gradient_id'     => '',
        'animation_id'    => '',
        'container_height'=> 100,
    ) );

    $this->assertStringContainsString( '<svg', $svg );
    $this->assertStringContainsString( 'aria-hidden="true"', $svg );
    $this->assertStringContainsString( '<path', $svg );
    $this->assertStringContainsString( 'stroke="currentColor"', $svg );
    $this->assertStringNotContainsString( '<div', $svg );
}

public function test_build_wave_svg_pixel_shape_uses_pixel_generator() {
    $svg = Awesome_Squiggle_Renderer::build_wave_svg( array(
        'shape' => 'pixel', 'amplitude' => 10, 'pointiness' => 0, 'angle' => 0,
        'stroke_width' => 2, 'animation_speed' => 2.5, 'is_animated' => false,
        'is_reversed' => false, 'line_color' => 'currentColor', 'gradient_data' => null,
        'gradient_id' => '', 'animation_id' => '', 'container_height' => 100,
    ) );
    // Pixel paths use H/V staircase commands.
    $this->assertMatchesRegularExpression( '/ H-?\d/', $svg );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/phpunit --filter build_wave_svg`
Expected: FAIL — "Call to undefined method … build_wave_svg".

- [ ] **Step 3: Extract the method**

In `includes/class-awesome-squiggle-renderer.php`, add a new public static method `build_wave_svg( array $args )`. Move into it the logic currently inside `render_block()` from "Generate wave path" through the `<svg>…</svg>` assembly (lines ~664–740 + the path style/class + the inner `<svg>` portion of the final `sprintf`, lines ~742–779), **excluding** the outer wrapper `<div>`. Concretely:

```php
public static function build_wave_svg( array $args ) {
    $shape            = isset( $args['shape'] ) ? $args['shape'] : 'squiggle';
    $amplitude        = self::validate_numeric( $args['amplitude'] ?? null, 5, 25, 10 );
    $pointiness       = self::validate_numeric( $args['pointiness'] ?? null, 0, 100, 0 );
    $angle            = self::validate_numeric( $args['angle'] ?? null, -60, 60, 0 );
    $stroke_width     = self::validate_numeric( $args['stroke_width'] ?? null, 1, 8, 1 );
    $animation_speed  = self::validate_numeric( $args['animation_speed'] ?? null, 0.5, 5, 2.5 );
    $is_animated      = ! empty( $args['is_animated'] );
    $is_reversed      = ! empty( $args['is_reversed'] );
    $line_color       = self::validate_color( $args['line_color'] ?? 'currentColor' );
    $gradient_data    = $args['gradient_data'] ?? null;
    $gradient_id      = self::validate_id( $args['gradient_id'] ?? '' );
    $animation_id     = self::validate_id( $args['animation_id'] ?? '' );
    $container_height = (int) ( $args['container_height'] ?? 100 );

    $is_pixel       = ( $shape === 'pixel' );
    $is_paused      = ! $is_animated;
    $animation_name = $is_paused ? 'none' : ( $is_reversed ? 'wave-flow-reverse' : 'wave-flow' );

    $wave_data   = $is_pixel
        ? self::generate_pixel_wave_path( $amplitude, $pointiness, $angle, $stroke_width, 80, $container_height )
        : self::generate_long_wave_path( $amplitude, $pointiness, $angle, $stroke_width, 80, $container_height );
    $wave_path   = $wave_data['d'];
    $wave_height = $wave_data['height'];
    $viewbox_w   = $wave_data['wavelength'] * 80;

    // Gradient defs (moved verbatim from render_block, using $gradient_data/$gradient_id).
    $defs_html = '';
    if ( $gradient_data && $gradient_id ) {
        $stops_html = '';
        if ( ! empty( $gradient_data['stops'] ) ) {
            foreach ( $gradient_data['stops'] as $stop ) {
                $validated_stop_color = self::validate_color( $stop['color'], '#000000' );
                $stops_html .= sprintf( '<stop offset="%s" stop-color="%s"/>', esc_attr( $stop['offset'] ), esc_attr( $validated_stop_color ) );
            }
        } else {
            $stops_html = '<stop offset="0%" stop-color="#ff6b35"/><stop offset="100%" stop-color="#f7931e"/>';
        }
        $defs_html = sprintf(
            '<defs><linearGradient id="%s" gradientUnits="userSpaceOnUse" spreadMethod="reflect" x1="0" y1="0" x2="40" y2="0">%s</linearGradient></defs>',
            esc_attr( $gradient_id ), $stops_html
        );
    }

    $path_style = $is_paused ? 'animation:none;' : sprintf( 'animation:%s %ss linear infinite;', esc_attr( $animation_name ), esc_attr( $animation_speed ) );
    $path_class = 'wave-path ' . ( $animation_id ? 'wave-path-' . esc_attr( $animation_id ) : 'wave-path-default' );

    return sprintf(
        '<svg viewBox="0 0 %d %d" preserveAspectRatio="xMinYMid slice" aria-hidden="true" focusable="false" style="width:100%%;height:100%%;display:block;">%s<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="%s" style="%s"/></svg>',
        $viewbox_w, $wave_height, $defs_html, esc_attr( $wave_path ), esc_attr( $line_color ), esc_attr( $stroke_width ), esc_attr( $path_class ), esc_attr( $path_style )
    );
}
```

Then rewrite `render_block()` to call it: keep the separator's attribute-extraction, style detection, frontend-style enqueue, color resolution (`resolve_line_color`), wrapper class/style building, and the outer `<div … role="separator">` wrapper — but replace the inline path-gen + `<svg>` assembly with:

```php
$shape = $is_pixel ? 'pixel' : ( $is_lightning ? 'lightning' : ( $is_zigzag ? 'zigzag' : 'squiggle' ) );
$svg = self::build_wave_svg( array(
    'shape' => $shape, 'amplitude' => $amplitude, 'pointiness' => $pointiness,
    'angle' => $angle, 'stroke_width' => $stroke_width, 'animation_speed' => $animation_speed,
    'is_animated' => $is_animated, 'is_reversed' => $is_reversed,
    'line_color' => $line_color, 'gradient_data' => $gradient_data, 'gradient_id' => $gradient_id,
    'animation_id' => $animation_id, 'container_height' => $container_height,
) );
$html = sprintf(
    '<div class="%s" style="%s" role="separator" aria-label="%s">%s</div>',
    esc_attr( $combined_class ), esc_attr( $wrapper_style ),
    esc_attr__( 'Decorative separator', 'awesome-squiggle' ), $svg
);
return $html;
```

- [ ] **Step 4: Run the full PHP suite to verify no regression**

Run: `vendor/bin/phpunit`
Expected: PASS — new `build_wave_svg` tests green AND all existing separator render tests still green.

- [ ] **Step 5: Commit**

```bash
git add includes/class-awesome-squiggle-renderer.php tests/test-renderer.php
git commit -m "refactor(renderer): extract build_wave_svg as shared SVG source of truth"
```

---

### Task 2: Extract shared JS wave-path generators (refactor, no behavior change)

Move `generateLongWavePath` / `generatePixelWavePath` out of `index.js` into a shared module so the new block's editor preview imports the same generators (JS↔PHP parity preserved).

**Files:**
- Create: `src/wave-path.js`
- Modify: `src/index.js` (remove the two function definitions; import them)
- Test: `src/__tests__/wave-path.test.js`

**Interfaces:**
- Produces: `export const generateLongWavePath = ( amplitude, pointiness, angle, strokeWidth, repetitions = 80, containerHeight = 100 ) => ({ d, height, wavelength, totalWidth })` and `export const generatePixelWavePath = ( … same signature … ) => ({ d, height, wavelength, totalWidth })`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/wave-path.test.js`:

```js
import { generateLongWavePath, generatePixelWavePath } from '../wave-path';

describe( 'wave-path generators', () => {
    it( 'long wave returns a path string and geometry', () => {
        const r = generateLongWavePath( 10, 0, 0, 1 );
        expect( typeof r.d ).toBe( 'string' );
        expect( r.d.startsWith( 'M' ) ).toBe( true );
        expect( r.wavelength ).toBe( 40 );
        expect( r.height ).toBe( 100 );
    } );

    it( 'pixel wave uses H/V staircase commands', () => {
        const r = generatePixelWavePath( 10, 0, 0, 2 );
        expect( r.d ).toMatch( / H-?\d/ );
    } );
} );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- wave-path`
Expected: FAIL — cannot resolve `../wave-path`.

- [ ] **Step 3: Move the generators**

Cut the full bodies of `generateLongWavePath` (src/index.js ~432–537) and `generatePixelWavePath` (~538–660) into `src/wave-path.js`, prefixing each with `export const`. In `src/index.js`, delete the originals and add near the other imports:

```js
import { generateLongWavePath, generatePixelWavePath } from './wave-path';
```

Keep every line of math identical — this is a move, not a rewrite.

- [ ] **Step 4: Run JS tests + build to verify no regression**

Run: `npm run test:unit && npm run build`
Expected: PASS — new wave-path test green, existing validator tests green, build compiles clean.

- [ ] **Step 5: Commit**

```bash
git add src/wave-path.js src/index.js src/__tests__/wave-path.test.js
git commit -m "refactor(editor): extract wave-path generators into shared module"
```

---

### Task 3: Scaffold the backdrop block end-to-end (minimal, de-risks build + registration)

Register a minimal new block that appears in the inserter, wraps InnerBlocks, and renders a plain wrapper `<div>` around its content via `render.php` — no wave yet. This proves the build copies `block.json`/`render.php` into `build/backdrop/` and that PHP registration works, before adding complexity.

**Files:**
- Create: `src/backdrop/block.json`
- Create: `src/backdrop/index.js`
- Create: `src/backdrop/render.php`
- Modify: `src/index.js` (import `./backdrop` so the block registers in the shared bundle)
- Modify: `awesome-squiggle.php` (second `register_block_type`)

**Interfaces:**
- Produces: block name `awesome-squiggle/backdrop`; wrapper class `wp-block-awesome-squiggle-backdrop`; content wrapper class `asquig-backdrop__content`.

- [ ] **Step 1: Create `src/backdrop/block.json`**

```json
{
	"$schema": "https://schemas.wp.org/trunk/block.json",
	"apiVersion": 3,
	"name": "awesome-squiggle/backdrop",
	"version": "2026.06.29",
	"title": "Squiggle Backdrop",
	"category": "design",
	"icon": "art",
	"description": "Wraps content with an animated squiggle wave band behind it.",
	"keywords": [ "squiggle", "backdrop", "wave", "background", "behind" ],
	"textdomain": "awesome-squiggle",
	"supports": {
		"html": false,
		"spacing": { "padding": true, "margin": true },
		"align": [ "wide", "full" ]
	},
	"editorScript": "file:../index.js",
	"style": "file:../style-index.css",
	"render": "file:./render.php"
}
```

(Shared bundle: `editorScript`/`style` point one level up at the separator's compiled `build/index.js` / `build/style-index.css`, so no new webpack entry is needed. Backdrop-specific CSS is added to `src/style.css` in Task 5, which compiles into that same `build/style-index.css`.)

- [ ] **Step 2: Create `src/backdrop/index.js`**

```js
import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps, useInnerBlocksProps, InnerBlocks } from '@wordpress/block-editor';
import metadata from './block.json';

registerBlockType( metadata.name, {
	edit: () => {
		const blockProps = useBlockProps( { className: 'wp-block-awesome-squiggle-backdrop' } );
		const innerProps = useInnerBlocksProps(
			{ className: 'asquig-backdrop__content' },
			{ template: [ [ 'core/heading', { placeholder: 'Heading with a squiggle behind it…' } ] ] }
		);
		return (
			<div { ...blockProps }>
				<div { ...innerProps } />
			</div>
		);
	},
	save: () => {
		const blockProps = useBlockProps.save( { className: 'wp-block-awesome-squiggle-backdrop' } );
		return (
			<div { ...blockProps }>
				<div className="asquig-backdrop__content">
					<InnerBlocks.Content />
				</div>
			</div>
		);
	},
} );
```

- [ ] **Step 3: Create `src/backdrop/render.php`**

```php
<?php
/**
 * Frontend render for awesome-squiggle/backdrop.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    InnerBlocks saved markup.
 * @var WP_Block $block      Block instance.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wrapper_attributes = get_block_wrapper_attributes( array(
	'class' => 'wp-block-awesome-squiggle-backdrop',
) );

// Wave layer is added in Task 4; for now just wrap the content.
printf(
	'<div %s><div class="asquig-backdrop__content">%s</div></div>',
	$wrapper_attributes, // get_block_wrapper_attributes() returns escaped output.
	$content // InnerBlocks content is already sanitized by WP.
);
```

- [ ] **Step 4: Wire registration**

In `src/index.js`, add with the other imports:

```js
import './backdrop';
```

In `awesome-squiggle.php`, inside `awesome_squiggle_init()` after the existing `register_block_type( __DIR__ . '/build' );`:

```php
register_block_type( __DIR__ . '/build/backdrop' );
```

- [ ] **Step 5: Build and verify the files land in build/**

Run: `npm run build && ls build/backdrop`
Expected: `block.json` and `render.php` present in `build/backdrop/`. (Confirms CopyWebpackPlugin copies the subdir.)

- [ ] **Step 6: Verify block registers (smoke test in WP)**

In the WordPress editor (live Studio site), confirm "Squiggle Backdrop" appears in the inserter, can wrap a heading, saves, and on the frontend renders `<div class="wp-block-awesome-squiggle-backdrop">…<div class="asquig-backdrop__content"><h2>…</h2></div></div>`. If `build/backdrop/render.php` is missing, fall back to registering the render callback in PHP (`register_block_type( __DIR__ . '/build/backdrop', array( 'render_callback' => 'awesome_squiggle_render_backdrop' ) )`) and note it for Task 4.

- [ ] **Step 7: Commit**

```bash
git add src/backdrop awesome-squiggle.php src/index.js
git commit -m "feat(backdrop): scaffold squiggle backdrop block (InnerBlocks + dynamic wrapper)"
```

---

### Task 4: Render the wave band behind the content (frontend)

Add wave attributes and make `render.php` paint the animated wave SVG behind the content via the shared `build_wave_svg()`.

**Files:**
- Modify: `src/backdrop/block.json` (attributes)
- Modify: `includes/class-awesome-squiggle-renderer.php` (add pure static helpers `backdrop_resolve_shape`, `backdrop_wave_layer_style`)
- Modify: `src/backdrop/render.php`
- Test: `tests/php/BackdropTest.php` (new PHPUnit file — auto-discovered)

**Why helpers instead of testing `render.php` directly:** the test harness is plain `PHPUnit\Framework\TestCase` with WP functions only stubbed in `bootstrap.php`. `render.php` calls `get_block_wrapper_attributes()` (not stubbed), so it isn't unit-testable here. We push the testable logic — shape whitelisting, vertical-position → CSS style — into pure static methods on the renderer (no WP deps), unit-test those, and verify the full `render.php` DOM in manual QA (Task 9).

**Interfaces:**
- Consumes: `Awesome_Squiggle_Renderer::build_wave_svg()` (Task 1), `Awesome_Squiggle_Renderer::resolve_line_color()` + `::validate_numeric()` + `::validate_id()` (existing).
- Produces: `Awesome_Squiggle_Renderer::backdrop_resolve_shape( $shape ): string` (returns one of `squiggle|zigzag|lightning|pixel`, default `squiggle`); `Awesome_Squiggle_Renderer::backdrop_wave_layer_style( string $position, $custom_pct, $band_height ): string` (returns the inline `style` for the absolute wave layer, with validated/clamped values).
- Block attributes (add to block.json `attributes`): `shape` (string, default `"squiggle"`), `squiggleAmplitude` (number, 10), `pointiness` (number, 0), `angle` (number, 0), `strokeWidth` (number, 2), `animationSpeed` (number, 2.5), `isAnimated` (boolean, true), `isReversed` (boolean, false), `bandHeight` (number, 100), `verticalPosition` (string, default `"center"`, one of `top|center|baseline|custom`), `verticalPositionCustom` (number, 50), `gradient` (string), `gradientId` (string), `animationId` (string). Plus color support — see Task 6.

- [ ] **Step 1: Write the failing test**

Create `tests/php/BackdropTest.php`:

```php
<?php
use PHPUnit\Framework\TestCase;

class BackdropTest extends TestCase {

    public function test_resolve_shape_whitelists() {
        $this->assertSame( 'pixel', Awesome_Squiggle_Renderer::backdrop_resolve_shape( 'pixel' ) );
        $this->assertSame( 'squiggle', Awesome_Squiggle_Renderer::backdrop_resolve_shape( 'bogus' ) );
        $this->assertSame( 'squiggle', Awesome_Squiggle_Renderer::backdrop_resolve_shape( null ) );
    }

    public function test_wave_layer_style_center() {
        $style = Awesome_Squiggle_Renderer::backdrop_wave_layer_style( 'center', 50, 100 );
        $this->assertStringContainsString( 'top:50%', $style );
        $this->assertStringContainsString( 'translateY(-50%)', $style );
        $this->assertStringContainsString( 'height:100px', $style );
        $this->assertStringContainsString( 'z-index:0', $style );
    }

    public function test_wave_layer_style_custom_clamps_percent_and_height() {
        $style = Awesome_Squiggle_Renderer::backdrop_wave_layer_style( 'custom', 999, 9999 );
        $this->assertStringContainsString( 'top:100%', $style );   // 999 clamped to 100
        $this->assertStringContainsString( 'height:400px', $style ); // 9999 clamped to 400
    }

    public function test_wave_layer_style_baseline() {
        $style = Awesome_Squiggle_Renderer::backdrop_wave_layer_style( 'baseline', 50, 100 );
        $this->assertStringContainsString( 'top:100%', $style );
        $this->assertStringContainsString( 'translateY(-100%)', $style );
    }

    public function test_build_wave_svg_is_the_layer_contents() {
        // The backdrop reuses build_wave_svg verbatim; assert it stays decorative.
        $svg = Awesome_Squiggle_Renderer::build_wave_svg( array(
            'shape' => 'squiggle', 'amplitude' => 10, 'pointiness' => 0, 'angle' => 0,
            'stroke_width' => 2, 'animation_speed' => 2.5, 'is_animated' => true,
            'is_reversed' => false, 'line_color' => 'currentColor', 'gradient_data' => null,
            'gradient_id' => '', 'animation_id' => '', 'container_height' => 100,
        ) );
        $this->assertStringContainsString( 'aria-hidden="true"', $svg );
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/phpunit --filter Backdrop`
Expected: FAIL — "Call to undefined method … backdrop_resolve_shape".

- [ ] **Step 3: Add attributes to `src/backdrop/block.json`**

Add an `"attributes"` object with every key listed in Interfaces above, each with `"type"` and `"default"`. Example fragment:

```json
"attributes": {
	"shape": { "type": "string", "default": "squiggle" },
	"squiggleAmplitude": { "type": "number", "default": 10 },
	"pointiness": { "type": "number", "default": 0 },
	"angle": { "type": "number", "default": 0 },
	"strokeWidth": { "type": "number", "default": 2 },
	"animationSpeed": { "type": "number", "default": 2.5 },
	"isAnimated": { "type": "boolean", "default": true },
	"isReversed": { "type": "boolean", "default": false },
	"bandHeight": { "type": "number", "default": 100 },
	"verticalPosition": { "type": "string", "default": "center" },
	"verticalPositionCustom": { "type": "number", "default": 50 },
	"gradient": { "type": "string" },
	"gradientId": { "type": "string" },
	"animationId": { "type": "string" }
}
```

- [ ] **Step 4: Add the pure static helpers to the renderer**

In `includes/class-awesome-squiggle-renderer.php` add:

```php
/**
 * Whitelist the backdrop shape attribute.
 */
public static function backdrop_resolve_shape( $shape ) {
	return in_array( $shape, array( 'squiggle', 'zigzag', 'lightning', 'pixel' ), true ) ? $shape : 'squiggle';
}

/**
 * Build the inline style for the absolute wave layer from placement attrs.
 * Pure string builder — no WP deps, unit-testable.
 */
public static function backdrop_wave_layer_style( $position, $custom_pct, $band_height ) {
	$band_height = (int) self::validate_numeric( $band_height, 20, 400, 100 );

	switch ( $position ) {
		case 'top':      $top = '0%';   $translate = '0';     break;
		case 'baseline': $top = '100%'; $translate = '-100%'; break;
		case 'custom':
			$pct = self::validate_numeric( $custom_pct, 0, 100, 50 );
			$top = $pct . '%'; $translate = '-50%'; break;
		case 'center':
		default:         $top = '50%';  $translate = '-50%'; break;
	}

	return sprintf(
		'position:absolute;left:0;right:0;top:%s;height:%dpx;transform:translateY(%s);z-index:0;overflow:hidden;pointer-events:none;',
		$top, $band_height, $translate
	);
}
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `vendor/bin/phpunit --filter Backdrop`
Expected: PASS.

- [ ] **Step 6: Wire `src/backdrop/render.php` to the helpers**

```php
<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$color = Awesome_Squiggle_Renderer::resolve_line_color( $attributes );

$svg = Awesome_Squiggle_Renderer::build_wave_svg( array(
	'shape'            => Awesome_Squiggle_Renderer::backdrop_resolve_shape( $attributes['shape'] ?? 'squiggle' ),
	'amplitude'        => $attributes['squiggleAmplitude'] ?? 10,
	'pointiness'       => $attributes['pointiness'] ?? 0,
	'angle'            => $attributes['angle'] ?? 0,
	'stroke_width'     => $attributes['strokeWidth'] ?? 2,
	'animation_speed'  => $attributes['animationSpeed'] ?? 2.5,
	'is_animated'      => $attributes['isAnimated'] ?? true,
	'is_reversed'      => $attributes['isReversed'] ?? false,
	'line_color'       => $color['line_color'],
	'gradient_data'    => $color['gradient_data'],
	'gradient_id'      => Awesome_Squiggle_Renderer::validate_id( $attributes['gradientId'] ?? '' ),
	'animation_id'     => Awesome_Squiggle_Renderer::validate_id( $attributes['animationId'] ?? '' ),
	'container_height' => (int) Awesome_Squiggle_Renderer::validate_numeric( $attributes['bandHeight'] ?? 100, 20, 400, 100 ),
) );

$wave_style = Awesome_Squiggle_Renderer::backdrop_wave_layer_style(
	$attributes['verticalPosition'] ?? 'center',
	$attributes['verticalPositionCustom'] ?? 50,
	$attributes['bandHeight'] ?? 100
);

$wrapper_attributes = get_block_wrapper_attributes( array(
	'class' => 'wp-block-awesome-squiggle-backdrop',
) );

printf(
	'<div %1$s><div class="asquig-backdrop__wave" aria-hidden="true" style="%2$s">%3$s</div><div class="asquig-backdrop__content">%4$s</div></div>',
	$wrapper_attributes,        // get_block_wrapper_attributes() returns escaped output.
	esc_attr( $wave_style ),
	$svg,                       // build_wave_svg() output is internally escaped.
	$content                    // InnerBlocks content already sanitized by WP.
);
```

- [ ] **Step 7: Run the full PHP suite**

Run: `vendor/bin/phpunit`
Expected: PASS — backdrop + renderer + existing separator tests all green.

- [ ] **Step 8: Commit**

```bash
git add src/backdrop/block.json src/backdrop/render.php includes/class-awesome-squiggle-renderer.php tests/php/BackdropTest.php
git commit -m "feat(backdrop): render animated wave band behind content"
```

---

### Task 5: Backdrop CSS — layering + reduced-motion

Add scoped styles for the new block to `src/style.css` (compiles into the shared `build/style-index.css`). The wave animation reuses the existing `wave-flow`/`wave-flow-reverse` keyframes — they live in this same stylesheet (the separator section) and `build_wave_svg()` already names them, so the backdrop needs no keyframes of its own. (Both blocks load the one compiled `style-index.css`, so the keyframes can never be missing — adding a duplicate set would be dead, unreferenced code.)

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Append backdrop styles**

```css
/* ========================================
   SQUIGGLE BACKDROP BLOCK
   Wave band behind nested content. Animation reuses the
   wave-flow / wave-flow-reverse keyframes defined above
   (build_wave_svg() emits those animation-names).
   ======================================== */
.wp-block-awesome-squiggle-backdrop {
	position: relative;
}

.wp-block-awesome-squiggle-backdrop > .asquig-backdrop__wave {
	position: absolute;
	left: 0;
	right: 0;
	z-index: 0;
	overflow: hidden;
	pointer-events: none;
}

.wp-block-awesome-squiggle-backdrop > .asquig-backdrop__wave svg {
	display: block;
	width: 100%;
	height: 100%;
}

/* Content sits above the wave within the block's own stacking context. */
.wp-block-awesome-squiggle-backdrop > .asquig-backdrop__content {
	position: relative;
	z-index: 1;
}

.wp-block-awesome-squiggle-backdrop .wave-path {
	vector-effect: non-scaling-stroke;
}

@media (prefers-reduced-motion: reduce) {
	.wp-block-awesome-squiggle-backdrop .wave-path {
		animation: none !important;
	}
}

@media (forced-colors: active) {
	.wp-block-awesome-squiggle-backdrop .wave-path {
		stroke: CanvasText;
	}
}
```

- [ ] **Step 2: Build and visually verify**

Run: `npm run build`
Then in the editor/frontend confirm: the wave sits behind the heading and animates; content is readable on top; reduced-motion (OS setting) stops the animation.

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "style(backdrop): layering, self-shipped keyframes, reduced-motion guard"
```

---

### Task 6: Editor — live wave preview, InnerBlocks, and InspectorControls

Replace the Task 3 placeholder `edit` with a full editor: animated wave preview behind InnerBlocks, plus the sidebar controls. Add color/gradient support.

**Files:**
- Modify: `src/backdrop/block.json` (color supports)
- Create: `src/backdrop/edit.js`
- Modify: `src/backdrop/index.js` (use the new edit, add color attributes wiring)
- Reuse: `src/wave-path.js` (Task 2), `src/validators.js` (existing)

**Interfaces:**
- Consumes: `generateLongWavePath`/`generatePixelWavePath` from `../wave-path`; `validateNumericInput`/`validateStringInput` from `../validators`.

- [ ] **Step 1: Add color supports to `src/backdrop/block.json`**

Inside `"supports"` add:

```json
"color": { "text": true, "background": false, "gradients": true }
```

(Wave stroke uses the text color / gradient. Background is disabled to avoid an opaque box hiding the wave; authors color the nested Group instead — see spec "Background-color interaction".)

- [ ] **Step 2: Write `src/backdrop/edit.js`**

```js
import { useBlockProps, useInnerBlocksProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, RangeControl, ToggleControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { generateLongWavePath, generatePixelWavePath } from '../wave-path';
import { validateNumericInput } from '../validators';

const SHAPES = [
	{ label: __( 'Squiggle', 'awesome-squiggle' ), value: 'squiggle' },
	{ label: __( 'Zig-Zag', 'awesome-squiggle' ), value: 'zigzag' },
	{ label: __( 'Lightning', 'awesome-squiggle' ), value: 'lightning' },
	{ label: __( 'Pixel', 'awesome-squiggle' ), value: 'pixel' },
];
const SHAPE_VALUES = [ 'squiggle', 'zigzag', 'lightning', 'pixel' ];
const POSITION_VALUES = [ 'top', 'center', 'baseline', 'custom' ];
// Note: validateStringInput() in src/validators.js takes a REGEX pattern, not
// an allow-list — so we guard these enum attributes with a simple .includes().
const oneOf = ( value, allowed, fallback ) => ( allowed.includes( value ) ? value : fallback );

export default function Edit( { attributes, setAttributes } ) {
	const {
		shape, squiggleAmplitude, pointiness, angle, strokeWidth,
		animationSpeed, isAnimated, isReversed, bandHeight, verticalPosition,
	} = attributes;

	const set = ( updates ) => setAttributes( updates );

	const wave = useMemo( () => {
		const gen = shape === 'pixel' ? generatePixelWavePath : generateLongWavePath;
		return gen( squiggleAmplitude, pointiness, angle, strokeWidth, 80, bandHeight );
	}, [ shape, squiggleAmplitude, pointiness, angle, strokeWidth, bandHeight ] );

	const viewBoxWidth = wave.wavelength * 80;
	const topMap = { top: '0%', center: '50%', baseline: '100%', custom: `${ attributes.verticalPositionCustom }%` };
	const translateMap = { top: '0', center: '-50%', baseline: '-100%', custom: '-50%' };
	const animationName = ! isAnimated ? 'none' : ( isReversed ? 'wave-flow-reverse' : 'wave-flow' );

	const blockProps = useBlockProps( { className: 'wp-block-awesome-squiggle-backdrop' } );
	const innerProps = useInnerBlocksProps(
		{ className: 'asquig-backdrop__content' },
		{ template: [ [ 'core/heading', { placeholder: __( 'Heading with a squiggle behind it…', 'awesome-squiggle' ) } ] ] }
	);

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Wave', 'awesome-squiggle' ) }>
					<SelectControl label={ __( 'Shape', 'awesome-squiggle' ) } value={ shape }
						options={ SHAPES }
						onChange={ ( v ) => set( { shape: oneOf( v, SHAPE_VALUES, 'squiggle' ) } ) } />
					<RangeControl label={ __( 'Amplitude', 'awesome-squiggle' ) } min={ 5 } max={ 25 } value={ squiggleAmplitude }
						onChange={ ( v ) => set( { squiggleAmplitude: validateNumericInput( v, 5, 25, 10 ) } ) } />
					<RangeControl label={ __( 'Pointiness', 'awesome-squiggle' ) } min={ 0 } max={ 100 } value={ pointiness }
						onChange={ ( v ) => set( { pointiness: validateNumericInput( v, 0, 100, 0 ) } ) } />
					<RangeControl label={ __( 'Angle', 'awesome-squiggle' ) } min={ -60 } max={ 60 } value={ angle }
						onChange={ ( v ) => set( { angle: validateNumericInput( v, -60, 60, 0 ) } ) } />
					<RangeControl label={ __( 'Stroke width', 'awesome-squiggle' ) } min={ 1 } max={ 8 } value={ strokeWidth }
						onChange={ ( v ) => set( { strokeWidth: validateNumericInput( v, 1, 8, 2 ) } ) } />
				</PanelBody>
				<PanelBody title={ __( 'Placement', 'awesome-squiggle' ) }>
					<SelectControl label={ __( 'Vertical position', 'awesome-squiggle' ) } value={ verticalPosition }
						options={ [
							{ label: __( 'Top', 'awesome-squiggle' ), value: 'top' },
							{ label: __( 'Center', 'awesome-squiggle' ), value: 'center' },
							{ label: __( 'Baseline', 'awesome-squiggle' ), value: 'baseline' },
							{ label: __( 'Custom', 'awesome-squiggle' ), value: 'custom' },
						] }
						onChange={ ( v ) => set( { verticalPosition: oneOf( v, POSITION_VALUES, 'center' ) } ) } />
					{ verticalPosition === 'custom' && (
						<RangeControl label={ __( 'Custom position (%)', 'awesome-squiggle' ) } min={ 0 } max={ 100 } value={ attributes.verticalPositionCustom }
							onChange={ ( v ) => set( { verticalPositionCustom: validateNumericInput( v, 0, 100, 50 ) } ) } />
					) }
					<RangeControl label={ __( 'Band height', 'awesome-squiggle' ) } min={ 20 } max={ 400 } value={ bandHeight }
						onChange={ ( v ) => set( { bandHeight: validateNumericInput( v, 20, 400, 100 ) } ) } />
					<p className="components-base-control__help">
						{ __( 'A busy wave behind text needs enough contrast to stay readable.', 'awesome-squiggle' ) }
					</p>
				</PanelBody>
				<PanelBody title={ __( 'Animation', 'awesome-squiggle' ) }>
					<ToggleControl label={ __( 'Animate', 'awesome-squiggle' ) } checked={ isAnimated }
						onChange={ ( v ) => set( { isAnimated: !! v } ) } />
					<RangeControl label={ __( 'Speed (s)', 'awesome-squiggle' ) } min={ 0.5 } max={ 5 } step={ 0.5 } value={ animationSpeed }
						onChange={ ( v ) => set( { animationSpeed: validateNumericInput( v, 0.5, 5, 2.5 ) } ) } />
					<ToggleControl label={ __( 'Reverse direction', 'awesome-squiggle' ) } checked={ isReversed }
						onChange={ ( v ) => set( { isReversed: !! v } ) } />
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				<div className="asquig-backdrop__wave" aria-hidden="true"
					style={ {
						position: 'absolute', left: 0, right: 0,
						top: topMap[ verticalPosition ], height: `${ bandHeight }px`,
						transform: `translateY(${ translateMap[ verticalPosition ] })`,
						zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
					} }>
					<svg viewBox={ `0 0 ${ viewBoxWidth } ${ wave.height }` } preserveAspectRatio="xMinYMid slice"
						aria-hidden="true" focusable="false" style={ { width: '100%', height: '100%', display: 'block' } }>
						<path d={ wave.d } fill="none" stroke="currentColor" strokeWidth={ strokeWidth }
							strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="wave-path"
							style={ { animation: isAnimated ? `${ animationName } ${ animationSpeed }s linear infinite` : 'none' } } />
					</svg>
				</div>
				<div { ...innerProps } />
			</div>
		</>
	);
}
```

(Editor preview uses `stroke="currentColor"`; the block's text-color support tints it through CSS `color`. Gradient preview parity with PHP is a known follow-up — the editor shows a solid stroke, the frontend renders the gradient. Acceptable for v1; note it in the PR.)

- [ ] **Step 3: Use the new edit in `src/backdrop/index.js`**

Replace the inline `edit` with `import Edit from './edit';` and `edit: Edit`. Keep the `save` from Task 3. (Numeric inputs use the existing `validateNumericInput( value, min, max, default )`; enum inputs use the local `oneOf` guard — `validateStringInput` is intentionally not used here because its second arg is a regex, not an allow-list.)

- [ ] **Step 4: Build and verify in editor**

Run: `npm run build`
Verify: changing shape/amplitude/angle/position/animation in the sidebar updates the live preview behind the heading; the wave animates; text color tints the wave.

- [ ] **Step 5: Commit**

```bash
git add src/backdrop/edit.js src/backdrop/index.js src/backdrop/block.json
git commit -m "feat(backdrop): editor preview + inspector controls"
```

---

### Task 7: Validator coverage for the new numeric inputs

Lock the new numeric inputs (band height, custom vertical position) with unit tests, matching the existing validator test style. The enum inputs (shape, vertical position) use the local `oneOf` guard in `edit.js` and the PHP `backdrop_resolve_shape` helper (already tested in Task 4), so they need no `validators.js` change.

**Files:**
- Modify: `src/__tests__/validators.test.js`

- [ ] **Step 1: Read the existing `validateNumericInput` contract**

Open `src/validators.js` (`validateNumericInput = ( value, min, max, defaultValue )`) and confirm its clamp/fallback behavior so the assertions below mirror it (clamps out-of-range to the nearest bound; returns `defaultValue` for non-numeric).

- [ ] **Step 2: Add assertions**

```js
describe( 'backdrop numeric inputs', () => {
	it( 'clamps band height to 20–400 and falls back on bad input', () => {
		expect( validateNumericInput( 5, 20, 400, 100 ) ).toBe( 20 );
		expect( validateNumericInput( 999, 20, 400, 100 ) ).toBe( 400 );
		expect( validateNumericInput( 'nope', 20, 400, 100 ) ).toBe( 100 );
	} );
	it( 'clamps custom vertical position to 0–100', () => {
		expect( validateNumericInput( -10, 0, 100, 50 ) ).toBe( 0 );
		expect( validateNumericInput( 150, 0, 100, 50 ) ).toBe( 100 );
	} );
} );
```

(`validateNumericInput` is already imported at the top of `validators.test.js`; if not, add it to the existing import.)

- [ ] **Step 3: Run and verify pass**

Run: `npm run test:unit -- validators`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/validators.test.js
git commit -m "test(backdrop): cover band-height + custom-position validation"
```

---

### Task 8: "Wrap in Squiggle Backdrop" block transform

Let authors select an existing block (e.g. a heading) and wrap it in a Backdrop in one click.

**Files:**
- Create: `src/backdrop/transforms.js`
- Modify: `src/backdrop/index.js` (attach `transforms`)

- [ ] **Step 1: Write the transform**

```js
import { createBlock } from '@wordpress/blocks';

const transforms = {
	from: [
		{
			type: 'block',
			blocks: [ '*' ],
			isMultiBlock: true,
			__experimentalConvert: ( blocks ) =>
				createBlock(
					'awesome-squiggle/backdrop',
					{},
					blocks.map( ( b ) => createBlock( b.name, b.attributes, b.innerBlocks ) )
				),
		},
	],
};

export default transforms;
```

(If `__experimentalConvert` proves unstable across the target WP versions, fall back to a standard `transform: ( attributes, innerBlocks ) => createBlock( 'awesome-squiggle/backdrop', {}, [ createBlock( … ) ] )` form. Verify against WP 6.3.)

- [ ] **Step 2: Attach in `src/backdrop/index.js`**

```js
import transforms from './transforms';
// …in registerBlockType config:
transforms,
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Verify: select a heading → block toolbar → "Squiggle Backdrop" wrap option produces a backdrop wrapping the heading.

- [ ] **Step 4: Commit**

```bash
git add src/backdrop/transforms.js src/backdrop/index.js
git commit -m "feat(backdrop): wrap-in-backdrop block transform"
```

---

### Task 9: Production build, docs, and manual QA

**Files:**
- Modify: `README.md`, `readme.txt`, `changelog.txt`

- [ ] **Step 1: Production build**

Run: `npm run build:production`
Expected: compiles clean; `build/backdrop/{block.json,render.php}` present.

- [ ] **Step 2: Manual QA on the live Studio site**

Verify all of:
- Behind a heading (no inner background): wave visible directly behind text, animates, readable.
- Behind a Group with an opaque background + padding on the Backdrop: wave slides out around the colored group (padding-frame case).
- Behind a Group with a semi-transparent background: wave shows through (show-through case).
- Vertical position top/center/baseline/custom all move the band; band height changes thickness.
- Reduced-motion OS setting stops animation; wave remains.
- Existing separator styles still work unchanged.

- [ ] **Step 3: Update docs**

Add a "Squiggle Backdrop block" section to `README.md` and `readme.txt` (what it is, how to use: insert or wrap, the controls, the opaque-vs-transparent inner-background behavior). Add a `changelog.txt` entry under a new version describing the additive block.

- [ ] **Step 4: Commit**

```bash
git add README.md readme.txt changelog.txt
git commit -m "docs(backdrop): document the squiggle backdrop block"
```

- [ ] **Step 5: Open PR**

Push the branch and open a PR summarizing the new block, the shared-builder refactor, and the editor-gradient-preview follow-up. Run `/review-yj` before opening (this is code, not a docs-only commit).

---

## Self-Review

**Spec coverage:**
- New `awesome-squiggle/backdrop` block → Tasks 3–8. ✓
- Two cases (behind heading / behind section) via one InnerBlocks block → Task 3 (InnerBlocks) + Task 9 QA. ✓
- Single animated wave band reusing `generate_long_wave_path` → Task 1 (shared builder) + Task 4. ✓
- Layering inside own stacking context (wave z-index:0, content z-index:1) → Task 4 markup + Task 5 CSS. ✓
- Animated by default, animation toggle/speed/direction, reduced-motion → Task 4 (attrs) + Task 5 (guard) + Task 6 (controls). ✓
- Opaque vs transparent inner background (padding frame + show-through) → spacing support (Task 3 block.json), `background:false` color support (Task 6), QA (Task 9). ✓
- Reused separator controls + new vertical-position/band-height/padding → Task 4 (attrs) + Task 6 (controls) + Task 7 (validation). ✓
- Wrap-in-backdrop transform → Task 8. ✓
- Color/gradient support → Task 4 (`resolve_line_color`) + Task 6 (color supports). ✓ (Editor gradient *preview* deferred — flagged in Task 6 + PR.)
- aria-hidden + decorative → Task 4 markup, asserted in Task 4 test. ✓
- PHP unit tests (new render path) → Task 1 + Task 4. JS validator tests → Task 7. Manual visual QA → Task 9. ✓
- Excluded (text-dodging reactivity, per-letter, tiled field) → not implemented, correct. ✓

**Placeholder scan:** No TBD/TODO. Each code step contains real code. The few "verify against your validators' actual signature / WP version" notes are deliberate guardrails on existing-code contracts the implementer must read, not deferred work.

**Type consistency:** `build_wave_svg( array $args )` keys are identical in Task 1 (definition), Task 4 (call), and the separator call site. JS generators keep the `( amplitude, pointiness, angle, strokeWidth, repetitions, containerHeight )` signature across Task 2 (definition) and Task 6 (use). Class names `asquig-backdrop__wave` / `asquig-backdrop__content` and block name `awesome-squiggle/backdrop` are consistent across Tasks 3–6 and the CSS in Task 5.
