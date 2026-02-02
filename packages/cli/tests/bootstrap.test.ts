/**
 * Bootstrap Module Tests
 */

import * as fs from 'fs';
import { execSync } from 'child_process';
import {
  isLocalInstalled,
  readConnectionInfo,
  ConnectionInfo,
} from '../src/bootstrap';
import { getLocalPaths } from '../src/bootstrap/paths';

// Mock fs and child_process
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('bootstrap', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  });

  describe('isLocalInstalled', () => {
    it('returns true when Local.app exists on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true,
      });
      mockFs.existsSync.mockReturnValue(true);

      expect(isLocalInstalled()).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('/Applications/Local.app');
    });

    it('returns false when Local.app does not exist on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true,
      });
      mockFs.existsSync.mockReturnValue(false);

      expect(isLocalInstalled()).toBe(false);
    });

    it('returns true when Local.exe exists on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
      mockFs.existsSync.mockReturnValue(true);

      expect(isLocalInstalled()).toBe(true);
    });

    it('returns false when Local.exe does not exist on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });
      mockFs.existsSync.mockReturnValue(false);

      expect(isLocalInstalled()).toBe(false);
    });

    it('checks PATH on Linux first', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
        configurable: true,
      });
      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/local'));

      expect(isLocalInstalled()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('which local', { stdio: 'ignore' });
    });

    it('falls back to file check on Linux when not in PATH', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
        configurable: true,
      });
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });
      mockFs.existsSync.mockReturnValue(true);

      expect(isLocalInstalled()).toBe(true);
      // Checks config first, then common locations starting with /usr/bin/Local
      expect(mockFs.existsSync).toHaveBeenCalledWith('/usr/bin/Local');
    });

    it('returns false on error', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true,
      });
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('permission denied');
      });

      expect(isLocalInstalled()).toBe(false);
    });
  });

  describe('readConnectionInfo', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true,
      });
    });

    it('returns null when connection info file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(readConnectionInfo()).toBeNull();
    });

    it('parses valid connection info JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          port: 4000,
          authToken: 'test-token-123',
        })
      );

      const info = readConnectionInfo();

      expect(info).toEqual({
        url: 'http://127.0.0.1:4000/graphql',
        subscriptionUrl: 'ws://127.0.0.1:4000/graphql',
        port: 4000,
        authToken: 'test-token-123',
      });
    });

    it('uses provided url if available', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          url: 'http://custom-url/graphql',
          subscriptionUrl: 'ws://custom-url/graphql',
          port: 4000,
          authToken: 'token',
        })
      );

      const info = readConnectionInfo();

      expect(info?.url).toBe('http://custom-url/graphql');
      expect(info?.subscriptionUrl).toBe('ws://custom-url/graphql');
    });

    it('returns null for malformed JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not valid json {{{');

      expect(readConnectionInfo()).toBeNull();
    });

    it('returns null when file read fails', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      expect(readConnectionInfo()).toBeNull();
    });

    it('handles missing authToken gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          port: 4000,
        })
      );

      const info = readConnectionInfo();

      expect(info?.authToken).toBe('');
    });
  });

  describe('getLocalPaths', () => {
    it('returns correct paths for macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true,
      });

      const paths = getLocalPaths();

      expect(paths.appExecutable).toBe('/Applications/Local.app');
      expect(paths.appName).toBe('Local');
      expect(paths.dataDir).toContain('Library/Application Support/Local');
    });

    it('returns correct paths for Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true,
      });

      const paths = getLocalPaths();

      expect(paths.appName).toBe('Local.exe');
      expect(paths.appExecutable).toContain('Local.exe');
    });

    it('returns correct paths for Linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
        configurable: true,
      });
      // Mock no executables found so it falls back to default
      mockFs.existsSync.mockReturnValue(false);

      const paths = getLocalPaths();

      // Falls back to /opt/Local/local when no paths found
      expect(paths.appExecutable).toBe('/opt/Local/local');
      expect(paths.appName).toBe('local');
      expect(paths.dataDir).toContain('.config/Local');
    });

    it('throws for unsupported platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        writable: true,
        configurable: true,
      });

      expect(() => getLocalPaths()).toThrow('Unsupported platform: freebsd');
    });
  });
});
