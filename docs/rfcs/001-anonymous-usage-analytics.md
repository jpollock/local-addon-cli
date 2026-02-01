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
5. **Security** - No data leakage between users

---

## Phase 1: Local Tracking + CLI Dashboard (MVP)

### What We Track

#### Collected Data

| Field | Example | Purpose |
|-------|---------|---------|
| `event` | `command_executed` | Event type |
| `command` | `sites.list` | Command name (no arguments) |
| `success` | `true` | Did it succeed? |
| `duration_ms` | `1234` | Execution time |
| `cli_version` | `0.0.5` | CLI version |
| `os` | `darwin` | Operating system |
| `node_version` | `20.10.0` | Node.js version |
| `timestamp` | `2025-01-31T12:00:00Z` | When it happened |
| `session_id` | `uuid` | Groups commands in one session |

#### Never Collected

- Site names, domains, paths
- Command arguments or flags
- File contents or database data
- IP addresses
- User names, emails, or any PII
- Environment variables
- Error stack traces with file paths

### User Identity

On first run, lwp generates a local identity stored in `~/.lwp/config.json`:

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "analytics": {
    "enabled": true,
    "promptedAt": "2025-01-31T12:00:00Z",
    "excludeCommands": ["wpe.*", "analytics.*"]
  }
}
```

- `userId`: Random UUID v4, generated locally
- Never transmitted with events (events are truly anonymous)
- Used only for local event correlation and future dashboard access
- `excludeCommands`: Glob patterns for commands to never track

### Command Exclusion

Certain commands are excluded from tracking by default:

| Pattern | Reason |
|---------|--------|
| `wpe.*` | May contain sensitive WP Engine hosting information |
| `analytics.*` | Meta commands about analytics itself |

Users can add custom exclusions:

```bash
lwp analytics exclude "db.*"      # Exclude all database commands
lwp analytics exclude "wp"        # Exclude wp-cli commands
lwp analytics exclude --list      # Show current exclusions
lwp analytics exclude --reset     # Reset to defaults
```

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

#### First Run

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

#### Commands

```bash
# Check current status
lwp analytics status
# → Analytics: enabled
# → User ID: 550e8400-...
# → Events this session: 12
# → Total events stored: 847

# Disable analytics
lwp analytics off
# → Analytics disabled. No data will be collected.

# Enable analytics
lwp analytics on
# → Analytics enabled. Thank you for helping improve lwp!

# View what's being collected
lwp analytics show
# → Shows recent events in a table

lwp analytics show --json
# → Exports all local events as JSON

# Delete all local data
lwp analytics reset
# → Deleted 847 local events.
# → Generated new user ID.

# See what would be sent (dry run)
lwp analytics debug
# → Shows next event payload without sending
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
{"event":"command_executed","command":"sites.list","success":true,"duration_ms":234,"timestamp":"2025-01-31T12:00:00Z"}
{"event":"command_executed","command":"wp","success":true,"duration_ms":1456,"timestamp":"2025-01-31T12:01:00Z"}
{"event":"command_executed","command":"sites.start","success":false,"duration_ms":5023,"timestamp":"2025-01-31T12:02:00Z"}
```

- Maximum 10,000 events stored locally (FIFO)
- ~1-2 MB max storage
- Rotated automatically

### CLI Dashboard

```bash
lwp analytics show
```

Output:
```
Usage Analytics (last 30 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Commands: 847
Success Rate:   94.2%

Top Commands:
  sites list      234  ████████████████████
  wp              189  ████████████████
  sites start     156  █████████████
  sites stop      98   ████████
  db export       45   ████

Commands by Day:
  Mon  ████████████████████  42
  Tue  ████████████████      35
  Wed  ██████████████████    38
  Thu  ████████████          28
  Fri  ██████████████████    37
  Sat  ████                  8
  Sun  ██████                12

Failed Commands (last 7 days):
  sites start   3 failures  "Site not found" (2), "Timeout" (1)
  wp            2 failures  "Site not running" (2)
```

---

## Phase 2: Central Analytics Service (Future)

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
    {"event": "command_executed", "command": "sites.list", ...},
    {"event": "command_executed", "command": "wp", ...}
  ]
}
```

**Note:** `userId` is NOT sent. Events are truly anonymous.

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

### User Secret Key

Stored locally in `~/.lwp/config.json`:

```json
{
  "userId": "uuid",
  "secretKey": "base64-encoded-32-bytes",
  "analytics": { "enabled": true }
}
```

- Generated on first run
- Never transmitted to server
- Used only for signing dashboard URLs
- Can be regenerated with `lwp analytics reset`

### Dashboard Features

- Command usage over time
- Most used commands
- Success/failure breakdown
- Session patterns
- "Delete my data" button
- "Download my data" (GDPR compliance)

---

## Implementation Plan

### Phase 1 (MVP) - CLI-Only

| Task | Estimate |
|------|----------|
| Add config file management (`~/.lwp/config.json`) | S |
| Implement opt-in prompt on first run | S |
| Add event tracking to command execution | M |
| Local event storage (JSONL file) | S |
| `lwp analytics` commands (status, on, off, show, reset) | M |
| CLI dashboard visualization | M |
| Documentation | S |
| **Total** | **~1-2 days** |

### Phase 2 - Central Service

| Task | Estimate |
|------|----------|
| Design API endpoints | S |
| Set up serverless infrastructure (Lambda + DynamoDB) | M |
| Implement event ingestion endpoint | M |
| Build admin aggregate dashboard | L |
| Add batch event submission to CLI | M |
| **Total** | **~3-5 days** |

### Phase 3 - Signed URL Dashboard

| Task | Estimate |
|------|----------|
| Implement HMAC signing in CLI | S |
| Add signature validation to server | S |
| Build user-specific dashboard views | L |
| Add data export and deletion | M |
| **Total** | **~2-3 days** |

---

## Privacy Considerations

### GDPR Compliance

- **Data minimization:** Only collect what's necessary
- **Purpose limitation:** Only for product improvement
- **Right to erasure:** `lwp analytics reset` + server deletion
- **Right to access:** `lwp analytics show --json` + dashboard export
- **Consent:** Explicit opt-in prompt

### Data Flow

```
User's Machine                    Our Infrastructure
━━━━━━━━━━━━━━━                   ━━━━━━━━━━━━━━━━━━
~/.lwp/
├── config.json     ─── userId never leaves machine
│   ├── userId
│   └── secretKey
│
└── analytics/
    └── events.jsonl ─── Events (no userId) ──▶ Analytics API
                                                    │
                                                    ▼
                                              Aggregated stats
                                              (no individual data)
```

---

## Decisions

1. **Opt-in vs Opt-out default?**
   - **Decision: Opt-in by default**
   - Users must explicitly agree to analytics on first run
   - No data collected until user consents

2. **What commands to exclude from tracking?**
   - **Decision: Configurable exclusion list**
   - Initial exclusions:
     - `wpe *` - WP Engine commands (may contain sensitive hosting info)
     - `analytics *` - Meta commands about analytics itself
   - Exclusion list stored in config, extensible for future needs

3. **Should we track error types?**
   - **Decision: Yes, track error categories**
   - Track category (e.g., `site_not_found`, `timeout`, `auth_failed`)
   - Never track error messages (may contain paths/names)

4. **Offline behavior?**
   - **Decision: Queue locally, send when online**
   - Events stored in local JSONL file
   - Batched and sent when connectivity available
   - Max queue size: 10,000 events (FIFO)

5. **CI/CD environments?**
   - **Decision: Auto-disable in CI**
   - Detect via `CI=true` environment variable
   - Also detect: `GITHUB_ACTIONS`, `GITLAB_CI`, `JENKINS_URL`, `TRAVIS`
   - Can be explicitly enabled with `LWP_ANALYTICS=1`

---

## Appendix: Example Event Payloads

### Command Executed (Success)

```json
{
  "event": "command_executed",
  "command": "sites.list",
  "success": true,
  "duration_ms": 234,
  "cli_version": "0.0.5",
  "os": "darwin",
  "node_version": "20.10.0",
  "timestamp": "2025-01-31T12:00:00.000Z",
  "session_id": "abc123"
}
```

### Command Executed (Failure)

```json
{
  "event": "command_executed",
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

### CLI Started

```json
{
  "event": "cli_started",
  "cli_version": "0.0.5",
  "os": "darwin",
  "node_version": "20.10.0",
  "timestamp": "2025-01-31T12:00:00.000Z",
  "session_id": "abc123"
}
```

---

## References

- [Homebrew Analytics](https://docs.brew.sh/Analytics) - Good example of transparent CLI analytics
- [npm telemetry discussion](https://github.com/npm/cli/issues/1494) - Community concerns
- [PostHog open source analytics](https://posthog.com/) - Self-hosted option
- [GDPR for developers](https://gdpr.eu/developers/) - Compliance guidance
