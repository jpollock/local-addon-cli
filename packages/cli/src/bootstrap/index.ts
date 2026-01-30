/**
 * Bootstrap System
 *
 * Handles zero-friction installation:
 * - Detects Local installation
 * - Installs addon if needed
 * - Activates addon if needed
 * - Starts Local if needed
 * - Waits for MCP server to be ready
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import {
  getLocalPaths,
  getAddonDirPath,
  ADDON_PACKAGE_NAME,
  LEGACY_ADDON_PACKAGE_NAME,
  LocalPaths,
} from './paths';

const execAsync = promisify(exec);

export interface ConnectionInfo {
  port: number;
  host: string;
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
 * Check if the addon is installed in Local's addons directory
 */
export function isAddonInstalled(): boolean {
  const paths = getLocalPaths();
  const addonPath = getAddonDirPath(paths.addonsDir);

  return fs.existsSync(addonPath) && fs.existsSync(path.join(addonPath, 'package.json'));
}

/**
 * Check if the addon is activated in enabled-addons.json
 * Supports both new and legacy package names
 */
export function isAddonActivated(): boolean {
  const paths = getLocalPaths();

  try {
    if (!fs.existsSync(paths.enabledAddonsFile)) {
      return false;
    }

    const content = fs.readFileSync(paths.enabledAddonsFile, 'utf-8');
    const enabledAddons = JSON.parse(content) as Record<string, boolean>;

    // Check for either new or legacy package name
    return (
      enabledAddons[ADDON_PACKAGE_NAME] === true ||
      enabledAddons[LEGACY_ADDON_PACKAGE_NAME] === true
    );
  } catch {
    return false;
  }
}

/**
 * Activate the addon by modifying enabled-addons.json
 * Returns true if a restart is needed
 */
export function activateAddon(): boolean {
  const paths = getLocalPaths();

  let enabledAddons: Record<string, boolean> = {};

  try {
    if (fs.existsSync(paths.enabledAddonsFile)) {
      const content = fs.readFileSync(paths.enabledAddonsFile, 'utf-8');
      enabledAddons = JSON.parse(content);
    }
  } catch {
    // Start with empty object
  }

  if (enabledAddons[ADDON_PACKAGE_NAME] === true) {
    return false; // Already active
  }

  enabledAddons[ADDON_PACKAGE_NAME] = true;
  fs.writeFileSync(paths.enabledAddonsFile, JSON.stringify(enabledAddons, null, 2));

  return true; // Restart needed
}

/**
 * Check if Local is currently running
 */
export async function isLocalRunning(): Promise<boolean> {
  const paths = getLocalPaths();

  try {
    if (process.platform === 'darwin') {
      const { stdout } = await execAsync(`pgrep -x "${paths.appName}"`);
      return stdout.trim().length > 0;
    } else if (process.platform === 'win32') {
      const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${paths.appName}"`);
      return stdout.includes(paths.appName);
    } else {
      const { stdout } = await execAsync(`pgrep -x "${paths.appName}"`);
      return stdout.trim().length > 0;
    }
  } catch {
    return false;
  }
}

/**
 * Start Local application
 */
export async function startLocal(): Promise<void> {
  const paths = getLocalPaths();

  if (process.platform === 'darwin') {
    await execAsync(`open -a "Local"`);
  } else if (process.platform === 'win32') {
    await execAsync(`start "" "${paths.appExecutable}"`);
  } else {
    await execAsync(`${paths.appExecutable} &`);
  }
}

/**
 * Stop Local application gracefully
 */
export async function stopLocal(): Promise<void> {
  const paths = getLocalPaths();

  try {
    if (process.platform === 'darwin') {
      await execAsync(`osascript -e 'quit app "Local"'`);
    } else if (process.platform === 'win32') {
      await execAsync(`taskkill /IM ${paths.appName}`);
    } else {
      await execAsync(`pkill -x ${paths.appName}`);
    }
  } catch {
    // Process may already be stopped
  }
}

/**
 * Read connection info from mcp-connection-info.json
 */
export function readConnectionInfo(): ConnectionInfo | null {
  const paths = getLocalPaths();

  try {
    if (!fs.existsSync(paths.connectionInfoFile)) {
      return null;
    }

    const content = fs.readFileSync(paths.connectionInfoFile, 'utf-8');
    const info = JSON.parse(content);

    // Parse host and port from URL if available
    let host = '127.0.0.1';
    let port = info.port || 5890;

    if (info.url) {
      try {
        const url = new URL(info.url);
        host = url.hostname;
        port = parseInt(url.port, 10) || port;
      } catch {
        // Use defaults
      }
    }

    return {
      port,
      host,
      authToken: info.authToken || '',
    };
  } catch {
    return null;
  }
}

/**
 * Wait for MCP server to be ready
 */
export async function waitForMcpServer(
  timeoutMs: number = 30000,
  pollIntervalMs: number = 500
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const connectionInfo = readConnectionInfo();

    if (connectionInfo) {
      try {
        const url = `http://${connectionInfo.host}:${connectionInfo.port}/health`;
        const response = await fetch(url);

        if (response.ok) {
          return true;
        }
      } catch {
        // Server not ready yet
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
 * Ensures Local and the addon are ready for CLI commands
 */
export async function bootstrap(options: { verbose?: boolean } = {}): Promise<BootstrapResult> {
  const actions: string[] = [];
  const log = (msg: string) => {
    actions.push(msg);
    if (options.verbose) {
      console.log(msg);
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

  // Check if addon is installed
  if (!isAddonInstalled()) {
    // TODO: Auto-install addon from GitHub releases or npm
    return {
      success: false,
      error: `Addon not installed. Please install ${ADDON_PACKAGE_NAME} in Local's addons directory.`,
      actions,
    };
  }

  // Check if addon is activated
  let needsRestart = false;
  if (!isAddonActivated()) {
    log('Activating addon...');
    needsRestart = activateAddon();
    log('Addon activated.');
  }

  // Check if Local is running
  const running = await isLocalRunning();

  if (needsRestart && running) {
    log('Restarting Local to load addon...');
    await stopLocal();
    await delay(2000);
    await startLocal();
    log('Local restarted.');
  } else if (!running) {
    log('Starting Local...');
    await startLocal();
    log('Local started.');
  }

  // Wait for MCP server
  log('Waiting for MCP server...');
  const ready = await waitForMcpServer();

  if (!ready) {
    return {
      success: false,
      error: 'Timed out waiting for MCP server. Is Local running with the addon enabled?',
      actions,
    };
  }

  log('MCP server ready.');

  // Read connection info
  const connectionInfo = readConnectionInfo();

  if (!connectionInfo) {
    return {
      success: false,
      error: 'Could not read connection info. Is the addon running?',
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
