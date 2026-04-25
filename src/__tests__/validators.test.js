import {
	debugLog,
	validateNumericInput,
	validateStringInput,
	validateId,
	validateColorValue,
} from '../validators';

describe( 'validateNumericInput', () => {
	it( 'returns in-range integers unchanged', () => {
		expect( validateNumericInput( 5, 0, 10, 0 ) ).toBe( 5 );
	} );

	it( 'returns in-range floats unchanged', () => {
		expect( validateNumericInput( 3.14, 0, 10, 0 ) ).toBe( 3.14 );
	} );

	it( 'allows the exact min boundary', () => {
		expect( validateNumericInput( 0, 0, 10, 5 ) ).toBe( 0 );
	} );

	it( 'allows the exact max boundary', () => {
		expect( validateNumericInput( 10, 0, 10, 5 ) ).toBe( 10 );
	} );

	it( 'clamps values below min', () => {
		expect( validateNumericInput( -5, 0, 10, 5 ) ).toBe( 0 );
	} );

	it( 'clamps values above max', () => {
		expect( validateNumericInput( 99, 0, 10, 5 ) ).toBe( 10 );
	} );

	it( 'supports negative ranges', () => {
		expect( validateNumericInput( -30, -60, 60, 0 ) ).toBe( -30 );
		expect( validateNumericInput( -100, -60, 60, 0 ) ).toBe( -60 );
		expect( validateNumericInput( 100, -60, 60, 0 ) ).toBe( 60 );
	} );

	it( 'returns defaultValue for NaN', () => {
		expect( validateNumericInput( NaN, 0, 10, 7 ) ).toBe( 7 );
	} );

	it( 'clamps Infinity to max (typeof Infinity is "number")', () => {
		// Documents current behavior: Infinity passes the type/NaN guard
		// and is clamped, rather than falling through to defaultValue.
		expect( validateNumericInput( Infinity, 0, 10, 5 ) ).toBe( 10 );
		expect( validateNumericInput( -Infinity, 0, 10, 5 ) ).toBe( 0 );
	} );

	it( 'returns defaultValue for non-number types', () => {
		expect( validateNumericInput( '5', 0, 10, 3 ) ).toBe( 3 );
		expect( validateNumericInput( null, 0, 10, 3 ) ).toBe( 3 );
		expect( validateNumericInput( undefined, 0, 10, 3 ) ).toBe( 3 );
		expect( validateNumericInput( true, 0, 10, 3 ) ).toBe( 3 );
		expect( validateNumericInput( false, 0, 10, 3 ) ).toBe( 3 );
		expect( validateNumericInput( {}, 0, 10, 3 ) ).toBe( 3 );
		expect( validateNumericInput( [], 0, 10, 3 ) ).toBe( 3 );
		expect( validateNumericInput( [ 5 ], 0, 10, 3 ) ).toBe( 3 );
	} );

	it( 'documents that defaultValue is returned even when out of range', () => {
		// If a caller passes an invalid value AND a defaultValue outside the
		// allowed range, the function does NOT clamp the default.
		expect( validateNumericInput( 'bad', 0, 10, 999 ) ).toBe( 999 );
	} );
} );

describe( 'validateStringInput', () => {
	it( 'returns valid strings within length unchanged', () => {
		expect( validateStringInput( 'hello' ) ).toBe( 'hello' );
	} );

	it( 'returns "" for non-string types', () => {
		expect( validateStringInput( 42 ) ).toBe( '' );
		expect( validateStringInput( null ) ).toBe( '' );
		expect( validateStringInput( undefined ) ).toBe( '' );
		expect( validateStringInput( true ) ).toBe( '' );
		expect( validateStringInput( {} ) ).toBe( '' );
		expect( validateStringInput( [] ) ).toBe( '' );
	} );

	it( 'truncates strings above maxLength', () => {
		expect( validateStringInput( 'a'.repeat( 150 ) ) ).toBe(
			'a'.repeat( 100 )
		);
	} );

	it( 'keeps strings exactly at maxLength', () => {
		const at = 'a'.repeat( 100 );
		expect( validateStringInput( at ) ).toBe( at );
	} );

	it( 'respects custom maxLength', () => {
		expect( validateStringInput( 'abcdef', null, 3 ) ).toBe( 'abc' );
	} );

	it( 'passes pattern-matching strings through', () => {
		expect( validateStringInput( 'abc123', /^[a-z0-9]+$/ ) ).toBe(
			'abc123'
		);
	} );

	it( 'returns "" when pattern does not match', () => {
		expect( validateStringInput( 'abc!', /^[a-z0-9]+$/ ) ).toBe( '' );
	} );

	it( 'applies pattern AFTER truncation, not before', () => {
		// 'aa!aa' truncated to 3 chars = 'aa!' which fails the pattern.
		expect( validateStringInput( 'aa!aa', /^[a-z]+$/, 3 ) ).toBe( '' );
		// 'aabbb' truncated to 3 chars = 'aab' which passes.
		expect( validateStringInput( 'aabbb', /^[a-z]+$/, 3 ) ).toBe( 'aab' );
	} );

	it( 'no pattern means anything within length is allowed', () => {
		expect( validateStringInput( 'a!@#$%^&*()', null, 5 ) ).toBe( 'a!@#$' );
	} );

	it( 'allows empty string when no pattern is set', () => {
		expect( validateStringInput( '' ) ).toBe( '' );
	} );

	it( 'is deterministic when caller passes a global-flagged regex', () => {
		// /g and /y advance lastIndex on .test() — without normalization,
		// the same input would alternate pass/fail across repeated calls.
		const globalPattern = /^[a-z]+$/g;
		expect( validateStringInput( 'abc', globalPattern ) ).toBe( 'abc' );
		expect( validateStringInput( 'abc', globalPattern ) ).toBe( 'abc' );
		expect( validateStringInput( 'abc', globalPattern ) ).toBe( 'abc' );
	} );

	it( 'is deterministic when caller passes a sticky-flagged regex', () => {
		const stickyPattern = /^[a-z]+$/y;
		expect( validateStringInput( 'abc', stickyPattern ) ).toBe( 'abc' );
		expect( validateStringInput( 'abc', stickyPattern ) ).toBe( 'abc' );
	} );

	it( 'preserves original allowedPattern flags when copying (no mutation)', () => {
		const globalPattern = /^[a-z]+$/g;
		validateStringInput( 'abc', globalPattern );
		expect( globalPattern.flags ).toBe( 'g' );
	} );
} );

describe( 'validateId', () => {
	it( 'accepts alphanumerics, dashes, and underscores', () => {
		expect( validateId( 'gradient-1' ) ).toBe( 'gradient-1' );
		expect( validateId( 'anim_id_42' ) ).toBe( 'anim_id_42' );
		expect( validateId( 'ABC-xyz_0' ) ).toBe( 'ABC-xyz_0' );
	} );

	it( 'rejects strings with spaces', () => {
		expect( validateId( 'has space' ) ).toBe( '' );
	} );

	it( 'rejects strings with special chars', () => {
		expect( validateId( 'no/slash' ) ).toBe( '' );
		expect( validateId( 'no.dot' ) ).toBe( '' );
		expect( validateId( 'no!bang' ) ).toBe( '' );
		expect( validateId( '<script>' ) ).toBe( '' );
	} );

	it( 'rejects empty strings (pattern requires 1+ chars)', () => {
		expect( validateId( '' ) ).toBe( '' );
	} );

	it( 'rejects non-string types', () => {
		expect( validateId( 42 ) ).toBe( '' );
		expect( validateId( null ) ).toBe( '' );
		expect( validateId( undefined ) ).toBe( '' );
	} );

	it( 'enforces 50-character limit by truncation, then pattern check', () => {
		// 50 valid chars: kept
		const at = 'a'.repeat( 50 );
		expect( validateId( at ) ).toBe( at );
		// 51 chars truncated to 50: still all valid → kept
		expect( validateId( 'a'.repeat( 51 ) ) ).toBe( 'a'.repeat( 50 ) );
		// 50 valid chars then a special: truncation drops the special → kept
		expect( validateId( 'a'.repeat( 50 ) + '!' ) ).toBe( 'a'.repeat( 50 ) );
	} );
} );

describe( 'validateColorValue', () => {
	it( 'returns fallback for non-strings', () => {
		expect( validateColorValue( 0xff0000 ) ).toBe( 'currentColor' );
		expect( validateColorValue( null ) ).toBe( 'currentColor' );
		expect( validateColorValue( undefined ) ).toBe( 'currentColor' );
		expect( validateColorValue( {} ) ).toBe( 'currentColor' );
	} );

	it( 'returns fallback for empty string', () => {
		expect( validateColorValue( '' ) ).toBe( 'currentColor' );
	} );

	it( 'honors custom fallback', () => {
		expect( validateColorValue( 'nope', '#000000' ) ).toBe( '#000000' );
	} );

	it( 'accepts the currentColor keyword', () => {
		expect( validateColorValue( 'currentColor' ) ).toBe( 'currentColor' );
		expect( validateColorValue( '  currentColor  ' ) ).toBe(
			'currentColor'
		);
	} );

	it( 'accepts hex colors of length 3, 4, 6, 8', () => {
		expect( validateColorValue( '#fff' ) ).toBe( '#fff' );
		expect( validateColorValue( '#ffff' ) ).toBe( '#ffff' );
		expect( validateColorValue( '#ff00ff' ) ).toBe( '#ff00ff' );
		expect( validateColorValue( '#ff00ffaa' ) ).toBe( '#ff00ffaa' );
		expect( validateColorValue( '#ABCDEF' ) ).toBe( '#ABCDEF' );
	} );

	it( 'rejects malformed hex colors', () => {
		expect( validateColorValue( '#gg0000' ) ).toBe( 'currentColor' );
		expect( validateColorValue( '#12345' ) ).toBe( 'currentColor' ); // 5 chars
		expect( validateColorValue( '#1234567' ) ).toBe( 'currentColor' ); // 7 chars
		expect( validateColorValue( 'ff0000' ) ).toBe( 'currentColor' ); // missing #
	} );

	it( 'accepts rgb and rgba forms', () => {
		expect( validateColorValue( 'rgb(255, 0, 0)' ) ).toBe(
			'rgb(255, 0, 0)'
		);
		expect( validateColorValue( 'rgba(255, 0, 0, 0.5)' ) ).toBe(
			'rgba(255, 0, 0, 0.5)'
		);
		expect( validateColorValue( 'rgb(100%, 0%, 0%)' ) ).toBe(
			'rgb(100%, 0%, 0%)'
		);
	} );

	it( 'accepts hsl and hsla forms', () => {
		expect( validateColorValue( 'hsl(120, 100%, 50%)' ) ).toBe(
			'hsl(120, 100%, 50%)'
		);
		expect( validateColorValue( 'hsla(120, 100%, 50%, 0.7)' ) ).toBe(
			'hsla(120, 100%, 50%, 0.7)'
		);
		expect( validateColorValue( 'hsl(120deg, 100%, 50%)' ) ).toBe(
			'hsl(120deg, 100%, 50%)'
		);
	} );

	it( 'accepts strict WP preset CSS variables', () => {
		expect(
			validateColorValue( 'var(--wp--preset--color--vivid-red)' )
		).toBe( 'var(--wp--preset--color--vivid-red)' );
		expect(
			validateColorValue(
				'var(--wp--preset--gradient--purple-to-yellow)'
			)
		).toBe( 'var(--wp--preset--gradient--purple-to-yellow)' );
	} );

	it( 'rejects non-WP-preset CSS variables (var() injection guard)', () => {
		expect( validateColorValue( 'var(--my-color)' ) ).toBe(
			'currentColor'
		);
		expect(
			validateColorValue( 'var(--wp--preset--font-size--small)' )
		).toBe( 'currentColor' );
		expect(
			validateColorValue( 'var(--wp--preset--color--x); attack: 1' )
		).toBe( 'currentColor' );
	} );

	it( 'rejects var() with internal whitespace or trailing junk', () => {
		expect( validateColorValue( 'var( --wp--preset--color--x)' ) ).toBe(
			'currentColor'
		);
		expect( validateColorValue( 'var(--wp--preset--color--x )' ) ).toBe(
			'currentColor'
		);
		expect( validateColorValue( 'var(--wp--preset--color--x);' ) ).toBe(
			'currentColor'
		);
		expect( validateColorValue( 'var(--wp--preset--color--x)/**/' ) ).toBe(
			'currentColor'
		);
	} );

	it( 'rejects url() with internal whitespace or trailing junk', () => {
		expect( validateColorValue( 'url( #gradient-1)' ) ).toBe(
			'currentColor'
		);
		expect( validateColorValue( 'url(#gradient-1 )' ) ).toBe(
			'currentColor'
		);
		expect( validateColorValue( 'url(#gradient-1);x' ) ).toBe(
			'currentColor'
		);
	} );

	it( 'accepts url(#localId) references', () => {
		expect( validateColorValue( 'url(#gradient-1)' ) ).toBe(
			'url(#gradient-1)'
		);
		expect( validateColorValue( 'url(#anim_42)' ) ).toBe( 'url(#anim_42)' );
	} );

	it( 'rejects external url() references', () => {
		expect( validateColorValue( 'url(https://evil.com/x.svg)' ) ).toBe(
			'currentColor'
		);
		expect( validateColorValue( 'url(//evil.com)' ) ).toBe(
			'currentColor'
		);
		expect( validateColorValue( 'url("#with-quotes")' ) ).toBe(
			'currentColor'
		);
	} );

	it( 'rejects javascript: and other injection attempts', () => {
		expect( validateColorValue( 'javascript:alert(1)' ) ).toBe(
			'currentColor'
		);
		expect( validateColorValue( 'expression(alert(1))' ) ).toBe(
			'currentColor'
		);
		expect( validateColorValue( '<script>' ) ).toBe( 'currentColor' );
	} );

	it( 'trims surrounding whitespace before validating', () => {
		expect( validateColorValue( '  #fff  ' ) ).toBe( '#fff' );
		expect( validateColorValue( '\trgb(0,0,0)\n' ) ).toBe( 'rgb(0,0,0)' );
	} );
} );

describe( 'debugLog', () => {
	let logSpy;
	let originalNodeEnv;

	beforeEach( () => {
		logSpy = jest.spyOn( console, 'log' ).mockImplementation( () => {} );
		originalNodeEnv = process.env.NODE_ENV;
	} );

	afterEach( () => {
		logSpy.mockRestore();
		process.env.NODE_ENV = originalNodeEnv;
	} );

	it( 'logs when NODE_ENV is development', () => {
		process.env.NODE_ENV = 'development';
		debugLog( 'msg', 1, 2 );
		expect( logSpy ).toHaveBeenCalledWith(
			'[Awesome Squiggle]',
			'msg',
			1,
			2
		);
	} );

	it( 'is silent when NODE_ENV is production', () => {
		process.env.NODE_ENV = 'production';
		debugLog( 'msg' );
		expect( logSpy ).not.toHaveBeenCalled();
	} );

	it( 'is silent when NODE_ENV is test', () => {
		process.env.NODE_ENV = 'test';
		debugLog( 'msg' );
		expect( logSpy ).not.toHaveBeenCalled();
	} );
} );
