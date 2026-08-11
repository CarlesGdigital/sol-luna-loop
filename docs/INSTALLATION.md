# Installation

## GitHub marketplace after tag publication

Confirm that GitHub shows the public `v1.0.1` tag before running the pinned
command:

```text
codex plugin marketplace add CarlesGdigital/sol-luna-loop --ref v1.0.1
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

Run the four read-only roles from a parent turn whose live sandbox is
`read-only`, then run the four writing roles from a parent turn whose live
sandbox is `workspace-write`. Current Codex runtimes reapply the parent turn's
live sandbox override to children, so mixing both groups in one verification
turn cannot prove their distinct defaults.
