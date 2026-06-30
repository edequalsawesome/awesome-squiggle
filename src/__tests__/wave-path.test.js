import { generateLongWavePath, generatePixelWavePath } from '../wave-path';

describe( 'wave-path generators', () => {
	it( 'long wave returns a path string and geometry', () => {
		const r = generateLongWavePath( 10, 0, 0, 1 );
		expect( typeof r.d ).toBe( 'string' );
		expect( r.d.startsWith( 'M' ) ).toBe( true );
		expect( r.wavelength ).toBe( 40 );
		expect( r.height ).toBe( 100 );
	} );

	it( 'pixel wave uses H/V staircase commands', () => {
		const r = generatePixelWavePath( 10, 0, 0, 2 );
		expect( r.d ).toMatch( / H-?\d/ );
	} );
} );
