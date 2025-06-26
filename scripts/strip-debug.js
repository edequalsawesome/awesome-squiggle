#!/usr/bin/env node

/**
 * Production build script to strip debugging statements from PHP files
 * This removes error_log() calls while preserving security checks
 */

const fs = require( 'fs' );
const path = require( 'path' );

console.log( '🔧 Stripping debug statements for production build...' );

// Files to process
const phpFiles = [ 'awesome-squiggle.php' ];

phpFiles.forEach( ( file ) => {
	const filePath = path.join( __dirname, '..', file );

	if ( ! fs.existsSync( filePath ) ) {
		console.log( `⚠️  Warning: ${ file } not found, skipping...` );
		return;
	}

	console.log( `📝 Processing ${ file }...` );

	let content = fs.readFileSync( filePath, 'utf8' );

	// Remove error_log statements but keep the security logic
	// This regex matches error_log lines including the semicolon and newline
	content = content.replace( /\s*error_log\([^;]+\);\s*\n/g, '' );

	fs.writeFileSync( filePath, content, 'utf8' );
	console.log( `✅ Removed debug statements from ${ file }` );
} );

console.log( '🎉 Production build complete - debug statements stripped!' );
console.log( '💡 Security checks are still in place, just without logging.' );
