<?php
/**
 * Tests for Awesome_Squiggle_Renderer.
 *
 * @package Awesome_Squiggle
 */

use PHPUnit\Framework\TestCase;

class RendererTest extends TestCase {

	// ───────────────────────────────────────────────
	// generate_long_wave_path
	// ───────────────────────────────────────────────

	public function test_wave_path_returns_expected_keys() {
		$result = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 0, 0, 1, 10, 100 );

		$this->assertArrayHasKey( 'd', $result );
		$this->assertArrayHasKey( 'height', $result );
		$this->assertArrayHasKey( 'wavelength', $result );
		$this->assertArrayHasKey( 'total_width', $result );
	}

	public function test_wave_path_wavelength_is_40() {
		$result = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 0, 0, 1, 10, 100 );
		$this->assertEquals( 40, $result['wavelength'] );
	}

	public function test_wave_path_height_matches_container() {
		$result = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 0, 0, 1, 10, 150 );
		$this->assertEquals( 150, $result['height'] );
	}

	public function test_wave_path_total_width() {
		$result = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 0, 0, 1, 50, 100 );
		$this->assertEquals( 2000, $result['total_width'] ); // 40 * 50
	}

	public function test_squiggle_path_uses_cubic_bezier() {
		$result = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 0, 0, 1, 5, 100 );
		// Pointiness=0 should produce cubic Bezier commands (C)
		$this->assertStringContainsString( ' C', $result['d'] );
		// Should NOT contain L (line-to) or Q (quadratic)
		$this->assertStringNotContainsString( ' L', $result['d'] );
		$this->assertStringNotContainsString( ' Q', $result['d'] );
	}

	public function test_zigzag_path_uses_line_to() {
		$result = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 100, 0, 1, 5, 100 );
		// Pointiness=100 should produce line commands (L)
		$this->assertStringContainsString( ' L', $result['d'] );
		// Should NOT contain C (cubic) or Q (quadratic)
		$this->assertStringNotContainsString( ' C', $result['d'] );
		$this->assertStringNotContainsString( ' Q', $result['d'] );
	}

	public function test_hybrid_path_uses_quadratic() {
		$result = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 50, 0, 1, 5, 100 );
		// Pointiness=50 should produce quadratic commands (Q)
		$this->assertStringContainsString( ' Q', $result['d'] );
		// Should NOT contain C (cubic) or L (line-to)
		$this->assertStringNotContainsString( ' C', $result['d'] );
		$this->assertStringNotContainsString( ' L', $result['d'] );
	}

	public function test_wave_path_starts_with_move_to() {
		$result = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 0, 0, 1, 5, 100 );
		$this->assertStringStartsWith( 'M', $result['d'] );
	}

	public function test_wave_path_clamps_amplitude() {
		// Amplitude below min (5) should clamp to 5
		$low = Awesome_Squiggle_Renderer::generate_long_wave_path( 1, 0, 0, 1, 5, 100 );
		$normal = Awesome_Squiggle_Renderer::generate_long_wave_path( 5, 0, 0, 1, 5, 100 );
		$this->assertEquals( $low['d'], $normal['d'] );

		// Amplitude above max (25) should clamp to 25
		$high = Awesome_Squiggle_Renderer::generate_long_wave_path( 50, 0, 0, 1, 5, 100 );
		$max = Awesome_Squiggle_Renderer::generate_long_wave_path( 25, 0, 0, 1, 5, 100 );
		$this->assertEquals( $high['d'], $max['d'] );
	}

	public function test_wave_path_with_angle_shifts_peaks() {
		$no_angle = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 100, 0, 1, 5, 100 );
		$with_angle = Awesome_Squiggle_Renderer::generate_long_wave_path( 10, 100, 30, 1, 5, 100 );
		// Different angle should produce different path
		$this->assertNotEquals( $no_angle['d'], $with_angle['d'] );
	}

	// ───────────────────────────────────────────────
	// parse_gradient
	// ───────────────────────────────────────────────

	public function test_parse_gradient_null_returns_fallback() {
		$result = Awesome_Squiggle_Renderer::parse_gradient( null );
		$this->assertEquals( 'linear', $result['type'] );
		$this->assertCount( 2, $result['stops'] );
		$this->assertEquals( '#667eea', $result['stops'][0]['color'] );
	}

	public function test_parse_gradient_empty_string_returns_fallback() {
		$result = Awesome_Squiggle_Renderer::parse_gradient( '' );
		$this->assertEquals( 'linear', $result['type'] );
		$this->assertCount( 2, $result['stops'] );
	}

	public function test_parse_gradient_wp_default_slug() {
		$result = Awesome_Squiggle_Renderer::parse_gradient( 'vivid-cyan-blue-to-vivid-purple' );
		$this->assertEquals( 'linear', $result['type'] );
		$this->assertGreaterThanOrEqual( 2, count( $result['stops'] ) );
	}

	public function test_parse_gradient_css_var() {
		$result = Awesome_Squiggle_Renderer::parse_gradient( 'var(--wp--preset--gradient--midnight)' );
		$this->assertEquals( 'linear', $result['type'] );
		$this->assertGreaterThanOrEqual( 2, count( $result['stops'] ) );
	}

	public function test_parse_gradient_css_string() {
		$result = Awesome_Squiggle_Renderer::parse_gradient(
			'linear-gradient(135deg, #ff0000 0%, #0000ff 100%)'
		);
		$this->assertEquals( 'linear', $result['type'] );
		$this->assertCount( 2, $result['stops'] );
		$this->assertEquals( '#ff0000', $result['stops'][0]['color'] );
		$this->assertEquals( '0%', $result['stops'][0]['offset'] );
		$this->assertEquals( '#0000ff', $result['stops'][1]['color'] );
		$this->assertEquals( '100%', $result['stops'][1]['offset'] );
	}

	public function test_parse_gradient_rgb_colors() {
		$result = Awesome_Squiggle_Renderer::parse_gradient(
			'linear-gradient(135deg, rgb(255,0,0) 0%, rgb(0,0,255) 100%)'
		);
		$this->assertCount( 2, $result['stops'] );
		$this->assertEquals( 'rgb(255,0,0)', $result['stops'][0]['color'] );
	}

	public function test_parse_gradient_rgba_colors() {
		$result = Awesome_Squiggle_Renderer::parse_gradient(
			'linear-gradient(135deg, rgba(6,147,227,1) 0%, rgb(155,81,224) 100%)'
		);
		$this->assertCount( 2, $result['stops'] );
		$this->assertEquals( 'rgba(6,147,227,1)', $result['stops'][0]['color'] );
	}

	public function test_parse_gradient_preserves_many_stops_and_offsets() {
		$result = Awesome_Squiggle_Renderer::parse_gradient(
			'linear-gradient(135deg, #ff0000 0%, #00ff00 20%, #0000ff 70%, #ffff00 100%)'
		);
		$this->assertSame(
			array(
				array( 'color' => '#ff0000', 'offset' => '0%' ),
				array( 'color' => '#00ff00', 'offset' => '20%' ),
				array( 'color' => '#0000ff', 'offset' => '70%' ),
				array( 'color' => '#ffff00', 'offset' => '100%' ),
			),
			$result['stops']
		);

		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className'  => 'is-style-squiggle',
					'gradient'   => 'linear-gradient(135deg, #ff0000 0%, #00ff00 20%, #0000ff 70%, #ffff00 100%)',
					'gradientId' => 'squiggle-gradient-four-stops',
				),
			)
		);
		$this->assertSame( 4, substr_count( $html, '<stop ' ) );
		foreach ( $result['stops'] as $stop ) {
			$this->assertStringContainsString(
				'<stop offset="' . $stop['offset'] . '" stop-color="' . $stop['color'] . '"',
				$html
			);
		}
	}

	public function test_parse_gradient_fixes_implicit_stop_positions() {
		$fixtures = array(
			array(
				'linear-gradient(90deg, #ff0000, #00ff00, #0000ff, #ffff00)',
				array( 0, 33.333, 66.667, 100 ),
			),
			array(
				'linear-gradient(90deg, #ff0000 10%, #00ff00, #0000ff 70%, #ffff00)',
				array( 10, 40, 70, 100 ),
			),
			array(
				'linear-gradient(90deg, #ff0000 0%, #00ff00, #0000ff, #ffff00, #ff00ff 100%)',
				array( 0, 25, 50, 75, 100 ),
			),
			array(
				'linear-gradient(90deg, #ff0000 60%, #00ff00 40%, #0000ff 80%, #ffff00)',
				array( 60, 60, 80, 100 ),
			),
		);

		foreach ( $fixtures as $fixture ) {
			$result = Awesome_Squiggle_Renderer::parse_gradient( $fixture[0] );
			$this->assertCount( count( $fixture[1] ), $result['stops'] );
			foreach ( $fixture[1] as $index => $offset ) {
				$this->assertEqualsWithDelta( $offset, (float) $result['stops'][ $index ]['offset'], 0.001 );
			}
		}
	}

	public function test_parse_gradient_unknown_slug_returns_fallback() {
		$result = Awesome_Squiggle_Renderer::parse_gradient( 'var(--wp--preset--gradient--totally-fake)' );
		$this->assertEquals( '#667eea', $result['stops'][0]['color'] );
	}

	public function test_gradient_positions_remain_finite() {
		$invalid = Awesome_Squiggle_Renderer::parse_gradient( 'linear-gradient(#f00 0%, #0f0, #00f ' . str_repeat( '9', 350 ) . '%)' );
		$this->assertSame( '#667eea', $invalid['stops'][0]['color'] );
		$finite = Awesome_Squiggle_Renderer::parse_gradient( 'linear-gradient(#f00 0%, #0f0, #00f, #fff 1' . str_repeat( '0', 308 ) . '%)' );
		$this->assertCount( 4, $finite['stops'] );
		foreach ( $finite['stops'] as $stop ) {
			$this->assertTrue( is_finite( (float) $stop['offset'] ) );
		}
		$this->assertEqualsWithDelta( 2 / 3, (float) $finite['stops'][2]['offset'] / 1e308, 0.00001 );
	}

	public function test_parse_gradient_keeps_hsl_deg_stops() {
		// Regression: substring-matching "deg" used to drop these stops entirely,
		// collapsing the gradient to the fallback.
		$result = Awesome_Squiggle_Renderer::parse_gradient(
			'linear-gradient(90deg, hsl(30deg 100% 50%) 0%, hsl(210deg 100% 40%) 100%)'
		);
		$this->assertCount( 2, $result['stops'] );
		$this->assertEquals( 'hsl(30deg 100% 50%)', $result['stops'][0]['color'] );
		$this->assertEquals( '0%', $result['stops'][0]['offset'] );
		$this->assertEquals( 'hsl(210deg 100% 40%)', $result['stops'][1]['color'] );
	}

	public function test_parse_gradient_offset_read_outside_percentage_color() {
		// Regression: rgb(100% 0% 0%) 25% used to yield offset "100%".
		$result = Awesome_Squiggle_Renderer::parse_gradient(
			'linear-gradient(135deg, rgb(100% 0% 0%) 25%, rgb(0% 0% 100%) 75%)'
		);
		$this->assertCount( 2, $result['stops'] );
		$this->assertEquals( '25%', $result['stops'][0]['offset'] );
		$this->assertEquals( '75%', $result['stops'][1]['offset'] );
	}

	public function test_parse_gradient_supports_decimal_offsets() {
		// Regression: /(\d+%)/ used to truncate "12.5%" to "5%".
		$result = Awesome_Squiggle_Renderer::parse_gradient(
			'linear-gradient(135deg, #ff0000 12.5%, #0000ff 87.5%)'
		);
		$this->assertEquals( '12.5%', $result['stops'][0]['offset'] );
		$this->assertEquals( '87.5%', $result['stops'][1]['offset'] );
	}

	// ───────────────────────────────────────────────
	// Type-confusion guards (raw comment-delimiter attrs)
	// ───────────────────────────────────────────────

	public function test_render_block_array_classname_does_not_fatal() {
		// render_block_{name} filters receive RAW attrs; an array className
		// used to hit explode() and fatal on PHP 8+.
		$block = array(
			'blockName' => 'core/separator',
			'attrs'     => array( 'className' => array( 'is-style-squiggle', 'x' ) ),
		);
		$result = Awesome_Squiggle_Renderer::render_block( '<hr/>', $block );
		// Array className coerces to '' → not a squiggle style → passthrough.
		$this->assertEquals( '<hr/>', $result );
	}

	public function test_resolve_line_color_array_attrs_do_not_fatal() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'gradient'        => array( 'not', 'a', 'string' ),
			'backgroundColor' => array( 'x' ),
			'textColor'       => array( 'y' ),
			'className'       => array( 'z' ),
			'style'           => 'not-an-array',
		) );
		$this->assertEquals( 'currentColor', $result['line_color'] );
		$this->assertNull( $result['gradient'] );
	}

	// ───────────────────────────────────────────────
	// resolve_line_color
	// ───────────────────────────────────────────────

	public function test_resolve_color_default_is_currentColor() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array() );
		$this->assertEquals( 'currentColor', $result['line_color'] );
		$this->assertNull( $result['gradient'] );
	}

	public function test_resolve_color_gradient_wins() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'gradient'        => 'linear-gradient(135deg, #ff0000 0%, #0000ff 100%)',
			'gradientId'      => 'test-gradient-abc',
			'backgroundColor' => 'primary',
		) );
		$this->assertStringContainsString( 'url(#test-gradient-abc)', $result['line_color'] );
		$this->assertNotNull( $result['gradient'] );
	}

	public function test_resolve_color_gradient_without_id_generates_runtime_id() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'gradient'        => 'linear-gradient(135deg, #ff0000 0%, #0000ff 100%)',
			// No gradientId — renderer should generate a runtime ID
			'backgroundColor' => 'primary',
		) );
		// Should generate a runtime gradient ID and use the gradient
		$this->assertStringContainsString( 'url(#gradient-', $result['line_color'] );
		$this->assertNotNull( $result['gradient'] );
	}

	public function test_resolve_color_background_preset() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'backgroundColor' => 'vivid-red',
		) );
		$this->assertEquals( 'var(--wp--preset--color--vivid-red)', $result['line_color'] );
	}

	public function test_resolve_color_custom_background() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'customBackgroundColor' => '#ff6600',
		) );
		$this->assertEquals( '#ff6600', $result['line_color'] );
	}

	public function test_resolve_color_style_background() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'style' => array( 'color' => array( 'background' => '#123456' ) ),
		) );
		$this->assertEquals( '#123456', $result['line_color'] );
	}

	public function test_resolve_color_classname_extraction() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'className' => 'is-style-squiggle has-cyan-bluish-gray-background-color',
		) );
		$this->assertEquals( 'var(--wp--preset--color--cyan-bluish-gray)', $result['line_color'] );
	}

	public function test_resolve_color_text_color_fallback() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'textColor' => 'luminous-vivid-orange',
		) );
		$this->assertEquals( 'var(--wp--preset--color--luminous-vivid-orange)', $result['line_color'] );
	}

	public function test_resolve_color_priority_order() {
		// backgroundColor should win over textColor
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'backgroundColor' => 'red',
			'textColor'       => 'blue',
		) );
		$this->assertStringContainsString( 'red', $result['line_color'] );
	}

	public function test_resolve_color_gradient_returns_gradient_id_matching_line_color() {
		// Bug B regression: the id returned as gradient_id must be the same id used
		// in the url(#...) stroke reference so build_wave_svg can emit matching <defs>.
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'gradient' => 'vivid-cyan-blue-to-vivid-purple',
		) );

		$gradient_id = $result['gradient_id'];
		$this->assertNotEmpty( $gradient_id, 'gradient_id should be non-empty when a gradient is set' );

		// The returned gradient_id must appear literally inside line_color: url(#<id>)
		$this->assertStringContainsString(
			'url(#' . $gradient_id . ')',
			$result['line_color'],
			'gradient_id must match the id used inside line_color url() reference'
		);
	}

	public function test_resolve_color_no_gradient_returns_empty_gradient_id() {
		// When no gradient is set, gradient_id must be '' and line_color must not be a url(#...).
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'backgroundColor' => 'vivid-red',
		) );

		$this->assertSame( '', $result['gradient_id'], 'gradient_id should be empty string when no gradient' );
		$this->assertStringNotContainsString( 'url(#', $result['line_color'] );
	}

	public function test_resolve_color_empty_gradient_falls_back_to_custom_style_gradient() {
		// Codex regression: gradient '' must not defeat the custom style.color.gradient.
		// `??` only falls through on null, so an empty-string slug used to swallow the
		// real custom gradient and drop to currentColor.
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'gradient' => '',
			'style'    => array( 'color' => array( 'gradient' => 'linear-gradient(135deg,#ff0000 0%,#0000ff 100%)' ) ),
		) );

		$this->assertNotEmpty( $result['gradient_id'], 'custom style gradient should be honored despite empty slug' );
		$this->assertStringContainsString( 'url(#', $result['line_color'] );
		$this->assertNotNull( $result['gradient'] );
	}

	public function test_resolve_color_theme_preset_gradient_resolves_real_stops() {
		// Codex finding: theme-defined preset slugs (not in the hardcoded default
		// palette) must resolve to their real stops via wp_get_global_settings, not
		// the #667eea/#764ba2 fallback. 'brand-sunset' is the bootstrap fixture.
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'gradient' => 'brand-sunset',
		) );

		$this->assertStringContainsString( 'url(#', $result['line_color'] );
		$this->assertNotNull( $result['gradient_data'] );
		// Real theme stops, not the fallback.
		$this->assertSame( '#ff5e62', $result['gradient_data']['stops'][0]['color'] );
		$this->assertNotEquals( '#667eea', $result['gradient_data']['stops'][0]['color'] );
	}

	public function test_parse_gradient_theme_preset_slug_resolves_real_stops() {
		// The pure parser, fed a theme preset slug, resolves via global settings.
		$result = Awesome_Squiggle_Renderer::parse_gradient( 'brand-sunset' );
		$this->assertSame( '#ff5e62', $result['stops'][0]['color'] );
		$this->assertSame( '#ff9966', $result['stops'][1]['color'] );
	}

	// ───────────────────────────────────────────────
	// render_block (separator integration)
	// ───────────────────────────────────────────────

	public function test_render_block_legacy_gradient_separator_emits_matching_defs() {
		// Reddy + Codex (convergent): a legacy squiggle separator with a gradient but
		// NO gradientId attribute used to emit no <linearGradient> defs (stale id),
		// rendering the gradient invisible. render_block must now use the resolved id.
		$block = array(
			'blockName' => 'core/separator',
			'attrs'     => array(
				'className' => 'is-style-squiggle',
				'gradient'  => 'vivid-cyan-blue-to-vivid-purple',
				// No gradientId — the legacy/native-gradient case.
			),
			'innerHTML' => '',
		);

		$html = Awesome_Squiggle_Renderer::render_block( '<hr class="wp-block-separator is-style-squiggle"/>', $block );

		// A <linearGradient> def must be present.
		$this->assertStringContainsString( '<linearGradient', $html, 'legacy gradient separator must emit <defs>' );

		// The def id must match the stroke's url(#...) reference.
		$this->assertTrue(
			(bool) preg_match( '/url\(#(gradient-[0-9a-f]+)\)/', $html, $stroke_m ),
			'stroke should reference a runtime gradient id'
		);
		$this->assertStringContainsString(
			'id="' . $stroke_m[1] . '"',
			$html,
			'the <linearGradient> id must match the stroke url(#...) reference'
		);
	}

	// ───────────────────────────────────────────────
	// generate_pixel_wave_path
	// ───────────────────────────────────────────────

	public function test_pixel_path_returns_expected_keys() {
		$result = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 10, 0, 0, 1, 10, 100 );
		$this->assertArrayHasKey( 'd', $result );
		$this->assertArrayHasKey( 'height', $result );
		$this->assertArrayHasKey( 'wavelength', $result );
		$this->assertArrayHasKey( 'total_width', $result );
	}

	public function test_pixel_path_wavelength_is_40() {
		$result = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 10, 0, 0, 1, 10, 100 );
		$this->assertEquals( 40, $result['wavelength'] );
	}

	public function test_pixel_path_uses_only_h_and_v_commands() {
		$result = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 10, 0, 0, 1, 10, 100 );
		// Should only contain M (move), H (horizontal), V (vertical) — no C, L, Q
		$this->assertStringNotContainsString( ' C', $result['d'] );
		$this->assertStringNotContainsString( ' L', $result['d'] );
		$this->assertStringNotContainsString( ' Q', $result['d'] );
		$this->assertStringContainsString( ' H', $result['d'] );
		$this->assertStringContainsString( ' V', $result['d'] );
	}

	public function test_pixel_path_starts_with_move() {
		$result = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 10, 0, 0, 1, 5, 100 );
		$this->assertStringStartsWith( 'M', $result['d'] );
	}

	public function test_pixel_path_clamps_amplitude() {
		$low = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 1, 0, 0, 1, 5, 100 );
		$normal = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 5, 0, 0, 1, 5, 100 );
		$this->assertEquals( $low['d'], $normal['d'] );
	}

	public function test_pixel_path_different_pointiness() {
		$sine = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 10, 0, 0, 1, 10, 100 );
		$triangle = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 10, 100, 0, 1, 10, 100 );
		$this->assertNotEquals( $sine['d'], $triangle['d'] );
	}

	public function test_pixel_path_with_angle() {
		// Use large amplitude so angle's cos() effect on adjusted_amplitude is visible
		$no_angle = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 25, 0, 0, 1, 5, 100 );
		$with_angle = Awesome_Squiggle_Renderer::generate_pixel_wave_path( 25, 0, 45, 1, 5, 100 );
		$this->assertNotEquals( $no_angle['d'], $with_angle['d'] );
	}

	// ───────────────────────────────────────────────
	// render_block
	// ───────────────────────────────────────────────

	public function test_render_non_separator_passthrough() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'<p>Hello</p>',
			array( 'blockName' => 'core/paragraph', 'attrs' => array() )
		);
		$this->assertEquals( '<p>Hello</p>', $html );
	}

	public function test_render_plain_separator_passthrough() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'<hr class="wp-block-separator"/>',
			array( 'blockName' => 'core/separator', 'attrs' => array() )
		);
		$this->assertEquals( '<hr class="wp-block-separator"/>', $html );
	}

	public function test_render_squiggle_generates_svg() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'<div class="wp-block-separator" role="separator"></div>',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className' => 'is-style-squiggle',
				),
			)
		);

		$this->assertStringContainsString( '<svg', $html );
		$this->assertStringContainsString( '<path', $html );
		$this->assertStringContainsString( 'awesome-squiggle-wave', $html );
		$this->assertStringContainsString( 'role="separator"', $html );
		$this->assertStringContainsString( 'aria-label="Decorative separator"', $html );
		$this->assertStringContainsString( 'aria-hidden="true"', $html );
		$this->assertStringContainsString( 'vector-effect="non-scaling-stroke"', $html );
	}

	public function test_render_zigzag_generates_svg() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className' => 'is-style-zigzag',
				),
			)
		);

		$this->assertStringContainsString( '<svg', $html );
		$this->assertStringContainsString( 'is-style-zigzag', $html );
	}

	public function test_render_lightning_generates_svg() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className' => 'is-style-lightning',
				),
			)
		);

		$this->assertStringContainsString( '<svg', $html );
		$this->assertStringContainsString( 'is-style-lightning', $html );
	}

	public function test_render_pixel_generates_svg_with_staircase() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className' => 'is-style-pixel',
				),
			)
		);

		$this->assertStringContainsString( '<svg', $html );
		$this->assertStringContainsString( 'is-style-pixel', $html );
		// Pixel paths use H and V commands, not C or L
		$this->assertMatchesRegularExpression( '/ H\d/', $html );
		$this->assertMatchesRegularExpression( '/ V\d/', $html );
	}

	public function test_render_includes_stroke_width() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className'   => 'is-style-squiggle',
					'strokeWidth' => 4,
				),
			)
		);

		$this->assertStringContainsString( 'stroke-width="4"', $html );
	}

	public function test_render_includes_gradient_defs() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className'  => 'is-style-squiggle',
					'gradient'   => 'vivid-cyan-blue-to-vivid-purple',
					'gradientId' => 'squiggle-gradient-abc123',
				),
			)
		);

		$this->assertStringContainsString( '<linearGradient', $html );
		$this->assertStringContainsString( 'id="squiggle-gradient-abc123"', $html );
		$this->assertStringContainsString( 'spreadMethod="reflect"', $html );
		$this->assertStringContainsString( '<stop', $html );
	}

	public function test_render_paused_state() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className'  => 'is-style-squiggle',
					'isAnimated' => false,
				),
			)
		);

		$this->assertStringContainsString( 'is-paused', $html );
		$this->assertStringContainsString( 'animation:none', $html );
	}

	public function test_render_alignment_class() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className' => 'is-style-squiggle',
					'align'     => 'full',
				),
			)
		);

		$this->assertStringContainsString( 'alignfull', $html );
	}

	public function test_render_custom_height() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className'      => 'is-style-squiggle',
					'squiggleHeight' => '150px',
				),
			)
		);

		$this->assertStringContainsString( 'height:150px', $html );
	}

	public function test_render_invalid_height_defaults() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className'      => 'is-style-squiggle',
					'squiggleHeight' => '999px',
				),
			)
		);

		$this->assertStringContainsString( 'height:100px', $html );
	}

	public function test_render_reverse_animation() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className'  => 'is-style-squiggle',
					'isReversed' => true,
				),
			)
		);

		$this->assertStringContainsString( 'wave-flow-reverse', $html );
	}

	// ───────────────────────────────────────────────
	// Security / validation
	// ───────────────────────────────────────────────

	public function test_render_escapes_output() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className'   => 'is-style-squiggle',
					'animationId' => 'test"><script>alert(1)</script>',
				),
			)
		);

		// validateId strips everything non-alphanumeric/dash/underscore
		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringNotContainsString( 'alert(1)', $html );
		$this->assertStringNotContainsString( 'test">', $html );
		// Should fall back to default class since the malicious ID is rejected
		$this->assertStringContainsString( 'wave-path-default', $html );
	}

	public function test_render_rejects_invalid_gradient_id() {
		$html = Awesome_Squiggle_Renderer::render_block(
			'',
			array(
				'blockName' => 'core/separator',
				'attrs'     => array(
					'className'  => 'is-style-squiggle',
					'gradient'   => 'vivid-cyan-blue-to-vivid-purple',
					'gradientId' => 'bad<id>with"quotes',
				),
			)
		);

		// Security: the malicious gradientId must never reach the output (no injection).
		$this->assertStringNotContainsString( 'bad<id>with"quotes', $html );
		$this->assertStringNotContainsString( '<id>', $html );

		// Improved behavior (fix #2): an invalid id is sanitized away and the gradient
		// still renders via a safe generated runtime id (gradient-<hash>) — it no longer
		// silently vanishes. The def id must match the stroke reference.
		$this->assertTrue(
			(bool) preg_match( '/url\(#(gradient-[0-9a-f]+)\)/', $html, $stroke_m ),
			'gradient should render with a safe runtime id after rejecting the invalid one'
		);
		$this->assertStringContainsString( 'id="' . $stroke_m[1] . '"', $html );
	}

	// ───────────────────────────────────────────────
	// build_wave_svg
	// ───────────────────────────────────────────────

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

	public function test_build_wave_svg_emits_gradient_defs_when_gradient_data_provided() {
		$gradient_data = array(
			'type'  => 'linear',
			'stops' => array(
				array( 'color' => '#ff0000', 'offset' => '0%' ),
				array( 'color' => '#0000ff', 'offset' => '100%' ),
			),
		);

		$svg = Awesome_Squiggle_Renderer::build_wave_svg( array(
			'shape'            => 'squiggle',
			'amplitude'        => 10,
			'pointiness'       => 0,
			'angle'            => 0,
			'stroke_width'     => 1,
			'animation_speed'  => 2.5,
			'is_animated'      => true,
			'is_reversed'      => false,
			'line_color'       => 'url(#gradient-abc12345)',
			'gradient_data'    => $gradient_data,
			'gradient_id'      => 'gradient-abc12345',
			'animation_id'     => '',
			'container_height' => 100,
		) );

		$this->assertStringContainsString( '<defs>', $svg );
		$this->assertStringContainsString( '<linearGradient', $svg );
		$this->assertStringContainsString( '#ff0000', $svg );
		$this->assertStringContainsString( '#0000ff', $svg );

		// Without gradient_data, no linearGradient should be emitted.
		$svg_no_gradient = Awesome_Squiggle_Renderer::build_wave_svg( array(
			'shape'            => 'squiggle',
			'amplitude'        => 10,
			'pointiness'       => 0,
			'angle'            => 0,
			'stroke_width'     => 1,
			'animation_speed'  => 2.5,
			'is_animated'      => true,
			'is_reversed'      => false,
			'line_color'       => 'currentColor',
			'gradient_data'    => null,
			'gradient_id'      => '',
			'animation_id'     => '',
			'container_height' => 100,
		) );
		$this->assertStringNotContainsString( '<linearGradient', $svg_no_gradient );
	}
}
