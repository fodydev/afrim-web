const path = require("path");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "development",
  devtool: "inline-source-map",
  devServer: {
    // Serve afrim-input's build output directly so that its watch rebuilds
    // trigger a live reload of the playground.
    static: [
      {
        directory: path.resolve(__dirname, "../afrim-input/dist"),
        watch: true,
      },
    ],
    compress: true,
    // Use the PORT env variable if set, otherwise 8080 (or the next free port).
    port: process.env.PORT || "auto",
  },
});
