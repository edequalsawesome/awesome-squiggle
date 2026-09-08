import { parseGradientStops } from '../gradient-utils';

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
