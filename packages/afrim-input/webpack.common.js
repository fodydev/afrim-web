const path = require("path");

module.exports = {
  entry: "./src/bootstrap.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "afrim_input.js",
    clean: true,
    globalObject: "this",
    library: {
      type: "umd",
    },
    umdNamedDefine: true,
    webassemblyModuleFilename: "[hash].wasm",
  },
  experiments: {
    asyncWebAssembly: true,
  },
  cache: {
    type: "filesystem",
  },
};
