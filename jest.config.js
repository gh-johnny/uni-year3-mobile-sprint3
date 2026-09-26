// Deterministic dates across machines/CI: the product is Brazilian, so tests run in São Paulo time.
process.env.TZ = 'America/Sao_Paulo';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest/setup-env.ts'],
  setupFilesAfterEnv: ['./jest/setup.ts'],
  resolver: 'react-native-worklets/jest/resolver',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|zustand)',
  ],
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)', '<rootDir>/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__fixtures__/**'],
  coverageReporters: ['text-summary', 'text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: { statements: 95, branches: 95, functions: 95, lines: 95 },
  },
};
