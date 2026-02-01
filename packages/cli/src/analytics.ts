/**
 * Anonymous Usage Analytics - Phase 1 (Local Only)
 *
 * Collects minimal anonymous usage data with user consent.
 * All data stays local until Phase 2.
 *
 * Privacy: Only tracks command names, success/failure, and duration.
 * Never tracks: arguments, site names, paths, or any PII.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsConfig {
  analytics: {
    enabled: boolean;
    promptedAt: string | null;
  };
}

interface AnalyticsEvent {
  command: string;
  success: boolean;
  duration_ms: number;
  timestamp: string;
}

// ============================================================================
// Constants
// ============================================================================

const LWP_DIR = path.join(os.homedir(), '.lwp');
const CONFIG_PATH = path.join(LWP_DIR, 'config.json');
const EVENTS_DIR = path.join(LWP_DIR, 'analytics');
const EVENTS_PATH = path.join(EVENTS_DIR, 'events.jsonl');

const MAX_EVENTS = 10000;
const EXCLUDED_PREFIXES = ['wpe.', 'analytics.'];

const CI_ENV_VARS = [
  'CI',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'JENKINS_URL',
  'TRAVIS',
  'CIRCLECI',
  'BUILDKITE',
];

// ============================================================================
// Config Management
// ============================================================================

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }
}

function readConfig(): AnalyticsConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(data);
      // Validate structure
      if (typeof config.analytics?.enabled === 'boolean') {
        return config;
      }
    }
  } catch {
    // Corrupted config, will regenerate
  }
  return { analytics: { enabled: false, promptedAt: null } };
}

function writeConfig(config: AnalyticsConfig): void {
  ensureDir(LWP_DIR);
  const tempPath = `${CONFIG_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, CONFIG_PATH);
}

export function isAnalyticsEnabled(): boolean {
  const override = process.env.LWP_ANALYTICS;
  if (override === '0') return false;
  if (override === '1') return true;
  if (CI_ENV_VARS.some((v) => process.env[v])) return false;
  return readConfig().analytics.enabled;
}

export function setAnalyticsEnabled(enabled: boolean): void {
  const config = readConfig();
  config.analytics.enabled = enabled;
  config.analytics.promptedAt = config.analytics.promptedAt || new Date().toISOString();
  writeConfig(config);
}

export function hasBeenPrompted(): boolean {
  return readConfig().analytics.promptedAt !== null;
}

// ============================================================================
// Opt-In Prompt
// ============================================================================

export async function showOptInPrompt(): Promise<boolean> {
  // Skip prompt in non-interactive mode - default to opt-out
  if (!process.stdin.isTTY) {
    const config = readConfig();
    config.analytics.promptedAt = new Date().toISOString();
    config.analytics.enabled = false;
    writeConfig(config);
    return false;
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Help improve lwp?');
  console.log('');
  console.log('We collect anonymous usage data to improve the CLI.');
  console.log('No personal information, site names, or command arguments are collected.');
  console.log('');
  console.log('You can change this anytime: lwp analytics off');
  console.log('Learn more: https://github.com/jpollock/local-addon-cli#analytics');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enable anonymous analytics? [Y/n]: ', (answer) => {
      rl.close();
      const enabled = answer.toLowerCase() !== 'n';
      setAnalyticsEnabled(enabled);
      console.log('');
      if (enabled) {
        console.log('Analytics enabled. Thank you for helping improve lwp!');
      } else {
        console.log('Analytics disabled. No data will be collected.');
      }
      console.log('');
      resolve(enabled);
    });
  });
}

// ============================================================================
// Event Tracking
// ============================================================================

function isCommandExcluded(command: string): boolean {
  return EXCLUDED_PREFIXES.some((prefix) => command.startsWith(prefix));
}

export function recordEvent(event: AnalyticsEvent): void {
  try {
    if (!isAnalyticsEnabled()) return;
    if (isCommandExcluded(event.command)) return;

    ensureDir(EVENTS_DIR);

    // Check event count and rotate if needed
    if (fs.existsSync(EVENTS_PATH)) {
      const content = fs.readFileSync(EVENTS_PATH, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      if (lines.length >= MAX_EVENTS) {
        // Keep newest 80%
        const keepCount = Math.floor(MAX_EVENTS * 0.8);
        const toKeep = lines.slice(-keepCount);
        fs.writeFileSync(EVENTS_PATH, toKeep.join('\n') + '\n');
        fs.chmodSync(EVENTS_PATH, 0o600);
      }
    }

    // Append new event
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(EVENTS_PATH, line);

    // Ensure permissions on first write
    fs.chmodSync(EVENTS_PATH, 0o600);
  } catch {
    // Never let analytics errors affect command execution
  }
}

export function readEvents(): AnalyticsEvent[] {
  try {
    if (!fs.existsSync(EVENTS_PATH)) return [];
    const content = fs.readFileSync(EVENTS_PATH, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export function clearEvents(): void {
  try {
    if (fs.existsSync(EVENTS_PATH)) {
      fs.unlinkSync(EVENTS_PATH);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Command Tracking (for Commander hooks)
// ============================================================================

let commandStartTime: number | null = null;
let currentCommandName: string | null = null;

export function startTracking(commandName: string): void {
  commandStartTime = Date.now();
  currentCommandName = commandName;
}

export function finishTracking(success: boolean): void {
  if (commandStartTime === null || currentCommandName === null) return;

  const duration = Date.now() - commandStartTime;
  recordEvent({
    command: currentCommandName,
    success,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
  });

  commandStartTime = null;
  currentCommandName = null;
}

// ============================================================================
// Analytics Summary
// ============================================================================

export function getStatus(): { enabled: boolean; eventCount: number } {
  return {
    enabled: isAnalyticsEnabled(),
    eventCount: readEvents().length,
  };
}

export function getSummary(): string {
  const events = readEvents();
  if (events.length === 0) {
    return 'No analytics data collected yet.';
  }

  const total = events.length;
  const successful = events.filter((e) => e.success).length;
  const successRate = ((successful / total) * 100).toFixed(1);

  // Count commands
  const commandCounts: Record<string, number> = {};
  events.forEach((e) => {
    commandCounts[e.command] = (commandCounts[e.command] || 0) + 1;
  });

  // Sort by count
  const topCommands = Object.entries(commandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Count recent failures (last 7 days)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentFailures = events.filter(
    (e) => !e.success && new Date(e.timestamp).getTime() > weekAgo
  ).length;

  let output = `
Analytics Summary
─────────────────
Total commands:  ${total}
Success rate:    ${successRate}%

Top commands:`;

  topCommands.forEach(([cmd, count]) => {
    output += `\n  ${cmd.padEnd(15)} ${count}`;
  });

  output += `\n\nRecent failures:  ${recentFailures} in last 7 days`;

  return output;
}
