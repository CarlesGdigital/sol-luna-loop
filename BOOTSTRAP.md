# Definitive Luna/Max agent bootstrap

This repository contains a dependency-free Node.js 20+ installer for the eight
definitive `sol-luna-loop` Luna/Max roles. The accepted
`sll_bootstrap_luna_max` template remains in `agent-templates/`, but it is a
bootstrap asset and is not managed by the eight-role manifest.

The installer never edits `config.toml`, never contacts a model API, and never
overwrites or removes an agent that is foreign to its manifest. It is safe to
exercise with temporary homes and project roots before the primary session
performs any real Codex-scope installation.

## Commands

User scope defaults to the current OS home and publishes to
`<user-home>/.codex/agents`:

```text
node scripts/bootstrap-agents.mjs install
node scripts/bootstrap-agents.mjs check --scope user --user-home C:\temp\codex-home --json
node scripts/bootstrap-agents.mjs doctor --scope user --user-home C:\temp\codex-home --json
node scripts/bootstrap-agents.mjs uninstall --scope user --user-home C:\temp\codex-home --json
```

Project scope publishes to `<project-root>/.codex/agents`:

```text
node scripts/bootstrap-agents.mjs install --scope project --project-root C:\temp\my-project
node scripts/bootstrap-agents.mjs check --scope project --project-root C:\temp\my-project --json
node scripts/bootstrap-agents.mjs doctor --scope project --project-root C:\temp\my-project --json
node scripts/bootstrap-agents.mjs uninstall --scope project --project-root C:\temp\my-project --json
```

`--dry-run` performs discovery and reports what would change without creating
directories, lock files, manifests, backups, or role files. `--json` emits one
machine-readable object on stdout and never includes template bodies.

Supported actions are `install`, `check`, `doctor`, and `uninstall`. Scope paths
are explicit: `--user-home` is valid only for user scope and `--project-root`
only for project scope. Empty, contradictory, duplicate, or unknown arguments
fail closed.

## Safety and recovery

The managed manifest is
`<agents-dir>/sol-luna-loop.lock.json` (schema version `1`). It records the
plugin version, scope, generation time, and the expected model, reasoning,
sandbox, SHA-256, and repository-relative template origin for every role.

Mutating actions serialize through the exclusive
`<agents-dir>/.sol-luna-loop.lock`. A live lock is an error; it is never
bypassed. Every replacement of an exact manifest-owned file is backed up under
`<agents-dir>/.sol-luna-loop-backups/<timestamp>/` and the backup hash is
verified before publication. Files are written to same-directory temporary
files, flushed, and then published atomically. Temporary files are cleaned up.

An absent-manifest file is foreign even if its bytes happen to match a current
template. A manifest-owned file whose bytes no longer match its recorded hash
is a tampered conflict. Both cases are preserved. Uninstall removes only exact
manifest-owned regular files; foreign files, symlinks, directories, and local
edits remain in place and produce a nonzero conflict result.

`check` verifies exact bytes, hashes, pins, and ownership without mutation.
`doctor` is read-only and reports stable action, scope, platform, Node gate,
paths, lock state, manifest validity, per-agent status, and deterministic issue
codes. Runtime discovery in Codex is a separate gate and may require a fresh
Codex task after installation.

## Verification

From the repository root:

```text
npm test
git diff --check
node scripts/bootstrap-agents.mjs install --dry-run --json
```

The test suite uses temporary user/project scopes only. The primary session
must independently inspect the diff, rerun the suite, perform temporary
lifecycle checks, and decide whether the real Codex user scope may be touched.
