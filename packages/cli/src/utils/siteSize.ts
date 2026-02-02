/**
 * Site Size Calculation Utility
 *
 * Uses native OS commands for efficient disk size calculation:
 * - macOS/Linux: du -sk (available since 1971!)
 * - Windows: PowerShell Get-ChildItem | Measure-Object
 */

import { execSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { getLocalPaths } from '../bootstrap/paths';

/**
 * Get directory size using native OS commands.
 * Returns size in bytes, or 0 if directory doesn't exist or can't be read.
 */
function getDirectorySize(dirPath: string): number {
  if (!existsSync(dirPath)) {
    return 0;
  }

  try {
    if (process.platform === 'win32') {
      // Windows: Use PowerShell
      const cmd = `powershell -Command "(Get-ChildItem -Recurse -Force '${dirPath}' -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum"`;
      const output = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
      return parseInt(output.trim(), 10) || 0;
    } else {
      // macOS/Linux: Use du (available since 1971!)
      const output = execSync(`du -sk "${dirPath}" 2>/dev/null`, {
        encoding: 'utf8',
        timeout: 60000,
      });
      // du -sk returns size in KB
      return (parseInt(output.split('\t')[0], 10) || 0) * 1024;
    }
  } catch {
    return 0; // Command failed (permissions, timeout, etc.)
  }
}

/**
 * Format bytes to human-readable string (e.g., "1.2 GB")
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '?';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  // More precision for larger units
  const precision = i >= 3 ? 2 : i >= 2 ? 1 : 0;
  return `${value.toFixed(precision)} ${units[i]}`;
}

export interface SiteSizeResult {
  bytes: number;
  formatted: string;
}

/**
 * Calculate total disk size for a site (files + runtime data).
 * Returns bytes and formatted string.
 */
export function getSiteSize(site: { id: string; path: string }): SiteSizeResult {
  const paths = getLocalPaths();

  // Expand ~ to home directory
  const sitePath = site.path.replace(/^~/, homedir());
  const runPath = join(paths.dataDir, 'run', site.id);

  // Calculate both directories
  const siteSize = getDirectorySize(sitePath);
  const runSize = getDirectorySize(runPath);
  const total = siteSize + runSize;

  return {
    bytes: total,
    formatted: formatBytes(total),
  };
}
