/**
 * Bootstrap System
 *
 * Connects the CLI to Local's GraphQL server:
 * - Detects Local installation
 * - Installs and activates addon if needed
 * - Starts Local if needed
 * - Waits for GraphQL server to be ready
 * - Reads connection info
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { getLocalPaths, LocalPaths, ensureLocalExecutable } from './paths';

const execAsync = promisify(exec);

export interface ConnectionInfo {
  url: string;
  subscriptionUrl: string;
  port: number;
  authToken: string;
}

export interface BootstrapResult {
  success: boolean;
  connectionInfo?: ConnectionInfo;
  error?: string;
  actions: string[];
}

/**
 * Check if Local is installed
 */
export function isLocalInstalled(): boolean {
  const paths = getLocalPaths();

  try {
    if (process.platform === 'darwin') {
      return fs.existsSync(paths.appExecutable);
    } else if (process.platform === 'win32') {
      return fs.existsSync(paths.appExecutable);
    } else {
      // Linux - check if 'local' is in PATH or at expected location
      try {
        execSync('which local', { stdio: 'ignore' });
        return true;
      } catch {
        return fs.existsSync(paths.appExecutable);
      }
    }
  } catch {
    return false;
  }
}

/**
 * Check if Local is currently running
 */
export async function isLocalRunning(): Promise<boolean> {
  try {
    if (process.platform === 'darwin') {
      // Use pgrep with -f to match any process containing "Local"
      const { stdout } = await execAsync(`pgrep -f "Local.app"`);
      return stdout.trim().length > 0;
    } else if (process.platform === 'win32') {
      const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq Local.exe"`);
      return stdout.includes('Local.exe');
    } else {
      // Linux: check for Local (case-insensitive) or check connection info
      try {
        const { stdout } = await execAsync(`pgrep -fi "local"`);
        return stdout.trim().length > 0;
      } catch {
        // pgrep -i might not be supported, try both cases
        try {
          const { stdout: stdout1 } = await execAsync(`pgrep -f "Local"`);
          if (stdout1.trim().length > 0) return true;
        } catch {
          // Continue to lowercase check
        }
        const { stdout: stdout2 } = await execAsync(`pgrep -f "local"`);
        return stdout2.trim().length > 0;
      }
    }
  } catch {
    // pgrep returns non-zero if no processes found
    // Check if connection info exists as a fallback
    const connectionInfo = readConnectionInfo();
    return connectionInfo !== null;
  }
}

/**
 * Check if we can start GUI apps (have a display)
 */
function hasDisplay(): boolean {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return true;
  }
  // Linux: check for DISPLAY or WAYLAND_DISPLAY
  return !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

/**
 * Start Local application
 */
export async function startLocal(): Promise<void> {
  const paths = getLocalPaths();

  try {
    if (process.platform === 'darwin') {
      // Just activate Local - don't try to hide it (requires accessibility permissions)
      await execAsync(`open -a "Local"`);
    } else if (process.platform === 'win32') {
      // /MIN = start minimized
      await execAsync(`start /MIN "" "${paths.appExecutable}"`);
    } else {
      // Linux: check for display (SSH sessions won't have one)
      if (!hasDisplay()) {
        console.error('Cannot start Local: no display available (SSH session?)');
        console.error('Please start Local from the desktop before connecting via SSH.');
        return;
      }
      // Linux: ensure we have a valid executable path
      const executable = await ensureLocalExecutable();
      if (!executable) {
        console.error('Cannot start Local: executable not found');
        console.error('Download Local from: https://localwp.com');
        return;
      }
      await execAsync(`${executable} &`);
    }
  } catch {
    // Ignore errors - Local might already be running
  }
}

/**
 * Stop Local application
 */
export async function stopLocal(): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      await execAsync(`osascript -e 'quit app "Local"'`);
    } else if (process.platform === 'win32') {
      await execAsync(`taskkill /IM Local.exe /F`);
    } else {
      await execAsync(`pkill -f local`);
    }
  } catch {
    // Ignore errors - Local might not be running
  }
}

/**
 * Restart Local application
 */
export async function restartLocal(): Promise<void> {
  await stopLocal();
  // Wait a bit for the process to fully stop
  await delay(2000);
  await startLocal();
}

// ===========================================
// Addon Management
// ===========================================

/**
 * Addon directory name in Local's addons folder
 * Local uses @scope-name format (replaces / with -)
 */
const ADDON_DIR_NAME = '@local-labs-local-addon-cli';

/**
 * Addon key in enabled-addons.json (package name)
 */
const ADDON_ENABLED_KEY = '@local-labs-jpollock/local-addon-cli';

/**
 * Get the addon installation path
 */
export function getAddonPath(): string {
  const paths = getLocalPaths();
  return path.join(paths.addonsDir, ADDON_DIR_NAME);
}

/**
 * Check if the addon is installed in Local's addons directory
 */
export function isAddonInstalled(): boolean {
  const addonPath = getAddonPath();

  // Check for directory or symlink
  try {
    const stat = fs.lstatSync(addonPath);
    return stat.isDirectory() || stat.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Check if the addon is activated in enabled-addons.json
 */
export function isAddonActivated(): boolean {
  const paths = getLocalPaths();

  try {
    if (!fs.existsSync(paths.enabledAddonsFile)) {
      return false;
    }

    const content = fs.readFileSync(paths.enabledAddonsFile, 'utf-8');
    const enabledAddons: Record<string, boolean> = JSON.parse(content);

    return enabledAddons[ADDON_ENABLED_KEY] === true;
  } catch {
    return false;
  }
}

/**
 * Activate the addon by modifying enabled-addons.json
 * Returns true if restart is needed (addon was just activated)
 */
export function activateAddon(): boolean {
  const paths = getLocalPaths();

  try {
    let enabledAddons: Record<string, boolean> = {};

    if (fs.existsSync(paths.enabledAddonsFile)) {
      const content = fs.readFileSync(paths.enabledAddonsFile, 'utf-8');
      enabledAddons = JSON.parse(content);
    }

    // Check if already activated
    if (enabledAddons[ADDON_ENABLED_KEY] === true) {
      return false; // Already active, no restart needed
    }

    // Activate the addon
    enabledAddons[ADDON_ENABLED_KEY] = true;
    fs.writeFileSync(paths.enabledAddonsFile, JSON.stringify(enabledAddons, null, 2));

    // Verify write succeeded
    const verifyContent = fs.readFileSync(paths.enabledAddonsFile, 'utf-8');
    const verified = JSON.parse(verifyContent);
    if (verified[ADDON_ENABLED_KEY] !== true) {
      console.error('Warning: Failed to persist addon activation');
      return false;
    }

    return true; // Restart needed
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to activate addon: ${message}`);
    console.error(`File: ${paths.enabledAddonsFile}`);
    return false;
  }
}

/**
 * Copy a directory recursively
 */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Find the bundled addon path (included in npm package)
 * Located at addon-dist/ relative to the CLI package root
 */
function findBundledAddonPath(): string | null {
  // From lib/bootstrap/ -> addon-dist/
  const bundledPath = path.resolve(__dirname, '..', '..', 'addon-dist');

  if (fs.existsSync(path.join(bundledPath, 'package.json'))) {
    return bundledPath;
  }

  return null;
}

/**
 * Find the local development addon path (for dev mode)
 * Looks for the addon relative to the CLI package in monorepo
 */
function findDevAddonPath(): string | null {
  // Check if we're in the monorepo structure
  // Works from both lib/bootstrap (compiled) and src/bootstrap (ts-node)
  const cliDir = __dirname;
  const addonPath = path.resolve(cliDir, '..', '..', '..', 'addon');

  if (fs.existsSync(path.join(addonPath, 'package.json'))) {
    return addonPath;
  }

  return null;
}

/**
 * Install the addon from bundled package or create dev symlink
 */
export async function installAddon(
  options: {
    onStatus?: (status: string) => void;
  } = {}
): Promise<{ success: boolean; error?: string; needsRestart: boolean }> {
  const log = options.onStatus || (() => {});
  const paths = getLocalPaths();
  const addonPath = getAddonPath();

  try {
    // Ensure addons directory exists
    if (!fs.existsSync(paths.addonsDir)) {
      fs.mkdirSync(paths.addonsDir, { recursive: true });
    }

    // Try bundled addon first (production - included in npm package)
    const bundledAddonPath = findBundledAddonPath();

    if (bundledAddonPath) {
      log('Installing bundled addon...');

      // Copy bundled addon to Local's addons directory
      copyDirSync(bundledAddonPath, addonPath);

      log('Addon installed successfully.');
    } else {
      // Try development mode - create symlink to local addon in monorepo
      const devAddonPath = findDevAddonPath();

      if (devAddonPath) {
        log('Using development addon (symlink)...');

        fs.symlinkSync(devAddonPath, addonPath);
        log(`Created symlink: ${addonPath} -> ${devAddonPath}`);
      } else {
        throw new Error(
          'Addon not found. Please reinstall the CLI package: npm install -g @local-labs/local-cli'
        );
      }
    }

    // Activate the addon
    const needsRestart = activateAddon();

    return { success: true, needsRestart };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to install addon',
      needsRestart: false,
    };
  }
}

/**
 * Ensure addon is installed and activated
 */
export async function ensureAddon(
  options: {
    onStatus?: (status: string) => void;
  } = {}
): Promise<{ success: boolean; error?: string; needsRestart: boolean }> {
  const log = options.onStatus || (() => {});

  // Check if addon is installed
  if (!isAddonInstalled()) {
    log('Addon not installed. Installing...');
    const result = await installAddon(options);
    if (!result.success) {
      return result;
    }
    return { success: true, needsRestart: true };
  }

  // Check if addon is activated
  if (!isAddonActivated()) {
    const running = await isLocalRunning();

    if (running) {
      // Local is running - it controls enabled-addons.json
      // We can't activate by modifying the file while Local runs
      // Try stopping Local first, then activating, then starting
      if (process.platform === 'linux' && !hasDisplay()) {
        // SSH session - can't restart Local
        console.error('');
        console.error('The CLI addon is installed but needs to be activated.');
        console.error('');
        console.error('Please activate from Local desktop app:');
        console.error('  1. Open Local');
        console.error('  2. Go to Addons');
        console.error('  3. Enable "@local-labs-jpollock/local-addon-cli"');
        console.error('');
        console.error('Or restart Local from the desktop to auto-activate.');
        console.error('');
        // Try to continue anyway - maybe it works
        return { success: true, needsRestart: false };
      }

      log('Stopping Local to activate addon...');
      await stopLocal();

      // Wait a moment for Local to fully stop
      await new Promise((resolve) => setTimeout(resolve, 2000));

      log('Activating addon...');
      activateAddon();

      return { success: true, needsRestart: true };
    } else {
      // Local not running - safe to modify enabled-addons.json
      log('Activating addon...');
      const needsRestart = activateAddon();
      return { success: true, needsRestart };
    }
  }

  return { success: true, needsRestart: false };
}

// ===========================================
// Connection Info
// ===========================================

/**
 * Read GraphQL connection info from graphql-connection-info.json
 */
export function readConnectionInfo(): ConnectionInfo | null {
  const paths = getLocalPaths();

  try {
    if (!fs.existsSync(paths.graphqlConnectionInfoFile)) {
      return null;
    }

    const content = fs.readFileSync(paths.graphqlConnectionInfoFile, 'utf-8');
    const info = JSON.parse(content);

    return {
      url: info.url || `http://127.0.0.1:${info.port}/graphql`,
      subscriptionUrl: info.subscriptionUrl || `ws://127.0.0.1:${info.port}/graphql`,
      port: info.port,
      authToken: info.authToken || '',
    };
  } catch {
    return null;
  }
}

/**
 * Wait for GraphQL server to be ready
 */
export async function waitForGraphQL(
  timeoutMs: number = 30000,
  pollIntervalMs: number = 500
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const connectionInfo = readConnectionInfo();

    if (connectionInfo) {
      try {
        // Use AbortController for per-request timeout (2 seconds)
        const controller = new AbortController();
        const requestTimeout = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(connectionInfo.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${connectionInfo.authToken}`,
          },
          body: JSON.stringify({ query: '{ __typename }' }),
          signal: controller.signal,
        });

        clearTimeout(requestTimeout);

        if (response.ok) {
          return true;
        }
      } catch {
        // Server not ready yet - connection refused, timeout, etc.
      }
    }

    await delay(pollIntervalMs);
  }

  return false;
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main bootstrap function
 * Ensures addon is installed, Local is running, and GraphQL is accessible
 */
export async function bootstrap(
  options: {
    verbose?: boolean;
    skipAddonInstall?: boolean;
    onStatus?: (status: string) => void;
  } = {}
): Promise<BootstrapResult> {
  const actions: string[] = [];
  const log = (msg: string) => {
    actions.push(msg);
    if (options.verbose) {
      console.log(msg);
    }
    if (options.onStatus) {
      options.onStatus(msg);
    }
  };

  // Check if Local is installed
  if (!isLocalInstalled()) {
    return {
      success: false,
      error: 'Local is not installed. Download from https://localwp.com',
      actions,
    };
  }

  // Ensure addon is installed and activated (unless skipped)
  let needsRestart = false;
  if (!options.skipAddonInstall) {
    const addonResult = await ensureAddon({ onStatus: log });
    if (!addonResult.success) {
      return {
        success: false,
        error: addonResult.error || 'Failed to install addon',
        actions,
      };
    }
    needsRestart = addonResult.needsRestart;
  }

  // Check if Local is running
  const running = await isLocalRunning();

  if (needsRestart && running) {
    // Check if we can restart (need display on Linux)
    if (process.platform === 'linux' && !hasDisplay()) {
      log('Addon installed but requires Local restart to activate.');
      console.error('');
      console.error('Please restart Local from the desktop to activate the addon.');
      console.error('Then run this command again.');
      console.error('');
      // Try to continue anyway - addon might already be active
    } else {
      log('Restarting Local to activate addon...');
      await restartLocal();
    }
  } else if (!running) {
    log('Starting Local...');
    await startLocal();
  }

  // Wait for GraphQL server
  log('Waiting for GraphQL...');
  const ready = await waitForGraphQL();

  if (!ready) {
    return {
      success: false,
      error: 'Timed out waiting for Local. Is Local running?',
      actions,
    };
  }

  log('GraphQL server ready.');

  // Read connection info
  const connectionInfo = readConnectionInfo();

  if (!connectionInfo) {
    return {
      success: false,
      error: 'Could not read GraphQL connection info.',
      actions,
    };
  }

  return {
    success: true,
    connectionInfo,
    actions,
  };
}

export { getLocalPaths, LocalPaths };
