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
export const validateStringInput = (
	value,
	allowedPattern,
	maxLength = 100
) => {
	if ( typeof value !== 'string' ) {
		return '';
	}

	value = value.substring( 0, maxLength );

	if ( allowedPattern && ! allowedPattern.test( value ) ) {
		return '';
	}

	return value;
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
	if ( typeof color !== 'string' || ! color ) {
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
