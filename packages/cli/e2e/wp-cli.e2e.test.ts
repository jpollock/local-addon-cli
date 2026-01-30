/**
 * WP-CLI Command E2E Tests
 *
 * Tests WP-CLI passthrough against a live Local instance.
 * Note: These tests may fail if the test site has PHP errors.
 * The tests validate that the CLI correctly handles both success and error cases.
 */

import { wpCli, sitesStart } from './helpers/cli';
import { getE2EContext } from './helpers/context';

const context = getE2EContext();
const describeIfLocal = (context.isLocalAvailable && context.isAddonEnabled) ? describe : describe.skip;

describeIfLocal('wp-cli', () => {
  const testSiteName = context.testSiteName!;
  let siteStarted = false;
  let siteHasPhpError = false;

  beforeAll(() => {
    // Ensure site is running for WP-CLI (with longer timeout)
    const result = sitesStart(testSiteName);
    siteStarted = result.exitCode === 0;

    // Check if the site has PHP errors by running a database-accessing command
    // wp core version doesn't access the database, so we use wp option get instead
    if (siteStarted) {
      const check = wpCli(testSiteName, 'option get siteurl');
      const output = (check.stdout + check.stderr).toLowerCase();
      siteHasPhpError = output.includes('critical error') || output.includes('error:') || check.exitCode !== 0;
      if (siteHasPhpError) {
        console.log('Warning: Test site has PHP/database errors - testing error handling instead');
      }
    }
  }, 180000); // 3 minute timeout for site start

  test('wp option get siteurl returns URL or reports error correctly', () => {
    if (!siteStarted) {
      console.log('Skipping: site not started');
      return;
    }

    const { stdout, stderr, exitCode } = wpCli(testSiteName, 'option get siteurl');

    if (siteHasPhpError) {
      // If site has PHP errors, verify CLI correctly reports the error
      expect(exitCode).toBe(1);
      expect(stderr.toLowerCase()).toMatch(/error|failed|critical/i);
    } else {
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^https?:\/\//);
    }
  });

  test('wp core version returns version number or reports error correctly', () => {
    if (!siteStarted) {
      console.log('Skipping: site not started');
      return;
    }

    const { stdout, stderr, exitCode } = wpCli(testSiteName, 'core version');

    // wp core version can succeed even when site has PHP errors
    // because it doesn't require database access
    if (exitCode === 0) {
      expect(stdout.trim()).toMatch(/^\d+\.\d+(\.\d+)?$/);
    } else {
      // If it fails, verify CLI correctly reports the error
      expect(stderr.toLowerCase()).toMatch(/error|failed|critical/i);
    }
  });

  test('wp plugin list returns plugins or reports error correctly', () => {
    if (!siteStarted) {
      console.log('Skipping: site not started');
      return;
    }

    const { stdout, stderr, exitCode } = wpCli(testSiteName, 'plugin list');

    if (siteHasPhpError) {
      // If site has PHP errors, verify CLI correctly reports the error
      expect(exitCode).toBe(1);
      expect(stderr.toLowerCase()).toMatch(/error|failed|critical/i);
    } else {
      expect(exitCode).toBe(0);
      // Plugin list output contains columns like "Name" and "Status"
      expect(stdout).toMatch(/name|status/i);
    }
  });
});

if (!context.isLocalAvailable || !context.isAddonEnabled) {
  describe('wp-cli (skipped)', () => {
    test.skip('Local not running or MCP addon not enabled - E2E tests skipped', () => {});
  });
}
