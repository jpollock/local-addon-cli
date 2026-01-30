/**
 * Jest Test Setup
 */

// Extend Jest matchers if needed
expect.extend({});

// Global test timeout
jest.setTimeout(10000);

// Mock console.error to fail tests on unexpected errors
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Allow expected errors in tests
    if (args[0]?.includes?.('[MCP Server]')) {
      return;
    }
    originalError.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalError;
});
