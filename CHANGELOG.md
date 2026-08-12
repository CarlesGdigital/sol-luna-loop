# Changelog

## 1.0.2 - 2026-08-12

- Added a cross-platform rollout verifier for exact child role, Luna model, and
  Max effort evidence when public collaboration metadata omits those fields.
- Accepted `danger-full-access` and other deliberate parent sandbox overrides
  as compatible runtime evidence instead of blocking the loop.
- Limited matching read-only/workspace-write turns to optional least-privilege
  enforcement tests and stopped repeating the manual hook-trust gate after an
  observed trusted hook execution.

## 1.0.1 - 2026-08-11

- Fixed Windows hook command expansion by using Codex's `${PLUGIN_ROOT}`
  substitution.
- Made hook entrypoint detection safe for paths containing spaces and macOS
  `/var` to `/private/var` canonicalization.
- Accepted Codex's `bypassPermissions` hook value for approval policy `never`;
  sandbox enforcement remains the parent runtime's responsibility.

## 1.0.0 - 2026-08-11

- Added the public Codex plugin manifest and Git-backed repo marketplace.
- Added explicit Sol/High orchestration and eight Luna/Max custom-agent
  onboarding instructions.
- Added fail-closed `PreToolUse` routing policy and observational lifecycle
  hooks with explicit user trust/review requirements.
- Added the iterative loop state machine, failure-fingerprint strategy, and
  deterministic packaging/hook/state tests.
- Added installer, clean-room, security, testing, release, upgrade, and
  uninstall documentation.
- Added cross-platform GitHub Actions validation for Node.js 20 on Linux,
  Windows, and macOS.

Known limitations are documented in `docs/LIMITATIONS.md`; in particular,
hooks are guardrails rather than an OS isolation boundary and runtime model
routing requires a fresh Codex session.
