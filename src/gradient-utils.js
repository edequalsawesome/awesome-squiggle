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

	const colors = css.match(
		/rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}/g
	);
	if ( ! colors || colors.length < 2 ) {
		return false;
	}

	const percentages = css.match( /\d+(?:\.\d+)?%/g );
	if ( colors.length > 2 && ( percentages || [] ).length < colors.length ) {
		return false;
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
