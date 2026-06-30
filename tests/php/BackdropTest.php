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
