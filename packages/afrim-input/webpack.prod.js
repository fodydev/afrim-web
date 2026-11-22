const CompressionPlugin = require("compression-webpack-plugin");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "production",
  devtool: "source-map",
  optimization: {
    minimize: true,
  },
  plugins: [
    // Emit a precompressed `<hash>.wasm.gz` next to the original `.wasm`.
    new CompressionPlugin({
      test: /\.wasm$/,
      algorithm: "gzip",
      filename: "[path][base].gz",
      minRatio: Infinity,
      deleteOriginalAssets: false,
    }),
  ],
});
