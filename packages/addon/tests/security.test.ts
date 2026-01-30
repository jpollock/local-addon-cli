/**
 * Security feature tests for MCP Server
 *
 * Tests for:
 * - HIGH-1: confirm requirement for pull_from_wpe
 * - HIGH-2: WP-CLI command blocklist (now uses production helpers)
 * - MEDIUM-2: Snapshot ID format validation
 * - MEDIUM-3: SQL path traversal protection (now uses production helpers)
 * - PERF-4: Timeout handling
 */

import {
  isBlockedWpCommand,
  BLOCKED_WP_COMMANDS,
  isValidSqlPath,
  isValidFilePath,
} from '../src/main/mcp/tools/helpers';

describe('Security Features', () => {
  describe('isValidSnapshotId', () => {
    // Extracted logic from bin/mcp-stdio.js for testing
    const isValidSnapshotId = (snapshotId: string | null | undefined): boolean => {
      if (!snapshotId || typeof snapshotId !== 'string') return false;
      // Restic snapshot IDs are hex strings, 8-64 characters (short prefix or full hash)
      return /^[a-f0-9]{8,64}$/i.test(snapshotId);
    };

    it('should accept valid 8-character snapshot ID prefixes', () => {
      expect(isValidSnapshotId('1b6ea6c9')).toBe(true);
      expect(isValidSnapshotId('abcdef12')).toBe(true);
      expect(isValidSnapshotId('ABCDEF12')).toBe(true); // Case insensitive
    });

    it('should accept valid 64-character full snapshot hashes', () => {
      expect(isValidSnapshotId('1b6ea6c9b2bd83af3c91adc4a455b6d900273a3bac87d4664b5300b80fe0fbbc')).toBe(true);
    });

    it('should reject IDs shorter than 8 characters', () => {
      expect(isValidSnapshotId('1234567')).toBe(false);
      expect(isValidSnapshotId('abc')).toBe(false);
    });

    it('should reject IDs longer than 64 characters', () => {
      expect(isValidSnapshotId('a'.repeat(65))).toBe(false);
    });

    it('should reject non-hex characters', () => {
      expect(isValidSnapshotId('1234567g')).toBe(false); // 'g' is not hex
      expect(isValidSnapshotId('snapshot!')).toBe(false);
      expect(isValidSnapshotId('12345678 ')).toBe(false); // trailing space
    });

    it('should reject SQL injection attempts', () => {
      expect(isValidSnapshotId("'; DROP TABLE snapshots; --")).toBe(false);
      expect(isValidSnapshotId('1234567; rm -rf /')).toBe(false);
    });

    it('should reject null, undefined, and empty strings', () => {
      expect(isValidSnapshotId(null)).toBe(false);
      expect(isValidSnapshotId(undefined)).toBe(false);
      expect(isValidSnapshotId('')).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(isValidSnapshotId(12345678 as unknown as string)).toBe(false);
      expect(isValidSnapshotId({} as unknown as string)).toBe(false);
    });
  });

  describe('isValidSqlPath (Production Implementation)', () => {
    // Using production isValidSqlPath from helpers.ts
    // Production function checks: ends with .sql AND path is in allowed directory (home, tmp)
    const os = require('os');
    const homeDir = os.homedir();

    it('should accept valid .sql file paths in allowed directories', () => {
      expect(isValidSqlPath('/tmp/backup.sql')).toBe(true);
      expect(isValidSqlPath(`${homeDir}/backup.sql`)).toBe(true);
      expect(isValidSqlPath(`${homeDir}/Downloads/database.sql`)).toBe(true);
    });

    it('should reject non-.sql files', () => {
      expect(isValidSqlPath('/tmp/backup.txt')).toBe(false);
      expect(isValidSqlPath('/tmp/backup.sql.php')).toBe(false);
      expect(isValidSqlPath('/tmp/backup')).toBe(false);
    });

    it('should reject paths outside allowed directories', () => {
      // Even if they end in .sql, paths outside home/tmp are rejected
      expect(isValidSqlPath('/etc/passwd.sql')).toBe(false);
      expect(isValidSqlPath('/var/log/test.sql')).toBe(false);
    });

    it('should reject null, undefined, and empty strings', () => {
      expect(isValidSqlPath(null)).toBe(false);
      expect(isValidSqlPath(undefined)).toBe(false);
      expect(isValidSqlPath('')).toBe(false);
    });
  });

  describe('isValidFilePath (Production Implementation)', () => {
    // Using production isValidFilePath from helpers.ts
    const os = require('os');
    const homeDir = os.homedir();

    it('should accept paths in home directory', () => {
      expect(isValidFilePath(`${homeDir}/test.zip`)).toBe(true);
      expect(isValidFilePath(`${homeDir}/Downloads/site.zip`)).toBe(true);
    });

    it('should accept paths in tmp directory', () => {
      expect(isValidFilePath('/tmp/test.zip')).toBe(true);
      expect(isValidFilePath('/tmp/subdir/test.zip')).toBe(true);
    });

    it('should reject paths outside allowed directories', () => {
      expect(isValidFilePath('/etc/passwd')).toBe(false);
      expect(isValidFilePath('/var/log/test.log')).toBe(false);
      expect(isValidFilePath('/usr/bin/dangerous')).toBe(false);
    });
  });

  describe('WP-CLI Command Blocklist (Production Implementation)', () => {
    // Using production isBlockedWpCommand from helpers.ts

    it('should have blocked commands defined', () => {
      expect(BLOCKED_WP_COMMANDS).toContain('eval');
      expect(BLOCKED_WP_COMMANDS).toContain('shell');
      expect(BLOCKED_WP_COMMANDS).toContain('db query');
      expect(BLOCKED_WP_COMMANDS).toContain('db cli');
    });

    it('should block eval command', () => {
      expect(isBlockedWpCommand(['eval', 'echo "hello";'])).toBe('eval');
      expect(isBlockedWpCommand(['wp', 'eval', '"echo 1;"'])).toBe('eval');
    });

    it('should block eval-file command', () => {
      // Note: 'eval-file' matches 'eval' first, which is fine - it's still blocked
      expect(isBlockedWpCommand(['eval-file', '/tmp/evil.php'])).toBe('eval');
    });

    it('should block shell command', () => {
      expect(isBlockedWpCommand(['shell'])).toBe('shell');
    });

    it('should block db query command', () => {
      expect(isBlockedWpCommand(['db', 'query', 'SELECT * FROM users'])).toBe('db query');
    });

    it('should block db cli command', () => {
      expect(isBlockedWpCommand(['db', 'cli'])).toBe('db cli');
    });

    it('should allow safe commands', () => {
      expect(isBlockedWpCommand(['plugin', 'list'])).toBeNull();
      expect(isBlockedWpCommand(['user', 'list'])).toBeNull();
      expect(isBlockedWpCommand(['cache', 'flush'])).toBeNull();
      expect(isBlockedWpCommand(['db', 'export', '/tmp/backup.sql'])).toBeNull();
      expect(isBlockedWpCommand(['db', 'import', '/tmp/backup.sql'])).toBeNull();
    });

    it('should block case-insensitive', () => {
      expect(isBlockedWpCommand(['EVAL', 'code'])).toBe('eval');
      expect(isBlockedWpCommand(['DB', 'QUERY', 'sql'])).toBe('db query');
    });
  });

  describe('pull_from_wpe confirm requirement', () => {
    const validatePullArgs = (args: { confirm?: boolean }): { valid: boolean; error?: string } => {
      if (!args.confirm) {
        return {
          valid: false,
          error: 'Pull requires confirm=true to prevent accidental overwrites.',
        };
      }
      return { valid: true };
    };

    it('should reject when confirm is not provided', () => {
      expect(validatePullArgs({})).toEqual({
        valid: false,
        error: 'Pull requires confirm=true to prevent accidental overwrites.',
      });
    });

    it('should reject when confirm is false', () => {
      expect(validatePullArgs({ confirm: false })).toEqual({
        valid: false,
        error: 'Pull requires confirm=true to prevent accidental overwrites.',
      });
    });

    it('should accept when confirm is true', () => {
      expect(validatePullArgs({ confirm: true })).toEqual({ valid: true });
    });
  });

  describe('Timeout handling', () => {
    const withTimeout = async <T>(
      promise: Promise<T>,
      timeoutMs: number,
      operationName: string
    ): Promise<T> => {
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId!);
        return result;
      } catch (error) {
        clearTimeout(timeoutId!);
        throw error;
      }
    };

    it('should resolve when operation completes before timeout', async () => {
      const fastOperation = Promise.resolve('success');
      const result = await withTimeout(fastOperation, 1000, 'Fast op');
      expect(result).toBe('success');
    });

    it('should reject when operation times out', async () => {
      const slowOperation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('too late'), 500);
      });

      await expect(withTimeout(slowOperation, 10, 'Slow op')).rejects.toThrow(
        'Slow op timed out after 0.01 seconds'
      );
    });

    it('should propagate errors from the operation', async () => {
      const failingOperation = Promise.reject(new Error('Operation failed'));

      await expect(withTimeout(failingOperation, 1000, 'Failing op')).rejects.toThrow(
        'Operation failed'
      );
    });
  });
});
