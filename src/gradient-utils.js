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
 * Keep the existing conservative fast path: explicit percentage stops without
 * nested variables, interpolation hints, or alternate position syntax. Other
 * authored forms use the computed-style fallback. Current stop parsing also
 * supports implicit positions and CSS fixup, but widening this fast path is a
 * separate change from preserving gradient output.
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
		// an empty position or a single percentage. Keep this preset fast path
		// conservative even though the shared parser also reads double positions.
		// Lengths (`10px`, unitless `0`) still need browser resolution.
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
	// distributes evenly; retain the conservative explicit-position contract.
	for ( let i = 1; i < resolved.length - 1; i++ ) {
		if ( resolved[ i ] === '' ) {
			return false;
		}
	}

	// CSS runs a fix-up pass that advances any stop which would sit before its
	// predecessor, so `#f00 0%, #0f0 120%, #00f` paints its last stop at 120%,
	// not 100%. Although current parsing applies fixup, this fast
	// path remains limited to an already-nondecreasing sequence.
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

/**
 * Minimal linear-gradient → stops parser for editor previews.
 *
 * Mirrors the stop-extraction half of the PHP renderer's parse_gradient()
 * (includes/class-awesome-squiggle-renderer.php) so the editor SVG can render
 * the same gradient the frontend paints. Kept tiny and dependency-free so it
 * can be shared by block editors without dragging in a block's registration
 * side effects.
 * Unsupported/non-finite positions use the PHP renderer’s fallback gradient.
 * Returns [] for unrecognized gradients or no recognized colors, fallback stops
 * for rejected positions, and parsed stops otherwise. Colorless parts are skipped.
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
		const part = trimCssWhitespace( rawPart );

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

		// Only positions outside the matched color belong to the stop. Unsupported
		// positions reject the gradient; colorless parts still follow the skip above.
		const remainder = trimCssWhitespace(
			part.slice( colorMatch.index + colorMatch[ 1 ].length )
		);
		const positions =
			remainder === '' ? [ null ] : remainder.split( /[ \t\n\r\f]+/ );
		if (
			trimCssWhitespace( part.slice( 0, colorMatch.index ) ) !== '' ||
			positions.length > 2 ||
			positions.some(
				( position ) =>
					position !== null &&
					( ! /^(?:\d+(?:\.\d+)?|\.\d+)%$/.test( position ) ||
						! Number.isFinite( Number.parseFloat( position ) ) )
			)
		) {
			return [
				{ color: '#667eea', offset: '0%' },
				{ color: '#764ba2', offset: '100%' },
			];
		}
		for ( const offset of positions ) {
			stops.push( { color: colorMatch[ 1 ], offset } );
		}
	}

	return fixupStopPositions( stops );
}

/**
 * Match the PHP parser's CSS whitespace set, preserving non-ASCII characters.
 *
 * @param {string} value Part of a color stop.
 * @return {string} Value with CSS whitespace trimmed.
 */
function trimCssWhitespace( value ) {
	let start = 0;
	let end = value.length;
	while ( start < end && ' \t\n\r\f'.includes( value[ start ] ) ) {
		start++;
	}
	while ( end > start && ' \t\n\r\f'.includes( value[ end - 1 ] ) ) {
		end--;
	}
	return value.slice( start, end );
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
	let previousOffset = '0%';
	for ( const stop of fixedStops ) {
		if ( stop.offset === null ) {
			continue;
		}

		const position = Number.parseFloat( stop.offset );
		if ( position < previous ) {
			stop.offset = previousOffset;
		} else {
			previous = position;
			previousOffset = stop.offset;
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
				const candidate = formatOffset(
					start + ( end - start ) * ( runIndex / ( runLength + 1 ) )
				);
				const rounded = Number.parseFloat( candidate );
				let offset = candidate;
				if ( start === end || rounded < start ) {
					offset = fixedStops[ previousIndex ].offset;
				} else if ( rounded > end ) {
					offset = fixedStops[ index ].offset;
				}
				fixedStops[ previousIndex + runIndex ].offset = offset;
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
