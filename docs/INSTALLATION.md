# Installation

## GitHub marketplace after tag publication

Confirm that GitHub shows the public `v1.0.2` tag before running the pinned
command:

```text
codex plugin marketplace add CarlesGdigital/sol-luna-loop --ref v1.0.2
```

Open `/plugins`, select `sol-luna-loop`, inspect the files, and install/enable
it. Then open `/hooks`, review the current definition, trust it explicitly, and
start a new Codex session. Plugin installation alone does not install the
custom agents or trust hooks.

The trusted lifecycle policy applies to every subagent while the plugin is
enabled. It quarantines non-`sll_luna_*` roles. Disable the plugin or its hooks
before using an unrelated workflow that requires built-in or third-party
subagents.

From the installed plugin root:

```text
node scripts/bootstrap-agents.mjs install --json
node scripts/bootstrap-agents.mjs check --scope user --json
node scripts/bootstrap-agents.mjs doctor --scope user --json
```

Use `--scope project --project-root <path>` for a project-scoped install. Use
`--dry-run --json` to preview without creating state. The installer writes only
the eight canonical roles and an owned manifest, preserving foreign files.

## Developer clone

```powershell
git clone https://github.com/CarlesGdigital/sol-luna-loop.git
cd sol-luna-loop
npm.cmd ci
npm.cmd test
node scripts/bootstrap-agents.mjs install --scope project --project-root (Get-Location) --json
```

## Restart and runtime gate

After plugin or agent installation, start a fresh Codex session. Verify the
parent is Sol/High, then run one minimal probe for each exact `sll_luna_*` role.
Record observed model, effort, sandbox, and fallback status. A file hash proves
template integrity; only a fresh runtime observation proves routing.

Current Codex runtimes reapply the parent turn's live sandbox override to
children. `danger-full-access` is therefore compatible with every definitive
role and must not block the loop; it is reported as an override of the TOML
default. Use separate matching `read-only` and `workspace-write` turns only when
explicitly testing their distinct least-privilege defaults.

When the child cannot see its own model or effort, do not accept its
`ROUTING_DENIED` as authoritative. Use the thread ID returned by the spawn:

```text
node scripts/verify-agent-runtime.mjs --thread-id <THREAD_ID> --expected-role <SLL_ROLE> --json
```

Continue when the report is `ok: true`, even if `sandboxOverride` is `true`.
