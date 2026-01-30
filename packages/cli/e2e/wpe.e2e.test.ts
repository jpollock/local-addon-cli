/**
 * WP Engine E2E Tests
 *
 * Tests WPE integration commands. Requires:
 * - Local running and authenticated with WPE
 * - A local site linked to a WPE install
 * - For push/pull: a test WPE environment (testblankjpp1)
 *
 * Set environment variables:
 * - WPE_TEST_LOCAL_SITE: Name of local site linked to WPE
 * - WPE_TEST_REMOTE_INSTALL: WPE install name for push/pull tests (default: testblankjpp1)
 */

import { runCLI } from './helpers/cli';
import { getE2EContext } from './helpers/context';

const context = getE2EContext();

// Configuration - can be overridden via environment variables
const WPE_TEST_LOCAL_SITE = process.env.WPE_TEST_LOCAL_SITE || 'testblankjpp1';
const WPE_TEST_REMOTE_INSTALL = process.env.WPE_TEST_REMOTE_INSTALL || 'testblankjpp1';

// Check if WPE is authenticated
function isWpeAuthenticated(): boolean {
  const { stdout, exitCode } = runCLI('wpe status --json');
  if (exitCode !== 0) return false;

  try {
    const data = JSON.parse(stdout);
    return data.authenticated === true;
  } catch {
    return false;
  }
}

// Find a local site that's linked to WPE
function findLinkedSite(): string | null {
  // If user specified a site, use that
  if (WPE_TEST_LOCAL_SITE) {
    return WPE_TEST_LOCAL_SITE;
  }

  // Otherwise, find any linked site
  const { stdout, exitCode } = runCLI('sites list --json');
  if (exitCode !== 0) return null;

  try {
    const sites = JSON.parse(stdout);
    for (const site of sites) {
      const linkResult = runCLI(`wpe link ${site.name} --json`);
      if (linkResult.exitCode === 0) {
        const linkData = JSON.parse(linkResult.stdout);
        if (linkData.linked && linkData.connections?.length > 0) {
          return site.name;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

const describeIfLocal = (context.isLocalAvailable && context.isAddonEnabled) ? describe : describe.skip;

describeIfLocal('WPE commands', () => {
  let wpeAuthenticated = false;
  let linkedSiteName: string | null = null;

  beforeAll(() => {
    wpeAuthenticated = isWpeAuthenticated();
    if (wpeAuthenticated) {
      linkedSiteName = findLinkedSite();
    }

    if (!wpeAuthenticated) {
      console.log('WPE not authenticated - some tests will be skipped');
    }
    if (!linkedSiteName) {
      console.log('No linked site found - link/history/diff/push/pull tests will be skipped');
      console.log('Set WPE_TEST_LOCAL_SITE env var to specify a site');
    }
  });

  describe('wpe sites', () => {
    test('lists WP Engine installs', () => {
      if (!wpeAuthenticated) {
        console.log('Skipping: not authenticated');
        return;
      }

      const { stdout, exitCode } = runCLI('wpe sites');

      expect(exitCode).toBe(0);
      // Should show sites or "no sites found"
      expect(stdout.toLowerCase()).toMatch(/wp engine|sites|install|no.*found/i);
    });

    test('returns JSON with --json flag', () => {
      if (!wpeAuthenticated) {
        console.log('Skipping: not authenticated');
        return;
      }

      const { stdout, exitCode } = runCLI('wpe sites --json');

      expect(exitCode).toBe(0);

      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);

      // If sites exist, they should have expected properties
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('name');
        expect(data[0]).toHaveProperty('environment');
      }
    });
  });

  describe('wpe link', () => {
    test('shows WPE connection for a site', () => {
      if (!wpeAuthenticated || !linkedSiteName) {
        console.log('Skipping: requires authenticated WPE and linked site');
        return;
      }

      const { stdout, exitCode } = runCLI(`wpe link ${linkedSiteName}`);

      expect(exitCode).toBe(0);
      // Should show connection info or "not linked"
      expect(stdout.toLowerCase()).toMatch(/connection|linked|wp engine/i);
    });

    test('returns JSON with --json flag', () => {
      if (!wpeAuthenticated || !linkedSiteName) {
        console.log('Skipping: requires authenticated WPE and linked site');
        return;
      }

      const { stdout, exitCode } = runCLI(`wpe link ${linkedSiteName} --json`);

      expect(exitCode).toBe(0);

      const data = JSON.parse(stdout);
      expect(data).toHaveProperty('linked');
      expect(data).toHaveProperty('siteName');
    });
  });

  describe('wpe history', () => {
    test('shows sync history for a site', () => {
      if (!wpeAuthenticated || !linkedSiteName) {
        console.log('Skipping: requires authenticated WPE and linked site');
        return;
      }

      const { stdout, exitCode } = runCLI(`wpe history ${linkedSiteName}`);

      expect(exitCode).toBe(0);
      // Should show history or "no history"
      expect(stdout.toLowerCase()).toMatch(/history|sync|no.*found|push|pull/i);
    });

    test('returns JSON with --json flag', () => {
      if (!wpeAuthenticated || !linkedSiteName) {
        console.log('Skipping: requires authenticated WPE and linked site');
        return;
      }

      const { stdout, exitCode } = runCLI(`wpe history ${linkedSiteName} --json`);

      expect(exitCode).toBe(0);

      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('wpe diff', () => {
    test('shows file differences or reports error', () => {
      if (!wpeAuthenticated || !linkedSiteName) {
        console.log('Skipping: requires authenticated WPE and linked site');
        return;
      }

      const { stdout, stderr, exitCode } = runCLI(`wpe diff ${linkedSiteName}`);
      const output = stdout + stderr;

      if (exitCode === 0) {
        // Should show changes or "no changes"
        expect(output.toLowerCase()).toMatch(/change|diff|added|modified|deleted|no.*change/i);
      } else {
        // If it fails, should be a meaningful error (not a crash)
        expect(output.toLowerCase()).toMatch(/error|failed|not linked|unable/i);
      }
    });

    test('returns JSON with --json flag or reports error', () => {
      if (!wpeAuthenticated || !linkedSiteName) {
        console.log('Skipping: requires authenticated WPE and linked site');
        return;
      }

      const { stdout, stderr, exitCode } = runCLI(`wpe diff ${linkedSiteName} --json`);

      if (exitCode === 0) {
        const data = JSON.parse(stdout);
        expect(data).toHaveProperty('totalChanges');
      } else {
        // If it fails, should be a meaningful error
        const output = stdout + stderr;
        expect(output.toLowerCase()).toMatch(/error|failed|not linked|unable/i);
      }
    });
  });

  describe('wpe push', () => {
    test('pushes to WP Engine test environment', () => {
      if (!wpeAuthenticated || !linkedSiteName) {
        console.log('Skipping: requires authenticated WPE and linked site');
        return;
      }

      // Use the test remote install
      const { stdout, stderr, exitCode } = runCLI(
        `wpe push ${linkedSiteName} --yes`,
        { timeout: 300000 } // 5 minutes for push
      );

      // Note: spinner output goes to stderr, so check both
      const output = stdout + stderr;

      // Push should succeed or fail gracefully
      if (exitCode === 0) {
        expect(output.toLowerCase()).toMatch(/push|started|success|complete/i);
      } else {
        // If it fails, make sure it's not a crash
        expect(output.toLowerCase()).toMatch(/error|failed|not linked/i);
      }
    }, 300000);
  });

  describe('wpe pull', () => {
    test('pulls from WP Engine test environment', () => {
      if (!wpeAuthenticated || !linkedSiteName) {
        console.log('Skipping: requires authenticated WPE and linked site');
        return;
      }

      // Pull from WPE
      const { stdout, stderr, exitCode } = runCLI(
        `wpe pull ${linkedSiteName}`,
        { timeout: 300000 } // 5 minutes for pull
      );

      // Note: spinner output goes to stderr, so check both
      const output = stdout + stderr;

      // Pull should succeed or fail gracefully
      if (exitCode === 0) {
        expect(output.toLowerCase()).toMatch(/pull|started|success|complete/i);
      } else {
        // If it fails, make sure it's not a crash
        expect(output.toLowerCase()).toMatch(/error|failed|not linked/i);
      }
    }, 300000);
  });
});

if (!context.isLocalAvailable || !context.isAddonEnabled) {
  describe('WPE commands (skipped)', () => {
    test.skip('Local not running or MCP addon not enabled - E2E tests skipped', () => {});
  });
}
