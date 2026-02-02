/**
 * Tests for Site Size Utility
 */

import { formatBytes, getSiteSize } from '../src/utils/siteSize';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

jest.mock('child_process');
jest.mock('fs');
jest.mock('../src/bootstrap/paths', () => ({
  getLocalPaths: () => ({
    dataDir: '/mock/data/dir',
  }),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('siteSize', () => {
  describe('formatBytes', () => {
    it('returns "0 B" for zero', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats bytes correctly', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('formats KB correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('2 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('formats MB with 1 decimal', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
      expect(formatBytes(100.3 * 1024 * 1024)).toBe('100.3 MB');
    });

    it('formats GB with 2 decimals', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatBytes(1.25 * 1024 * 1024 * 1024)).toBe('1.25 GB');
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
    });

    it('formats TB with 2 decimals', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
    });

    it('returns "?" for negative numbers', () => {
      expect(formatBytes(-1)).toBe('?');
      expect(formatBytes(-1000)).toBe('?');
    });

    it('returns "?" for NaN', () => {
      expect(formatBytes(NaN)).toBe('?');
    });

    it('returns "?" for Infinity', () => {
      expect(formatBytes(Infinity)).toBe('?');
      expect(formatBytes(-Infinity)).toBe('?');
    });
  });

  describe('getSiteSize', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('calculates size for both site and run directories', () => {
      // Mock both directories exist
      mockExistsSync.mockReturnValue(true);

      // Site directory: 100MB, Run directory: 50MB
      mockExecSync
        .mockReturnValueOnce('102400\t/path/to/site') // 100MB in KB
        .mockReturnValueOnce('51200\t/mock/data/dir/run/abc123'); // 50MB in KB

      const result = getSiteSize({ id: 'abc123', path: '~/Local Sites/my-site' });

      expect(result.bytes).toBe((102400 + 51200) * 1024);
      expect(result.formatted).toBe('150.0 MB');
    });

    it('handles missing site directory', () => {
      // Site dir doesn't exist, run dir does
      mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);

      mockExecSync.mockReturnValueOnce('51200\t/mock/data/dir/run/abc123');

      const result = getSiteSize({ id: 'abc123', path: '~/Local Sites/missing' });

      expect(result.bytes).toBe(51200 * 1024);
      expect(result.formatted).toBe('50.0 MB');
    });

    it('handles missing run directory', () => {
      // Site dir exists, run dir doesn't
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);

      mockExecSync.mockReturnValueOnce('102400\t/path/to/site');

      const result = getSiteSize({ id: 'abc123', path: '~/Local Sites/my-site' });

      expect(result.bytes).toBe(102400 * 1024);
      expect(result.formatted).toBe('100.0 MB');
    });

    it('handles both directories missing', () => {
      mockExistsSync.mockReturnValue(false);

      const result = getSiteSize({ id: 'abc123', path: '~/Local Sites/gone' });

      expect(result.bytes).toBe(0);
      expect(result.formatted).toBe('0 B');
    });

    it('handles command errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = getSiteSize({ id: 'abc123', path: '~/Local Sites/protected' });

      expect(result.bytes).toBe(0);
      expect(result.formatted).toBe('0 B');
    });

    it('expands ~ in path', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('1024\t/path');

      getSiteSize({ id: 'abc123', path: '~/Local Sites/my-site' });

      // Check that the first call to existsSync uses expanded path
      const calls = mockExistsSync.mock.calls;
      expect(calls[0][0]).not.toContain('~');
    });
  });
});
