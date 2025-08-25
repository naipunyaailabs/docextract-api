module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'services/**/*.ts',
    'utils/**/*.ts',
    'routes/**/*.ts',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
};