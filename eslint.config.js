// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // jest.mock() factories are lazy: they must `require` what they need.
    files: ["**/*.test.{ts,tsx}"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
