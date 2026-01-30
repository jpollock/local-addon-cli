/**
 * CLI Integration Tests
 *
 * Tests the CLI as a subprocess, exercising the actual binary.
 * These tests validate command-line argument parsing and help output.
 */

import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as path from 'path';

const CLI_PATH = path.resolve(__dirname, '../bin/lwp.js');

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function run(args: string): RunResult {
  const options: ExecSyncOptionsWithStringEncoding = {
    encoding: 'utf-8',
    cwd: path.resolve(__dirname, '..'),
  };

  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, options);
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status ?? 1,
    };
  }
}

describe('CLI', () => {
  describe('help and version', () => {
    it('shows help with --help flag', () => {
      const { stdout, exitCode } = run('--help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('lwp');
      expect(stdout).toContain('sites');
      expect(stdout).toContain('wp');
      expect(stdout).toContain('db');
      expect(stdout).toContain('backups');
      expect(stdout).toContain('wpe');
    });

    it('shows version with --version flag', () => {
      const { stdout, exitCode } = run('--version');

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('shows version with -V flag', () => {
      const { stdout, exitCode } = run('-V');

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('subcommand help', () => {
    it('shows sites subcommand help', () => {
      const { stdout, exitCode } = run('sites --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Manage WordPress sites');
      expect(stdout).toContain('list');
      expect(stdout).toContain('start');
      expect(stdout).toContain('stop');
      expect(stdout).toContain('create');
      expect(stdout).toContain('delete');
    });

    it('shows sites list options', () => {
      const { stdout, exitCode } = run('sites list --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--status');
      expect(stdout).toContain('running');
      expect(stdout).toContain('stopped');
    });

    it('shows db subcommand help', () => {
      const { stdout, exitCode } = run('db --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Database');
      expect(stdout).toContain('export');
      expect(stdout).toContain('import');
      expect(stdout).toContain('adminer');
    });

    it('shows backups subcommand help', () => {
      const { stdout, exitCode } = run('backups --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('backup');
      expect(stdout).toContain('list');
      expect(stdout).toContain('create');
      expect(stdout).toContain('restore');
    });

    it('shows wpe subcommand help', () => {
      const { stdout, exitCode } = run('wpe --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('WP Engine');
      expect(stdout).toContain('status');
      expect(stdout).toContain('login');
      expect(stdout).toContain('push');
      expect(stdout).toContain('pull');
    });

    it('shows blueprints subcommand help', () => {
      const { stdout, exitCode } = run('blueprints --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('blueprint');
      expect(stdout).toContain('list');
      expect(stdout).toContain('save');
    });
  });

  describe('global options', () => {
    it('accepts --json flag', () => {
      const { stdout } = run('--help');
      expect(stdout).toContain('--json');
    });

    it('accepts --quiet flag', () => {
      const { stdout } = run('--help');
      expect(stdout).toContain('--quiet');
    });

    it('accepts --no-color flag', () => {
      const { stdout } = run('--help');
      expect(stdout).toContain('--no-color');
    });
  });

  describe('error handling', () => {
    it('shows error for unknown command', () => {
      const { stderr, exitCode } = run('unknown-command');

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('unknown command');
    });

    it('shows error for unknown subcommand', () => {
      const { stderr, exitCode } = run('sites unknown-subcommand');

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('unknown command');
    });
  });
});
