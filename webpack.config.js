const path = require('path');

module.exports = (env, argv) => ({
  devtool: argv.mode === 'production' ? false : 'cheap-source-map',
  entry: {
    content: './src/content/index.jsx',
    popup: './src/popup/index.jsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
});
