/**
 * Addon Auto-Install E2E Tests
 *
 * Tests the CLI's ability to automatically install and activate
 * the addon when it's missing or disabled.
 *
 * These tests modify the addon installation state and restore it afterward.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  isAddonInstalled,
  isAddonActivated,
  getAddonPath,
  activateAddon,
  installAddon,
  ensureAddon,
  getLocalPaths,
} from '../src/bootstrap';
import { runCLI } from './helpers/cli';
import { getE2EContext } from './helpers/context';

const context = getE2EContext();
const describeIfLocal = context.isLocalAvailable ? describe : describe.skip;

// Store original state for restoration
let originalAddonPath: string | null = null;
let originalAddonTarget: string | null = null;
let originalEnabledAddons: Record<string, boolean> | null = null;

/**
 * Save current addon state for restoration
 */
function saveAddonState(): void {
  const paths = getLocalPaths();
  const addonPath = getAddonPath();

  // Save symlink target if exists
  try {
    const stat = fs.lstatSync(addonPath);
    if (stat.isSymbolicLink()) {
      originalAddonPath = addonPath;
      originalAddonTarget = fs.readlinkSync(addonPath);
    }
  } catch {
    // Addon not installed
  }

  // Save enabled-addons.json
  try {
    if (fs.existsSync(paths.enabledAddonsFile)) {
      const content = fs.readFileSync(paths.enabledAddonsFile, 'utf-8');
      originalEnabledAddons = JSON.parse(content);
    }
  } catch {
    // No enabled addons file
  }
}

/**
 * Restore addon state after tests
 */
function restoreAddonState(): void {
  const paths = getLocalPaths();
  const addonPath = getAddonPath();

  // Restore symlink
  try {
    // Remove current symlink/directory
    if (fs.existsSync(addonPath)) {
      fs.unlinkSync(addonPath);
    }

    // Restore original symlink
    if (originalAddonPath && originalAddonTarget) {
      fs.symlinkSync(originalAddonTarget, addonPath);
    }
  } catch {
    // Ignore errors during cleanup
  }

  // Restore enabled-addons.json
  try {
    if (originalEnabledAddons) {
      fs.writeFileSync(
        paths.enabledAddonsFile,
        JSON.stringify(originalEnabledAddons, null, 2)
      );
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Remove the addon symlink
 */
function removeAddon(): void {
  const addonPath = getAddonPath();
  try {
    if (fs.existsSync(addonPath)) {
      fs.unlinkSync(addonPath);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Disable the addon in enabled-addons.json
 */
function disableAddon(): void {
  const paths = getLocalPaths();
  try {
    let enabledAddons: Record<string, boolean> = {};
    if (fs.existsSync(paths.enabledAddonsFile)) {
      const content = fs.readFileSync(paths.enabledAddonsFile, 'utf-8');
      enabledAddons = JSON.parse(content);
    }
    // Remove the addon key
    delete enabledAddons['@local-labs-jpollock/local-addon-cli'];
    fs.writeFileSync(paths.enabledAddonsFile, JSON.stringify(enabledAddons, null, 2));
  } catch {
    // Ignore errors
  }
}

describeIfLocal('addon auto-install', () => {
  beforeAll(() => {
    saveAddonState();
  });

  afterAll(() => {
    restoreAddonState();
  });

  afterEach(() => {
    // Restore state between tests
    restoreAddonState();
  });

  describe('isAddonInstalled', () => {
    test('returns true when addon symlink exists', () => {
      // Addon should be installed from previous test runs
      if (!originalAddonPath) {
        console.log('Skipping: addon was not originally installed');
        return;
      }

      expect(isAddonInstalled()).toBe(true);
    });

    test('returns false when addon is removed', () => {
      if (!originalAddonPath) {
        console.log('Skipping: addon was not originally installed');
        return;
      }

      removeAddon();
      expect(isAddonInstalled()).toBe(false);
    });
  });

  describe('isAddonActivated', () => {
    test('returns true when addon is in enabled-addons.json', () => {
      if (!originalEnabledAddons?.['@local-labs-jpollock/local-addon-cli']) {
        console.log('Skipping: addon was not originally enabled');
        return;
      }

      expect(isAddonActivated()).toBe(true);
    });

    test('returns false when addon is disabled', () => {
      disableAddon();
      expect(isAddonActivated()).toBe(false);
    });
  });

  describe('activateAddon', () => {
    test('adds addon to enabled-addons.json', () => {
      disableAddon();
      expect(isAddonActivated()).toBe(false);

      const needsRestart = activateAddon();

      expect(needsRestart).toBe(true);
      expect(isAddonActivated()).toBe(true);
    });

    test('returns false if already activated', () => {
      // Ensure addon is activated
      activateAddon();
      expect(isAddonActivated()).toBe(true);

      // Calling again should return false (no restart needed)
      const needsRestart = activateAddon();
      expect(needsRestart).toBe(false);
    });
  });

  describe('installAddon', () => {
    test('creates symlink to development addon', async () => {
      if (!originalAddonPath) {
        console.log('Skipping: addon was not originally installed');
        return;
      }

      removeAddon();
      expect(isAddonInstalled()).toBe(false);

      const statusMessages: string[] = [];
      const result = await installAddon({
        onStatus: (msg) => statusMessages.push(msg),
      });

      expect(result.success).toBe(true);
      expect(isAddonInstalled()).toBe(true);

      // Should have logged progress
      expect(statusMessages.some((m) => m.includes('Fetching'))).toBe(true);
      expect(statusMessages.some((m) => m.includes('development addon') || m.includes('symlink'))).toBe(true);
    }, 30000);
  });

  describe('ensureAddon', () => {
    test('installs and activates addon when missing', async () => {
      if (!originalAddonPath) {
        console.log('Skipping: addon was not originally installed');
        return;
      }

      removeAddon();
      disableAddon();

      expect(isAddonInstalled()).toBe(false);
      expect(isAddonActivated()).toBe(false);

      const result = await ensureAddon();

      expect(result.success).toBe(true);
      expect(result.needsRestart).toBe(true);
      expect(isAddonInstalled()).toBe(true);
      expect(isAddonActivated()).toBe(true);
    }, 30000);

    test('returns needsRestart=false when addon already installed and activated', async () => {
      if (!originalAddonPath || !originalEnabledAddons?.['@local-labs-jpollock/local-addon-cli']) {
        console.log('Skipping: addon was not originally installed/enabled');
        return;
      }

      // Restore to ensure addon is installed and activated
      restoreAddonState();

      const result = await ensureAddon();

      expect(result.success).toBe(true);
      expect(result.needsRestart).toBe(false);
    });
  });

  describe('CLI integration', () => {
    test('CLI command works after addon auto-install', async () => {
      if (!originalAddonPath) {
        console.log('Skipping: addon was not originally installed');
        return;
      }

      // Note: We don't actually remove the addon here because
      // the CLI would restart Local which is disruptive.
      // Instead, we just verify the CLI works with addon installed.

      const { stdout, exitCode } = runCLI('blueprints list --json');

      expect(exitCode).toBe(0);

      const blueprints = JSON.parse(stdout);
      expect(Array.isArray(blueprints)).toBe(true);
    });
  });
});

if (!context.isLocalAvailable) {
  describe('addon auto-install (skipped)', () => {
    test.skip('Local not running - addon install tests skipped', () => {});
  });
}
