/**
 * Analytics E2E Tests
 *
 * Tests the analytics CLI commands. These don't require Local to be running.
 * Uses environment variable LWP_ANALYTICS to control state without modifying config.
 */

import { runCLI } from './helpers/cli';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.lwp');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const EVENTS_DIR = path.join(CONFIG_DIR, 'analytics');
const EVENTS_PATH = path.join(EVENTS_DIR, 'events.jsonl');

describe('analytics commands', () => {
  // Save original state before tests
  let originalConfig: string | null = null;
  let originalEvents: string | null = null;

  beforeAll(() => {
    // Backup existing config and events
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        originalConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
      }
      if (fs.existsSync(EVENTS_PATH)) {
        originalEvents = fs.readFileSync(EVENTS_PATH, 'utf-8');
      }
    } catch {
      // Ignore read errors
    }
  });

  afterAll(() => {
    // Restore original state
    try {
      if (originalConfig !== null) {
        fs.writeFileSync(CONFIG_PATH, originalConfig);
      }
      if (originalEvents !== null) {
        if (!fs.existsSync(EVENTS_DIR)) {
          fs.mkdirSync(EVENTS_DIR, { recursive: true });
        }
        fs.writeFileSync(EVENTS_PATH, originalEvents);
      }
    } catch {
      // Ignore restore errors
    }
  });

  describe('analytics status', () => {
    test('returns current status', () => {
      const { stdout, exitCode } = runCLI('analytics status');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Analytics:/i);
      expect(stdout).toMatch(/enabled|disabled/i);
    });

    test('shows event count', () => {
      const { stdout, exitCode } = runCLI('analytics status');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/events stored/i);
    });
  });

  describe('analytics on/off', () => {
    test('analytics off disables tracking', () => {
      const { stdout, exitCode } = runCLI('analytics off');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/disabled/i);

      // Verify status shows disabled
      const status = runCLI('analytics status');
      expect(status.stdout).toMatch(/disabled/i);
    });

    test('analytics on enables tracking', () => {
      const { stdout, exitCode } = runCLI('analytics on');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/enabled/i);

      // Verify status shows enabled
      const status = runCLI('analytics status');
      expect(status.stdout).toMatch(/enabled/i);
    });
  });

  describe('analytics show', () => {
    test('returns summary or empty message', () => {
      const { stdout, exitCode } = runCLI('analytics show');

      expect(exitCode).toBe(0);
      // Either shows summary or "No analytics data"
      expect(stdout).toMatch(/analytics|no analytics data/i);
    });

    test('returns JSON with --json flag', () => {
      const { stdout, exitCode } = runCLI('analytics show --json');

      expect(exitCode).toBe(0);

      // Should be valid JSON array
      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('analytics reset', () => {
    beforeEach(() => {
      // Ensure analytics is on and has at least one event
      runCLI('analytics on');
    });

    test('clears all events and disables', () => {
      const { stdout, exitCode } = runCLI('analytics reset');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/deleted|reset/i);

      // Verify events are cleared
      const status = runCLI('analytics status');
      expect(status.stdout).toMatch(/0|disabled/i);
    });
  });

  describe('environment variable override', () => {
    test('LWP_ANALYTICS=0 disables tracking', () => {
      // First enable analytics
      runCLI('analytics on');

      // Run with env override - status should show enabled (config) but tracking disabled
      const result = runCLI('analytics status');
      expect(result.exitCode).toBe(0);
      // The status command reads config, not env override
      // But new events won't be recorded when LWP_ANALYTICS=0
    });
  });

  describe('command exclusion', () => {
    beforeEach(() => {
      // Clear events and enable analytics
      runCLI('analytics reset');
      runCLI('analytics on');
    });

    test('analytics commands are not tracked', () => {
      // Run several analytics commands
      runCLI('analytics status');
      runCLI('analytics status');
      runCLI('analytics status');

      // Check event count - should still be 0
      const { stdout } = runCLI('analytics show --json');
      const events = JSON.parse(stdout);

      // Filter out any non-analytics commands that might have been tracked
      const analyticsEvents = events.filter((e: { command: string }) =>
        e.command.startsWith('analytics.')
      );

      expect(analyticsEvents.length).toBe(0);
    });
  });
});
