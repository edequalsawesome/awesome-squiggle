import { validateNumericInput } from './validators';

/**
 * Generate a long continuous wave path with many wavelengths
 * Uses The Outline's technique: a long path that extends beyond the viewBox
 * and gets clipped naturally - no pattern tiling seams
 *
 * @param {number} amplitude       - Wave height (5-25px)
 * @param {number} pointiness      - 0 = smooth curves (squiggle), 100 = sharp points (zigzag)
 * @param {number} angle           - Peak angle in degrees (-60 to +60)
 * @param {number} strokeWidth     - Line thickness (for padding calculation)
 * @param {number} repetitions     - Number of wavelengths to generate (default 50)
 * @param {number} containerHeight - Height of the container (default 100)
 * @return {Object} { d: string, height: number, wavelength: number, totalWidth: number }
 */
export const generateLongWavePath = (
	amplitude = 10,
	pointiness = 0,
	angle = 0,
	strokeWidth = 1,
	repetitions = 80,
	containerHeight = 100
) => {
	// Security: Validate all inputs
	amplitude = validateNumericInput( amplitude, 5, 25, 10 );
	pointiness = validateNumericInput( pointiness, 0, 100, 0 );
	angle = validateNumericInput( angle, -60, 60, 0 );
	strokeWidth = validateNumericInput( strokeWidth, 1, 8, 1 );

	const wavelength = 40;
	// Use the container height directly so viewBox matches container - no scaling issues
	const height = containerHeight;
	const midY = height / 2;
	const totalWidth = wavelength * repetitions;

	// Convert angle to radians for offset calculation
	const angleRad = ( angle * Math.PI ) / 180;
	const xOffset = amplitude * Math.sin( angleRad );
	const yMultiplier = Math.cos( angleRad );
	const adjustedAmplitude = amplitude * yMultiplier;

	// Start before the viewBox to ensure animation loops seamlessly
	const startX = -wavelength * 2;
	let d = `M${ startX },${ midY }`;

	// Generate many wavelengths
	for ( let i = 0; i < repetitions + 4; i++ ) {
		const baseX = startX + i * wavelength;
		const isUpPeak = i % 2 === 0;

		if ( pointiness >= 100 ) {
			// Pure zigzag: straight lines to peaks
			const peakX =
				baseX + wavelength / 2 + ( isUpPeak ? xOffset : -xOffset );
			const peakY = isUpPeak
				? midY - adjustedAmplitude
				: midY + adjustedAmplitude;
			const endX = baseX + wavelength;
			d += ` L${ peakX },${ peakY } L${ endX },${ midY }`;
		} else if ( pointiness <= 0 ) {
			// Pure squiggle: smooth cubic Bezier curves
			// Use original control point positions (0.375 and 0.625) for correct curve shape
			const peakY = isUpPeak
				? midY - adjustedAmplitude
				: midY + adjustedAmplitude;
			const cp1x = baseX + wavelength * 0.375;
			const cp2x = baseX + wavelength * 0.625;
			const endX = baseX + wavelength;
			d += ` C${ cp1x },${ peakY } ${ cp2x },${ peakY } ${ endX },${ midY }`;
		} else {
			// Hybrid: quadratic curves with variable tension
			const tension = pointiness / 100;
			const peakX =
				baseX +
				wavelength / 2 +
				( isUpPeak ? xOffset * tension : -xOffset * tension );
			const peakY = isUpPeak
				? midY - adjustedAmplitude
				: midY + adjustedAmplitude;
			const endX = baseX + wavelength;

			// Quadratic control points - blend between smooth (0.375/0.625) and sharp (0.5)
			const qcp1x = baseX + wavelength * ( 0.375 + tension * 0.125 );
			const qcp2x = baseX + wavelength * ( 0.625 - tension * 0.125 );

			d += ` Q${ qcp1x },${ peakY } ${ peakX },${ peakY }`;
			d += ` Q${ qcp2x },${ peakY } ${ endX },${ midY }`;
		}
	}

	return { d, height, wavelength, totalWidth };
};

/**
 * Generate a pixelated (8-bit / Scott Pilgrim) wave path.
 * Uses only horizontal and vertical line segments for a staircase pattern.
 *
 * @param {number} amplitude       - Wave height (5-25px)
 * @param {number} pointiness      - 0 = sine staircase, 100 = triangle staircase
 * @param {number} angle           - Peak angle in degrees (-60 to +60)
 * @param {number} strokeWidth     - Line thickness (unused in path math)
 * @param {number} repetitions     - Number of wavelengths (default 80)
 * @param {number} containerHeight - Container height (default 100)
 * @param          phase
 * @param          shift
 * @return {Object} { d, height, wavelength, totalWidth }
 */
// Warp a linear phase (0-1) to shift where peaks occur — creates lightning lean
const warpPhase = ( phase, shift ) => {
	if ( Math.abs( shift ) < 0.001 ) {
		return phase;
	}
	let mid = 0.5 - shift;
	mid = Math.max( 0.15, Math.min( 0.85, mid ) );

	if ( phase < mid ) {
		return ( phase / mid ) * 0.5;
	}
	return 0.5 + ( ( phase - mid ) / ( 1 - mid ) ) * 0.5;
};

export const generatePixelWavePath = (
	amplitude = 10,
	pointiness = 0,
	angle = 0,
	strokeWidth = 1,
	repetitions = 80,
	containerHeight = 100
) => {
	amplitude = validateNumericInput( amplitude, 5, 25, 10 );
	pointiness = validateNumericInput( pointiness, 0, 100, 0 );
	angle = validateNumericInput( angle, -60, 60, 0 );

	const pixelSize = 5;
	const wavelength = 40;
	const height = containerHeight;
	const midY = height / 2;
	const totalWidth = wavelength * repetitions;

	const angleRad = ( angle * Math.PI ) / 180;
	// Peak shift: how far to shift peak from center of wavelength
	const peakShift = Math.sin( angleRad ) * 0.3;

	const startX = -wavelength * 2;
	const endX = totalWidth + wavelength * 2;

	const quantizedMidY = Math.round( midY / pixelSize ) * pixelSize;
	let d = `M${ startX },${ quantizedMidY }`;
	let prevY = quantizedMidY;

	for ( let x = startX; x <= endX; x += pixelSize ) {
		// Linear phase within wavelength (0 to 1)
		const phaseNorm = ( ( x - startX ) % wavelength ) / wavelength;

		// Warp phase to shift peaks — creates asymmetric wave (lightning lean)
		const warped = warpPhase( phaseNorm, peakShift );

		// Convert to radians
		const phase = warped * 2 * Math.PI;

		// Sine wave (smooth)
		const sineY = Math.sin( phase );

		// Triangle wave (angular) — aligned with sine peaks
		const triPhase = ( warped + 0.25 ) % 1.0;
		const triangleY =
			triPhase < 0.5
				? 1 - 4 * Math.abs( triPhase - 0.25 )
				: -1 + 4 * Math.abs( triPhase - 0.75 );

		// Blend based on pointiness
		const tension = pointiness / 100;
		const waveY = ( 1 - tension ) * sineY + tension * triangleY;

		// Calculate Y and quantize to pixel grid
		const rawY = midY - amplitude * waveY;
		const quantizedY = Math.round( rawY / pixelSize ) * pixelSize;

		// Draw horizontal then vertical (staircase)
		if ( quantizedY !== prevY ) {
			d += ` H${ x } V${ quantizedY }`;
			prevY = quantizedY;
		}
	}

	// Final horizontal segment
	d += ` H${ endX }`;

	return { d, height, wavelength, totalWidth };
};
