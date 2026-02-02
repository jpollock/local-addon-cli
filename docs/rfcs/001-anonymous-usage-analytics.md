# RFC 001: Anonymous Usage Analytics

**Status:** Draft
**Author:** Jeremy Pollock
**Created:** 2025-01-31
**Last Updated:** 2025-01-31

## Summary

Add privacy-first, anonymous usage analytics to the lwp CLI with opt-in/opt-out capabilities. Users can view their own usage data via CLI commands. A future phase will add time-limited signed URLs for web-based dashboards.

## Motivation

Understanding how lwp is used helps:
- Prioritize feature development
- Identify common pain points and errors
- Understand adoption and usage patterns
- Make data-informed decisions

However, this must be balanced against user privacy and trust.

## Design Principles

1. **Privacy first** - No PII, no identifying information
2. **Transparency** - Users know exactly what's collected
3. **User control** - Easy opt-in/opt-out at any time
4. **Data ownership** - Users can view and delete their data
5. **Simplicity** - Minimal implementation for MVP, add complexity only when needed

---

## Phase 1: Local Tracking + CLI Summary (MVP)

### What We Track

#### Collected Data (Minimal)

| Field | Example | Purpose |
|-------|---------|---------|
| `command` | `sites.list` | Command name (no arguments) |
| `success` | `true` | Did it succeed? |
| `duration_ms` | `1234` | Execution time |
| `timestamp` | `2025-01-31T12:00:00Z` | When it happened |

**Note:** Phase 1 intentionally collects minimal data. Additional fields (cli_version, os, node_version, session_id, error_category) deferred to Phase 2 when events are transmitted to a server.

#### Never Collected

- Site names, domains, paths
- Command arguments or flags
- File contents or database data
- IP addresses
- User names, emails, or any PII
- Environment variables
- Error stack traces or messages

### Config File

On first run, lwp creates `~/.lwp/config.json`:

```json
{
  "analytics": {
    "enabled": true,
    "promptedAt": "2025-01-31T12:00:00Z"
  }
}
```

- Minimal config for Phase 1
- `userId` and `secretKey` added in Phase 3 when needed for signed URLs
- File permissions set to `0600` (user read/write only)

### Command Exclusion

Certain commands are excluded from tracking using simple prefix matching:

| Prefix | Reason |
|--------|--------|
| `wpe.` | May contain sensitive WP Engine hosting information |
| `analytics.` | Meta commands about analytics itself |

```typescript
// Simple implementation - no dependencies needed
const EXCLUDED_PREFIXES = ['wpe.', 'analytics.'];
const isExcluded = (cmd: string) => EXCLUDED_PREFIXES.some(p => cmd.startsWith(p));
```

**Note:** User-configurable exclusions deferred to a future phase. Users who want to exclude commands can simply disable analytics.

### CI/CD Detection

Analytics are **automatically disabled** in CI environments:

```typescript
const CI_ENV_VARS = [
  'CI',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'JENKINS_URL',
  'TRAVIS',
  'CIRCLECI',
  'BUILDKITE'
];

const isCI = CI_ENV_VARS.some(v => process.env[v]);
```

Override with `LWP_ANALYTICS=1` to explicitly enable in CI.

### Opt-In Flow

#### First Run (Interactive Terminal)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Help improve lwp?

We collect anonymous usage data to improve the CLI.
No personal information, site names, or command arguments are collected.

You can change this anytime: lwp analytics off
Learn more: https://github.com/jpollock/local-addon-cli#analytics

Enable anonymous analytics? [Y/n]:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Non-Interactive (Scripts, CI)

When stdin is not a TTY, default to **opt-out** without prompting. This prevents blocking automation.

#### Commands

```bash
# Check current status
lwp analytics status
# → Analytics: enabled
# → Total events stored: 847

# Disable analytics
lwp analytics off
# → Analytics disabled. No data will be collected.

# Enable analytics
lwp analytics on
# → Analytics enabled. Thank you for helping improve lwp!

# View collected data
lwp analytics show
# → Shows summary of tracked commands

lwp analytics show --json
# → Exports all local events as JSON array

# Delete all local data
lwp analytics reset
# → Deleted 847 local events. Analytics disabled.
```

#### Environment Variable Override

```bash
# Disable for a single command
LWP_ANALYTICS=0 lwp sites list

# Disable globally via shell profile
export LWP_ANALYTICS=0
```

### Local Storage

Events stored in `~/.lwp/analytics/events.jsonl` (JSON Lines format):

```jsonl
{"command":"sites.list","success":true,"duration_ms":234,"timestamp":"2025-01-31T12:00:00Z"}
{"command":"wp","success":true,"duration_ms":1456,"timestamp":"2025-01-31T12:01:00Z"}
{"command":"sites.start","success":false,"duration_ms":5023,"timestamp":"2025-01-31T12:02:00Z"}
```

- Maximum 10,000 events stored locally
- ~500KB max storage (minimal event format)
- File permissions set to `0600`
- Simple size-based cleanup when limit reached

### CLI Summary Output

```bash
lwp analytics show
```

Output (simple text, no ASCII charts):
```
Analytics Summary
─────────────────
Total commands:  847
Success rate:    94.2%

Top commands:
  sites.list     234
  wp             189
  sites.start    156
  sites.stop      98
  db.export       45

Recent failures:  5 in last 7 days
```

**Note:** Fancy ASCII bar charts and day-of-week histograms deferred. Simple text output is sufficient for MVP.

---

## Phase 2: Central Analytics Service (Future)

### Additional Event Fields

When transmitting to server, add:

| Field | Example | Purpose |
|-------|---------|---------|
| `cli_version` | `0.0.5` | Version adoption tracking |
| `os` | `darwin` | Platform distribution |
| `node_version` | `20.10.0` | Runtime compatibility |
| `session_id` | `uuid` | Correlate commands in session |
| `error_category` | `site_not_found` | Failure analysis |

### Error Categories (Phase 2)

```typescript
enum ErrorCategory {
  SITE_NOT_FOUND = 'site_not_found',
  SITE_NOT_RUNNING = 'site_not_running',
  LOCAL_NOT_RUNNING = 'local_not_running',
  TIMEOUT = 'timeout',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown'
}
```

**Note:** Error categorization deferred to Phase 2. In Phase 1, we only track `success: true/false`.

### Architecture

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│   lwp CLI   │──────▶│   Analytics API  │──────▶│  Dashboard  │
│             │ HTTPS │   (Serverless)   │       │   (Admin)   │
└─────────────┘       └──────────────────┘       └─────────────┘
                              │
                              ▼
                      ┌──────────────┐
                      │   Database   │
                      │  (DynamoDB)  │
                      └──────────────┘
```

### Event Submission

Events batched and sent periodically (not on every command):

```typescript
// Batch up to 50 events or 5 minutes, whichever comes first
POST https://analytics.lwp.dev/v1/events
Content-Type: application/json

{
  "batch_id": "uuid",
  "cli_version": "0.0.5",
  "os": "darwin",
  "events": [
    {"command": "sites.list", "success": true, ...},
    {"command": "wp", "success": true, ...}
  ]
}
```

### Aggregate Dashboard (Admin Only)

Available at internal admin URL:

- Total users (estimated by unique session patterns)
- Command popularity
- Success/failure rates
- Version adoption
- OS distribution
- Error trends

### Data Retention

- Events older than 90 days automatically deleted
- No long-term storage of individual events
- Aggregates computed daily and stored separately

---

## Phase 3: Signed URL Web Dashboard (Future)

### Problem

Users want to see their personal analytics in a web browser, but:
- Static tokens in URLs can leak via logs, referrer headers, sharing
- Brute-forcing simple tokens could expose user data

### Solution: Time-Limited Signed URLs

```bash
lwp analytics dashboard
```

Output:
```
Opening your analytics dashboard...

https://analytics.lwp.dev/d/abc123?sig=hmac_signature&exp=1706749200

This link expires in 1 hour. Run this command again for a new link.
```

### Config Updates for Phase 3

Add userId and secretKey to config:

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "secretKey": "base64-encoded-32-bytes",
  "analytics": {
    "enabled": true,
    "promptedAt": "2025-01-31T12:00:00Z"
  }
}
```

- `userId`: Random UUID v4, generated locally
- `secretKey`: 32 random bytes for HMAC signing
- Both generated when first needed (Phase 3), not in Phase 1

### How It Works

1. **User runs `lwp analytics dashboard`**
2. **CLI generates signed URL:**
   ```
   payload = userId + expiration_timestamp
   signature = HMAC-SHA256(payload, user_secret_key)
   url = base_url + "?user=" + userId + "&exp=" + timestamp + "&sig=" + signature
   ```
3. **Server validates:**
   - Signature matches
   - Expiration not passed
   - Rate limit not exceeded
4. **Dashboard shows only that user's data**

### Security Properties

| Attack | Mitigation |
|--------|------------|
| Brute force tokens | 256-bit HMAC signature = infeasible |
| URL sharing/leaking | Expires in 1 hour |
| Replay attacks | Expiration timestamp |
| Signature tampering | HMAC validation |
| Rate limiting bypass | Per-IP and per-user limits |

### Dashboard Features

- Command usage over time
- Most used commands
- Success/failure breakdown
- Session patterns
- "Delete my data" button
- "Download my data" (GDPR compliance)

---

## Implementation Plan

### Phase 1 (MVP) - CLI-Only (~300 lines, 1-2 files)

| Task | Estimate |
|------|----------|
| Config file management (`~/.lwp/config.json`) | S |
| Opt-in prompt on first run | S |
| Event tracking with Commander hooks | S |
| Local event storage (JSONL file) | S |
| `lwp analytics` commands (status, on, off, show, reset) | M |
| Simple text summary output | S |
| Documentation | S |
| **Total** | **~1 day** |

### Phase 2 - Central Service

| Task | Estimate |
|------|----------|
| Add extended event fields (version, os, session_id, error_category) | S |
| Design API endpoints | S |
| Set up serverless infrastructure (Lambda + DynamoDB) | M |
| Implement event ingestion endpoint | M |
| Build admin aggregate dashboard | L |
| Add batch event submission to CLI | M |
| **Total** | **~3-5 days** |

### Phase 3 - Signed URL Dashboard

| Task | Estimate |
|------|----------|
| Add userId and secretKey to config | S |
| Implement HMAC signing in CLI | S |
| Add signature validation to server | S |
| Build user-specific dashboard views | L |
| Add data export and deletion | M |
| **Total** | **~2-3 days** |

---

## Privacy Considerations

### GDPR Compliance

- **Data minimization:** Only collect what's necessary (Phase 1 is extremely minimal)
- **Purpose limitation:** Only for product improvement
- **Right to erasure:** `lwp analytics reset`
- **Right to access:** `lwp analytics show --json`
- **Consent:** Explicit opt-in prompt

### Data Flow

```
User's Machine                    Our Infrastructure
━━━━━━━━━━━━━━━                   ━━━━━━━━━━━━━━━━━━
~/.lwp/
├── config.json     ─── Config stays local (Phase 1)
│   └── analytics.enabled
│
└── analytics/
    └── events.jsonl ─── Events stay local (Phase 1)
                         ──▶ Anonymous events (Phase 2+)
```

---

## Decisions

1. **Opt-in vs Opt-out default?**
   - **Decision: Enabled by default (opt-out model)**
   - Analytics enabled by default to maximize data collection
   - Users can easily disable with `lwp analytics off`
   - First-run prompt informs users and offers easy opt-out
   - Non-interactive terminals also default to enabled

2. **What commands to exclude from tracking?**
   - **Decision: Hardcoded prefix exclusions**
   - `wpe.` - WP Engine commands
   - `analytics.` - Meta commands
   - User-configurable exclusions deferred to future phase

3. **Should we track error types?**
   - **Decision: Defer to Phase 2**
   - Phase 1 tracks only `success: true/false`
   - Error categorization added when transmitting to server

4. **Offline behavior?**
   - **Decision: Local-only for Phase 1**
   - Events stored in local JSONL file
   - No network transmission until Phase 2
   - Max queue size: 10,000 events

5. **CI/CD environments?**
   - **Decision: Auto-disable in CI**
   - Detect via `CI=true` environment variable
   - Also detect: `GITHUB_ACTIONS`, `GITLAB_CI`, `JENKINS_URL`, `TRAVIS`
   - Can be explicitly enabled with `LWP_ANALYTICS=1`

6. **Implementation complexity?**
   - **Decision: Minimal for Phase 1**
   - Single analytics module (~300 lines)
   - No external dependencies
   - Add complexity only when needed for Phase 2+

---

## Appendix: Event Payloads

### Phase 1: Minimal Event

```json
{
  "command": "sites.list",
  "success": true,
  "duration_ms": 234,
  "timestamp": "2025-01-31T12:00:00.000Z"
}
```

### Phase 2: Extended Event (Future)

```json
{
  "command": "sites.start",
  "success": false,
  "error_category": "site_not_found",
  "duration_ms": 156,
  "cli_version": "0.0.5",
  "os": "darwin",
  "node_version": "20.10.0",
  "timestamp": "2025-01-31T12:01:00.000Z",
  "session_id": "abc123"
}
```

---

## Security Considerations

### File Permissions

- Config file (`~/.lwp/config.json`): `0600`
- Events file (`~/.lwp/analytics/events.jsonl`): `0600`
- Directory (`~/.lwp/`): `0700`

### Atomic Writes

Use temp file + rename pattern to prevent corruption:
```typescript
const tempPath = `${configPath}.${process.pid}.tmp`;
fs.writeFileSync(tempPath, data);
fs.chmodSync(tempPath, 0o600);
fs.renameSync(tempPath, configPath);
```

### Error Handling

- Analytics failures must never block command execution
- Wrap all analytics code in try/catch
- Log errors to debug, don't show to users
- If config is corrupted, regenerate with defaults

---

## References

- [Homebrew Analytics](https://docs.brew.sh/Analytics) - Good example of transparent CLI analytics
- [npm telemetry discussion](https://github.com/npm/cli/issues/1494) - Community concerns
- [PostHog open source analytics](https://posthog.com/) - Self-hosted option
- [GDPR for developers](https://gdpr.eu/developers/) - Compliance guidance
