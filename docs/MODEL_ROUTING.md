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

`hooks/hooks.json` registers `PreToolUse` for the `Agent`/`spawn_agent` tool.
`hooks/pre_tool_use.mjs` denies unknown types and incompatible model or effort
overrides before the call. `SubagentStart` is observational and cannot prevent
startup; this is why the blocking policy lives at `PreToolUse`.

Do not report `routing OK` from TOML files, hashes, or the marketplace entry.
Runtime acceptance requires a fresh Codex session and a table containing each
agent type, observed model, configured/observed effort, permission/sandbox,
start/stop status, and fallback/override result. Missing discovery is a restart
or external blocker, never a reason to substitute a built-in agent.
