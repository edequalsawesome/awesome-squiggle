import {
	parseGradientStops,
	presetSlugFromGradientValue,
	isParserSafeGradientCss,
} from '../gradient-utils';

describe( 'parseGradientStops', () => {
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

	// The stop regex has no dot-all flag, so a newline breaks parsing.
	it( 'rejects a multiline gradient', () => {
		expect(
			isParserSafeGradientCss(
				'linear-gradient(\n135deg,\n#0693e3 0%,\n#9b51e0 100%\n)'
			)
		).toBe( false );
	} );

	// Offset inference assigns 100% to every stop past the first, which
	// collapses three implicit stops onto the same position.
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

	it( 'rejects non-string and empty values', () => {
		expect( isParserSafeGradientCss( '' ) ).toBe( false );
		expect( isParserSafeGradientCss( null ) ).toBe( false );
		expect( isParserSafeGradientCss( undefined ) ).toBe( false );
		expect( isParserSafeGradientCss( 42 ) ).toBe( false );
		expect( isParserSafeGradientCss( {} ) ).toBe( false );
	} );
} );
