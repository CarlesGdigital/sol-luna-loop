# Security

The installer is dependency-free and uses Node built-ins. It does not execute
model-provided shell, contact a model API, edit Codex global configuration, or
accept credentials. JSON results omit template bodies.

The installer validates every existing path component with `lstat`, rejects
symlinks/junctions and non-directories, requires manifest ownership plus current
hashes before replacement/removal, preserves foreign/tampered files, verifies
backups, and serializes cooperating mutations with an exclusive lock.

The lock and path checks are cooperative controls, not an OS isolation boundary
against an equal-permission process racing between syscalls. Do not run the
installer elevated against trees writable by less-privileged or untrusted
actors. This limitation is explicit and tested at the observable validation
boundary.

Plugin hooks are non-managed hooks. Codex must show them for review and trust;
the plugin does not silently mutate global trust/configuration. The routing hook
is a guardrail: `PreToolUse` denies known prohibited spawn requests, while
specialized runtime paths may require independent verification.

The deterministic release scan rejects PAT/OAuth-like credentials and local
user paths in tracked metadata. The release reviewer separately checks that
temporary fixtures, caches, logs, archive paths, and GitHub Actions permissions
do not enter the published tree; these are release-review gates rather than
claims made by the installer itself.
