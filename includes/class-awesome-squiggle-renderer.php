<?php
/**
 * Awesome Squiggle — PHP Dynamic Renderer
 *
 * Generates all frontend SVG markup server-side from block attributes.
 * This is the single source of truth for frontend rendering.
 *
 * @package Awesome_Squiggle
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Awesome_Squiggle_Renderer {

	/**
	 * WordPress default gradients map — matches the JS wpDefaultGradients object.
	 *
	 * @var array<string, string>
	 */
	private static $wp_default_gradients = array(
		'vivid-cyan-blue-to-vivid-purple'            => 'linear-gradient(135deg,rgba(6,147,227,1) 0%,rgb(155,81,224) 100%)',
		'light-green-cyan-to-vivid-green-cyan'        => 'linear-gradient(135deg,rgb(122,220,180) 0%,rgb(0,208,130) 100%)',
		'luminous-vivid-amber-to-luminous-vivid-orange' => 'linear-gradient(135deg,rgba(252,185,0,1) 0%,rgba(255,105,0,1) 100%)',
		'luminous-vivid-orange-to-vivid-red'          => 'linear-gradient(135deg,rgba(255,105,0,1) 0%,rgb(207,46,46) 100%)',
		'very-light-gray-to-cyan-bluish-gray'         => 'linear-gradient(135deg,rgb(238,238,238) 0%,rgb(169,184,195) 100%)',
		'cool-to-warm-spectrum'                       => 'linear-gradient(135deg,rgb(74,234,220) 0%,rgb(238,44,130) 50%,rgb(254,248,76) 100%)',
		'blush-light-purple'                          => 'linear-gradient(135deg,rgb(255,206,236) 0%,rgb(152,150,240) 100%)',
		'blush-bordeaux'                              => 'linear-gradient(135deg,rgb(254,205,165) 0%,rgb(254,45,45) 50%,rgb(107,0,62) 100%)',
		'luminous-dusk'                               => 'linear-gradient(135deg,rgb(255,203,112) 0%,rgb(199,81,192) 50%,rgb(65,88,208) 100%)',
		'pale-ocean'                                  => 'linear-gradient(135deg,rgb(255,245,203) 0%,rgb(182,227,212) 50%,rgb(51,167,181) 100%)',
		'electric-grass'                              => 'linear-gradient(135deg,rgb(202,248,128) 0%,rgb(113,206,126) 100%)',
		'midnight'                                    => 'linear-gradient(135deg,rgb(2,3,129) 0%,rgb(40,116,252) 100%)',
	);

	/**
	 * Fallback gradient stops when parsing fails.
	 *
	 * @var array
	 */
	private static $fallback_gradient = array(
		'type'  => 'linear',
		'stops' => array(
			array( 'color' => '#667eea', 'offset' => '0%' ),
			array( 'color' => '#764ba2', 'offset' => '100%' ),
		),
	);

	// ───────────────────────────────────────────────
	// Validation helpers
	// ───────────────────────────────────────────────

	/**
	 * Clamp a numeric value to a range, returning a default for non-numeric input.
	 */
	private static function validate_numeric( $value, $min, $max, $default ) {
		if ( ! is_numeric( $value ) ) {
			return $default;
		}
		$value = (float) $value;
		return max( $min, min( $max, $value ) );
	}

	/**
	 * Validate a CSS color value against a whitelist of safe patterns.
	 * Returns $fallback for anything that doesn't match.
	 */
	private static function validate_color( $color, $fallback = 'currentColor' ) {
		if ( ! is_string( $color ) || $color === '' ) {
			return $fallback;
		}

		$trimmed = trim( $color );

		if ( $trimmed === 'currentColor' ) {
			return $trimmed;
		}

		// Hex: #RGB, #RRGGBB, #RGBA, #RRGGBBAA
		if ( preg_match( '/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $trimmed ) ) {
			return $trimmed;
		}

		// rgb/rgba — includes modern space-separated syntax with / alpha separator
		// e.g., rgb(255 0 0 / 0.5), rgba(0, 128, 255, 0.8)
		if ( preg_match( '/^rgba?\(\s*[\d.%,\s\/]+\s*\)$/', $trimmed ) ) {
			return $trimmed;
		}

		// hsl/hsla
		if ( preg_match( '/^hsla?\(\s*[\d.%,\s\/deg]+\s*\)$/', $trimmed ) ) {
			return $trimmed;
		}

		// CSS custom properties — only WP preset color/gradient patterns
		if ( preg_match( '/^var\(--wp--preset--(color|gradient)--[a-zA-Z0-9-]+\)$/', $trimmed ) ) {
			return $trimmed;
		}

		// url() references to local gradient IDs
		if ( preg_match( '/^url\(#[a-zA-Z0-9_-]+\)$/', $trimmed ) ) {
			return $trimmed;
		}

		return $fallback;
	}

	/**
	 * Validate an ID string — alphanumeric, dash, underscore only, max 50 chars.
	 */
	private static function validate_id( $id ) {
		if ( ! is_string( $id ) ) {
			return '';
		}
		$id = substr( $id, 0, 50 );
		if ( ! preg_match( '/^[a-zA-Z0-9_-]+$/', $id ) ) {
			return '';
		}
		return $id;
	}

	/**
	 * Warp a linear phase (0-1) to shift where peaks/troughs occur.
	 *
	 * With shift=0, output equals input (symmetric wave).
	 * With shift>0, the first half compresses (steep rise) and second half stretches (gradual fall).
	 * This creates the lightning-bolt lean effect in pixel waves.
	 *
	 * @param float $phase Linear phase 0-1 within one wavelength.
	 * @param float $shift How much to shift the midpoint (-0.3 to +0.3).
	 * @return float Warped phase 0-1.
	 */
	private static function warp_phase( $phase, $shift ) {
		if ( abs( $shift ) < 0.001 ) {
			return $phase;
		}
		// Midpoint shifts from 0.5 to (0.5 - shift)
		$mid = 0.5 - $shift;
		$mid = max( 0.15, min( 0.85, $mid ) ); // Clamp to avoid extreme warping

		if ( $phase < $mid ) {
			// Map [0, mid] → [0, 0.5]
			return ( $phase / $mid ) * 0.5;
		}
		// Map [mid, 1] → [0.5, 1]
		return 0.5 + ( ( $phase - $mid ) / ( 1 - $mid ) ) * 0.5;
	}

	// ───────────────────────────────────────────────
	// Style detection
	// ───────────────────────────────────────────────

	private static function has_class( $class_name, $target ) {
		return $class_name && in_array( $target, explode( ' ', $class_name ), true );
	}

	private static function is_squiggle_style( $class_name ) {
		return self::has_class( $class_name, 'is-style-squiggle' );
	}

	private static function is_zigzag_style( $class_name ) {
		return self::has_class( $class_name, 'is-style-zigzag' );
	}

	private static function is_lightning_style( $class_name ) {
		return self::has_class( $class_name, 'is-style-lightning' );
	}

	private static function is_pixel_style( $class_name ) {
		return self::has_class( $class_name, 'is-style-pixel' );
	}

	private static function is_custom_style( $class_name ) {
		return self::is_squiggle_style( $class_name )
			|| self::is_zigzag_style( $class_name )
			|| self::is_lightning_style( $class_name )
			|| self::is_pixel_style( $class_name );
	}

	// ───────────────────────────────────────────────
	// Wave path generation
	// ───────────────────────────────────────────────

	/**
	 * Generate a long continuous wave SVG path.
	 *
	 * Uses The Outline's technique: a path extending far beyond the viewBox
	 * that gets clipped naturally — no pattern tiling seams.
	 *
	 * @param float $amplitude        Wave height 5-25px.
	 * @param float $pointiness       0 = smooth curves, 100 = sharp angles.
	 * @param float $angle            Peak lean in degrees, -60 to +60.
	 * @param float $stroke_width     Line thickness 1-8px (unused in path math, kept for API parity).
	 * @param int   $repetitions      Number of wavelengths to generate (default 80).
	 * @param int   $container_height Height of the container in px (default 100).
	 * @return array { d: string, height: int, wavelength: int, total_width: int }
	 */
	public static function generate_long_wave_path( $amplitude = 10, $pointiness = 0, $angle = 0, $stroke_width = 1, $repetitions = 80, $container_height = 100 ) {
		$amplitude        = self::validate_numeric( $amplitude, 5, 25, 10 );
		$pointiness       = self::validate_numeric( $pointiness, 0, 100, 0 );
		$angle            = self::validate_numeric( $angle, -60, 60, 0 );
		$stroke_width     = self::validate_numeric( $stroke_width, 1, 8, 1 );

		$wavelength  = 40;
		$height      = $container_height;
		$mid_y       = $height / 2;
		$total_width = $wavelength * $repetitions;

		$angle_rad          = deg2rad( $angle );
		$x_offset           = $amplitude * sin( $angle_rad );
		$y_multiplier       = cos( $angle_rad );
		$adjusted_amplitude = $amplitude * $y_multiplier;

		$start_x = -$wavelength * 2;
		$d       = "M{$start_x},{$mid_y}";

		$total_segments = $repetitions + 4;

		for ( $i = 0; $i < $total_segments; $i++ ) {
			$base_x     = $start_x + ( $i * $wavelength );
			$is_up_peak = ( $i % 2 === 0 );

			if ( $pointiness >= 100 ) {
				// Zigzag: straight lines to sharp peaks
				$peak_x = $base_x + $wavelength / 2 + ( $is_up_peak ? $x_offset : -$x_offset );
				$peak_y = $is_up_peak ? $mid_y - $adjusted_amplitude : $mid_y + $adjusted_amplitude;
				$end_x  = $base_x + $wavelength;
				$d     .= " L{$peak_x},{$peak_y} L{$end_x},{$mid_y}";
			} elseif ( $pointiness <= 0 ) {
				// Squiggle: smooth cubic Bezier curves
				$peak_y = $is_up_peak ? $mid_y - $adjusted_amplitude : $mid_y + $adjusted_amplitude;
				$cp1x   = $base_x + $wavelength * 0.375;
				$cp2x   = $base_x + $wavelength * 0.625;
				$end_x  = $base_x + $wavelength;
				$d     .= " C{$cp1x},{$peak_y} {$cp2x},{$peak_y} {$end_x},{$mid_y}";
			} else {
				// Hybrid: quadratic curves with variable tension
				$tension = $pointiness / 100;
				$peak_x  = $base_x + $wavelength / 2 + ( $is_up_peak ? $x_offset * $tension : -$x_offset * $tension );
				$peak_y  = $is_up_peak ? $mid_y - $adjusted_amplitude : $mid_y + $adjusted_amplitude;
				$end_x   = $base_x + $wavelength;

				$qcp1x = $base_x + $wavelength * ( 0.375 + $tension * 0.125 );
				$qcp2x = $base_x + $wavelength * ( 0.625 - $tension * 0.125 );

				$d .= " Q{$qcp1x},{$peak_y} {$peak_x},{$peak_y}";
				$d .= " Q{$qcp2x},{$peak_y} {$end_x},{$mid_y}";
			}
		}

		return array(
			'd'           => $d,
			'height'      => $height,
			'wavelength'  => $wavelength,
			'total_width' => $total_width,
		);
	}

	/**
	 * Generate a pixelated (8-bit / Scott Pilgrim) wave path.
	 *
	 * Uses only horizontal and vertical line segments to create a staircase
	 * pattern that approximates a wave shape on a pixel grid.
	 *
	 * @param float $amplitude        Wave height 5-25px.
	 * @param float $pointiness       0 = sine wave staircase, 100 = triangle wave staircase.
	 * @param float $angle            Peak lean in degrees, -60 to +60.
	 * @param float $stroke_width     Line thickness (unused in path math).
	 * @param int   $repetitions      Number of wavelengths (default 80).
	 * @param int   $container_height Container height in px (default 100).
	 * @return array { d: string, height: int, wavelength: int, total_width: int }
	 */
	public static function generate_pixel_wave_path( $amplitude = 10, $pointiness = 0, $angle = 0, $stroke_width = 1, $repetitions = 80, $container_height = 100 ) {
		$amplitude  = self::validate_numeric( $amplitude, 5, 25, 10 );
		$pointiness = self::validate_numeric( $pointiness, 0, 100, 0 );
		$angle      = self::validate_numeric( $angle, -60, 60, 0 );

		$pixel_size  = 5;
		$wavelength  = 40;
		$height      = $container_height;
		$mid_y       = $height / 2;
		$total_width = $wavelength * $repetitions;

		$angle_rad = deg2rad( $angle );
		// Peak shift: how far (as fraction of wavelength) to shift peak from center
		// angle=0 → peak at 50%, angle=60 → peak shifted toward ~25% (steep rise, gradual fall)
		$peak_shift = sin( $angle_rad ) * 0.3; // ±0.3 of wavelength max

		$start_x = -$wavelength * 2;
		$end_x   = $total_width + $wavelength * 2;

		// Start at the quantized mid-Y
		$quantized_mid_y = round( $mid_y / $pixel_size ) * $pixel_size;
		$d               = "M{$start_x},{$quantized_mid_y}";
		$prev_y          = $quantized_mid_y;

		for ( $x = $start_x; $x <= $end_x; $x += $pixel_size ) {
			// Linear phase within wavelength (0 to 1)
			$phase_norm = fmod( ( $x - $start_x ), $wavelength ) / $wavelength;

			// Warp the phase to shift peaks — creates asymmetric wave (lightning lean)
			// peak_shift > 0 means peak arrives earlier → steep rise, gradual fall
			$warped = self::warp_phase( $phase_norm, $peak_shift );

			// Convert to radians for wave functions
			$phase = $warped * 2 * M_PI;

			// Sine wave component (smooth)
			$sine_y = sin( $phase );

			// Triangle wave component (angular)
			$tri_phase = fmod( ( $warped + 0.25 ), 1.0 );
			$triangle_y = ( $tri_phase < 0.5 )
				? 1 - 4 * abs( $tri_phase - 0.25 )
				: -1 + 4 * abs( $tri_phase - 0.75 );

			// Blend based on pointiness
			$tension = $pointiness / 100;
			$wave_y  = ( 1 - $tension ) * $sine_y + $tension * $triangle_y;

			// Calculate Y and quantize to pixel grid
			$raw_y       = $mid_y - $amplitude * $wave_y;
			$quantized_y = round( $raw_y / $pixel_size ) * $pixel_size;

			// Draw horizontal then vertical (staircase)
			if ( $quantized_y !== $prev_y ) {
				$d     .= " H{$x} V{$quantized_y}";
				$prev_y = $quantized_y;
			}
		}

		// Final horizontal segment to the end
		$d .= " H{$end_x}";

		return array(
			'd'           => $d,
			'height'      => $height,
			'wavelength'  => $wavelength,
			'total_width' => $total_width,
		);
	}

	// ───────────────────────────────────────────────
	// Gradient parsing
	// ───────────────────────────────────────────────

	/**
	 * Resolve a gradient slug/var/custom to a concrete CSS linear-gradient string.
	 */
	private static function resolve_gradient_to_css( $input ) {
		if ( ! $input ) {
			return null;
		}

		$value = trim( (string) $input );

		// Bare slug (no var()/gradient())
		$looks_like_slug = ( strpos( $value, 'gradient(' ) === false && strpos( $value, 'var(' ) !== 0 );
		if ( $looks_like_slug ) {
			if ( isset( self::$wp_default_gradients[ $value ] ) ) {
				return self::$wp_default_gradients[ $value ];
			}
		}

		// CSS var for a preset gradient — resolve from map or pass through for browser resolution
		if ( strpos( $value, 'var(--wp--preset--gradient--' ) === 0 ) {
			if ( preg_match( '/var\(--wp--preset--gradient--([^)]+)\)/', $value, $m ) ) {
				if ( isset( self::$wp_default_gradients[ $m[1] ] ) ) {
					return self::$wp_default_gradients[ $m[1] ];
				}
			}
			// Theme-defined preset not in our map — pass through for browser resolution
			return $value;
		}

		// Already a concrete linear-gradient
		if ( strpos( $value, 'linear-gradient(' ) === 0 ) {
			return $value;
		}

		return null;
	}

	/**
	 * Parse a gradient input into structured color stops.
	 *
	 * @param string $gradient_input CSS gradient string, preset var, or slug.
	 * @return array { type: string, stops: array<{ color: string, offset: string }> }
	 */
	public static function parse_gradient( $gradient_input ) {
		if ( ! $gradient_input ) {
			return self::$fallback_gradient;
		}

		$gradient_string = self::resolve_gradient_to_css( $gradient_input );
		if ( ! $gradient_string ) {
			$gradient_string = (string) $gradient_input;
		}

		// Handle unresolved var references
		if ( strpos( $gradient_string, 'var(--wp--preset--gradient--' ) === 0 ) {
			if ( preg_match( '/var\(--wp--preset--gradient--([^)]+)\)/', $gradient_string, $m ) ) {
				if ( isset( self::$wp_default_gradients[ $m[1] ] ) ) {
					$gradient_string = self::$wp_default_gradients[ $m[1] ];
				} else {
					return self::$fallback_gradient;
				}
			} else {
				return self::$fallback_gradient;
			}
		}

		// Parse linear-gradient CSS
		if ( preg_match( '/linear-gradient\((.*)\)$/s', $gradient_string, $linear_match ) ) {
			$content = $linear_match[1];

			// Split by commas respecting parenthesis depth
			$parts       = array();
			$current     = '';
			$paren_depth = 0;
			$len         = strlen( $content );

			for ( $i = 0; $i < $len; $i++ ) {
				$char = $content[ $i ];
				if ( $char === '(' ) {
					$paren_depth++;
				}
				if ( $char === ')' ) {
					$paren_depth--;
				}
				if ( $char === ',' && $paren_depth === 0 ) {
					$parts[] = trim( $current );
					$current = '';
				} else {
					$current .= $char;
				}
			}
			if ( trim( $current ) !== '' ) {
				$parts[] = trim( $current );
			}

			$stops = array();

			foreach ( $parts as $part ) {
				// Skip direction (e.g., "135deg", "to bottom")
				if ( strpos( $part, 'deg' ) !== false || strpos( $part, 'to ' ) !== false ) {
					continue;
				}

				// Match color: rgb(), rgba(), hsl(), hsla(), or hex
				if ( preg_match( '/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/', $part, $color_match ) ) {
					$color = $color_match[1];

					// Match percentage
					$offset = null;
					if ( preg_match( '/(\d+%)/', $part, $pct_match ) ) {
						$offset = $pct_match[1];
					} else {
						$offset = empty( $stops ) ? '0%' : '100%';
					}

					$stops[] = array(
						'color'  => $color,
						'offset' => $offset,
					);
				}
			}

			if ( count( $stops ) >= 2 ) {
				// Simplify >3 stops to 3 (first, middle, last) for performance
				if ( count( $stops ) > 3 ) {
					$first  = $stops[0];
					$middle = $stops[ (int) floor( count( $stops ) / 2 ) ];
					$last   = $stops[ count( $stops ) - 1 ];

					$stops = array(
						$first,
						array( 'color' => $middle['color'], 'offset' => '50%' ),
						$last,
					);
				}

				return array(
					'type'  => 'linear',
					'stops' => $stops,
				);
			}
		}

		return self::$fallback_gradient;
	}

	// ───────────────────────────────────────────────
	// Color resolution
	// ───────────────────────────────────────────────

	/**
	 * Extract a color CSS var from WordPress class names.
	 *
	 * Priority: background-color classes are checked first, then text-color.
	 * This matches the resolve_line_color() priority chain where background
	 * takes precedence over text color for separator stroke rendering.
	 */
	private static function extract_color_from_classname( $class_name ) {
		if ( ! $class_name ) {
			return null;
		}

		// has-{color}-background-color
		if ( preg_match( '/has-([a-zA-Z0-9-]+)-background-color/', $class_name, $m ) ) {
			return 'var(--wp--preset--color--' . $m[1] . ')';
		}

		// has-{color}-color (text color, not background)
		if ( preg_match( '/has-([a-zA-Z0-9-]+)-color(?!\s*background)/', $class_name, $m ) ) {
			return 'var(--wp--preset--color--' . $m[1] . ')';
		}

		return null;
	}

	/**
	 * Resolve the line (stroke) color from block attributes.
	 *
	 * Returns an array: [ 'line_color' => string, 'gradient' => string|null, 'gradient_data' => array|null ]
	 */
	public static function resolve_line_color( $attrs ) {
		$gradient              = $attrs['gradient'] ?? null;
		$style                 = $attrs['style'] ?? array();
		$gradient_id           = $attrs['gradientId'] ?? null;
		$background_color      = $attrs['backgroundColor'] ?? null;
		$custom_bg_color       = $attrs['customBackgroundColor'] ?? null;
		$text_color            = $attrs['textColor'] ?? null;
		$custom_text_color     = $attrs['customTextColor'] ?? null;
		$class_name            = $attrs['className'] ?? '';

		$line_color    = 'currentColor';
		$final_gradient = null;
		$gradient_data  = null;

		// Check for gradient (highest priority)
		$custom_gradient = $gradient ?? ( $style['color']['gradient'] ?? null );

		if ( $custom_gradient ) {
			$validated_id = $gradient_id ? self::validate_id( $gradient_id ) : '';
			// Generate a runtime ID for legacy blocks saved without a gradient ID
			if ( ! $validated_id ) {
				$validated_id = 'gradient-' . substr( md5( $custom_gradient ), 0, 8 );
			}
			$final_gradient = $custom_gradient;
			$line_color     = 'url(#' . $validated_id . ')';
			$gradient_data  = self::parse_gradient( $custom_gradient );
			// Store validated ID for use in gradient defs
			$gradient_id    = $validated_id;
		}

		if ( ! $final_gradient ) {
			// Priority chain for solid colors
			if ( $background_color && preg_match( '/^[a-zA-Z0-9-]+$/', $background_color ) ) {
				$line_color = self::validate_color( 'var(--wp--preset--color--' . $background_color . ')' );
			} elseif ( $custom_bg_color ) {
				$line_color = self::validate_color( $custom_bg_color );
			} elseif ( ! empty( $style['color']['background'] ) ) {
				$line_color = self::validate_color( $style['color']['background'] );
			} else {
				$classname_color = self::extract_color_from_classname( $class_name );
				if ( $classname_color ) {
					$line_color = self::validate_color( $classname_color );
				} elseif ( $text_color && preg_match( '/^[a-zA-Z0-9-]+$/', $text_color ) ) {
					$line_color = self::validate_color( 'var(--wp--preset--color--' . $text_color . ')' );
				} elseif ( $custom_text_color ) {
					$line_color = self::validate_color( $custom_text_color );
				} elseif ( ! empty( $style['color']['text'] ) ) {
					$line_color = self::validate_color( $style['color']['text'] );
				}
			}
		}

		return array(
			'line_color'    => $line_color,
			'gradient'      => $final_gradient,
			'gradient_data' => $gradient_data,
		);
	}

	// ───────────────────────────────────────────────
	// Main render method
	// ───────────────────────────────────────────────

	/**
	 * Filter separator block content on frontend — generates full SVG from attributes.
	 *
	 * @param string $block_content The saved HTML (ignored for squiggle blocks).
	 * @param array  $block         The parsed block with blockName and attrs.
	 * @return string
	 */
	public static function render_block( $block_content, $block ) {
		if ( $block['blockName'] !== 'core/separator' ) {
			return $block_content;
		}

		$attrs      = $block['attrs'] ?? array();
		$class_name = $attrs['className'] ?? '';
		$class_name = implode( ' ', array_map( 'sanitize_html_class', explode( ' ', $class_name ) ) );

		// Only handle our custom styles
		$class_list = explode( ' ', $class_name );
		if ( ! array_intersect( $class_list, array( 'is-style-squiggle', 'is-style-zigzag', 'is-style-lightning', 'is-style-pixel' ) ) ) {
			return $block_content;
		}

		// Enqueue frontend styles on demand. block.json's "style" field handles
		// editor CSS loading, but this manual enqueue is needed for the frontend
		// because the plugin extends core/separator (not its own block type).
		if ( ! wp_style_is( 'awesome-squiggle-frontend', 'enqueued' ) ) {
			wp_enqueue_style(
				'awesome-squiggle-frontend',
				plugin_dir_url( dirname( __FILE__ ) ) . 'build/style-index.css',
				array(),
				AWESOME_SQUIGGLE_VERSION
			);
		}

		// ── Extract attributes with style-aware defaults ──

		$is_zigzag    = self::is_zigzag_style( $class_name );
		$is_lightning = self::is_lightning_style( $class_name );
		$is_pixel     = self::is_pixel_style( $class_name );

		$stroke_width = self::validate_numeric( $attrs['strokeWidth'] ?? null, 1, 8, $is_pixel ? 2 : 1 );
		$amplitude    = self::validate_numeric(
			$attrs['squiggleAmplitude'] ?? null,
			5, 25,
			( $is_zigzag || $is_lightning ) ? 15 : 10
		);
		$pointiness   = self::validate_numeric(
			$attrs['pointiness'] ?? null,
			0, 100,
			( $is_zigzag || $is_lightning ) ? 100 : 0
		);
		$angle        = self::validate_numeric(
			$attrs['angle'] ?? null,
			-60, 60,
			$is_lightning ? 40 : 0
		);

		$squiggle_height  = $attrs['squiggleHeight'] ?? '100px';
		$allowed_heights  = array( '50px', '75px', '100px', '125px', '150px', '200px' );
		if ( ! in_array( $squiggle_height, $allowed_heights, true ) ) {
			$squiggle_height = '100px';
		}
		$container_height = (int) $squiggle_height; // intval of "100px" = 100

		$animation_speed = self::validate_numeric( $attrs['animationSpeed'] ?? null, 0.5, 5, 2.5 );
		$is_animated     = $attrs['isAnimated'] ?? true;
		$is_reversed     = $attrs['isReversed'] ?? false;
		$animation_id    = self::validate_id( $attrs['animationId'] ?? '' );
		$gradient_id     = self::validate_id( $attrs['gradientId'] ?? '' );

		$is_paused      = ! $is_animated;
		$animation_name = $is_paused ? 'none' : ( $is_reversed ? 'wave-flow-reverse' : 'wave-flow' );

		// ── Generate wave path ──

		$wave_data    = $is_pixel
			? self::generate_pixel_wave_path( $amplitude, $pointiness, $angle, $stroke_width, 80, $container_height )
			: self::generate_long_wave_path( $amplitude, $pointiness, $angle, $stroke_width, 80, $container_height );
		$wave_path    = $wave_data['d'];
		$wave_height  = $wave_data['height'];
		$wavelength   = $wave_data['wavelength'];
		$viewbox_w    = $wavelength * 80;

		// ── Resolve color ──

		$color_result  = self::resolve_line_color( $attrs );
		$line_color    = $color_result['line_color'];
		$final_gradient = $color_result['gradient'];
		$gradient_data  = $color_result['gradient_data'];

		// ── Build class names ──

		$classes = array( 'wp-block-separator', 'awesome-squiggle-wave' );

		if ( ! empty( $attrs['align'] ) ) {
			$classes[] = 'align' . sanitize_html_class( $attrs['align'] );
		}

		// Add existing classes from className (avoiding duplicates)
		if ( $class_name ) {
			foreach ( explode( ' ', $class_name ) as $cls ) {
				$cls = trim( $cls );
				if ( $cls && ! in_array( $cls, $classes, true ) ) {
					$classes[] = sanitize_html_class( $cls );
				}
			}
		}

		// Preserve classes from $block_content that WordPress's layout system
		// may have already injected (e.g., wp-container-content-* for column span).
		// We're replacing the entire block HTML, so we need to carry these forward.
		if ( $block_content && preg_match( '/class="([^"]*)"/', $block_content, $existing_match ) ) {
			foreach ( explode( ' ', $existing_match[1] ) as $cls ) {
				$cls = trim( $cls );
				if ( $cls && ! in_array( $cls, $classes, true ) ) {
					$classes[] = $cls;
				}
			}
		}

		if ( $is_paused && ! in_array( 'is-paused', $classes, true ) ) {
			$classes[] = 'is-paused';
		}

		$combined_class = implode( ' ', array_unique( $classes ) );

		// ── Build inline styles for wrapper ──

		$wrapper_style = sprintf(
			'height:%s;background-color:transparent;--animation-duration:%ss;--animation-name:%s;',
			esc_attr( $squiggle_height ),
			esc_attr( $animation_speed ),
			esc_attr( $animation_name )
		);

		// ── Build gradient SVG defs ──

		$defs_html = '';
		if ( $final_gradient && $gradient_id ) {
			$gradient_span = 40;
			$stops_html    = '';

			if ( ! empty( $gradient_data['stops'] ) ) {
				foreach ( $gradient_data['stops'] as $stop ) {
					$validated_stop_color = self::validate_color( $stop['color'], '#000000' );
					$stops_html .= sprintf(
						'<stop offset="%s" stop-color="%s"/>',
						esc_attr( $stop['offset'] ),
						esc_attr( $validated_stop_color )
					);
				}
			} else {
				$stops_html = '<stop offset="0%" stop-color="#ff6b35"/><stop offset="100%" stop-color="#f7931e"/>';
			}

			$defs_html = sprintf(
				'<defs><linearGradient id="%s" gradientUnits="userSpaceOnUse" spreadMethod="reflect" x1="0" y1="0" x2="%d" y2="0">%s</linearGradient></defs>',
				esc_attr( $gradient_id ),
				$gradient_span,
				$stops_html
			);
		}

		// ── Build path animation style ──

		$path_style = $is_paused
			? 'animation:none;'
			: sprintf(
				'animation:%s %ss linear infinite;',
				esc_attr( $animation_name ),
				esc_attr( $animation_speed )
			);

		$path_class = 'wave-path';
		if ( $animation_id ) {
			$path_class .= ' wave-path-' . esc_attr( $animation_id );
		} else {
			$path_class .= ' wave-path-default';
		}

		// ── Assemble final HTML ──

		$html = sprintf(
			'<div class="%s" style="%s" role="separator" aria-label="%s">'
			. '<svg viewBox="0 0 %d %d" preserveAspectRatio="xMinYMid slice" aria-hidden="true" focusable="false" style="width:100%%;height:100%%;display:block;">'
			. '%s'
			. '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="%s" style="%s"/>'
			. '</svg>'
			. '</div>',
			esc_attr( $combined_class ),
			esc_attr( $wrapper_style ),
			esc_attr__( 'Decorative separator', 'awesome-squiggle' ),
			$viewbox_w,
			$wave_height,
			$defs_html,
			esc_attr( $wave_path ),
			esc_attr( $line_color ),
			esc_attr( $stroke_width ),
			esc_attr( $path_class ),
			esc_attr( $path_style )
		);

		return $html;
	}
}
