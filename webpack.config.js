const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const TerserPlugin = require( 'terser-webpack-plugin' );

module.exports = {
	...defaultConfig,
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
