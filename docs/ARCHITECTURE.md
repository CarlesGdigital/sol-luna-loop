# Architecture

`sol-luna-loop` has four intentionally separate layers:

1. **Plugin package** — `.codex-plugin/plugin.json`, `skills/`, and default
   `hooks/hooks.json` make the repository a Codex plugin without duplicating the
   source tree.
2. **Agent onboarding** — `skills/sol-luna-loop-setup/SKILL.md` teaches a user
   how to run the dependency-free installer. Agent TOML files are copied to
   Codex user or project scope only by that explicit installer.
3. **Installer** — `scripts/bootstrap-agents.mjs` and `scripts/lib/` implement
   template validation, scope resolution, manifest ownership, SHA-256 checks,
   backups, atomic per-file publication, cooperative locks, diagnostics, and
   uninstall conflict handling.
4. **Loop policy** — `hooks/` denies prohibited children at `PreToolUse` on
   supported tool paths and quarantines prohibited roles at `SubagentStart`
   when a specialized spawn path opts out of `PreToolUse`.
   `scripts/lib/loop-state.mjs` records legal iterative phases and
   failure-fingerprint strategy changes. The parent remains responsible for
   allow-list discipline, integration, and acceptance.

The eight definitive roles are ordered in `agent-templates/`. The bootstrap
template remains an asset and is intentionally excluded from the managed
manifest. No production module calls a model API, edits `config.toml`, or
contains a network dependency.
