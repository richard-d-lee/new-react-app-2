const path = require('path'); 
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js', // Entry point for your app
  output: {
    path: path.resolve(__dirname, 'dist'), // Output directory
    filename: 'bundle.js', // Output file
    assetModuleFilename: 'images/[name].[hash][ext][query]', // Default output for asset modules
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/, // Transpile .js and .jsx files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/, // Handle CSS files
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/, // Handle image files
        type: 'asset/resource', // Built-in asset module for copying files
        generator: {
          filename: 'images/[name].[hash][ext]', // Output folder for images
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html', // HTML template
    }),
  ],
  devServer: {
    static: path.join(__dirname, 'dist'), // Serve files from the dist directory
    port: 3000, // Port for the development server
    open: true, // Open the browser automatically
  },
};
