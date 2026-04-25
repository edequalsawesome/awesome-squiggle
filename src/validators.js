// Defensive cap on validateColorValue input length. This is a pathology
// guard, NOT a tightness check — the regex matrix already validates the
// allowed grammar with anchored, linear-time patterns. WordPress theme.json
// preset slugs have no defined max length, so a low cap (e.g. 200) would
// silently regress legitimate var(--wp--preset--color--<long-slug>) values
// from verbose design-token namespaces. 4096 chars is far beyond any
// realistic preset value but well below "10kb of garbage" pathological
// inputs that would still benefit from a short-circuit.
const MAX_COLOR_LENGTH = 4096;

// Development-only logging — only emits in development builds.
export const debugLog = ( message, ...args ) => {
	if ( process.env.NODE_ENV === 'development' ) {
		// eslint-disable-next-line no-console
		console.log( '[Awesome Squiggle]', message, ...args );
	}
};

// Clamp a numeric value to [min, max], returning defaultValue for non-numbers and NaN.
// Note: Infinity / -Infinity are valid `typeof number` and pass the NaN check, so they get clamped.
export const validateNumericInput = ( value, min, max, defaultValue ) => {
	if ( typeof value !== 'number' || isNaN( value ) ) {
		return defaultValue;
	}
	return Math.max( min, Math.min( max, value ) );
};

// Truncate to maxLength and optionally validate against a regex pattern.
// Returns '' for non-strings or pattern mismatch (after truncation).
//
// Stateful regexes (g / y flags) are normalized to a non-stateful copy before
// .test() — RegExp.prototype.test advances lastIndex on global/sticky patterns,
// which would make repeated validations alternate pass/fail. Current in-repo
// callers all pass non-stateful patterns, but this is a public named export.
export const validateStringInput = (
	value,
	allowedPattern,
	maxLength = 100
) => {
	if ( typeof value !== 'string' ) {
		return '';
	}

	const truncated = value.substring( 0, maxLength );

	if ( allowedPattern ) {
		const safePattern =
			allowedPattern.global || allowedPattern.sticky
				? new RegExp(
						allowedPattern.source,
						allowedPattern.flags.replace( /[gy]/g, '' )
				  )
				: allowedPattern;

		if ( ! safePattern.test( truncated ) ) {
			return '';
		}
	}

	return truncated;
};

// IDs (animation, gradient): alphanumeric, dash, underscore only. Max 50 chars.
export const validateId = ( id ) => {
	const allowedPattern = /^[a-zA-Z0-9_-]+$/;
	return validateStringInput( id, allowedPattern, 50 );
};

/**
 * Validate a CSS color value. Accepts: currentColor, hex (3/4/6/8), rgb(a), hsl(a),
 * var(--wp--preset--{color|gradient}--{slug}), and url(#localId).
 * Returns fallback for anything else.
 *
 * Inputs longer than MAX_COLOR_LENGTH (4096 chars) are rejected outright
 * without running the regex tests — pathology guard for genuinely huge
 * payloads, NOT a tightness check on legitimate values. The cap is set
 * far above any realistic CSS color value (WP preset slugs have no
 * defined max length, so we leave generous headroom). Note: the length
 * check measures the RAW input before trimming, so a 4097-char value
 * with leading whitespace is rejected at the gate.
 *
 * Surrounding whitespace is trimmed before validation; the trimmed value is
 * what is returned on success. Callers comparing input vs output for equality
 * should account for this.
 *
 * @param {*}      color    Candidate color value.
 * @param {string} fallback Returned when validation fails. Defaults to
 *                          'currentColor', which inherits the surrounding
 *                          text color and is the safest choice for users in
 *                          forced-colors / dark / high-contrast modes.
 *                          Override only when the calling context guarantees
 *                          a specific intent (e.g., a transparent default).
 */
export const validateColorValue = ( color, fallback = 'currentColor' ) => {
	if (
		typeof color !== 'string' ||
		! color ||
		color.length > MAX_COLOR_LENGTH
	) {
		if ( typeof color === 'string' && color.length > MAX_COLOR_LENGTH ) {
			debugLog(
				'⚠️ Rejected color value exceeding length cap:',
				`${ color.length } chars (max ${ MAX_COLOR_LENGTH })`
			);
		}
		return fallback;
	}

	const trimmed = color.trim();

	if ( trimmed === 'currentColor' ) {
		return trimmed;
	}

	if (
		/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
			trimmed
		)
	) {
		return trimmed;
	}

	if ( /^rgba?\(\s*[\d.%,\s/]+\s*\)$/.test( trimmed ) ) {
		return trimmed;
	}

	if ( /^hsla?\(\s*[\d.%,\s/deg]+\s*\)$/.test( trimmed ) ) {
		return trimmed;
	}

	// Strict: only WP preset color/gradient custom properties — prevents var() injection.
	if (
		/^var\(--wp--preset--(color|gradient)--[a-zA-Z0-9-]+\)$/.test( trimmed )
	) {
		return trimmed;
	}

	// Local gradient references only.
	if ( /^url\(#[a-zA-Z0-9_-]+\)$/.test( trimmed ) ) {
		return trimmed;
	}

	debugLog( '⚠️ Rejected invalid color value:', trimmed );
	return fallback;
};
