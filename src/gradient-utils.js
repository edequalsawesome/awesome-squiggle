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

		// Skip the direction token (e.g. "135deg", "to bottom").
		if ( part.includes( 'deg' ) || part.includes( 'to ' ) ) {
			continue;
		}

		const colorMatch = part.match(
			/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/
		);
		if ( ! colorMatch ) {
			continue;
		}

		const pctMatch = part.match( /(\d+)%/ );
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
