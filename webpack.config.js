const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  return [
    {
      mode: argv.mode || "production",
      entry: {
        "background/service-worker": "./src/background/service-worker.ts",
        "content/content-script": "./src/content/content-script.ts",
        "popup/popup": "./src/popup/index.tsx",
        "options/options": "./src/options/index.tsx",
      },
      output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].js",
        clean: true,
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: "ts-loader",
            exclude: /node_modules/,
          },
        ],
      },
      resolve: {
        extensions: [".tsx", ".ts", ".js"],
      },
      devtool: isProduction ? false : "cheap-module-source-map",
      plugins: [
        new CopyPlugin({
          patterns: [
            { from: "manifest.json", to: "manifest.json" },
            { from: "popup.html", to: "popup.html" },
            { from: "options.html", to: "options.html" },
            { from: "rules.json", to: "rules.json" },
            { from: "public/icons", to: "public/icons" },
          ],
        }),
      ],
      optimization: isProduction
        ? {
            minimize: true,
            usedExports: true,
            sideEffects: false,
          }
        : {},
    },
  ];
};
