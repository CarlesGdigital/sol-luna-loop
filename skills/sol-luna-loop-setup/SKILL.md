---
name: sol-luna-loop-setup
description: Install, verify, and safely operate the Sol/High loop with the eight pinned Luna/Max custom agents.
---

# Sol Luna Loop setup and operation

Use this skill when a repository needs the definitive `sol-luna-loop` workflow.
The parent Codex session remains Sol/High. The only productive child agent types
are the eight named `sll_luna_*` profiles, each pinned by its TOML template to
`gpt-5.6-luna` with `model_reasoning_effort = "max"`.

## Requirements and boundaries

- Node.js 20 or newer is required for the dependency-free installer.
- Multi-agent tools must be enabled in Codex.
- Git is required only when installing this plugin from a Git marketplace.
- Do not edit `config.toml` or bypass hook trust.
- Do not substitute `worker`, `default`, built-in `explorer`, Terra, a Sol child,
  or an unrecognised agent type.
- Do not run the installer elevated against a tree writable by a less-privileged
  or untrusted actor.

## Locate the installed plugin

When the plugin is installed from a marketplace, use its installed root as
`PLUGIN_ROOT`. If the shell does not expose that variable, use the checked-out
repository root that contains this skill and `scripts/bootstrap-agents.mjs`.

## Install or upgrade the agents

Run the dependency-free CLI from the plugin root. User scope is the default:

```text
node scripts/bootstrap-agents.mjs install --json
node scripts/bootstrap-agents.mjs check --scope user --json
node scripts/bootstrap-agents.mjs doctor --scope user --json
```

For a project-scoped installation:

```text
node scripts/bootstrap-agents.mjs install --scope project --project-root <PROJECT_ROOT> --json
node scripts/bootstrap-agents.mjs check --scope project --project-root <PROJECT_ROOT> --json
node scripts/bootstrap-agents.mjs doctor --scope project --project-root <PROJECT_ROOT> --json
```

Use `install --dry-run --json` before a change when you need a pure preview.
The installer creates an owned manifest, records SHA-256 hashes, preserves
foreign files, backs up exact owned updates, and refuses unsafe path components.
Re-run `check` and `doctor` after every upgrade. A stale manifest is repaired by
`install`; do not delete it manually.

## Hooks and restart boundary

Installing or enabling this plugin does not trust its hooks automatically. Open
`/hooks` in Codex, review the current hook definition, and trust it explicitly
when you accept the routing policy. The `PreToolUse` hook denies prohibited
agent spawns before execution. `SubagentStart`, `SubagentStop`, and `Stop` are
observational lifecycle hooks; they do not replace the PreToolUse boundary.

After installing or changing a plugin or custom-agent files, start a new Codex
session before relying on discovery. Never claim runtime routing from TOML hashes
alone.

## Runtime verification

In the new session, verify the parent is Sol/High, then run a minimal probe for
each of these exact custom agent types:

```text
sll_luna_probe
sll_luna_explorer
sll_luna_implementer
sll_luna_fixer
sll_luna_test_engineer
sll_luna_reviewer
sll_luna_security_auditor
sll_luna_docs_writer
```

Record the observed `agent_type`, model, configured/observed effort, sandbox,
start/stop status, and any fallback or override. The required sequence is
Sol/High parent → Luna/Max child → Sol/High parent. If a role is not discoverable,
stop with `RESTART_REQUIRED` or `BLOCKED_RUNTIME_RESTART_REQUIRED` rather than
falling back to a built-in agent.

## Uninstall

To remove only exact owned files while preserving foreign agents:

```text
node scripts/bootstrap-agents.mjs uninstall --scope user --json
```

Use the corresponding project flags for project scope. Inspect conflicts before
retrying; an unowned or tampered file is intentionally preserved.
