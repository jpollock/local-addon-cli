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

const MAX_EVENTS = 10000;
const EXCLUDED_PREFIXES = ['wpe.', 'analytics.'];

// Lazy-initialized paths (for testability)
function getLwpDir(): string {
  return path.join(os.homedir(), '.lwp');
}

function getConfigPath(): string {
  return path.join(getLwpDir(), 'config.json');
}

function getEventsDir(): string {
  return path.join(getLwpDir(), 'analytics');
}

function getEventsPath(): string {
  return path.join(getEventsDir(), 'events.jsonl');
}

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
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data);
      // Validate structure
      if (typeof config.analytics?.enabled === 'boolean') {
        return config;
      }
    }
  } catch {
    // Corrupted config, will regenerate
  }
  // Default to enabled (opt-out model)
  return { analytics: { enabled: true, promptedAt: null } };
}

function writeConfig(config: AnalyticsConfig): void {
  const configPath = getConfigPath();
  ensureDir(getLwpDir());
  const tempPath = `${configPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, configPath);
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
  // Mark as prompted and keep enabled (opt-out model)
  const config = readConfig();
  config.analytics.promptedAt = new Date().toISOString();
  config.analytics.enabled = true;
  writeConfig(config);

  // In non-interactive mode, silently enable without message
  if (!process.stdin.isTTY) {
    return true;
  }

  // Show informational message about analytics
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Anonymous usage analytics enabled');
  console.log('');
  console.log('We collect anonymous data to improve the CLI.');
  console.log('No personal information, site names, or command arguments are collected.');
  console.log('');
  console.log('To disable: lwp analytics off');
  console.log('Learn more: https://github.com/jpollock/local-addon-cli#analytics');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  return true;
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

    const eventsDir = getEventsDir();
    const eventsPath = getEventsPath();

    ensureDir(eventsDir);

    // Check event count and rotate if needed
    if (fs.existsSync(eventsPath)) {
      const content = fs.readFileSync(eventsPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      if (lines.length >= MAX_EVENTS) {
        // Keep newest 80%
        const keepCount = Math.floor(MAX_EVENTS * 0.8);
        const toKeep = lines.slice(-keepCount);
        fs.writeFileSync(eventsPath, toKeep.join('\n') + '\n');
        fs.chmodSync(eventsPath, 0o600);
      }
    }

    // Append new event
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(eventsPath, line);

    // Ensure permissions on first write
    fs.chmodSync(eventsPath, 0o600);
  } catch {
    // Never let analytics errors affect command execution
  }
}

export function readEvents(): AnalyticsEvent[] {
  try {
    const eventsPath = getEventsPath();
    if (!fs.existsSync(eventsPath)) return [];
    const content = fs.readFileSync(eventsPath, 'utf-8');
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
    const eventsPath = getEventsPath();
    if (fs.existsSync(eventsPath)) {
      fs.unlinkSync(eventsPath);
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
