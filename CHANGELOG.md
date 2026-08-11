# Changelog

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
