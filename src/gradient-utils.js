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
