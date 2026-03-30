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

	public function test_parse_gradient_simplifies_many_stops() {
		$result = Awesome_Squiggle_Renderer::parse_gradient(
			'linear-gradient(135deg, #ff0000 0%, #00ff00 25%, #0000ff 50%, #ffff00 75%, #ff00ff 100%)'
		);
		// >3 stops should be simplified to 3 (first, middle, last)
		$this->assertCount( 3, $result['stops'] );
		$this->assertEquals( '#ff0000', $result['stops'][0]['color'] );
		$this->assertEquals( '50%', $result['stops'][1]['offset'] ); // Middle normalized to 50%
		$this->assertEquals( '#ff00ff', $result['stops'][2]['color'] );
	}

	public function test_parse_gradient_unknown_slug_returns_fallback() {
		$result = Awesome_Squiggle_Renderer::parse_gradient( 'var(--wp--preset--gradient--totally-fake)' );
		$this->assertEquals( '#667eea', $result['stops'][0]['color'] );
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

	public function test_resolve_color_gradient_without_id_falls_through() {
		$result = Awesome_Squiggle_Renderer::resolve_line_color( array(
			'gradient'        => 'linear-gradient(135deg, #ff0000 0%, #0000ff 100%)',
			// No gradientId
			'backgroundColor' => 'primary',
		) );
		// Without gradientId, should fall through to backgroundColor
		$this->assertStringContainsString( 'var(--wp--preset--color--primary)', $result['line_color'] );
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

		// Script injection should be sanitized away (validateId strips non-alphanumeric)
		$this->assertStringNotContainsString( '<script>', $html );
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

		// Invalid gradient ID means no gradient defs
		$this->assertStringNotContainsString( '<linearGradient', $html );
	}
}
