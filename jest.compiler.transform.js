const babelJest = require('babel-jest').default;
module.exports = babelJest.createTransformer({
  plugins: [['babel-plugin-react-compiler', {}]],
  presets: ['babel-preset-expo'],
  caller: { name: 'metro', platform: 'ios', isDev: true, supportsStaticESM: false, supportsReactCompiler: true },
});
