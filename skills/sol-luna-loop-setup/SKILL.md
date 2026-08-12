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
after a new install or hook change when you accept the routing policy. Do not
repeat this manual gate on every task: an observed `sol-luna-loop` hook message
in the current session proves that the trusted hook executed. The `PreToolUse` hook denies prohibited
agent spawns before execution on supported tool paths. A specialized spawn path
may opt out of that event; `SubagentStart` then quarantines prohibited roles or
a canonical role with a wrong reported model, using a no-tools/no-edits
instruction and warning to the parent. That event does not expose reasoning
effort. This defense in depth does not replace the parent's exact allow-list and
runtime telemetry. `SubagentStop` and `Stop` remain observational hooks.

The `SubagentStart` policy matches every child while the plugin is enabled.
Disable the plugin or its hooks before running an unrelated workflow that
legitimately requires a built-in or third-party child role.

After installing or changing a plugin or custom-agent files, start a new Codex
session before relying on discovery. Never claim runtime routing from TOML hashes
alone.

## Runtime verification

Codex reapplies the parent turn's live sandbox and approval overrides to every
child. A custom agent's `sandbox_mode` is therefore its default, not a boundary
that can override the active parent turn. `read-only`, `workspace-write`, and
`danger-full-access` are all compatible parent sandboxes. Never block the loop,
request separate tasks, or return `ROUTING_DENIED` solely because the live
sandbox differs from a role's TOML default. Record the difference as an active
parent override. When the user deliberately selected `danger-full-access`, all
eight roles may run in that one parent task; their role-specific no-write or
bounded-write instructions remain behavioral constraints.

Only use separate `read-only` and `workspace-write` turns when the user
explicitly asks to prove OS-enforced least-privilege behavior. That optional
sandbox test is independent from the Luna/Max routing gate.

Spawn every child with its explicit `agent_type` and `fork_turns="none"`; do not
pass model or reasoning overrides. The child's own message is liveness evidence,
not authoritative self-identification. Obtain the exact child thread ID from the
spawn result and verify its local rollout from the plugin root:

```text
node scripts/verify-agent-runtime.mjs --thread-id <THREAD_ID> --expected-role <SLL_ROLE> --json
```

The verifier reads `$CODEX_HOME/sessions` or `~/.codex/sessions`, requires the
exact role, `gpt-5.6-luna`, and effort `max`, and reports the live sandbox and
approval settings. `ok: true` remains acceptance when `sandboxOverride: true`,
including `danger-full-access`. Use public runtime details instead when they
already expose the same facts; use the local verifier as the authoritative
fallback when they omit model or effort.

Record the observed role, model, effort, live sandbox, start/stop status, and
any fallback or override. The required sequence is Sol/High parent -> Luna/Max
child -> Sol/High parent. Stop only if the role is undiscoverable, the verifier
reports a role/model/effort issue, or the telemetry is missing or inconsistent.
Never fall back to a built-in agent.

## Uninstall

To remove only exact owned files while preserving foreign agents:

```text
node scripts/bootstrap-agents.mjs uninstall --scope user --json
```

Use the corresponding project flags for project scope. Inspect conflicts before
retrying; an unowned or tampered file is intentionally preserved.
