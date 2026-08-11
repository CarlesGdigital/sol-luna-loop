# Testing

## Deterministic gates

```text
npm.cmd ci
npm.cmd test
npm.cmd run validate:plugin
npm.cmd pack --dry-run
git diff --check
```

The tests cover template pins/hashes, user and project installer lifecycles,
idempotency, ownership/conflict handling, backups/rollback, symlink/junction
refusal, manifest staleness, lock recovery, hook deny/allow decisions, package
shape, and loop-state transitions.

## Local runtime gates

Static tests cannot prove model routing. In a fresh Codex session, run the eight
minimal probes and record observed model/effort/fallback data. Run the negative
agent classes through `PreToolUse` and confirm no prohibited child starts.

## CI boundary

GitHub Actions runs deterministic validation on Ubuntu, Windows, and macOS with
Node.js 20. It does not call model APIs, consume Codex quota, or store runtime
credentials. Local runtime and E2E acceptance evidence belongs in
`docs/RELEASE_VALIDATION.md`.
