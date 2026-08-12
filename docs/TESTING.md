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
minimal probes and record observed model/effort/fallback data. A
`danger-full-access` parent may verify all eight without a sandbox mismatch
failure. Use separate `read-only` and `workspace-write` parent turns only for an
explicit least-privilege enforcement test. When public runtime details omit
model or effort, run `scripts/verify-agent-runtime.mjs` against the exact child
thread ID and accept `ok: true` regardless of `sandboxOverride`.
Run negative agent classes through the live runtime: supported `PreToolUse`
paths must deny before spawn, while a specialized path that opts out must make
`SubagentStart` inject quarantine context; the live test must then verify that
the child performed no productive work.

## CI boundary

GitHub Actions runs deterministic validation on Ubuntu, Windows, and macOS with
Node.js 20. It does not call model APIs, consume Codex quota, or store runtime
credentials. Local runtime and E2E acceptance evidence belongs in
`docs/RELEASE_VALIDATION.md`.
