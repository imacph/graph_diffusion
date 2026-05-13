## Commit Message Formula

### General Structure

```
<type>(<scope>): <subject>

<body>

<footer>
```

---

## Core Formula

**Header (50 chars max):**
- `<type>`: What kind of change (feat, fix, refactor, docs, test, chore, perf, style)
- `<scope>`: What component/module (optional but recommended)
- `<subject>`: Imperative, present tense, no period. What does this commit DO?

**Body (72 chars per line):**
- Explain WHY, not WHAT (WHAT is in the diff)
- Reference issues/tickets if applicable
- Can be multiple paragraphs

**Footer:**
- Breaking changes: `BREAKING CHANGE: description`
- Issue references: `Closes #123`, `Fixes #456`

---

## Templates by Change Size

### Template 1: Tiny Fix (one-liner)

```
fix(cache): invalidate on TTL expiry
```

Use when:
- Single line change
- Clear, self-explanatory intent
- No deeper context needed

**Real examples:**
```
fix(parser): handle empty input
docs: update installation instructions
test(api): increase timeout for slow CI
```

---

### Template 2: Small Feature/Fix (~5-20 lines)

```
feat(auth): add JWT token refresh mechanism

- Token refresh endpoint validates expired tokens
- Implements sliding window expiration (30 min)
- Returns new token in response headers

Closes #234
```

Use when:
- Single responsibility, but needs context
- Motivated by a specific issue/feature request
- Implementation details worth explaining

---

### Template 3: Medium Change (20-100 lines, single component)

```
refactor(database): migrate connection pooling to async/await

## Motivation
Previous callback-based pooling made error handling fragile and
difficult to trace. Async/await improves readability and integrates
with modern error handling patterns.

## Changes
- Replace Pool.connect(callback) with Pool.acquire() async method
- Migrate 12 call sites to async/await
- Add connection timeout validation
- Deprecate old Pool.connect() method (will remove in v2.0)

## Testing
- All existing tests pass
- Added integration tests for timeout scenarios
- Verified connection leak under high concurrency (stress test)

BREAKING CHANGE: Pool.connect(callback) now throws if pool is closed.
Use Pool.acquire() instead.

Closes #445
```

Use when:
- Affects multiple files in one component
- Involves design decisions worth documenting
- May have downstream effects
- Breaking changes

---

### Template 4: Large Feature (100+ lines, multiple components)

```
feat: add real-time collaboration layer

## Overview
Implement operational transformation (OT) for concurrent document editing.
Enables multiple users to edit the same document simultaneously with
automatic conflict resolution.

## Architecture
- `src/ot/`: Core OT engine (transform, compose, invert operations)
- `src/sync/`: Sync protocol (client heartbeat, server acknowledgment)
- `src/network/`: WebSocket server and reconnection logic

## Key Changes
- New TransformationEngine class with proper associativity proofs
- SyncProtocol handles out-of-order operations via sequence numbers
- Graceful degradation: falls back to last-write-wins if OT fails
- Rate limiting: max 1000 ops/sec per document

## Testing
- Property-based tests for OT: tested 100k random operation sequences
- Integration tests with 10-user simulated edit scenarios
- Network partition tests: 5000+ operations with connectivity loss
- Performance: <5ms transform time for typical documents

## Migration
- Existing documents continue with last-write-wins (no changes needed)
- New documents opt-in to OT via feature flag
- Full migration planned for v3.0 (6 months)

## Known Limitations
- OT history not persisted (server restart loses transform chain)
- No offline support yet (planned Q3)

Closes #312
Relates to #445
```

Use when:
- Major feature spanning multiple areas
- Architectural decisions
- Complex testing strategy
- Migration/compatibility notes
- Known limitations or future work

---

### Template 5: Emergency Hotfix

```
hotfix: prevent account lockout on failed 2FA

## Critical Issue
Users stuck unable to login after 3 failed 2FA attempts. Lockout
timer not respecting timezone offsets; appears permanent to UTC-based users.

## Root Cause
`lockoutUntil = now + 30min` calculated in UTC, but checked against
local time. Off by +8 hours for PST users.

## Solution
Use moment().utc() consistently for all time comparisons.

## Testing
- Verified against all 15 timezone offsets
- Regression test added: prevents future lockout miscalculations

## Deployment
- Hotfix should be deployed immediately to all regions
- No data migration needed
- Existing locked-out users: run unlock script in ops docs

Closes #789 (critical)
```

Use when:
- Production incident
- Clear explanation of issue + solution
- Deployment instructions if non-standard

---

## Anti-Patterns to Avoid

❌ **Vague subjects:**
```
fix: stuff
update: things
refactor: code improvements
```

❌ **Passive voice:**
```
was fixed
have been updated
```

❌ **Too long (header >50 chars):**
```
fix(authentication): add support for two-factor authentication via TOTP
```

❌ **Implementation details in header:**
```
feat: convert callback to promise using util.promisify()
```

❌ **No context (commit message is just the diff):**
```
Modified UserService.java and updated test suite
```

---

## Quick Reference: Type Meanings

| Type | Use For | Example |
|------|---------|---------|
| `feat` | New feature | `feat(auth): add OAuth2 provider` |
| `fix` | Bug fix | `fix(parser): handle edge case in regex` |
| `refactor` | Restructure without changing behavior | `refactor(db): extract pool management` |
| `perf` | Performance improvement | `perf(render): memoize expensive calculations` |
| docs | Documentation changes | `docs: add API reference` |
| `test` | Add/modify tests | `test(api): add stress tests for connections` |
| `style` | Code style, formatting (no logic change) | `style: conform to eslint rules` |
| `chore` | Build, CI, deps (no product change) | `chore(deps): upgrade TypeScript to 5.0` |

---

## Checklist for Quality Commits

- [ ] Subject is imperative mood ("add" not "adds", "fixed" not "fixes")
- [ ] Subject capitalizes first letter
- [ ] Subject has no period at end
- [ ] Header ≤ 50 characters
- [ ] Body wrapped at 72 characters
- [ ] Body explains WHY, not WHAT
- [ ] Related issues are referenced (Closes, Fixes, Relates)
- [ ] Breaking changes documented if applicable
- [ ] Type and scope are accurate

---

## Pro Tip: Scope Selection

Choose scope based on your codebase structure:

**By module:** `feat(auth)`, `fix(payments)`, `docs(api)`

**By layer:** `feat(backend)`, `fix(frontend)`, `refactor(database)`

**By feature:** `feat(user-profiles)`, `fix(checkout-flow)`

Pick one convention and stick with it across your project.