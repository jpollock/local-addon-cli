/**
 * Platform-specific paths for Local
 *
 * The CLI talks directly to Local's GraphQL server - no addon required for basic operations.
 * The addon extends GraphQL with additional operations (backups, WPE sync, etc.)
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
  /** GraphQL connection info file path (Local's native GraphQL server) */
  graphqlConnectionInfoFile: string;
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
        graphqlConnectionInfoFile: path.join(dataDir, 'graphql-connection-info.json'),
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
        graphqlConnectionInfoFile: path.join(dataDir, 'graphql-connection-info.json'),
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
        graphqlConnectionInfoFile: path.join(dataDir, 'graphql-connection-info.json'),
        appExecutable: '/opt/Local/local',
        appName: 'local',
      };
    }

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get the addon package name
 */
export const ADDON_PACKAGE_NAME = '@local-labs-jpollock/local-addon-cli';
