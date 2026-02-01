/**
 * Analytics Module Tests
 *
 * Tests for the anonymous usage analytics module (Phase 2).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// Mock fs module before importing analytics
jest.mock('fs');

// Mock os module
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => '/mock/home'),
  platform: jest.fn(() => 'darwin'),
}));

// Mock crypto.randomUUID
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
}));

// Mock fetch for transmission tests
global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as jest.Mock;

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

// Import after mocking
import * as analytics from '../src/analytics';

describe('analytics', () => {
  const mockHomedir = '/mock/home';
  const configPath = path.join(mockHomedir, '.lwp', 'config.json');
  const eventsPath = path.join(mockHomedir, '.lwp', 'analytics', 'events.jsonl');

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.LWP_ANALYTICS;
    delete process.env.LWP_ANALYTICS_ENDPOINT;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
  });

  describe('isAnalyticsEnabled', () => {
    it('returns true when config does not exist (enabled by default)', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(analytics.isAnalyticsEnabled()).toBe(true);
    });

    it('returns true when analytics is enabled in config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.isAnalyticsEnabled()).toBe(true);
    });

    it('returns false when analytics is disabled in config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: false, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.isAnalyticsEnabled()).toBe(false);
    });

    it('respects LWP_ANALYTICS=0 override', () => {
      process.env.LWP_ANALYTICS = '0';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.isAnalyticsEnabled()).toBe(false);
    });

    it('respects LWP_ANALYTICS=1 override', () => {
      process.env.LWP_ANALYTICS = '1';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: false, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.isAnalyticsEnabled()).toBe(true);
    });

    it('auto-disables in CI environments', () => {
      process.env.CI = 'true';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.isAnalyticsEnabled()).toBe(false);
    });

    it('auto-disables in GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.isAnalyticsEnabled()).toBe(false);
    });

    it('handles corrupted config gracefully (defaults to enabled)', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json');

      expect(analytics.isAnalyticsEnabled()).toBe(true);
    });
  });

  describe('setAnalyticsEnabled', () => {
    it('writes config with enabled=true', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.chmodSync.mockImplementation(() => {});
      mockFs.renameSync.mockImplementation(() => {});

      analytics.setAnalyticsEnabled(true);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.analytics.enabled).toBe(true);
      expect(parsed.analytics.promptedAt).toBeDefined();
      expect(parsed.installationId).toBeDefined();
    });

    it('sets proper file permissions (0600)', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.chmodSync.mockImplementation(() => {});
      mockFs.renameSync.mockImplementation(() => {});

      analytics.setAnalyticsEnabled(true);

      expect(mockFs.chmodSync).toHaveBeenCalledWith(expect.any(String), 0o600);
    });
  });

  describe('hasBeenPrompted', () => {
    it('returns false when config does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(analytics.hasBeenPrompted()).toBe(false);
    });

    it('returns false when promptedAt is null', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: false, promptedAt: null },
        })
      );

      expect(analytics.hasBeenPrompted()).toBe(false);
    });

    it('returns true when promptedAt has a value', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.hasBeenPrompted()).toBe(true);
    });
  });

  describe('getInstallationId', () => {
    it('returns installationId from config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'existing-install-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.getInstallationId()).toBe('existing-install-id');
    });

    it('generates new installationId when missing', () => {
      mockFs.existsSync.mockReturnValue(false);

      const id = analytics.getInstallationId();

      expect(id).toBe('mock-uuid-1234');
    });
  });

  describe('getSessionId', () => {
    it('returns consistent session ID within same process', () => {
      const id1 = analytics.getSessionId();
      const id2 = analytics.getSessionId();

      expect(id1).toBe(id2);
      expect(id1).toBe('mock-uuid-1234');
    });
  });

  describe('readEvents', () => {
    it('returns empty array when events file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(analytics.readEvents()).toEqual([]);
    });

    it('parses JSONL file correctly', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        '{"command":"sites.list","success":true,"duration_ms":100,"timestamp":"2025-01-31T00:00:00Z","installation_id":"a","session_id":"b","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n' +
          '{"command":"wp","success":false,"duration_ms":200,"timestamp":"2025-01-31T00:01:00Z","installation_id":"a","session_id":"b","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n'
      );

      const events = analytics.readEvents();

      expect(events).toHaveLength(2);
      expect(events[0].command).toBe('sites.list');
      expect(events[0].success).toBe(true);
      expect(events[0].installation_id).toBe('a');
      expect(events[1].command).toBe('wp');
      expect(events[1].success).toBe(false);
    });

    it('handles corrupted events file gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json\n');

      expect(analytics.readEvents()).toEqual([]);
    });
  });

  describe('clearEvents', () => {
    it('deletes the events file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {});

      analytics.clearEvents();

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(eventsPath);
    });

    it('handles missing file gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => analytics.clearEvents()).not.toThrow();
    });
  });

  describe('resetAnalytics', () => {
    it('clears events and regenerates installationId', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p === configPath) return true;
        if (p === eventsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'old-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );
      mockFs.unlinkSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.chmodSync.mockImplementation(() => {});
      mockFs.renameSync.mockImplementation(() => {});

      analytics.resetAnalytics();

      // Should delete events
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(eventsPath);

      // Should write new config with new installationId
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.installationId).toBe('mock-uuid-1234');
      expect(parsed.analytics.enabled).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns enabled status, event count, and installationId', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p === configPath) return true;
        if (p === eventsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p) => {
        if (p === configPath) {
          return JSON.stringify({
            installationId: 'test-install-id',
            analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
          });
        }
        if (p === eventsPath) {
          return (
            '{"command":"a","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z","installation_id":"x","session_id":"y","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n' +
            '{"command":"b","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z","installation_id":"x","session_id":"y","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n'
          );
        }
        return '';
      });

      const status = analytics.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.eventCount).toBe(2);
      expect(status.installationId).toBe('test-install-id');
    });
  });

  describe('getSummary', () => {
    it('returns message when no events', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(analytics.getSummary()).toBe('No analytics data collected yet.');
    });

    it('calculates success rate correctly', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        '{"command":"a","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z","installation_id":"x","session_id":"y","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n' +
          '{"command":"b","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z","installation_id":"x","session_id":"y","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n' +
          '{"command":"c","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z","installation_id":"x","session_id":"y","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n' +
          '{"command":"d","success":false,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z","installation_id":"x","session_id":"y","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n'
      );

      const summary = analytics.getSummary();

      expect(summary).toContain('Total commands:  4');
      expect(summary).toContain('Success rate:    75.0%');
    });

    it('shows top commands', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        '{"command":"sites.list","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z","installation_id":"x","session_id":"y","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n' +
          '{"command":"sites.list","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z","installation_id":"x","session_id":"y","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n' +
          '{"command":"wp","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z","installation_id":"x","session_id":"y","cli_version":"0.0.5","os":"darwin","node_version":"v20"}\n'
      );

      const summary = analytics.getSummary();

      expect(summary).toContain('sites.list');
      expect(summary).toContain('wp');
    });
  });

  describe('command tracking', () => {
    it('tracks command with Phase 2 fields', () => {
      // Set up mocks for recording
      mockFs.existsSync.mockImplementation((p) => {
        if (p === configPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-install-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.appendFileSync.mockImplementation(() => {});
      mockFs.chmodSync.mockImplementation(() => {});

      analytics.startTracking('sites.list');
      analytics.finishTracking(true);

      expect(mockFs.appendFileSync).toHaveBeenCalled();
      const appendedContent = mockFs.appendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(appendedContent);
      expect(event.command).toBe('sites.list');
      expect(event.success).toBe(true);
      expect(event.duration_ms).toBeGreaterThanOrEqual(0);
      expect(event.installation_id).toBe('test-install-id');
      expect(event.session_id).toBeDefined();
      expect(event.cli_version).toBeDefined();
      expect(event.os).toBe('darwin');
      expect(event.node_version).toBeDefined();
    });

    it('includes error_category on failure', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p === configPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-install-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.appendFileSync.mockImplementation(() => {});
      mockFs.chmodSync.mockImplementation(() => {});

      analytics.startTracking('sites.get');
      analytics.finishTracking(false, 'site_not_found');

      expect(mockFs.appendFileSync).toHaveBeenCalled();
      const appendedContent = mockFs.appendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(appendedContent);
      expect(event.success).toBe(false);
      expect(event.error_category).toBe('site_not_found');
    });

    it('does not track when analytics disabled', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: false, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      analytics.startTracking('sites.list');
      analytics.finishTracking(true);

      expect(mockFs.appendFileSync).not.toHaveBeenCalled();
    });

    it('does not track excluded commands', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      analytics.startTracking('wpe.status');
      analytics.finishTracking(true);

      expect(mockFs.appendFileSync).not.toHaveBeenCalled();
    });

    it('does not track analytics commands', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      analytics.startTracking('analytics.status');
      analytics.finishTracking(true);

      expect(mockFs.appendFileSync).not.toHaveBeenCalled();
    });

    it('transmits event to server', async () => {
      // Set up fetch mock
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      mockFs.existsSync.mockImplementation((p) => {
        if (p === configPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          installationId: 'test-install-id',
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.appendFileSync.mockImplementation(() => {});
      mockFs.chmodSync.mockImplementation(() => {});

      analytics.startTracking('sites.list');
      analytics.finishTracking(true);

      // Wait for the fire-and-forget fetch to be called
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify fetch was called (fire-and-forget)
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('/v1/events');
      expect(fetchCall[1].method).toBe('POST');
    });
  });
});
