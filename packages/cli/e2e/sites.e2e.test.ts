/**
 * Sites Command E2E Tests
 *
 * Tests sites list, get, start, and stop commands against a live Local instance.
 */

import { sitesList, sitesGet, sitesStart, sitesStop } from './helpers/cli';
import { getE2EContext } from './helpers/context';

const context = getE2EContext();
const describeIfLocal = (context.isLocalAvailable && context.isAddonEnabled) ? describe : describe.skip;

describeIfLocal('sites list', () => {
  const testSiteName = context.testSiteName!;

  test('returns list of sites', () => {
    const { stdout, exitCode } = sitesList();

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Name');
    expect(stdout).toContain('Status');
  });

  test('returns JSON with --json flag', () => {
    const { stdout, exitCode } = sitesList('--json');

    expect(exitCode).toBe(0);

    const data = JSON.parse(stdout);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('name');
    expect(data[0]).toHaveProperty('status');
  });

  test('includes test site in list', () => {
    const { stdout, exitCode } = sitesList();

    expect(exitCode).toBe(0);
    expect(stdout).toContain(testSiteName);
  });
});

describeIfLocal('sites get', () => {
  test('returns error for non-existent site', () => {
    const { stderr, exitCode } = sitesGet('nonexistent-site-xyz-12345');

    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toMatch(/not found|error/);
  });
});

describeIfLocal('sites start/stop', () => {
  const testSiteName = context.testSiteName!;

  test('can stop and start a site', () => {
    // Stop the site
    const stopResult = sitesStop(testSiteName);
    expect(stopResult.exitCode).toBe(0);

    // Verify stopped via list
    const afterStop = sitesList('--json');
    const sitesAfterStop = JSON.parse(afterStop.stdout);
    const siteAfterStop = sitesAfterStop.find((s: any) => s.name === testSiteName);
    // Local uses 'halted' for stopped sites
    expect(['stopped', 'halted']).toContain(siteAfterStop?.status);

    // Start the site
    const startResult = sitesStart(testSiteName);
    expect(startResult.exitCode).toBe(0);

    // Verify running via list
    const afterStart = sitesList('--json');
    const sitesAfterStart = JSON.parse(afterStart.stdout);
    const siteAfterStart = sitesAfterStart.find((s: any) => s.name === testSiteName);
    expect(siteAfterStart?.status).toBe('running');
  }, 180000); // 3 minute timeout for start/stop cycle
});

if (!context.isLocalAvailable || !context.isAddonEnabled) {
  describe('sites (skipped)', () => {
    test.skip('Local not running or MCP addon not enabled - E2E tests skipped', () => {});
  });
}
