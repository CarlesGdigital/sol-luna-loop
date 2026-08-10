# Definitive role profiles

All eight definitive templates pin `model = "gpt-5.6-luna"` and
`model_reasoning_effort = "max"`. Read-only roles use `sandbox_mode =
"read-only"`; bounded writing roles use `sandbox_mode = "workspace-write"`.

| Role | Sandbox | Contract |
| --- | --- | --- |
| `sll_luna_probe` | read-only | Minimal routing checks only; report observable evidence and blockers. |
| `sll_luna_explorer` | read-only | Trace architecture, interfaces, and runtime evidence without edits. |
| `sll_luna_implementer` | workspace-write | Make only explicitly owned bounded changes, with RED→GREEN tests and runtime evidence. |
| `sll_luna_fixer` | workspace-write | Reproduce the failure, identify root cause, and test each new hypothesis before fixing. |
| `sll_luna_test_engineer` | workspace-write | Add honest regressions, complete fixtures, and meaningful edge cases; avoid fake assertions. |
| `sll_luna_reviewer` | read-only | Perform adversarial scope, correctness, safety, test, and evidence review. |
| `sll_luna_security_auditor` | read-only | Audit path traversal, symlink/non-file confusion, TOCTOU/races, injection, secrets, privilege, and ownership. |
| `sll_luna_docs_writer` | workspace-write | Documentation-only changes within explicit ownership; never implement code or configuration. |

The repository-relative template origin recorded in the manifest is
`agent-templates/<role>.toml`. The existing
`sll_bootstrap_luna_max.toml` is intentionally outside this definitive managed
set and is preserved as the accepted bootstrap agent.
