# Installer contract

The CLI is `node scripts/bootstrap-agents.mjs` and supports four actions:

* `install` discovers and validates the eight canonical TOML templates, checks
  manifest ownership, creates verified backups for managed updates, publishes
  complete file bytes through flushed same-directory temporaries, and writes
  the lock manifest. A later failure is rolled back where possible without
  intentionally leaving partial bytes.
* `check` is read-only exactness verification. Before reading the manifest,
  role files, or any other managed state, it validates every existing component
  of `<agents-dir>` with `lstat`. A pre-existing symlink/junction or
  non-directory component fails closed with structured `PATH_UNSAFE` (CLI exit
  `2`) and is never followed. A genuinely missing path continues with ordinary
  missing-install issues. The result reports expected and actual hashes, pins,
  file type, and whether each file is owned by the manifest. A valid manifest
  from an older plugin version is reported with deterministic `MANIFEST_STALE`
  until `install` rewrites it to the current version.
* `doctor` is read-only environment and ownership diagnostics. It applies the
  same component-by-component path check before reading managed or lock state;
  an unsafe component returns `PATH_UNSAFE`, while a missing path is diagnosed
  as an incomplete installation. Its top-level JSON keys are stable: `action`,
  `ok`, `scope`, `platform`, `node`, `paths`, `lock`, `manifest`, `agents`, and
  `issues`; it reports the same `MANIFEST_STALE` issue for an older valid
  manifest.
* `uninstall` removes only exact regular files whose current SHA-256 matches a
  manifest entry. Local modifications, foreign files, symlinks, and other
  non-files are preserved and reported as conflicts. With no manifest it is
  idempotent only when no canonical role path exists. An existing canonical
  role path is an `unowned-file` or `foreign-type` conflict, preserved with a
  nonzero result in both ordinary and `--dry-run` modes. If the manifest
  disappears after lock acquisition, uninstall re-inspects state and applies
  the same rule before unlinking anything.

## Scope and flags

The default scope is `user`, rooted at `os.homedir()`. User scope accepts
`--user-home <path>` and project scope accepts `--project-root <path>`; the
other path flag is rejected. `--dry-run` does not create a parent directory,
lock, manifest, backup, or role file. It still validates every existing
component of the agents path and returns `PATH_UNSAFE` for a symlink/junction
or non-directory component, so a dry-run can never report a plan through an
unsafe parent. `--json` writes exactly one JSON object to stdout and
suppresses human output; template bodies are never included.

## Ownership and paths

Each scope uses these paths:

* `<agents-dir>/sol-luna-loop.lock.json` — schema version `1` manifest;
* `<agents-dir>/.sol-luna-loop.lock` — exclusive mutation lock;
* `<agents-dir>/.sol-luna-loop-backups/<timestamp>/` — verified managed-update backups;
* `<agents-dir>/sll_luna_<role>.toml` — the eight definitive role files.

The installer refuses an unknown `sll_luna_*.toml` repository template and
never trusts a manifest name or origin outside the definitive list. An
unowned destination file is a conflict even when its contents resemble a
canonical template. A managed file with bytes different from its recorded
manifest SHA-256 is tampered and is preserved. A symlink or non-file target is
never followed, replaced, or removed. Manifest ownership is required before a
role or manifest file can be replaced or removed.

Before replacing an exact owned file, the installer writes its old bytes to a
same-directory temporary backup, flushes them, and verifies the SHA-256 against
the manifest. Managed manifest upgrades from an older valid `0.x.y` plugin
version are accepted as ownership evidence, then rewrite the current manifest;
the prior manifest is included in the verified backup run. New and replacement
role files and the manifest are published only after their temporary bytes are
flushed. Publication is atomic per file; an installation error rolls back
complete role and manifest files where possible, but the complete install is
not a process-wide transaction.

All actions validate every existing component of `<agents-dir>` with `lstat`.
A symlink/junction or non-directory component returns the structured
`PATH_UNSAFE` error and is never followed. Missing components are allowed to
remain missing for read-only diagnostics. Uninstall performs another path
check immediately before acquiring its lock and recomputes manifest and agent
ownership after the lock is acquired, before any unlink.

## Lock lifecycle

Mutating `install` and manifest-owned `uninstall` actions use the exclusive
`<agents-dir>/.sol-luna-loop.lock`; an existing lock is never bypassed and
returns `LOCK_ACTIVE`. Dry-runs and a no-manifest uninstall that has no owned
mutation to perform return without acquiring this lock. Lock initialization
uses exclusive creation (`wx`), writes metadata containing a random owner
token, flushes it, and closes the handle. If setup fails after creation, the
owner closes the handle and removes that path only after confirming the same
token; the original setup error is re-thrown, with structured cleanup evidence
when cleanup itself fails.

`release()` validates that the path is a regular file with parseable metadata
and the original token, unlinks it, and only then marks the lock object
released. Missing, unsafe, malformed, or replacement-token state is not
removed and returns `LOCK_LOST`; restoring the original owned metadata allows
the owner to retry `release()`. The lock serializes cooperating installer
processes, while component, token, ownership, and hash checks fail closed when
they detect changed or unsafe state.

## Security boundary

The dependency-free Node.js path syscalls and the lock are cooperative
controls, not an OS-enforced isolation boundary. They detect pre-existing
unsafe components and changes observed at their validation points, but they do
not make the installer race-free against a hostile process with equivalent
filesystem permissions. Such a process can race between checks and mutations
or modify the same files directly. Do not run this installer elevated against a
user/project tree writable by a less-privileged or untrusted actor.

Within that boundary, the verified fail-closed guarantees remain strong:

* pre-existing symlink/junction and non-directory components are refused;
* detected foreign or tampered paths are preserved, and manifest ownership is
  required for replace/remove;
* JSON output never includes template bodies; and
* the installer does not edit `config.toml` or contact a model API.

## Runtime gate

This utility installs files only. It does not modify global `config.toml` or
perform runtime `agent_type` discovery. The primary Sol/High session must run
the temporary user/project lifecycle checks, inspect native runtime discovery
in a fresh Codex task, and decide whether the real user scope may be touched.
