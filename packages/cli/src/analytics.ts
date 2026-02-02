/**
 * Anonymous Usage Analytics - Phase 3 (Signed Authentication)
 *
 * Collects anonymous usage data with user consent and transmits to server.
 * All requests are signed with HMAC-SHA256 for authentication.
 *
 * Privacy: Only tracks command names, success/failure, duration, and system info.
 * Never tracks: arguments, site names, paths, or any PII.
 *
 * Identifiers:
 * - installationId: Random UUID, identifies this CLI installation (not the user)
 * - secretKey: Random 32 bytes, used for HMAC signing (never transmitted after registration)
 * - sessionId: Random UUID per CLI invocation, correlates commands in a session
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsConfig {
  installationId?: string;
  secretKey?: string;
  registeredAt?: string; // When secretKey was first sent to server
  analytics: {
    enabled: boolean;
    promptedAt: string | null;
  };
}

export type ErrorCategory =
  | 'site_not_found'
  | 'site_not_running'
  | 'local_not_running'
  | 'timeout'
  | 'network_error'
  | 'validation_error'
  | 'unknown';

interface AnalyticsEvent {
  // Phase 1 fields
  command: string;
  success: boolean;
  duration_ms: number;
  timestamp: string;

  // Phase 2 fields
  installation_id: string;
  session_id: string;
  cli_version: string;
  os: string;
  node_version: string;
  error_category?: ErrorCategory;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_EVENTS = 10000;
const EXCLUDED_PREFIXES = ['wpe.', 'analytics.'];
const ANALYTICS_BASE_URL =
  process.env.LWP_ANALYTICS_ENDPOINT?.replace('/v1/events', '') ||
  'https://lwp-analytics.jeremy7746.workers.dev';
const ANALYTICS_ENDPOINT = `${ANALYTICS_BASE_URL}/v1/events`;
const TRANSMISSION_TIMEOUT = 5000; // 5 seconds

// Session ID generated once per CLI invocation
const SESSION_ID = crypto.randomUUID();

// CLI version from package.json
const CLI_VERSION = require('../package.json').version;

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

function generateInstallationId(): string {
  return crypto.randomUUID();
}

function generateSecretKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

function readConfig(): AnalyticsConfig {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data);
      // Validate structure
      if (typeof config.analytics?.enabled === 'boolean') {
        let needsWrite = false;

        // Ensure installationId exists (migrate from Phase 1/2)
        if (!config.installationId) {
          config.installationId = generateInstallationId();
          needsWrite = true;
        }

        // Ensure secretKey exists (migrate from Phase 2)
        if (!config.secretKey) {
          config.secretKey = generateSecretKey();
          needsWrite = true;
        }

        if (needsWrite) {
          writeConfig(config);
        }
        return config;
      }
    }
  } catch {
    // Corrupted config, will regenerate
  }
  // Default to enabled (opt-out model) with new credentials
  return {
    installationId: generateInstallationId(),
    secretKey: generateSecretKey(),
    analytics: { enabled: true, promptedAt: null },
  };
}

function writeConfig(config: AnalyticsConfig): void {
  const configPath = getConfigPath();
  ensureDir(getLwpDir());
  const tempPath = `${configPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, configPath);
}

export function getInstallationId(): string {
  return readConfig().installationId || generateInstallationId();
}

export function getSecretKey(): string {
  return readConfig().secretKey || generateSecretKey();
}

export function getSessionId(): string {
  return SESSION_ID;
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
// HMAC Signing
// ============================================================================

/**
 * Sign data with HMAC-SHA256
 */
function signData(data: string, secretKey: string): string {
  const key = Buffer.from(secretKey, 'base64');
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Check if this installation has been registered with the server
 */
function isRegistered(): boolean {
  return readConfig().registeredAt !== null;
}

/**
 * Mark this installation as registered
 */
function markAsRegistered(): void {
  const config = readConfig();
  config.registeredAt = new Date().toISOString();
  writeConfig(config);
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

/**
 * Transmit event to analytics server with HMAC signature (fire-and-forget)
 */
async function transmitEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const config = readConfig();
    const installationId = config.installationId!;
    const secretKey = config.secretKey!;
    const isFirstRequest = !config.registeredAt;

    const body = JSON.stringify(event);
    const signature = signData(body, secretKey);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Installation-Id': installationId,
      'X-Signature': signature,
    };

    // On first request, send the secret key so server can store it
    if (isFirstRequest) {
      headers['X-Secret-Key'] = secretKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRANSMISSION_TIMEOUT);

    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // If successful and this was first request, mark as registered
    if (response.ok && isFirstRequest) {
      markAsRegistered();
    }
  } catch {
    // Silently ignore transmission errors - never block CLI
  }
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

    // Append new event to local storage
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(eventsPath, line);

    // Ensure permissions on first write
    fs.chmodSync(eventsPath, 0o600);

    // Transmit to server (fire-and-forget, don't await)
    transmitEvent(event).catch(() => {
      // Ignore transmission errors
    });
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

/**
 * Reset analytics: clear events and regenerate installationId + secretKey
 */
export function resetAnalytics(): void {
  clearEvents();
  const config = readConfig();
  config.installationId = generateInstallationId();
  config.secretKey = generateSecretKey();
  delete config.registeredAt; // Will need to re-register
  config.analytics.enabled = false;
  writeConfig(config);
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

export function finishTracking(success: boolean, errorCategory?: ErrorCategory): void {
  if (commandStartTime === null || currentCommandName === null) return;

  const duration = Date.now() - commandStartTime;
  const event: AnalyticsEvent = {
    command: currentCommandName,
    success,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    installation_id: getInstallationId(),
    session_id: SESSION_ID,
    cli_version: CLI_VERSION,
    os: os.platform(),
    node_version: process.version,
  };

  // Add error category for failures
  if (!success && errorCategory) {
    event.error_category = errorCategory;
  }

  recordEvent(event);

  commandStartTime = null;
  currentCommandName = null;
}

// ============================================================================
// Dashboard URL Generation
// ============================================================================

/**
 * Generate a signed dashboard URL for viewing personal analytics
 * URL expires in 1 hour
 */
export function getDashboardUrl(): string {
  const config = readConfig();
  const installationId = config.installationId!;
  const secretKey = config.secretKey!;

  // Expire in 1 hour
  const expiration = Math.floor(Date.now() / 1000) + 3600;

  // Sign: installationId:expiration
  const payload = `${installationId}:${expiration}`;
  const signature = signData(payload, secretKey);

  return `${ANALYTICS_BASE_URL}/dashboard/${installationId}?exp=${expiration}&sig=${signature}`;
}

// ============================================================================
// Analytics Summary
// ============================================================================

export function getStatus(): { enabled: boolean; eventCount: number; installationId: string } {
  return {
    enabled: isAnalyticsEnabled(),
    eventCount: readEvents().length,
    installationId: getInstallationId(),
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
