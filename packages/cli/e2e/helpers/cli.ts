/**
 * CLI Runner for E2E Tests
 *
 * Executes CLI commands as subprocesses.
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../bin/lwp.js');

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runCLI(args: string, options?: { timeout?: number }): CLIResult {
  // Use spawnSync to properly capture both stdout and stderr
  const result = spawnSync('node', [CLI_PATH, ...args.split(/\s+/)], {
    encoding: 'utf-8',
    timeout: options?.timeout || 60000,
    cwd: path.resolve(__dirname, '../..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? 1,
  };
}

// Convenience functions
export function sitesList(options: string = ''): CLIResult {
  return runCLI(`sites list ${options}`);
}

export function sitesGet(site: string): CLIResult {
  return runCLI(`sites get ${site}`);
}

export function sitesStart(site: string): CLIResult {
  return runCLI(`sites start ${site}`, { timeout: 180000 }); // 3 min for cold start
}

export function sitesStop(site: string): CLIResult {
  return runCLI(`sites stop ${site}`, { timeout: 60000 });
}

export function wpCli(site: string, command: string): CLIResult {
  return runCLI(`wp ${site} ${command}`, { timeout: 60000 });
}
