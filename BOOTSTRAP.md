# Luna/Max Codex agent bootstrap

This repository contains the smallest Codex-only bootstrap for the native agent
`sll_bootstrap_luna_max`. It does not scaffold a plugin, edit `config.toml`, or
touch any Cursor, Kiro, Copilot, or ChatGPT compatibility files.

## Requirements

- Node.js 20 or newer.
- A writable user home directory.

The exact template is tracked at
`agent-templates/sll_bootstrap_luna_max.toml`. The installer always reads that
file and computes its SHA-256 before it does anything to the destination.

## Install and check

Install to the current user's Codex scope:

```text
node scripts/bootstrap-agents.mjs install
```

The default destination is
`<os.homedir()>/.codex/agents/sll_bootstrap_luna_max.toml`. To inspect or test a
different home, pass `--user-home <path>`:

```text
node scripts/bootstrap-agents.mjs install --user-home C:\temp\codex-home
node scripts/bootstrap-agents.mjs check --user-home C:\temp\codex-home --json
```

`install` creates the parent directories, publishes the flushed file
atomically, and is idempotent when the destination already has the exact
template bytes. A destination containing any other file (including a symlink)
is a closed conflict: the command exits nonzero and leaves it unchanged. The
installer never modifies `config.toml`.

Use `--dry-run` to see the planned install without creating directories or
writing a file:

```text
node scripts/bootstrap-agents.mjs install --user-home C:\temp\codex-home --dry-run --json
```

`check` reports existence, exact-byte equality, SHA-256 equality, and every
required schema literal. It exits nonzero for a missing, tampered, or otherwise
non-matching file. `--json` emits one object only, with hashes and status but
never the template body.

## Verification

Run the dependency-free test suite from the repository root:

```text
node --test tests/bootstrap-agents.test.mjs
git diff --check
```

The tests use temporary homes and cover install, check, idempotent reinstall,
dry-run safety, conflict refusal, tamper detection, JSON output, and the
default literal pins.
