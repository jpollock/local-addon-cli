/**
 * Platform-specific paths for Local and the CLI addon
 */

import * as os from 'os';
import * as path from 'path';

export interface LocalPaths {
  /** Local application data directory */
  dataDir: string;
  /** Addons installation directory */
  addonsDir: string;
  /** enabled-addons.json file path */
  enabledAddonsFile: string;
  /** MCP connection info file path */
  connectionInfoFile: string;
  /** Local application executable path */
  appExecutable: string;
  /** Local application name (for process detection) */
  appName: string;
}

/**
 * Get platform-specific paths for Local
 */
export function getLocalPaths(): LocalPaths {
  const platform = process.platform;
  const home = os.homedir();

  switch (platform) {
    case 'darwin': {
      const dataDir = path.join(home, 'Library', 'Application Support', 'Local');
      return {
        dataDir,
        addonsDir: path.join(dataDir, 'addons'),
        enabledAddonsFile: path.join(dataDir, 'enabled-addons.json'),
        connectionInfoFile: path.join(dataDir, 'mcp-connection-info.json'),
        appExecutable: '/Applications/Local.app',
        appName: 'Local',
      };
    }

    case 'win32': {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      const dataDir = path.join(appData, 'Local');
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      return {
        dataDir,
        addonsDir: path.join(dataDir, 'addons'),
        enabledAddonsFile: path.join(dataDir, 'enabled-addons.json'),
        connectionInfoFile: path.join(dataDir, 'mcp-connection-info.json'),
        appExecutable: path.join(programFiles, 'Local', 'Local.exe'),
        appName: 'Local.exe',
      };
    }

    case 'linux': {
      const dataDir = path.join(home, '.config', 'Local');
      return {
        dataDir,
        addonsDir: path.join(dataDir, 'addons'),
        enabledAddonsFile: path.join(dataDir, 'enabled-addons.json'),
        connectionInfoFile: path.join(dataDir, 'mcp-connection-info.json'),
        appExecutable: '/opt/Local/local',
        appName: 'local',
      };
    }

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get the addon package name (new name)
 */
export const ADDON_PACKAGE_NAME = '@local-labs/local-addon-cli-mcp';

/**
 * Legacy addon package name (for backwards compatibility)
 */
export const LEGACY_ADDON_PACKAGE_NAME = '@local-labs/local-addon-mcp-server';

/**
 * Get the addon directory name (scoped package structure)
 */
export function getAddonDirPath(addonsDir: string): string {
  // Check for new name first
  const newPath = path.join(addonsDir, '@local-labs', 'local-addon-cli-mcp');
  if (require('fs').existsSync(newPath)) {
    return newPath;
  }

  // Fall back to legacy name
  return path.join(addonsDir, '@local-labs', 'local-addon-mcp-server');
}
