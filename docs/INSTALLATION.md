# Installation

The GitHub repository is public at `main`, but `v1.0.0` is not published yet:
the release gate is blocked on a fresh Codex runtime sandbox check and the
real marketplace CLI. Use the developer clone below until that gate is cleared.

## GitHub marketplace (after v1.0.0 publication)

```text
codex plugin marketplace add CarlesGdigital/sol-luna-loop --ref v1.0.0
```

Open `/plugins`, select `sol-luna-loop`, inspect the files, and install/enable
it. Then open `/hooks`, review the current definition, trust it explicitly, and
start a new Codex session. Plugin installation alone does not install the
custom agents or trust hooks.

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
