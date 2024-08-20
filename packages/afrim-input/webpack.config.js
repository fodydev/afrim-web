const path = require("path");

module.exports = {
  entry: "./src/bootstrap.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "afrim_input.js",
    clean: true,
  },
  mode: "development",
  experiments: {
    asyncWebAssembly: true,
  },
};
