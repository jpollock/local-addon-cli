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
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { getLocalPaths, LocalPaths, ADDON_PACKAGE_NAME } from './paths';

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
      // Also check if GraphQL connection info exists and is recent
      const { stdout } = await execAsync(`pgrep -f "Local.app"`);
      return stdout.trim().length > 0;
    } else if (process.platform === 'win32') {
      const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq Local.exe"`);
      return stdout.includes('Local.exe');
    } else {
      const { stdout } = await execAsync(`pgrep -f "local"`);
      return stdout.trim().length > 0;
    }
  } catch {
    // pgrep returns non-zero if no processes found
    // Check if connection info exists as a fallback
    const connectionInfo = readConnectionInfo();
    return connectionInfo !== null;
  }
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
      await execAsync(`${paths.appExecutable} &`);
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
const ADDON_DIR_NAME = '@local-labs-local-addon-cli-mcp';

/**
 * Addon key in enabled-addons.json (package name)
 */
const ADDON_ENABLED_KEY = '@local-labs/local-addon-cli-mcp';

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

    return true; // Restart needed
  } catch {
    return false;
  }
}

/**
 * GitHub release asset info
 */
interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

/**
 * Fetch the latest release from GitHub
 */
async function fetchLatestRelease(repo: string): Promise<GitHubRelease> {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'local-cli',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch release: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<GitHubRelease>;
}

/**
 * Download a file from URL to destination
 */
async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'local-cli' },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  // Create directory if needed
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Use stream pipeline for efficient download
  const fileStream = createWriteStream(dest);
  await pipeline(response.body!, fileStream);
}

/**
 * Extract a .tgz file to a directory
 */
async function extractTgz(tgzPath: string, destDir: string): Promise<void> {
  // Create destination directory
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Use tar to extract (available on macOS, Linux, and Windows with Git)
  await execAsync(`tar -xzf "${tgzPath}" -C "${destDir}" --strip-components=1`);
}

/**
 * Find the local development addon path (for dev mode)
 * Looks for the addon relative to the CLI package
 */
function findDevAddonPath(): string | null {
  // Check if we're in the monorepo structure
  const cliDir = __dirname;

  // Try relative path from lib/bootstrap to packages/addon
  const monorepoPath = path.resolve(cliDir, '..', '..', '..', 'addon');
  if (fs.existsSync(path.join(monorepoPath, 'package.json'))) {
    return monorepoPath;
  }

  // Try from src/bootstrap (dev mode with ts-node)
  const devPath = path.resolve(cliDir, '..', '..', '..', 'addon');
  if (fs.existsSync(path.join(devPath, 'package.json'))) {
    return devPath;
  }

  return null;
}

/**
 * Install the addon from GitHub Releases or create dev symlink
 */
export async function installAddon(options: {
  onStatus?: (status: string) => void;
} = {}): Promise<{ success: boolean; error?: string; needsRestart: boolean }> {
  const log = options.onStatus || (() => {});
  const paths = getLocalPaths();
  const addonPath = getAddonPath();

  try {
    log('Fetching latest addon release...');

    // Try to fetch from GitHub first
    let release: GitHubRelease | null = null;
    try {
      release = await fetchLatestRelease('getflywheel/local-addon-cli-mcp');
    } catch {
      // GitHub release not available - try dev mode
    }

    if (release) {
      // Find the .tgz asset
      const tgzAsset = release.assets.find((a) => a.name.endsWith('.tgz'));
      if (!tgzAsset) {
        throw new Error('No .tgz asset found in release');
      }

      log(`Downloading ${release.tag_name}...`);

      // Download to temp location
      const tempPath = path.join(paths.dataDir, 'addon-download.tgz');
      await downloadFile(tgzAsset.browser_download_url, tempPath);

      log('Extracting addon...');

      // Extract to addons directory
      await extractTgz(tempPath, addonPath);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      log('Addon installed successfully.');
    } else {
      // Try development mode - create symlink to local addon
      const devAddonPath = findDevAddonPath();

      if (devAddonPath) {
        log('GitHub release not found. Using development addon...');

        // Create symlink
        if (!fs.existsSync(paths.addonsDir)) {
          fs.mkdirSync(paths.addonsDir, { recursive: true });
        }

        fs.symlinkSync(devAddonPath, addonPath);
        log(`Created symlink: ${addonPath} -> ${devAddonPath}`);
      } else {
        throw new Error(
          'Addon release not found on GitHub and no local development addon available. ' +
          'Visit https://github.com/getflywheel/local-addon-cli-mcp for installation instructions.'
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
export async function ensureAddon(options: {
  onStatus?: (status: string) => void;
} = {}): Promise<{ success: boolean; error?: string; needsRestart: boolean }> {
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
    log('Activating addon...');
    const needsRestart = activateAddon();
    return { success: true, needsRestart };
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
export async function bootstrap(options: {
  verbose?: boolean;
  skipAddonInstall?: boolean;
  onStatus?: (status: string) => void;
} = {}): Promise<BootstrapResult> {
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
    log('Restarting Local to activate addon...');
    await restartLocal();
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
