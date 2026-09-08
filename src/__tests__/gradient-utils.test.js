import {
	parseGradientStops,
	presetSlugFromGradientValue,
	isParserSafeGradientCss,
} from '../gradient-utils';

describe( 'parseGradientStops', () => {
	it( 'rejects non-finite positions and interpolates large finite positions', () => {
		expect(
			parseGradientStops(
				`linear-gradient(#f00 0%, #0f0, #00f ${ '9'.repeat( 350 ) }%)`
			)
		).toEqual( [
			{ color: '#667eea', offset: '0%' },
			{ color: '#764ba2', offset: '100%' },
		] );
		const stops = parseGradientStops(
			`linear-gradient(#f00 0%, #0f0, #00f, #fff ${
				'1' + '0'.repeat( 308 )
			}%)`
		);
		expect( stops ).toHaveLength( 4 );
		for ( const stop of stops ) {
			expect( Number.isFinite( Number.parseFloat( stop.offset ) ) ).toBe(
				true
			);
		}
		expect( Number.parseFloat( stops[ 2 ].offset ) / 1e308 ).toBeCloseTo(
			2 / 3
		);
	} );
	it( 'returns [] for empty / non-string input', () => {
		expect( parseGradientStops( '' ) ).toEqual( [] );
		expect( parseGradientStops( null ) ).toEqual( [] );
		expect( parseGradientStops( undefined ) ).toEqual( [] );
		expect( parseGradientStops( 42 ) ).toEqual( [] );
	} );

	it( 'returns [] for a non-linear-gradient string', () => {
		expect( parseGradientStops( '#ff0000' ) ).toEqual( [] );
		expect( parseGradientStops( 'radial-gradient(#fff, #000)' ) ).toEqual(
			[]
		);
	} );

	it( 'parses hex stops and skips the direction token', () => {
		const stops = parseGradientStops(
			'linear-gradient(135deg, #ff0000 0%, #0000ff 100%)'
		);
		expect( stops ).toEqual( [
			{ color: '#ff0000', offset: '0%' },
			{ color: '#0000ff', offset: '100%' },
		] );
	} );

	it( 'parses rgb()/rgba() stops without splitting on inner commas', () => {
		const stops = parseGradientStops(
			'linear-gradient(135deg,rgba(6,147,227,1) 0%,rgb(155,81,224) 100%)'
		);
		expect( stops ).toEqual( [
			{ color: 'rgba(6,147,227,1)', offset: '0%' },
			{ color: 'rgb(155,81,224)', offset: '100%' },
		] );
	} );

	it( 'infers offsets when percentages are omitted', () => {
		const stops = parseGradientStops(
			'linear-gradient(135deg, #ff0000, #0000ff)'
		);
		expect( stops ).toEqual( [
			{ color: '#ff0000', offset: '0%' },
			{ color: '#0000ff', offset: '100%' },
		] );
	} );

	it( 'evenly distributes fully implicit positions', () => {
		const stops = parseGradientStops(
			'linear-gradient(90deg, #ff0000, #00ff00, #0000ff, #ffff00)'
		);

		const offsets = stops.map( ( stop ) =>
			Number.parseFloat( stop.offset )
		);
		expect( offsets[ 0 ] ).toBe( 0 );
		expect( offsets[ 1 ] ).toBeCloseTo( 33.333, 3 );
		expect( offsets[ 2 ] ).toBeCloseTo( 66.667, 3 );
		expect( offsets[ 3 ] ).toBe( 100 );
	} );

	it( 'fills implicit runs between their surrounding explicit positions', () => {
		const mixed = parseGradientStops(
			'linear-gradient(90deg, #ff0000 10%, #00ff00, #0000ff 70%, #ffff00)'
		);
		const run = parseGradientStops(
			'linear-gradient(90deg, #ff0000 0%, #00ff00, #0000ff, #ffff00, #ff00ff 100%)'
		);

		expect( mixed.map( ( stop ) => stop.offset ) ).toEqual( [
			'10%',
			'40%',
			'70%',
			'100%',
		] );
		expect( run.map( ( stop ) => stop.offset ) ).toEqual( [
			'0%',
			'25%',
			'50%',
			'75%',
			'100%',
		] );
	} );

	it( 'clamps descending explicit positions before filling gaps', () => {
		const stops = parseGradientStops(
			'linear-gradient(90deg, #ff0000 60%, #00ff00 40%, #0000ff 80%, #ffff00)'
		);

		expect( stops.map( ( stop ) => stop.offset ) ).toEqual( [
			'60%',
			'60%',
			'80%',
			'100%',
		] );
	} );

	it( 'handles a three-stop gradient', () => {
		const stops = parseGradientStops(
			'linear-gradient(135deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)'
		);
		expect( stops ).toHaveLength( 3 );
		expect( stops[ 1 ] ).toEqual( { color: '#00ff00', offset: '50%' } );
	} );

	it( 'keeps hsl() stops whose hue uses deg units', () => {
		// Regression: substring-matching "deg" used to drop these stops entirely.
		const stops = parseGradientStops(
			'linear-gradient(90deg, hsl(30deg 100% 50%) 0%, hsl(210deg 100% 40%) 100%)'
		);
		expect( stops ).toEqual( [
			{ color: 'hsl(30deg 100% 50%)', offset: '0%' },
			{ color: 'hsl(210deg 100% 40%)', offset: '100%' },
		] );
	} );

	it( 'reads the stop offset outside the color, not percentages inside it', () => {
		// Regression: rgb(100% 0% 0%) 25% used to yield offset "100%".
		const stops = parseGradientStops(
			'linear-gradient(135deg, rgb(100% 0% 0%) 25%, rgb(0% 0% 100%) 75%)'
		);
		expect( stops ).toEqual( [
			{ color: 'rgb(100% 0% 0%)', offset: '25%' },
			{ color: 'rgb(0% 0% 100%)', offset: '75%' },
		] );
	} );

	it( 'supports decimal stop offsets', () => {
		// Regression: /(\d+)%/ used to truncate "12.5%" to "5%".
		const stops = parseGradientStops(
			'linear-gradient(135deg, #ff0000 12.5%, #0000ff 87.5%)'
		);
		expect( stops ).toEqual( [
			{ color: '#ff0000', offset: '12.5%' },
			{ color: '#0000ff', offset: '87.5%' },
		] );
	} );
} );

describe( 'presetSlugFromGradientValue', () => {
	it( 'reads the slug out of a preset custom property', () => {
		expect(
			presetSlugFromGradientValue(
				'var(--wp--preset--gradient--vivid-cyan-blue-to-vivid-purple)'
			)
		).toBe( 'vivid-cyan-blue-to-vivid-purple' );
	} );

	it( 'passes a bare slug straight through', () => {
		expect( presetSlugFromGradientValue( 'cool-to-warm-spectrum' ) ).toBe(
			'cool-to-warm-spectrum'
		);
	} );

	it( 'returns null for a concrete gradient', () => {
		expect(
			presetSlugFromGradientValue( 'linear-gradient(135deg,#fff,#000)' )
		).toBeNull();
	} );

	it( 'returns null for a non-preset custom property', () => {
		expect(
			presetSlugFromGradientValue( 'var(--my-theme-gradient)' )
		).toBeNull();
	} );

	it( 'returns null for empty or non-string input', () => {
		expect( presetSlugFromGradientValue( '' ) ).toBeNull();
		expect( presetSlugFromGradientValue( null ) ).toBeNull();
		expect( presetSlugFromGradientValue( undefined ) ).toBeNull();
		expect( presetSlugFromGradientValue( 42 ) ).toBeNull();
	} );
} );

describe( 'isParserSafeGradientCss', () => {
	it( 'accepts a two-stop authored gradient', () => {
		expect(
			isParserSafeGradientCss(
				'linear-gradient(135deg,rgb(6,147,227) 0%,rgb(155,81,224) 100%)'
			)
		).toBe( true );
		expect(
			isParserSafeGradientCss( 'linear-gradient(135deg,#0693e3,#9b51e0)' )
		).toBe( true );
	} );

	// A preset built on color tokens: the browser resolves the nested var(),
	// our stop regex does not, so it must fall through to computed style.
	it( 'rejects a gradient containing a nested var()', () => {
		expect(
			isParserSafeGradientCss(
				'linear-gradient(135deg,var(--wp--preset--color--primary) 0%,#000 100%)'
			)
		).toBe( false );
	} );

	// Keep multiline presets on the existing computed-style fallback.
	it( 'rejects a multiline gradient', () => {
		expect(
			isParserSafeGradientCss(
				'linear-gradient(\n135deg,\n#0693e3 0%,\n#9b51e0 100%\n)'
			)
		).toBe( false );
	} );

	// Preserve the conservative preset fast path for implicit multi-stop gradients.
	it( 'rejects 3+ stops without explicit percentages', () => {
		expect(
			isParserSafeGradientCss(
				'linear-gradient(90deg,#ff0000,#00ff00,#0000ff)'
			)
		).toBe( false );
	} );

	// Percentage color channels contribute their own % tokens; counting them
	// across the whole string would let this offset-less gradient through.
	it( 'rejects 3+ stops whose only percentages are color channels', () => {
		expect(
			isParserSafeGradientCss(
				'linear-gradient(rgb(100% 0% 0%),rgb(0% 100% 0%),rgb(0% 0% 100%))'
			)
		).toBe( false );
	} );

	it( 'accepts 3+ stops when every position is explicit', () => {
		expect(
			isParserSafeGradientCss(
				'linear-gradient(90deg,#ff0000 0%,#00ff00 50%,#0000ff 100%)'
			)
		).toBe( true );
	} );

	it( 'rejects url(), non-linear gradients, and junk', () => {
		expect(
			isParserSafeGradientCss(
				'linear-gradient(135deg,#fff 0%,#000 100%),url(https://x.test/a.png)'
			)
		).toBe( false );
		expect( isParserSafeGradientCss( 'radial-gradient(#fff,#000)' ) ).toBe(
			false
		);
		expect(
			isParserSafeGradientCss( 'linear-gradient(135deg,#fff)' )
		).toBe( false );
	} );

	it( 'rejects a stop carrying two offsets (double-position hard stop)', () => {
		// parseGradientStops keeps only the first offset, so the 25% hard stop
		// would be silently dropped and the preview would not match the render.
		expect(
			isParserSafeGradientCss(
				'linear-gradient(90deg,#f00 0% 25%,#0f0 50%,#00f 100%)'
			)
		).toBe( false );
	} );

	it( 'rejects a middle stop with no offset', () => {
		// Keep implicit middle stops on the fallback. Use a single-position
		// first stop so the double-position guard cannot mask this rule.
		expect(
			isParserSafeGradientCss(
				'linear-gradient(90deg,#f00 0%,#0f0,#00f 100%)'
			)
		).toBe( false );
	} );

	it( 'rejects color interpolation hints', () => {
		// A bare position between two colors shifts the midpoint. Both this
		// guard and parseGradientStops skip colorless parts, so honouring the
		// gradient means refusing it rather than silently dropping the hint.
		expect(
			isParserSafeGradientCss( 'linear-gradient(#f00,30%,#0f0 50%,#00f)' )
		).toBe( false );
		expect(
			isParserSafeGradientCss( 'linear-gradient(#f00,30%,#00f)' )
		).toBe( false );
		// A leading direction token is not a hint and must still pass.
		expect(
			isParserSafeGradientCss( 'linear-gradient(135deg,#f00,#00f)' )
		).toBe( true );
		expect(
			isParserSafeGradientCss( 'linear-gradient(to bottom,#f00,#00f)' )
		).toBe( true );
	} );

	it( 'rejects stop positions CSS fix-up would move', () => {
		// Preserve fallback selection for presets requiring position fix-up.
		expect(
			isParserSafeGradientCss( 'linear-gradient(#f00 0%,#0f0 120%,#00f)' )
		).toBe( false );
		expect(
			isParserSafeGradientCss( 'linear-gradient(#f00,#0f0 80%,#00f 20%)' )
		).toBe( false );
		// Nondecreasing beyond 100% needs no fix-up, so it stays faithful.
		expect(
			isParserSafeGradientCss(
				'linear-gradient(#f00 0%,#0f0 120%,#00f 150%)'
			)
		).toBe( true );
	} );

	it( 'rejects three offset-less stops with percentage color channels', () => {
		// Nine percent tokens live inside the colors; none is an offset.
		expect(
			isParserSafeGradientCss(
				'linear-gradient(rgb(100% 0% 0%),rgb(0% 100% 0%),rgb(0% 0% 100%))'
			)
		).toBe( false );
	} );

	it( 'rejects length positions the percentage-only parser cannot read', () => {
		// Percentage interpolation cannot preserve a browser's length offsets.
		expect(
			isParserSafeGradientCss( 'linear-gradient(#f00,#0f0 10px)' )
		).toBe( false );
		expect(
			isParserSafeGradientCss(
				'linear-gradient(90deg,#f00 0,#0f0 10px,#00f 100%)'
			)
		).toBe( false );
		// Unitless zero is a valid length position, and equally unreadable.
		expect(
			isParserSafeGradientCss( 'linear-gradient(#f00 0,#00f 100%)' )
		).toBe( false );
	} );

	it( 'still accepts offset-less two-stop gradients', () => {
		// Both stops are at an end, where the parser's 0%/100% default is
		// exactly what the browser computes.
		expect( isParserSafeGradientCss( 'linear-gradient(#f00,#00f)' ) ).toBe(
			true
		);
		expect(
			isParserSafeGradientCss( 'linear-gradient(135deg,#f00,#00f)' )
		).toBe( true );
	} );

	it( 'still accepts fully-offset multi-stop gradients', () => {
		expect(
			isParserSafeGradientCss(
				'linear-gradient(90deg,#f00 0%,#0f0 50%,#00f 100%)'
			)
		).toBe( true );
	} );

	it( 'rejects non-string and empty values', () => {
		expect( isParserSafeGradientCss( '' ) ).toBe( false );
		expect( isParserSafeGradientCss( null ) ).toBe( false );
		expect( isParserSafeGradientCss( undefined ) ).toBe( false );
		expect( isParserSafeGradientCss( 42 ) ).toBe( false );
		expect( isParserSafeGradientCss( {} ) ).toBe( false );
	} );
} );
