/**
 * Frontend JavaScript for Awesome Squiggle
 * Handles dynamic sparkle generation based on container width
 */

( function() {
	'use strict';

	// Helper function to generate sparkle elements dynamically
	function generateSparkleElements( sparkleSize, verticalAmplitude, containerWidth, isAnimated, randomness ) {
		const spacing = 50;
		const height = 100;
		const midY = height / 2;
		const sparkleElements = [];
		let sparkleIndex = 0;

		// Calculate effective container boundaries to avoid half-sparkles
		const sparkleRadius = sparkleSize; // Maximum extent of a sparkle from its center
		const effectiveStart = sparkleRadius; // Start far enough from edge
		const effectiveEnd = containerWidth - sparkleRadius; // End far enough from edge
		
		// Only generate sparkles if we have enough space
		if ( effectiveEnd <= effectiveStart ) {
			// Container too small for sparkles, return empty array
			return sparkleElements;
		}

		// Generate sparkles with proper boundaries to avoid half-sparkles
		for ( let x = effectiveStart; x <= effectiveEnd; x += spacing ) {
			// Create Y variation based on vertical amplitude
			const waveFrequency = 0.008;
			const offsetY = Math.sin( x * waveFrequency ) * verticalAmplitude;
			const sparkleY = midY + offsetY;

			// Create a 4-pointed star sparkle shape
			const size = sparkleSize;
			const innerSize = size * 0.3;
			const rotation = 0;

			// Calculate points for a 4-pointed star
			const points = [];
			for ( let i = 0; i < 8; i++ ) {
				const angle = ( Math.PI * 2 * i ) / 8 + ( rotation * Math.PI ) / 180;
				const radius = i % 2 === 0 ? size : innerSize;
				const px = x + Math.cos( angle ) * radius;
				const py = sparkleY + Math.sin( angle ) * radius;
				points.push( `${ px },${ py }` );
			}

			// Calculate timing for twinkling animation
			const seed = ( x + sparkleIndex * 17 ) % 1600;
			const randScale = Math.max(0, Math.min(200, typeof randomness === 'number' ? randomness : 100)) / 100;
			const delayMs = Math.round(seed * randScale);
			const durationMs = 1200 + Math.round((( sparkleIndex * 67 ) % 800) * randScale);

			sparkleElements.push( {
				points: points.join( ' ' ),
				delay: delayMs,
				duration: durationMs,
				isAnimated: isAnimated
			} );

			sparkleIndex++;
		}

		return sparkleElements;
	}

	// Function to update sparkles for a specific container
    function updateSparkles( container ) {
        const svg = container.querySelector( 'svg' );
        const sparkleGroup = svg.querySelector( '.sparkle-group' );
		
		if ( ! sparkleGroup ) {
			return; // Not a sparkle separator
		}

		// Get actual container width
		const containerWidth = container.offsetWidth;
		
		// Get attributes from data attributes or defaults
		const sparkleSize = parseInt( container.dataset.sparkleSize ) || 18;
		const verticalAmplitude = parseInt( container.dataset.sparkleVerticalAmplitude ) || 15;
		const isAnimated = ! container.classList.contains( 'is-style-static-sparkle' );
		const animationSpeedSec = Math.max(0.5, Math.min(5, parseFloat(container.dataset.animationSpeed) || 1.6));
		const isPaused = container.classList.contains( 'is-paused' );
		const randomness = parseInt( container.dataset.sparkleRandomness ) || 100;

		// Calculate appropriate viewBox width based on container width
		// Add extra width to ensure smooth animation
		const viewBoxWidth = Math.max( 800, containerWidth + 100 );
		svg.setAttribute( 'viewBox', `0 0 ${ viewBoxWidth } 100` );

		// Generate new sparkle elements
		const sparkleElements = generateSparkleElements( 
			sparkleSize, 
			verticalAmplitude, 
			viewBoxWidth, 
			isAnimated && ! isPaused,
			randomness
		);

		// Clear existing sparkles
		sparkleGroup.innerHTML = '';

		// Add new sparkles
        sparkleElements.forEach( ( sparkle, index ) => {
            const polygon = document.createElementNS( 'http://www.w3.org/2000/svg', 'polygon' );
            polygon.setAttribute( 'points', sparkle.points );
            polygon.setAttribute( 'class', 'sparkle-element' );
            
            if ( sparkle.isAnimated ) {
                // Scale duration around the chosen animation speed from the editor
                // Base prior behavior used ~1600ms average; scale proportionally
                const baseAvg = 1600; // ms
                const scale = animationSpeedSec * 1000 / baseAvg;
                const scaledDuration = Math.max(300, Math.round(sparkle.duration * scale));
                polygon.style.animationName = 'sparkle-shimmer';
                polygon.style.animationTimingFunction = 'ease-in-out';
                polygon.style.animationIterationCount = 'infinite';
                polygon.style.animationDuration = `${ scaledDuration }ms`;
                polygon.style.animationDelay = `${ sparkle.delay }ms`;
            } else {
                polygon.style.opacity = '0.8';
                polygon.style.transform = 'scale(1)';
            }
            
            sparkleGroup.appendChild( polygon );
        } );
	}

	// Function to handle all sparkle separators
	function handleAllSparkles() {
		const sparkleContainers = document.querySelectorAll( 
			'.wp-block-separator.is-style-animated-sparkle, .wp-block-separator.is-style-static-sparkle' 
		);

		sparkleContainers.forEach( updateSparkles );
	}

	// Initialize on DOM ready
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', handleAllSparkles );
	} else {
		handleAllSparkles();
	}

	// Handle window resize with debouncing
	let resizeTimeout;
	window.addEventListener( 'resize', function() {
		clearTimeout( resizeTimeout );
		resizeTimeout = setTimeout( handleAllSparkles, 250 );
	} );

	// Handle dynamic content changes (e.g., in block editor)
	if ( typeof wp !== 'undefined' && wp.domReady ) {
		wp.domReady( handleAllSparkles );
	}

	// Expose function globally for potential use by other scripts
	window.awesomeSquiggleUpdateSparkles = handleAllSparkles;

} )();
