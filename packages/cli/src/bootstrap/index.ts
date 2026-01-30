/**
 * Bootstrap System
 *
 * Connects the CLI to Local's GraphQL server:
 * - Detects Local installation
 * - Starts Local if needed
 * - Waits for GraphQL server to be ready
 * - Reads connection info
 *
 * Note: The addon extends Local's GraphQL with additional operations
 * (backups, WPE sync, etc.) but is not required for basic site operations.
 */

import * as fs from 'fs';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { getLocalPaths, LocalPaths } from './paths';

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
 * Start Local application (minimized/background)
 */
export async function startLocal(): Promise<void> {
  const paths = getLocalPaths();

  if (process.platform === 'darwin') {
    // -g = don't bring to foreground, --hide = start hidden
    await execAsync(`open -g -a "Local"`);
  } else if (process.platform === 'win32') {
    // /MIN = start minimized
    await execAsync(`start /MIN "" "${paths.appExecutable}"`);
  } else {
    await execAsync(`${paths.appExecutable} &`);
  }
}

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
 * Ensures Local is running and GraphQL is accessible
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

  // Check if Local is running
  const running = await isLocalRunning();

  if (!running) {
    log('Starting Local...');
    await startLocal();
    log('Local started.');
  }

  // Wait for GraphQL server
  log('Waiting for Local GraphQL server...');
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
