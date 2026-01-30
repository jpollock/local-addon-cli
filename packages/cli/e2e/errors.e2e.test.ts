/**
 * Error Handling E2E Tests
 *
 * Tests CLI error handling. These tests run regardless of Local availability.
 */

import { runCLI } from './helpers/cli';

describe('error handling', () => {
  test('shows error for unknown command', () => {
    const { stderr, exitCode } = runCLI('unknown-command');

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('unknown command');
  });

  test('shows error for unknown subcommand', () => {
    const { stderr, exitCode } = runCLI('sites unknown-subcommand');

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('unknown command');
  });

  test('sites get without argument shows error', () => {
    const { stderr, exitCode } = runCLI('sites get');

    expect(exitCode).not.toBe(0);
    // Should indicate missing required argument
    expect(stderr.toLowerCase()).toMatch(/missing|required|argument/);
  });

  test('wp without site shows error', () => {
    const { stderr, exitCode } = runCLI('wp');

    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toMatch(/missing|required|argument/);
  });
});
