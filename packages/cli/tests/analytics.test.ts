/**
 * Analytics Module Tests
 *
 * Tests for the anonymous usage analytics module.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs module before importing analytics
jest.mock('fs');

// Mock os.homedir specifically
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => '/mock/home'),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

// Import after mocking
import * as analytics from '../src/analytics';

describe('analytics', () => {
  const mockHomedir = '/mock/home';
  const configPath = path.join(mockHomedir, '.lwp', 'config.json');
  const eventsPath = path.join(mockHomedir, '.lwp', 'analytics', 'events.jsonl');

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.LWP_ANALYTICS;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
  });

  describe('isAnalyticsEnabled', () => {
    it('returns false when config does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(analytics.isAnalyticsEnabled()).toBe(false);
    });

    it('returns true when analytics is enabled in config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.isAnalyticsEnabled()).toBe(true);
    });

    it('returns false when analytics is disabled in config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
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
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.isAnalyticsEnabled()).toBe(false);
    });

    it('handles corrupted config gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json');

      expect(analytics.isAnalyticsEnabled()).toBe(false);
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
          analytics: { enabled: false, promptedAt: null },
        })
      );

      expect(analytics.hasBeenPrompted()).toBe(false);
    });

    it('returns true when promptedAt has a value', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      expect(analytics.hasBeenPrompted()).toBe(true);
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
        '{"command":"sites.list","success":true,"duration_ms":100,"timestamp":"2025-01-31T00:00:00Z"}\n' +
          '{"command":"wp","success":false,"duration_ms":200,"timestamp":"2025-01-31T00:01:00Z"}\n'
      );

      const events = analytics.readEvents();

      expect(events).toHaveLength(2);
      expect(events[0].command).toBe('sites.list');
      expect(events[0].success).toBe(true);
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

  describe('getStatus', () => {
    it('returns enabled status and event count', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p === configPath) return true;
        if (p === eventsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockImplementation((p) => {
        if (p === configPath) {
          return JSON.stringify({
            analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
          });
        }
        if (p === eventsPath) {
          return (
            '{"command":"a","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z"}\n' +
            '{"command":"b","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z"}\n'
          );
        }
        return '';
      });

      const status = analytics.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.eventCount).toBe(2);
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
        '{"command":"a","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z"}\n' +
          '{"command":"b","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z"}\n' +
          '{"command":"c","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z"}\n' +
          '{"command":"d","success":false,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z"}\n'
      );

      const summary = analytics.getSummary();

      expect(summary).toContain('Total commands:  4');
      expect(summary).toContain('Success rate:    75.0%');
    });

    it('shows top commands', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        '{"command":"sites.list","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z"}\n' +
          '{"command":"sites.list","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z"}\n' +
          '{"command":"wp","success":true,"duration_ms":1,"timestamp":"2025-01-31T00:00:00Z"}\n'
      );

      const summary = analytics.getSummary();

      expect(summary).toContain('sites.list');
      expect(summary).toContain('wp');
    });
  });

  describe('command tracking', () => {
    it('tracks command start and finish', () => {
      // Set up mocks for recording
      mockFs.existsSync.mockImplementation((p) => {
        if (p === configPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
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
    });

    it('does not track when analytics disabled', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
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
          analytics: { enabled: true, promptedAt: '2025-01-31T00:00:00Z' },
        })
      );

      analytics.startTracking('analytics.status');
      analytics.finishTracking(true);

      expect(mockFs.appendFileSync).not.toHaveBeenCalled();
    });
  });
});
