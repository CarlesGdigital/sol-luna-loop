# Troubleshooting

## `PATH_UNSAFE`

An existing component of `.codex/agents` is a symlink, junction, or non-directory.
Stop and repair the path manually after checking its target. The installer does
not follow it.

## `LOCK_ACTIVE` or `LOCK_LOST`

Do not delete a lock blindly. Inspect `doctor --json`. A live cooperative
operation owns `LOCK_ACTIVE`; a missing, malformed, or replaced lock returns
`LOCK_LOST` and preserves the path.

## `MANIFEST_STALE`

Run `install` to upgrade an older valid manifest. Ownership is retained only for
the exact recorded files; changed files remain conflicts.

## Agents are not visible

Run `check` and `doctor`, then start a fresh Codex session. Inspect the native
`agent_type` list. Do not substitute a built-in agent or change the model pins.

## Hooks are skipped

Open `/hooks`, review the current plugin hook definition, and trust it. A
changed hook hash requires a new review. `PreToolUse` blocks on supported tool
paths. Some specialized spawn paths may opt out; `SubagentStart` then adds a
quarantine instruction and warning for prohibited roles. Treat that as a
guardrail and inspect runtime evidence rather than assuming no child started.

## Marketplace is missing

Refresh the pinned source:

```text
codex plugin marketplace add CarlesGdigital/sol-luna-loop --ref v1.0.1
codex plugin marketplace list
```
