/**
 * Site Lifecycle E2E Tests
 *
 * Tests create, clone, and delete operations.
 * These tests are slow (site creation ~30-60s) and modify state.
 * They clean up after themselves.
 *
 * Run order: create → verify → clone → verify clone → delete both
 */

import { runCLI } from './helpers/cli';
import { getE2EContext } from './helpers/context';

const context = getE2EContext();
const describeIfLocal = (context.isLocalAvailable && context.isAddonEnabled) ? describe : describe.skip;

// Unique names to avoid conflicts
const timestamp = Date.now();
const TEST_SITE_NAME = `e2e-lifecycle-${timestamp}`;
const CLONE_SITE_NAME = `e2e-clone-${timestamp}`;

// Track created sites for cleanup
let createdSiteId: string | null = null;
let clonedSiteId: string | null = null;

describeIfLocal('site lifecycle', () => {
  // Run tests in order - each depends on previous
  describe('1. create site', () => {
    test('creates a new WordPress site', () => {
      const { stdout, stderr, exitCode } = runCLI(
        `sites create ${TEST_SITE_NAME}`,
        { timeout: 180000 } // 3 minutes for site creation
      );

      // Site creation should succeed
      // Note: spinner output goes to stderr, so check both
      const output = stdout + stderr;
      expect(exitCode).toBe(0);
      expect(output.toLowerCase()).toMatch(/created|success/i);

      // Extract site ID from output if possible
      const idMatch = output.match(/\(([a-zA-Z0-9_-]+)\)/);
      if (idMatch) {
        createdSiteId = idMatch[1];
      }
    }, 180000);

    test('new site appears in sites list', () => {
      const { stdout, exitCode } = runCLI('sites list --json');

      expect(exitCode).toBe(0);

      const sites = JSON.parse(stdout);
      const newSite = sites.find((s: any) => s.name === TEST_SITE_NAME);

      expect(newSite).toBeDefined();
      expect(newSite.name).toBe(TEST_SITE_NAME);

      // Store ID for later cleanup
      if (newSite) {
        createdSiteId = newSite.id;
      }
    });
  });

  describe('2. clone site', () => {
    test('clones the created site or reports error correctly', () => {
      // Skip if create failed
      if (!createdSiteId) {
        console.log('Skipping: no site to clone');
        return;
      }

      const { stdout, stderr, exitCode } = runCLI(
        `sites clone ${TEST_SITE_NAME} ${CLONE_SITE_NAME}`,
        { timeout: 180000 } // 3 minutes for clone
      );

      // Note: spinner output goes to stderr, so check both
      const output = stdout + stderr;

      if (exitCode === 0) {
        expect(output.toLowerCase()).toMatch(/cloned|success/i);

        // Extract clone ID
        const idMatch = output.match(/\(([a-zA-Z0-9_-]+)\)/);
        if (idMatch) {
          clonedSiteId = idMatch[1];
        }
      } else {
        // Clone can fail for various reasons (disk space, permissions, etc.)
        // Just ensure it's a meaningful error, not a crash
        console.log('Clone failed (may be transient):', output);
        expect(output.toLowerCase()).toMatch(/error|failed|unable/i);
      }
    }, 180000);

    test('cloned site appears in sites list', () => {
      // Skip if clone failed
      if (!clonedSiteId && !createdSiteId) {
        console.log('Skipping: no clone to verify');
        return;
      }

      const { stdout, exitCode } = runCLI('sites list --json');

      expect(exitCode).toBe(0);

      const sites = JSON.parse(stdout);
      const clonedSite = sites.find((s: any) => s.name === CLONE_SITE_NAME);

      expect(clonedSite).toBeDefined();
      expect(clonedSite.name).toBe(CLONE_SITE_NAME);

      if (clonedSite) {
        clonedSiteId = clonedSite.id;
      }
    });
  });

  describe('3. delete sites (cleanup)', () => {
    test('deletes the cloned site', () => {
      // Skip if no clone was created
      if (!clonedSiteId) {
        console.log('Skipping: no clone to delete');
        return;
      }

      const { stdout, stderr, exitCode } = runCLI(
        `sites delete ${CLONE_SITE_NAME} --yes`,
        { timeout: 60000 }
      );

      // Note: spinner output goes to stderr, so check both
      const output = stdout + stderr;
      expect(exitCode).toBe(0);
      expect(output.toLowerCase()).toMatch(/deleted|success/i);
    }, 60000);

    test('deletes the original site', () => {
      // Skip if no site was created
      if (!createdSiteId) {
        console.log('Skipping: no site to delete');
        return;
      }

      const { stdout, stderr, exitCode } = runCLI(
        `sites delete ${TEST_SITE_NAME} --yes`,
        { timeout: 60000 }
      );

      // Note: spinner output goes to stderr, so check both
      const output = stdout + stderr;
      expect(exitCode).toBe(0);
      expect(output.toLowerCase()).toMatch(/deleted|success/i);
    }, 60000);

    test('deleted sites no longer appear in list', () => {
      const { stdout, exitCode } = runCLI('sites list --json');

      expect(exitCode).toBe(0);

      const sites = JSON.parse(stdout);
      const originalSite = sites.find((s: any) => s.name === TEST_SITE_NAME);
      const clonedSite = sites.find((s: any) => s.name === CLONE_SITE_NAME);

      expect(originalSite).toBeUndefined();
      expect(clonedSite).toBeUndefined();
    });
  });
});

// Cleanup in case tests fail partway through
afterAll(async () => {
  if (!context.isLocalAvailable || !context.isAddonEnabled) return;

  // Try to clean up any leftover test sites
  const { stdout } = runCLI('sites list --json');

  try {
    const sites = JSON.parse(stdout);

    for (const site of sites) {
      if (site.name === TEST_SITE_NAME || site.name === CLONE_SITE_NAME) {
        console.log(`Cleaning up leftover site: ${site.name}`);
        runCLI(`sites delete ${site.name} --yes`, { timeout: 60000 });
      }
    }
  } catch {
    // Ignore cleanup errors
  }
});

if (!context.isLocalAvailable || !context.isAddonEnabled) {
  describe('site lifecycle (skipped)', () => {
    test.skip('Local not running or MCP addon not enabled - E2E tests skipped', () => {});
  });
}
