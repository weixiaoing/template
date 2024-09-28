const process = require("node:process");
const isDevelopment = process.env.NODE_ENV !== "production";
const LightningCSS = require("lightningcss");
const TerserPlugin = require("terser-webpack-plugin");
const { LightningCssMinifyPlugin } = require("lightningcss-loader");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const topLevelFrameworkPaths = isDevelopment ? [] : getTopLevelFrameworkPaths();

const WebpackBar = require("webpackbar");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const path = require("node:path");
const getSupportedBrowsers = (dir = __dirname) => {
  try {
    return browserslist.loadConfig({
      path: dir,
      env: isDevelopment ? "development" : "production",
    });
  } catch {}
};
function getTopLevelFrameworkPaths(
  frameworkPackages = ["react", "react-dom"],
  dir = path.resolve(__dirname)
) {
  // Only top-level packages are included, e.g. nested copies like
  // 'node_modules/meow/node_modules/react' are not included.
  const topLevelFrameworkPaths = [];
  const visitedFrameworkPackages = new Set();

  // Adds package-paths of dependencies recursively
  const addPackagePath = (packageName, relativeToPath) => {
    try {
      if (visitedFrameworkPackages.has(packageName)) return;
      visitedFrameworkPackages.add(packageName);

      const packageJsonPath = require.resolve(`${packageName}/package.json`, {
        paths: [relativeToPath],
      });

      // Include a trailing slash so that a `.startsWith(packagePath)` check avoids false positives
      // when one package name starts with the full name of a different package.
      // For example:
      //   "node_modules/react-slider".startsWith("node_modules/react")  // true
      //   "node_modules/react-slider".startsWith("node_modules/react/") // false
      const directory = path.join(packageJsonPath, "../");

      // Returning from the function in case the directory has already been added and traversed
      if (topLevelFrameworkPaths.includes(directory)) return;
      topLevelFrameworkPaths.push(directory);

      const dependencies = require(packageJsonPath).dependencies || {};
      for (const name of Object.keys(dependencies)) {
        addPackagePath(name, directory);
      }
    } catch {
      // don't error on failing to resolve framework packages
    }
  };

  for (const packageName of frameworkPackages) {
    addPackagePath(packageName, dir);
  }

  return topLevelFrameworkPaths;
}
// 使用swc代替babel，减少编译时间 swc自带react fresh
const getSwcOptions = (useTypeScript) => {
  const supportedBrowsers = getSupportedBrowsers();

  return /** @type {import('@swc/core').Options} */ ({
    jsc: {
      parser: useTypeScript
        ? {
            syntax: "typescript",
            tsx: true,
          }
        : {
            syntax: "ecmascript",
            jsx: true,
            importAttributes: true,
          },
      externalHelpers: true,
      loose: false,
      transform: {
        react: {
          runtime: "automatic",
          refresh: isDevelopment,
          development: isDevelopment,
        },
        optimizer: {
          simplify: true,
          globals: {
            typeofs: {
              window: "object",
            },
            envs: {
              NODE_ENV: isDevelopment ? '"development"' : '"production"',
            },
          },
        },
      },
    },
    env: {
      // swc-loader don't read browserslist config file, manually specify targets
      targets:
        supportedBrowsers?.length > 0
          ? supportedBrowsers
          : "defaults, chrome > 70, edge >= 79, firefox esr, safari >= 11, not dead, not ie > 0, not ie_mob > 0, not OperaMini all",
      mode: "usage",
      loose: false,
      coreJs: require("core-js/package.json").version,
      shippedProposals: false,
    },
  });
};
const isAnalyze = !!process.env.ANALYZE;

module.exports = /** @type {import('webpack').Configuration} */ ({
  // webpack config goes here
  mode: isDevelopment ? "development" : "production",
  // 开启实验性支持
  experiments: {
    // css支持,与css loader mini css extract互斥
    css: true,
    // 缓存优化
    cacheUnaffected: true,
  },
  entry: "./src/index.tsx",
  output: {
    path: __dirname + "/dist",
    asyncChunks: true,
    // 为挂载全局变量名添加后缀
    library: "_fix",
    clean: true,
    filename: isDevelopment ? "[name].js" : "[contenthash].js",
    cssFilename: isDevelopment ? "[name].css" : "[contenthash].css",
    hotUpdateChunkFilename: "[id].[fullhash].hot-update.js",
    hotUpdateMainFilename: "[fullhash].[runtime].hot-update.json",
    webassemblyModuleFilename: "[contenthash].wasm",
    // 使用jsnop加载chunk
    crossOriginLoading: "anonymous",
    hashFunction: "xxhash64",
    hashDigestLength: 16,
  },
  //   为了更好性能可使用eval-cheap-module-source-map
  devtool: "eval-source-map",
  devServer: {
    port: 3000,
    // 防止spa 404
    historyApiFallback: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: "lightningcss-loader",
            options: {
              implementation: LightningCSS,
            },
          },
          // 需要postcss时添加
          {
            loader: "postcss-loader",
            // postcss-loader 可以自动寻找 PostCSS 的配置文件，也可以在 options 中手动指定
          },
        ],
      },
      {
        test: /assets\//,
        type: "asset/resource",
        generator: {
          filename: "assets/[hash][ext][query]",
        },
      },
      {
        test: /\.[cm]?tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "swc-loader",
            options: getSwcOptions(true),
          },
        ],
      },
      {
        test: /\.[cm]?t=jsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "swc-loader",
            options: getSwcOptions(false),
          },
        ],
      },
    ],
  },
  plugins: [
    // 自动导入js和css
    new HtmlWebpackPlugin({
      template: "./index.html",
    }),

    // chunk分析
    isAnalyze &&
      new BundleAnalyzerPlugin({
        analyzerMode: "static",
      }),
    !isDevelopment && new WebpackBar(),
    isDevelopment && new ReactRefreshWebpackPlugin(),
    //to do react compile
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".jsx", ".mjs", ".cjs", ".js", ".json"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },

    // 缓存模块路径解析结果
    cache: true,
    unsafeCache: false,
  },
  // 将react react-dom打包进一个chunk 因为改变少所以contenthash基本不变 提高缓存命中率
  optimization: {
    splitChunks: {
      cacheGroups: {
        framework: {
          chunks: "all",
          name: "framework",
          test(module) {
            const resource = module.nameForCondition?.();
            return resource
              ? topLevelFrameworkPaths.some((pkgPath) =>
                  resource.startsWith(pkgPath)
                )
              : false;
          },
          priority: 40,
          enforce: true,
        },
      },
    },
    // 将runtime代码单独抽离 减少chunk体积
    runtimeChunk: {
      name: "runtime",
    },
    // 配置压缩
    minimizer: [
      new TerserPlugin({
        minify: TerserPlugin.swcMinify,
        terserOptions: {
          compress: {
            ecma: 5,
            comparisons: false,
            inline: 2, // https://github.com/vercel/next.js/issues/7178#issuecomment-493048965
          },
          mangle: { safari10: true },
          format: {
            // use ecma 2015 to enable minify like shorthand object
            ecma: 2015,
            safari10: true,
            comments: false,
            // Fixes usage of Emoji and certain Regex
            ascii_only: true,
          },
        },
      }),
      new LightningCssMinifyPlugin(),
    ],
  },
  // dev时自动内存缓存 此处配置pro时文件系统缓存
  cache: {
    type: "filesystem",
    maxMemoryGenerations: isDevelopment ? 5 : Infinity,
    cacheDirectory: path.join(__dirname, "node_modules", ".cache", "webpack"),
    compression: isDevelopment ? "gzip" : false,
  },
});
