/**
 * Minimal linear-gradient → stops parser for editor previews.
 *
 * Mirrors the stop-extraction half of the PHP renderer's parse_gradient()
 * (includes/class-awesome-squiggle-renderer.php) so the editor SVG can render
 * the same gradient the frontend paints. Kept tiny and dependency-free so it
 * can be shared by block editors without dragging in a block's registration
 * side effects.
 * Non-finite positions use the same fallback gradient as the PHP renderer.
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
		if ( pctMatch && ! Number.isFinite( Number( pctMatch[ 1 ] ) ) ) {
			return [
				{ color: '#667eea', offset: '0%' },
				{ color: '#764ba2', offset: '100%' },
			];
		}
		stops.push( {
			color: colorMatch[ 1 ],
			offset: pctMatch ? `${ pctMatch[ 1 ] }%` : null,
		} );
	}

	return fixupStopPositions( stops );
}

/**
 * Apply the CSS Images color-stop position fixup rules to parsed percentages.
 *
 * @param {Array<{color: string, offset: string|null}>} stops Parsed stops.
 * @return {Array<{color: string, offset: string}>} Stops with usable positions.
 */
function fixupStopPositions( stops ) {
	if ( stops.length === 0 ) {
		return stops;
	}

	const fixedStops = stops.map( ( stop ) => ( { ...stop } ) );
	const lastIndex = fixedStops.length - 1;
	if ( fixedStops[ 0 ].offset === null ) {
		fixedStops[ 0 ].offset = '0%';
	}
	if ( fixedStops[ lastIndex ].offset === null ) {
		fixedStops[ lastIndex ].offset = '100%';
	}

	let previous = 0;
	for ( const stop of fixedStops ) {
		if ( stop.offset === null ) {
			continue;
		}

		const position = Number.parseFloat( stop.offset );
		if ( position < previous ) {
			stop.offset = formatOffset( previous );
		} else {
			previous = position;
		}
	}

	let previousIndex = 0;
	for ( let index = 1; index <= lastIndex; index++ ) {
		if ( fixedStops[ index ].offset === null ) {
			continue;
		}

		const runLength = index - previousIndex - 1;
		if ( runLength > 0 ) {
			const start = Number.parseFloat(
				fixedStops[ previousIndex ].offset
			);
			const end = Number.parseFloat( fixedStops[ index ].offset );
			for ( let runIndex = 1; runIndex <= runLength; runIndex++ ) {
				fixedStops[ previousIndex + runIndex ].offset = formatOffset(
					start + ( end - start ) * ( runIndex / ( runLength + 1 ) )
				);
			}
		}
		previousIndex = index;
	}

	return fixedStops;
}

/**
 * @param {number} position A percentage value.
 * @return {string} A stable percentage string.
 */
function formatOffset( position ) {
	return `${ Number( position.toFixed( 3 ) ) }%`;
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
