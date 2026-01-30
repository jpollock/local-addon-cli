module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/e2e'],
  testMatch: ['**/*.e2e.test.ts'],
  globalSetup: '<rootDir>/e2e/globalSetup.ts',
  globalTeardown: '<rootDir>/e2e/globalTeardown.ts',
  testTimeout: 300000, // 5 minutes per test
  maxWorkers: 1, // Sequential execution
  moduleFileExtensions: ['ts', 'js', 'json'],
};
