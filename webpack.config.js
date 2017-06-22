const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const { CheckerPlugin } = require('awesome-typescript-loader');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
const path = require('path');

const BUILD_DIR = path.resolve(__dirname, './docs');
const DEBUG = 'DEBUG' in process.env ? process.env['DEBUG'] : false;

const minifyOption = {
	collapseBooleanAttributes: !DEBUG,
	collapseInlineTagWhitespace: !DEBUG,
	collapseWhitespace: !DEBUG,
	removeAttributeQuotes: !DEBUG,
	removeComments: !DEBUG,
	removeEmptyAttributes: !DEBUG,
	removeOptionalTags: !DEBUG,
	removeRedundantAttributes: !DEBUG,
	removeScriptTypeAttributes: !DEBUG,
	removeTagWhitespace: !DEBUG
};

let plugins = [
	new ExtractTextPlugin({
		filename: getPath => getPath('[name].css'),
		allChunks: true
	}),
	new CheckerPlugin()
];

if (!DEBUG) plugins.push(new UglifyJSPlugin());

plugins = plugins.concat([
	new HTMLWebpackPlugin({
		filename: './index.html',
		inject: 'head',
		template: 'src/index.html',
		chunks: ['index'],
		inlineSource: '.(js|css)$',
		minify: minifyOption
	}),
	new HtmlWebpackInlineSourcePlugin(),
	new CopyWebpackPlugin([{
		from: './src/static',
		to: './'
	}])
]);

module.exports = {
	entry: {
		'index': './src/script.ts',
	},
	output: {
		path: BUILD_DIR,
		filename: '[name].js'
	},
	module: {
		rules: [{
			test: /\.tsx?$/,
			use: [{
				loader: 'awesome-typescript-loader',
			}]
		}, {
			test: /\.scss?$/,
			use: ExtractTextPlugin.extract({
				fallback: 'style-loader',
				use: ['css-loader', 'postcss-loader', 'sass-loader']
			})
		}]
	},
	resolve: {
		modules: [
			path.join(__dirname, './src'),
			path.join(__dirname, './node_modules'),
		],
		extensions: ['.ts', '.scss']
	},
	plugins: plugins,
	cache: false
};