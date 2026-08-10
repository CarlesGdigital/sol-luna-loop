# Installer contract

The CLI is `node scripts/bootstrap-agents.mjs` and supports four actions:

* `install` discovers and validates the eight canonical TOML templates, checks
  manifest ownership, creates verified backups for managed updates, publishes
  files atomically, and writes the lock manifest.
* `check` is read-only exactness verification. It reports expected and actual
  hashes, pins, file type, and whether each file is owned by the manifest.
* `doctor` is read-only environment and ownership diagnostics. Its top-level
  JSON keys are stable: `action`, `ok`, `scope`, `platform`, `node`, `paths`,
  `lock`, `manifest`, `agents`, and `issues`.
* `uninstall` removes only exact regular files whose current SHA-256 matches a
  manifest entry. Local modifications, foreign files, symlinks, and other
  non-files are preserved and reported as conflicts.

## Scope and flags

The default scope is `user`, rooted at `os.homedir()`. User scope accepts
`--user-home <path>` and project scope accepts `--project-root <path>`; the
other path flag is rejected. `--dry-run` does not create a parent directory,
lock, manifest, backup, or role file. `--json` writes exactly one JSON object
to stdout and suppresses human output.

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
never followed, replaced, or removed.

Before replacing an exact owned file, the installer writes its old bytes to a
same-directory temporary backup, flushes them, and verifies the SHA-256 against
the manifest. Managed manifest upgrades from an older valid `0.x.y` plugin
version are accepted as ownership evidence, then rewrite the current manifest;
the prior manifest is included in the verified backup run. New and replacement
role files and the manifest are published only after their temporary bytes are
flushed. An installation error rolls back complete role and manifest files
where possible; it never intentionally leaves partial bytes.

Uninstall validates every component of `<agents-dir>` with `lstat` before
acquiring its lock. A symlink/junction or non-directory component returns the
structured `PATH_UNSAFE` error and is never followed. After the lock is
acquired, manifest and agent ownership are recomputed before any unlink.

## Runtime gate

This utility installs files only. It does not modify global `config.toml` or
perform runtime `agent_type` discovery. The primary Sol/High session must run
the temporary user/project lifecycle checks, inspect native runtime discovery
in a fresh Codex task, and decide whether the real user scope may be touched.
