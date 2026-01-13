const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const TerserPlugin = require( 'terser-webpack-plugin' );
const path = require( 'path' );

module.exports = {
	...defaultConfig,
	entry: {
		index: path.resolve( process.cwd(), 'src', 'index.js' ),
	},
	optimization: {
		...defaultConfig.optimization,
		minimizer: [
			new TerserPlugin( {
				terserOptions: {
					compress: {
						drop_console: true, // Remove console.log in production
					},
				},
			} ),
		],
	},
};
