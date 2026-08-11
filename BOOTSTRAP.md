# Definitive Luna/Max agent bootstrap

This repository contains a dependency-free Node.js 20+ installer for the eight
definitive `sol-luna-loop` Luna/Max roles. The accepted
`sll_bootstrap_luna_max` template remains in `agent-templates/`, but it is a
bootstrap asset and is not managed by the eight-role manifest.

The installer never edits `config.toml`, never contacts a model API, and never
overwrites or removes an agent that is foreign to its manifest. It is safe to
exercise with temporary homes and project roots before the primary session
performs any real Codex-scope installation.

The repository is also a Codex plugin release. The public Git-backed install is:

```text
codex plugin marketplace add CarlesGdigital/sol-luna-loop --ref v1.0.0
```

Install/enable it from `/plugins`, review and trust its bundled hooks from
`/hooks`, then start a new Codex session. Plugin installation does not silently
copy custom agents; run the explicit CLI below from the installed plugin root.

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
directories, lock files, manifests, backups, or role files. Existing path
components are still checked with `lstat`; an existing symlink/junction or
non-directory component returns `PATH_UNSAFE` rather than following it. A
nonexistent target root remains untouched. `--json` emits one machine-readable
object on stdout and never includes template bodies.

Supported actions are `install`, `check`, `doctor`, and `uninstall`. Scope paths
are explicit: `--user-home` is valid only for user scope and `--project-root`
only for project scope. Empty, contradictory, duplicate, or unknown arguments
fail closed.

## Safety and recovery

The managed manifest is
`<agents-dir>/sol-luna-loop.lock.json` (schema version `1`). It records the
plugin version, scope, generation time, and the expected model, reasoning,
sandbox, SHA-256, and repository-relative template origin for every role.

Every existing component of `<agents-dir>` is validated with `lstat` before the
installer uses it. In particular, read-only `check` and `doctor` validate the
components before reading managed state or lock state. A pre-existing
symlink/junction or non-directory component fails closed with structured
`PATH_UNSAFE` and is never followed. A genuinely missing path continues with
the ordinary missing-install diagnostics.

Mutating actions serialize through the exclusive
`<agents-dir>/.sol-luna-loop.lock`. A live lock is an error; it is never
bypassed. Lock setup uses exclusive creation, writes and flushes its metadata,
and, if setup fails after creation, closes and removes that same-token lock
where it can still prove ownership. The original setup error is preserved; a
cleanup failure is attached as structured cleanup evidence. `release()` checks
the same token and removes the lock before marking it released. Missing,
unsafe, malformed, or replacement-token locks remain in place and return
`LOCK_LOST`; after the original owned metadata is restored, the owner may retry
release.

Every replacement of an exact manifest-owned file is backed up under
`<agents-dir>/.sol-luna-loop-backups/<timestamp>/` and the backup hash is
verified before publication. Files are written to same-directory temporary
files, flushed, and then published atomically per file. Temporary files are
cleaned up. This does not make the complete install a process-wide transaction;
rollback restores complete old/new files where possible when a later step fails.

An absent-manifest file is foreign even if its bytes happen to match a current
template. A manifest-owned file whose bytes no longer match its recorded hash
is a tampered conflict. Both cases are preserved. Uninstall removes only exact
manifest-owned regular files; foreign files, symlinks, directories, and local
edits remain in place and produce a nonzero conflict result. With no manifest,
uninstall is idempotent only when no canonical role path exists. An existing
canonical role path is returned as an `unowned-file` or `foreign-type` conflict
and is preserved, including in `--dry-run`. The final post-lock inspection uses
the same rule if the manifest disappears while uninstall is waiting to mutate.

`check` verifies exact bytes, hashes, pins, and ownership without mutation. A
valid prior-version manifest remains usable ownership evidence, but both
`check` and `doctor` report deterministic `MANIFEST_STALE` and remain not-ok
until `install` upgrades the manifest. `doctor` is read-only and reports stable
action, scope, platform, Node gate, paths, lock state, manifest validity,
per-agent status, and deterministic issue codes. Runtime discovery in Codex is a
separate gate and may require a fresh Codex task after installation.

The exclusive lock serializes cooperating installer processes. Component
checks, lock-token checks, and manifest ownership/hash checks fail closed when
they detect unsafe or changed state. They are not a security boundary against
a hostile process with equivalent filesystem permissions that races between
checks and mutations; such a process can already modify the same files
directly. Do not run this installer elevated against a user/project tree that
is writable by a less-privileged or untrusted actor.

The writing-role contracts are intentionally restrictive: implementer forbids
merge, push, PR, and deploy actions; fixer must record changed hypotheses and
failure fingerprints and never repeat a failed strategy without new evidence;
test engineer forbids weakening, manipulating, or skipping tests; reviewer
checks regressions, bugs, maintainability, and concurrency; and security
auditor covers a threat model, dependency audit, secret scanning,
authentication, authorization, injection, XSS, CSRF, SSRF, path traversal,
command injection, supply chain, symlink/TOCTOU/concurrency, and applicable
risks.

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
For a read-only preflight, run `check` and `doctor` against an explicit
temporary scope and confirm that `PATH_UNSAFE` refuses any pre-existing unsafe
component before the target is read.
