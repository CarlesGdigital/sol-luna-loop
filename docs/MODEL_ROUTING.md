# Model routing

The routing contract is deliberately asymmetric:

| Session | Required model | Required effort |
| --- | --- | --- |
| Parent | `gpt-5.6-sol` | `high` |
| Every definitive child | `gpt-5.6-luna` | `max` |

The parent must remain Sol/High before and after each child. The eight child
types are `sll_luna_probe`, `sll_luna_explorer`, `sll_luna_implementer`,
`sll_luna_fixer`, `sll_luna_test_engineer`, `sll_luna_reviewer`,
`sll_luna_security_auditor`, and `sll_luna_docs_writer`.

Codex reapplies the parent turn's live sandbox and approval overrides to every
child. The TOML `sandbox_mode` is a default; it cannot override an explicit live
parent setting. Verify the roles in two matching parent turns:

| Parent live sandbox | Roles to verify |
| --- | --- |
| `read-only` | probe, explorer, reviewer, security auditor |
| `workspace-write` | implementer, fixer, test engineer, docs writer |

Do not mix the groups when sandbox behavior is an acceptance gate.

`hooks/hooks.json` registers `PreToolUse` for the `Agent`/`spawn_agent` tool.
`hooks/pre_tool_use.mjs` denies unknown types and incompatible model or effort
overrides before the call when that tool path participates in hooks. Codex
allows specialized tool paths to opt out of the standard hook path; current
collaboration v2 is observed doing so. `SubagentStart` cannot prevent startup,
so the lifecycle hook quarantines a prohibited role or a canonical role whose
reported model is not `gpt-5.6-luna`, with a no-tools/no-edits instruction and
warning to the parent. The event does not expose reasoning effort, so `max`
still requires template validation and runtime telemetry. This is defense in
depth, not a complete enforcement boundary; the Sol/High parent must keep the
exact allow-list.

The lifecycle matcher covers every subagent type while the plugin is enabled.
It also quarantines canonical roles that report a model other than
`gpt-5.6-luna`, or an unknown permission mode. Codex maps approval policy
`never` to the known `bypassPermissions` event value, so the hook accepts it and
leaves sandbox enforcement to the parent runtime. The global
matcher is intentional exact-loop policy and can conflict with unrelated agent
plugins; disable this plugin/hook policy for those workflows.

Do not report `routing OK` from TOML files, hashes, or the marketplace entry.
Runtime acceptance requires a fresh Codex session and a table containing each
agent type, observed model, configured/observed effort, permission/sandbox,
start/stop status, and fallback/override result. Missing discovery is a restart
or external blocker, never a reason to substitute a built-in agent.
