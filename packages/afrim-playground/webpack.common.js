const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");
const { DefinePlugin } = require("webpack");

// Where the datasets are published (an afrim-data GitHub Pages site).
const AFRIM_DATA_URL =
  process.env.AFRIM_DATA_URL || "https://fodydev.github.io/afrim-data";

module.exports = {
  entry: "./src/bootstrap.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
    clean: true,
  },
  plugins: [
    new DefinePlugin({
      "process.env.AFRIM_DATA_URL": JSON.stringify(AFRIM_DATA_URL),
    }),
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
  cache: {
    type: "filesystem",
  },
};
