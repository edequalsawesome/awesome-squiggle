import { parseGradientStops } from '../gradient-utils';

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
