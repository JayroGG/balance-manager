// Test-only: same as package.json "jest" but React Compiler ON (like Metro at runtime via
// app.config.js experiments.reactCompiler). Run: npx jest -c jest.compiler.config.js <paths>
const pkg = require('./package.json');
module.exports = {
  ...pkg.jest,
  rootDir: __dirname,
  transform: { '\\.[jt]sx?$': '<rootDir>/jest.compiler.transform.js' },
};
