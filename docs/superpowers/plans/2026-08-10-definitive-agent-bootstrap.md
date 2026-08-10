# Definitive Luna Agent Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use test-driven development and execute this plan in order. The primary Sol/High session owns architecture, diff inspection, installation into the real Codex home, and the restart gate.

**Goal:** Replace the one-agent bootstrap utility with a safe, cross-platform installer for the eight definitive `sol-luna-loop` Luna/Max roles, without overwriting or removing foreign agents.

**Architecture:** Keep the implementation dependency-free on Node.js 20+. Static TOML templates are the canonical role definitions. A single CLI resolves user or project scope, validates templates, serializes mutations with an exclusive lock, publishes files atomically, and records ownership and hashes in a JSON lock manifest. `check` is exactness verification; `doctor` adds environmental and ownership diagnostics; `uninstall` removes only files still matching the manifest.

**Tech Stack:** Node.js 20+ ESM, `node:test`, filesystem primitives from `node:fs/promises`, TOML validation limited to the required top-level scalar schema, SHA-256 from `node:crypto`.

## Global Constraints

- Work only on branch `feat/sol-luna-loop` and preserve commit `bcd3c738af307f64cadec3576b06d18dd1c2d84c`.
- Do not push, open a PR, merge, deploy, or edit global `config.toml`.
- Every definitive template must contain literal `model = "gpt-5.6-luna"` and `model_reasoning_effort = "max"`; no definitive template may use Sol or Terra.
- Definitive names are exactly `sll_luna_probe`, `sll_luna_explorer`, `sll_luna_implementer`, `sll_luna_fixer`, `sll_luna_test_engineer`, `sll_luna_reviewer`, `sll_luna_security_auditor`, and `sll_luna_docs_writer`.
- Read-only roles are probe, explorer, reviewer, and security auditor. Implementer, fixer, test engineer, and docs writer use workspace-write plus restrictive developer instructions.
- Supported actions are `install`, `check`, `doctor`, and `uninstall`; supported flags are `--scope user|project`, `--user-home <path>`, `--project-root <path>`, `--dry-run`, and `--json`.
- Default scope is `user`. User scope resolves to `<user-home>/.codex/agents`; project scope resolves to `<project-root>/.codex/agents`.
- The managed lock manifest is `<agents-dir>/sol-luna-loop.lock.json`, schema version `1`, and records plugin version, scope, generated timestamp, and for every agent: name, plugin version, expected model, expected reasoning, expected sandbox, SHA-256, and repository-relative template origin.
- Never overwrite or delete an agent that is absent from the manifest or whose current bytes differ from the hash owned by the manifest.
- Managed updates must create a recoverable backup before replacement. All writes use same-directory temporary files, flush before publication, and cleanup temporary artifacts.
- Mutating actions must use an exclusive cross-platform filesystem lock. A live lock fails closed with a structured error; it is never silently bypassed.
- `--dry-run` performs no directory, file, backup, manifest, or lock mutation.
- JSON mode emits exactly one JSON object on stdout and no template bodies or secrets.
- All behavior changes follow RED → confirm expected failure → GREEN → full relevant suite.
- Tests must pass before the primary session installs the agents into the real Codex location.

---

### Task 1: Canonical definitive role templates and schema validation

**Files:**

- Create: `agent-templates/sll_luna_probe.toml`
- Create: `agent-templates/sll_luna_explorer.toml`
- Create: `agent-templates/sll_luna_implementer.toml`
- Create: `agent-templates/sll_luna_fixer.toml`
- Create: `agent-templates/sll_luna_test_engineer.toml`
- Create: `agent-templates/sll_luna_reviewer.toml`
- Create: `agent-templates/sll_luna_security_auditor.toml`
- Create: `agent-templates/sll_luna_docs_writer.toml`
- Create: `tests/agent-templates.test.mjs`
- Modify: `scripts/bootstrap-agents.mjs`

**Interfaces:**

- Export `DEFINITIVE_AGENTS`, an immutable ordered array of the eight exact names.
- Export `EXPECTED_AGENT_SCHEMA`, keyed by agent name with `model`, `reasoning`, and `sandbox`.
- Export `validateTemplate(name, bytes)`, returning normalized metadata or throwing a precise validation error for invalid UTF-8/schema, missing or duplicate keys, wrong role name, wrong model/effort/sandbox, or forbidden Sol/Terra pins.

- [ ] Write template tests first. They must enumerate exactly eight definitive templates, require valid TOML string assignments for `name`, `model`, `model_reasoning_effort`, `sandbox_mode`, `description`, and `developer_instructions`, and assert the exact role-specific sandbox and contract language.
- [ ] Run `node --test tests/agent-templates.test.mjs`; confirm failure because definitive templates/exports do not exist.
- [ ] Add the eight templates with minimal, role-specific responsibility contracts from the approved mission. The probe must promise minimal read-only routing checks; explorer architecture/evidence; implementer bounded owned writes and tests; fixer reproduction/root cause/new-hypothesis behavior; test engineer honest regressions/fixtures/edge cases; reviewer adversarial read-only review; security auditor the enumerated threat classes and read-only default; docs writer documentation-only ownership.
- [ ] Implement the dependency-free schema validator and ordered template discovery; reject extra template names from the definitive set while continuing to preserve the existing bootstrap template outside the definitive managed set.
- [ ] Re-run the targeted test and then `node --test`; require zero failures.

### Task 2: Multi-scope installer, lock manifest, backups, conflicts, and uninstall

**Files:**

- Modify: `scripts/bootstrap-agents.mjs`
- Replace/expand: `tests/bootstrap-agents.test.mjs`
- Create: `scripts/lib/agent-installer.mjs` for scope resolution, template inspection, install/check/doctor/uninstall orchestration, atomic publication, backup, and rollback.
- Create: `scripts/lib/manifest.mjs` for manifest schema validation, canonical serialization, ownership checks, and SHA-256 metadata.
- Create: `scripts/lib/fs-lock.mjs` for exclusive lock acquisition, lock-state inspection, and guaranteed release.

**Interfaces:**

- CLI: `node scripts/bootstrap-agents.mjs <install|check|doctor|uninstall> [--scope user|project] [--user-home <path>] [--project-root <path>] [--dry-run] [--json]`.
- `install` returns per-agent status plus manifest status; exact reinstall is idempotent.
- `check` returns exactness, hashes, pins, and manifest ownership without mutation.
- `doctor` returns platform, Node version gate, resolved scope/paths, lock state, manifest validity, conflicts, missing/stale files, and an overall status without mutation.
- `uninstall` removes only manifest-owned exact files, removes the manifest only when no owned entries remain, and preserves foreign or locally modified files with a nonzero conflict result.

- [ ] Add failing tests for user/project resolution, dry-run purity, eight-file install, exact idempotence, JSON single-object output, manifest schema/fields, SHA-256 values, foreign-file conflict preservation, managed update backup, tampered-managed-file conflict, partial install recovery, concurrent lock refusal, stale/malformed manifest refusal, uninstall exact ownership, uninstall conflict preservation, symlink/non-file refusal, and Windows-safe path handling.
- [ ] Run the focused test file and confirm each new behavior fails for the intended missing capability.
- [ ] Refactor the current single-template implementation into the three exact modules listed above; keep CLI parsing/output in `scripts/bootstrap-agents.mjs`. Preserve the bootstrap test semantics while changing the managed production set to the eight definitive roles.
- [ ] Implement scope resolution and strict argument validation. Reject contradictory flags, `--user-home` in project scope, `--project-root` in user scope, empty paths, and unknown arguments.
- [ ] Implement same-directory exclusive lock acquisition with create-exclusive semantics and guaranteed cleanup. Read-only actions report lock state but do not acquire or remove it.
- [ ] Implement canonical JSON manifest serialization and validation. Never trust a manifest path/name outside the eight known templates.
- [ ] Implement atomic publication: write unique same-directory temporary files with mode `0600`, flush, publish without exposing partial content, and cleanup. Before replacing an exact manifest-owned prior version, create a timestamped backup under `<agents-dir>/.sol-luna-loop-backups/<timestamp>/` and verify its hash.
- [ ] Implement conflict rules and rollback so an error cannot convert a pre-existing managed/foreign file into loss. Installation failure must leave either the original complete file or the new complete file, never partial bytes.
- [ ] Implement ownership-safe uninstall and backup preservation.
- [ ] Re-run the focused suite after every GREEN step; finish with `node --test` and zero failures.

### Task 3: Doctor semantics, documentation, package metadata, and pre-install verification

**Files:**

- Modify: `package.json`
- Modify: `BOOTSTRAP.md`
- Create: `docs/AGENT_PROFILES.md`
- Create: `docs/INSTALLER.md`
- Create: `tests/doctor.test.mjs`

**Interfaces:**

- Package version becomes `0.1.0`; `npm test` runs all `tests/*.test.mjs` via `node --test`.
- Doctor JSON uses stable top-level keys `action`, `ok`, `scope`, `platform`, `node`, `paths`, `lock`, `manifest`, `agents`, and `issues`.

- [ ] Write doctor tests first for a healthy install, missing install, malformed manifest, foreign conflicts, active lock, project scope, Node version reporting, and deterministic issue codes.
- [ ] Run `node --test tests/doctor.test.mjs` and confirm expected failures.
- [ ] Implement only the doctor behavior required by those tests; keep it read-only.
- [ ] Document exact install/check/doctor/uninstall/dry-run/json commands for user and project scope, lock/backup locations, ownership guarantees, update/recovery behavior, all eight role contracts, platform support, and the fact that runtime discovery may require a fresh Codex task.
- [ ] Run `npm test`, `node scripts/bootstrap-agents.mjs install --dry-run --json`, a temporary-home install/check/doctor/uninstall cycle, and `git diff --check`.
- [ ] Inspect the final diff for forbidden model pins, placeholders, skipped tests, config.toml edits, and out-of-scope changes.
- [ ] Commit the verified implementation locally with a coherent message. Do not install into the real user/project scope; the primary Sol/High session performs that gated step after independent verification.

## Primary-session acceptance and restart gate

After Luna returns, the primary session must inspect the complete diff and rerun `npm test`, `git diff --check`, template/pin scans, temporary user/project lifecycle tests, and package validation. Only then may it run the real user-scope install followed by real `check`, `doctor`, and independent SHA-256 validation. It must inspect the native `agent_type` list without substituting any built-in or Sol Advisor role. If any definitive role is missing, commit all verified bootstrap work locally and return exactly `BLOCKED_RUNTIME_RESTART_REQUIRED` with commit SHA, installed roles/hashes, tests, resume command, and confirmation of no push/PR/merge/deploy.
