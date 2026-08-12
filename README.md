# sol-luna-loop

Codex-native Sol/High orchestration with eight bounded Luna/Max specialist
agents. The loop makes planning, implementation, review, testing, security,
documentation, and final verification explicit, while preserving a fail-closed
installer for user- and project-scoped custom agents.

> Pinned release target: `v1.0.2`. The immutable marketplace command below is
> supported once GitHub shows that public tag. Runtime routing must still be
> verified after installation because static templates and hashes cannot prove
> a live model.

## Requirements

- A current Codex build with multi-agent tools enabled.
- Node.js 20 or newer for the installer and local validation.
- Git for developer installs and Git-backed marketplaces.
- A GitHub account only when installing from the public Git marketplace.

The plugin does not call a model API and does not edit global `config.toml`.

## Recommended install: GitHub marketplace after tag publication

Add the pinned public marketplace source:

```text
codex plugin marketplace add CarlesGdigital/sol-luna-loop --ref v1.0.2
```

Open the Codex plugin browser with `/plugins` (or `codex /plugins`), select the
`sol-luna-loop` marketplace, inspect the plugin, and install/enable it. Then:

1. Open `/hooks`, review the bundled hook definition, and trust it explicitly.
2. Start a new Codex session so the plugin and custom-agent discovery refresh.
3. Locate the installed plugin root and run:

   ```text
   node scripts/bootstrap-agents.mjs install --json
   node scripts/bootstrap-agents.mjs check --scope user --json
   node scripts/bootstrap-agents.mjs doctor --scope user --json
   ```

4. Run the runtime routing probe described in [Model routing](docs/MODEL_ROUTING.md).

Installing the plugin does not silently trust hooks or copy custom agents. The
setup command is explicit, idempotent, hash-checked, and preserves foreign
files. A new Codex session is required after plugin or agent changes.

Codex reapplies a parent turn's live sandbox override to its children. A
deliberately selected `danger-full-access` parent may run all eight roles in one
task; the live override is recorded and does not invalidate Luna/Max routing.
Matching `read-only` and `workspace-write` turns are needed only when separately
testing OS-enforced least privilege. The hook denies prohibited roles on
supported `PreToolUse` paths and quarantines a prohibited role at
`SubagentStart` when a specialized spawn path bypasses `PreToolUse`; hooks remain
guardrails, so the parent must also enforce the exact allow-list.

The lifecycle matcher is intentionally global while the plugin is enabled: any
non-definitive built-in or third-party child receives quarantine context. Disable
this plugin or its hooks before starting a workflow that legitimately requires
other child roles.

## Developer install

```powershell
git clone https://github.com/CarlesGdigital/sol-luna-loop.git
cd sol-luna-loop
npm.cmd ci
npm.cmd test
node scripts/bootstrap-agents.mjs install --scope project --project-root (Get-Location) --json
node scripts/bootstrap-agents.mjs check --scope project --project-root (Get-Location) --json
node scripts/bootstrap-agents.mjs doctor --scope project --project-root (Get-Location) --json
```

For a user-scoped install, omit the project flags. Use
`node scripts/bootstrap-agents.mjs install --dry-run --json` to preview changes.

## Upgrade

Refresh the Git marketplace and reinstall the plugin from the new pinned ref:

```text
codex plugin marketplace upgrade sol-luna-loop
```

Run the installer again. It upgrades only manifest-owned files, verifies SHA-256
hashes, creates verified backups for managed updates, and reports tampering or
foreign conflicts. Start a new Codex session after the upgrade and repeat
`check`, `doctor`, and runtime routing verification.

## Uninstall

Remove the plugin from the Codex plugin browser, or remove its marketplace:

```text
codex plugin marketplace remove sol-luna-loop
```

Remove managed agents only through the installer:

```text
node scripts/bootstrap-agents.mjs uninstall --scope user --json
```

Exact owned files may be removed; foreign files, local edits, symlinks, junctions,
and unowned canonical names are preserved and reported as conflicts.

## Quick verification

```text
npm.cmd test
node scripts/bootstrap-agents.mjs check --scope user --json
node scripts/bootstrap-agents.mjs doctor --scope user --json
```

These commands prove package/installer health. They do not by themselves prove
runtime routing. Routing is `OK` only after fresh Codex sessions observe all
eight exact `sll_luna_*` agent types running as `gpt-5.6-luna` with `max`
effort. Verify an exact child rollout with
`node scripts/verify-agent-runtime.mjs --thread-id <THREAD_ID> --expected-role <SLL_ROLE> --json`;
`sandboxOverride: true` is informational rather than a routing failure. See
[Model routing](docs/MODEL_ROUTING.md).

## Documentation

- [Installation](docs/INSTALLATION.md)
- [Usage](docs/USAGE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Model routing](docs/MODEL_ROUTING.md)
- [State machine](docs/STATE_MACHINE.md)
- [Testing](docs/TESTING.md)
- [Security](docs/SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Limitations](docs/LIMITATIONS.md)
- [Release validation](docs/RELEASE_VALIDATION.md)

This repository is a Git-backed marketplace distribution. It is not submitted
to the universal public plugin directory by this release.
