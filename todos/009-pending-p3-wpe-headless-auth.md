---
status: deferred
priority: p3
issue_id: "009"
tags: [code-review, agent-native, local-core]
dependencies: []
deferred_reason: Requires changes to Local's core WpeOAuthService
---

# WPE Login Requires Browser OAuth (Not Agent-Native)

## Problem Statement

The `lwp wpe login` command triggers browser-based OAuth authentication. There is no headless/token-based authentication option for agents.

**Why it matters:** Agents cannot programmatically authenticate with WP Engine. They can only use WPE features if a human has previously authenticated.

## Findings

**Location:** `/packages/cli/src/index.ts` lines 1153-1181

The command opens a browser for OAuth flow - no non-interactive option exists.

**Technical Constraint:** WPE authentication is handled by Local's core `WpeOAuthService` in `app/main/wpeOAuth/WpeOAuthService.ts`. This service:
- Uses OAuth 2.0 with Okta for authentication
- Stores encrypted OAuth tokens (idToken, accessToken, refreshToken) via Local's userData service
- Has no public API for accepting direct tokens

The CLI addon cannot implement token-based auth without changes to Local's core.

## Proposed Solutions

### Option A: Add --token flag (Requires Local Core Changes)
- **Pros:** Simple API, WPE supports API tokens
- **Cons:** Requires modifying WpeOAuthService in Local core
- **Effort:** High (involves Local core team)
- **Risk:** Low

Would require:
1. Add `authenticateWithToken(token: string)` method to WpeOAuthService
2. Validate token against WPE API
3. Store token in same encrypted userData location
4. Expose via IPC event for addon to call

### Option B: Refresh token persistence
- **Pros:** Uses existing OAuth tokens after initial browser auth
- **Cons:** Still requires initial browser auth
- **Effort:** Low
- **Risk:** Low

OAuth refresh tokens are already persisted. After initial browser auth, subsequent CLI sessions can use the stored tokens until they expire.

## Recommended Action

1. For now, document that initial auth requires browser (human interaction)
2. Open a feature request with Local core team for Option A
3. Note: The refresh token persistence (Option B) already works - no code changes needed

## Acceptance Criteria

- [x] Document current limitation in README
- [ ] (Future: Local Core) Add WpeOAuthService.authenticateWithToken() method
- [ ] (Future: Addon) Add --token option to wpe login
- [ ] (Future) Document how to generate WPE API token

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-30 | Identified via agent-native review | Always provide non-interactive auth options |
| 2026-01-30 | Analyzed: Requires Local core changes | OAuth is core, addon can only trigger it |
