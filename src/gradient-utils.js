/**
 * Minimal linear-gradient → stops parser for editor previews.
 *
 * Mirrors the stop-extraction half of the PHP renderer's parse_gradient()
 * (includes/class-awesome-squiggle-renderer.php) so the editor SVG can render
 * the same gradient the frontend paints. Kept tiny and dependency-free so it
 * can be shared by block editors without dragging in a block's registration
 * side effects.
 *
 * @param {string} css A concrete `linear-gradient(...)` CSS string.
 * @return {Array<{color: string, offset: string}>} Ordered color stops (possibly empty).
 */
/**
 * Extract a preset gradient slug from a block's stored gradient value.
 *
 * Accepts either a bare slug ("vivid-cyan-blue-to-vivid-purple") or a preset
 * custom property reference ("var(--wp--preset--gradient--<slug>)"). Anything
 * else — a concrete gradient, a non-preset custom property — returns null.
 *
 * @param {string} value Stored gradient attribute value.
 * @return {string|null} The preset slug, or null.
 */
export function presetSlugFromGradientValue( value ) {
	if ( ! value || typeof value !== 'string' ) {
		return null;
	}

	const trimmed = value.trim();

	const varMatch = trimmed.match(
		/^var\(\s*--wp--preset--gradient--([^)\s]+)\s*\)$/
	);
	if ( varMatch ) {
		return varMatch[ 1 ];
	}

	if ( ! trimmed.includes( 'gradient(' ) && ! trimmed.startsWith( 'var(' ) ) {
		return trimmed;
	}

	return null;
}

/**
 * Is this authored gradient CSS safe to use instead of a computed-style read?
 *
 * theme.json hands back the string the theme AUTHORED. getComputedStyle hands
 * back a browser-NORMALIZED string. They are not interchangeable, and the
 * places they differ are exactly where this codebase's parser breaks:
 *
 * - a nested var() (a preset referencing a color token) is resolved by the
 *   browser but not by our stop regex, which would silently drop every stop
 * - a newline survives authoring but our stop regex has no dot-all flag
 * - three or more stops without explicit percentages get positions filled in
 *   by the browser; our offset inference assigns 100% to every stop past the
 *   first, collapsing them
 * - url() has no business here at all
 *
 * Rejecting these is not a loss: the caller falls through to the computed-style
 * path, which is exactly what it did before the fast path existed.
 *
 * @param {string} css Authored gradient CSS from editor settings.
 * @return {boolean} True when the authored form parses like the computed one.
 */
export function isParserSafeGradientCss( css ) {
	if ( ! css || typeof css !== 'string' ) {
		return false;
	}

	if ( ! css.startsWith( 'linear-gradient(' ) ) {
		return false;
	}

	if ( /url\(|var\(/i.test( css ) || /[\r\n]/.test( css ) ) {
		return false;
	}

	const inner = css.match( /linear-gradient\((.*)\)$/s );
	if ( ! inner ) {
		return false;
	}

	// Walk the stops exactly the way parseGradientStops does, and accept only
	// what it can represent faithfully. Counting offsets across the whole
	// string is not enough: a percentage-channel color like rgb(100% 0% 0%)
	// contributes percentages of its own, and an aggregate count cannot tell
	// `#f00 0% 25%, #0f0, #00f 100%` (one stop with two offsets, one with
	// none) from three evenly-offset stops.
	const COLOR = /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/;
	const stops = [];
	let seenColor = false;
	for ( const rawPart of splitTopLevel( inner[ 1 ] ) ) {
		const part = rawPart.trim();
		const colorMatch = part.match( COLOR );
		if ( ! colorMatch ) {
			// Before any color this is a direction token ("135deg",
			// "to bottom"), which the parser skips harmlessly. After one it is
			// a color interpolation hint — a bare position that shifts the
			// midpoint between its neighbours. The parser skips that too, and
			// dropping it changes the gradient.
			if ( seenColor ) {
				return false;
			}
			continue;
		}
		seenColor = true;
		// Whatever is left after the color IS the stop position. Accept only
		// an empty position or a single percentage, because those are the only
		// forms parseGradientStops reads. linear-gradient() also takes lengths
		// (`10px`, unitless `0`) and double positions (`0% 25%`); the parser's
		// percentage-only regex finds nothing in a length and falls back to its
		// 0%/100% default, which silently disagrees with the browser.
		const position = part.replace( colorMatch[ 1 ], '' ).trim();
		if ( position !== '' && ! /^\d+(?:\.\d+)?%$/.test( position ) ) {
			return false;
		}
		stops.push( position );
	}

	if ( stops.length < 2 ) {
		return false;
	}

	// Fill the ends the parser defaults, then judge the sequence as a whole.
	const resolved = stops.slice();
	if ( resolved[ 0 ] === '' ) {
		resolved[ 0 ] = '0%';
	}
	if ( resolved[ resolved.length - 1 ] === '' ) {
		resolved[ resolved.length - 1 ] = '100%';
	}

	// A missing position is only safe at those ends. In the middle the browser
	// distributes evenly while the parser guesses 100%.
	for ( let i = 1; i < resolved.length - 1; i++ ) {
		if ( resolved[ i ] === '' ) {
			return false;
		}
	}

	// CSS runs a fix-up pass that advances any stop which would sit before its
	// predecessor, so `#f00 0%, #0f0 120%, #00f` paints its last stop at 120%,
	// not the 100% the parser assumes. The parser has no fix-up, so only an
	// already-nondecreasing sequence is reproduced faithfully.
	let previous = -Infinity;
	for ( const position of resolved ) {
		const value = parseFloat( position );
		if ( value < previous ) {
			return false;
		}
		previous = value;
	}

	return true;
}

export function parseGradientStops( css ) {
	if ( ! css || typeof css !== 'string' ) {
		return [];
	}

	const match = css.match( /linear-gradient\((.*)\)$/s );
	if ( ! match ) {
		return [];
	}

	const stops = [];
	for ( const rawPart of splitTopLevel( match[ 1 ] ) ) {
		const part = rawPart.trim();

		// Parts without a color token (direction tokens like "135deg" /
		// "to bottom") are skipped. Checking for the color FIRST — instead of
		// substring-matching "deg" — keeps valid stops like
		// hsl(30deg 100% 50%) from being dropped.
		const colorMatch = part.match(
			/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/
		);
		if ( ! colorMatch ) {
			continue;
		}

		// Match the stop position in the part WITH THE COLOR REMOVED, so
		// percentages inside the color function (rgb(100% 0% 0%)) are not
		// mistaken for the offset. Supports decimal offsets (12.5%).
		const remainder = part.replace( colorMatch[ 1 ], '' );
		const pctMatch = remainder.match( /(\d+(?:\.\d+)?)%/ );
		let offset;
		if ( pctMatch ) {
			offset = `${ pctMatch[ 1 ] }%`;
		} else {
			offset = stops.length === 0 ? '0%' : '100%';
		}
		stops.push( { color: colorMatch[ 1 ], offset } );
	}

	return stops;
}

/**
 * Split a comma-separated list while respecting parenthesis depth, so commas
 * inside rgb()/hsl() are not treated as separators.
 *
 * @param {string} content The contents inside `linear-gradient( … )`.
 * @return {string[]} Top-level comma-separated parts.
 */
function splitTopLevel( content ) {
	const parts = [];
	let current = '';
	let depth = 0;

	for ( const ch of content ) {
		if ( ch === '(' ) {
			depth++;
		}
		if ( ch === ')' ) {
			depth--;
		}
		if ( ch === ',' && depth === 0 ) {
			parts.push( current );
			current = '';
		} else {
			current += ch;
		}
	}

	if ( current.trim() !== '' ) {
		parts.push( current );
	}

	return parts;
}
