const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");

module.exports = {
  entry: "./src/bootstrap.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
    clean: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: "src/index.html" }],
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: "../afrim-input/dist" }],
    }),
  ],

  experiments: {
    asyncWebAssembly: true,
  },
};
