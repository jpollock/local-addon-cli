/**
 * Read-Only Command E2E Tests
 *
 * Tests commands that don't modify state: info, services, blueprints list,
 * backups status, wpe status. These are safe to run repeatedly.
 */

import { runCLI } from './helpers/cli';
import { getE2EContext } from './helpers/context';

const context = getE2EContext();
const describeIfLocal = (context.isLocalAvailable && context.isAddonEnabled) ? describe : describe.skip;

describeIfLocal('info command', () => {
  test('returns site counts', () => {
    const { stdout, exitCode } = runCLI('info');

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/totalSites|Total/i);
  });

  test('returns JSON with --json flag', () => {
    const { stdout, exitCode } = runCLI('info --json');

    expect(exitCode).toBe(0);

    const data = JSON.parse(stdout);
    expect(data).toHaveProperty('totalSites');
    expect(typeof data.totalSites).toBe('number');
  });
});

describeIfLocal('services command', () => {
  test('lists available service versions', () => {
    const { stdout, exitCode } = runCLI('services');

    expect(exitCode).toBe(0);
    // Should list PHP versions at minimum
    expect(stdout.toLowerCase()).toMatch(/php|version/i);
  });

  test('returns JSON with --json flag', () => {
    const { stdout, exitCode } = runCLI('services --json');

    expect(exitCode).toBe(0);

    const data = JSON.parse(stdout);
    expect(Array.isArray(data)).toBe(true);
    // Each service should have role, name, version
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('role');
      expect(data[0]).toHaveProperty('version');
    }
  });
});

describeIfLocal('blueprints list command', () => {
  test('returns list or empty message', () => {
    const { stdout, exitCode } = runCLI('blueprints list');

    expect(exitCode).toBe(0);
    // Either shows blueprints or "No blueprints found"
    expect(stdout).toMatch(/blueprint|no blueprints/i);
  });

  test('returns JSON with --json flag', () => {
    const { stdout, exitCode } = runCLI('blueprints list --json');

    expect(exitCode).toBe(0);

    const data = JSON.parse(stdout);
    expect(Array.isArray(data)).toBe(true);
  });
});

describeIfLocal('backups status command', () => {
  test('returns backup service status', () => {
    const { stdout, exitCode } = runCLI('backups status');

    expect(exitCode).toBe(0);
    // Should mention availability or feature status
    expect(stdout.toLowerCase()).toMatch(/available|status|backup/i);
  });

  test('returns JSON with --json flag', () => {
    const { stdout, exitCode } = runCLI('backups status --json');

    expect(exitCode).toBe(0);

    const data = JSON.parse(stdout);
    expect(data).toHaveProperty('available');
    expect(typeof data.available).toBe('boolean');
  });
});

describeIfLocal('wpe status command', () => {
  test('returns WP Engine auth status', () => {
    const { stdout, exitCode } = runCLI('wpe status');

    expect(exitCode).toBe(0);
    // Should show connected or not connected
    expect(stdout.toLowerCase()).toMatch(/wp engine|connected|not connected/i);
  });

  test('returns JSON with --json flag', () => {
    const { stdout, exitCode } = runCLI('wpe status --json');

    expect(exitCode).toBe(0);

    const data = JSON.parse(stdout);
    expect(data).toHaveProperty('authenticated');
    expect(typeof data.authenticated).toBe('boolean');
  });
});

if (!context.isLocalAvailable || !context.isAddonEnabled) {
  describe('read-only commands (skipped)', () => {
    test.skip('Local not running or MCP addon not enabled - E2E tests skipped', () => {});
  });
}
