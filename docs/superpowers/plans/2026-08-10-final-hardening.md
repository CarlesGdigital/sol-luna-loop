# Final Installer Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven development and the definitive `sll_luna_*` role contracts. The primary Sol/High session owns architecture, routing evidence, diff inspection, review integration, and final acceptance.

**Goal:** Correct the discovered uninstall, diagnostic path-safety, and lock-lifecycle defects, then make the documented security boundary match what a dependency-free Node.js 20 implementation can actually guarantee.

**Architecture:** Keep the existing dependency-free ESM design and public CLI. Add behavior-first regressions around the current public functions and CLI, make path validation consistent before every initial inspection, make no-manifest uninstall surface foreign conflicts, and make lock setup/release failures recoverable where the owning process still controls the path. Preserve fail-closed behavior. Do not claim atomic protection against a hostile same-privilege process that can replace filesystem entries between syscalls; document that boundary and forbid elevated execution over untrusted writable trees.

**Tech Stack:** Node.js 20+ ESM, `node:test`, `node:fs/promises`, Windows junction fixtures where supported, SHA-256 and UUIDs from Node built-ins.

## Global Constraints

- Work only on `feat/sol-luna-loop`; preserve all existing commits and unrelated files.
- Do not push, open a PR, merge, deploy, reinstall real user agents, or edit global `config.toml`.
- Do not add dependencies, native addons, shell subprocesses, skipped tests, placeholders, or test-only production behavior reachable from the CLI.
- All eight definitive templates remain byte-exact and pinned to `gpt-5.6-luna` plus `max`.
- Tests must exercise real filesystem behavior; a fault-injection seam is allowed only for otherwise unreachable lock I/O failures and must remain narrow and non-CLI.
- Each behavior change follows RED, observed expected failure, minimal GREEN, focused verification, and full-suite verification.
- Existing foreign agents and manifest ownership rules remain unchanged.
- Security claims cover pre-existing unsafe components, cooperative installer concurrency, and changes detected at revalidation points. They do not promise race-free operation against a hostile process with equivalent filesystem rights.
- The CLI must warn in documentation against elevated execution on a user/project tree writable by less-privileged or untrusted actors.

---

### Task 1: Add honest failing regressions

**Files:**

- Modify: `tests/bootstrap-agents.test.mjs`
- Create: `tests/fs-lock.test.mjs`

**Interfaces:**

- Existing `runCli()` JSON contract remains the observable boundary for uninstall, check, and doctor.
- Existing `acquireExclusiveLock(lockPath)` remains the production lock API.
- A narrow exported test helper may inject only `open`, `lstat`, `readFile`, or `unlink` operations into the same lock algorithm; production callers must continue using the default real filesystem functions.

- [ ] Add a no-manifest uninstall fixture containing `sll_luna_probe.toml` with foreign bytes. Assert both ordinary and `--dry-run` CLI calls exit `1`, return `ok:false`, preserve the file byte-for-byte, and report one `unowned-file` conflict.
- [ ] Run the focused test and observe RED because current uninstall returns `ok:true` with no conflicts.
- [ ] Add `check` and `doctor` fixtures whose `.codex/agents` is a Windows junction (or POSIX directory symlink). Assert exit `2`, structured `PATH_UNSAFE`, and unchanged target sentinel/manifest/roles. Exit `2` is the established CLI contract for a thrown structural/safety error; exit `1` remains reserved for a valid action result whose `ok` field is false.
- [ ] Add a non-directory ancestor fixture and assert the same fail-closed result for both commands.
- [ ] Run the focused tests and observe RED because current read-only actions follow the unsafe parent.
- [ ] Add a real-filesystem retry regression: replace a held lock token, observe `LOCK_LOST`, restore the original metadata, call `release()` again, and assert the owned lock is removed. This test must fail while `released` is set before successful unlink.
- [ ] Add a fault-injected partial-acquire regression: force `sync()` to fail after real exclusive creation, then assert the lock path is cleaned up and a normal second acquire succeeds. The fake handle must delegate every other operation to the real handle.
- [ ] Run `node --test tests/bootstrap-agents.test.mjs tests/fs-lock.test.mjs`; require failure only at the intended missing behaviors, with no syntax/setup errors.

### Task 2: Implement the minimal fail-closed fixes

**Files:**

- Modify: `scripts/lib/agent-installer.mjs`
- Modify: `scripts/lib/fs-lock.mjs`

**Interfaces:**

- `check()` and `doctor()` validate all existing components of `paths.agentsDir` before `inspectState()` or `inspectLock()`.
- `uninstall()` with no manifest returns conflicts already identified by `inspectState()`; no lock or mutation is needed when nothing is owned.
- `release()` becomes idempotent only after successful deletion of the same-token lock; a failed ownership check remains retryable.
- Failed lock initialization closes its handle and removes only the path created by that attempt where the same attempt still owns it; cleanup failure is preserved as structured evidence and never reported as success.

- [ ] Change `check()` and `doctor()` to call the existing non-creating safe-component validator before reading state. Missing directories remain a normal missing-install diagnostic; symlink/junction/non-directory components throw `PATH_UNSAFE`.
- [ ] Change both no-manifest branches of uninstall planning so `unowned-file` and `foreign-type` entries are returned as conflicts with `ok:false`, `changed:false`, and the established conflict error text. An empty agents directory with no manifest remains idempotent `ok:true`.
- [ ] Refactor lock acquisition behind a single internal function with default real I/O and a narrow test-only injected-I/O wrapper. Track whether exclusive creation succeeded. On later setup failure, close the handle, validate cooperative ownership when possible, unlink the created lock, and rethrow the original setup failure with cleanup evidence if cleanup also fails.
- [ ] Move `released = true` to after successful same-token unlink. Preserve `LOCK_LOST` for missing, unsafe, malformed, or replaced locks; allow a later retry if the original owned metadata is restored.
- [ ] Run `node --test tests/bootstrap-agents.test.mjs tests/fs-lock.test.mjs`; require all focused tests green.
- [ ] Run `npm.cmd test`; require every test green with zero skipped, zero todo, and zero failures.
- [ ] Run `git diff --check`; require no whitespace errors.

### Task 3: Review and correct the bounded code change

**Files:**

- Review only: the Task 1 and Task 2 files and their complete diff from base `6c5ca95ea43e2c4a5425f94d3a9c7969bcba6891`.
- Fix ownership, only if review requires it: the same test and implementation files.

**Interfaces:**

- The reviewer must return PASS or findings covering spec compliance and code quality.
- Any correctness, regression, concurrency, unsafe-path, or dishonest-test finding returns to the same fixer context with a changed hypothesis and a focused re-review.

- [ ] Independently inspect the actual diff and reports; do not accept worker summaries as evidence.
- [ ] Confirm every new test was observed RED for the intended production defect.
- [ ] Review Windows/POSIX behavior, conflict shape, JSON exit behavior, lock ownership, cleanup error preservation, retry semantics, and absence of broad test seams.
- [ ] Delegate all required fixes to `sll_luna_fixer`, rerun focused tests, and obtain a clean scoped re-review.

### Task 4: Align documentation with the verified security boundary

**Files:**

- Modify: `BOOTSTRAP.md`
- Modify: `docs/INSTALLER.md`
- Modify if behavior descriptions changed: `docs/AGENT_PROFILES.md`

**Interfaces:**

- Documentation must describe the new no-manifest conflict, read-only unsafe-parent refusal, and recoverable lock lifecycle.
- Safety language must distinguish detected/pre-existing symlinks and cooperative installer serialization from hostile same-privilege TOCTOU.
- Documentation must state: do not run elevated against user/project trees writable by less-privileged or untrusted actors.

- [ ] Update behavior and recovery sections from the verified implementation and tests.
- [ ] Remove or qualify absolute race-free claims that the Node API cannot support.
- [ ] Keep commands, paths, schemas, pins, and ownership rules exact; add no speculative feature promises.
- [ ] Run documentation consistency scans and `git diff --check`.

### Task 5: Final review, security, and acceptance

**Files:**

- Review the complete branch range and final worktree; no new scope unless a gate finds a concrete blocker.

**Interfaces:**

- Required runtime roles are exactly the eight `sll_luna_*` names.
- Final state is `VERIFIED_READY` only when all repository, package, lifecycle, routing, documentation, review, and security gates pass.

- [ ] Run `npm.cmd test`, `git diff --check`, template/pin scans, package validation, and temporary user/project install/check/doctor/uninstall lifecycles.
- [ ] Run real user-scope `check` and `doctor` only; do not reinstall when both remain exact.
- [ ] Independently verify installed SHA-256 values and native routing evidence already established in this fresh task.
- [ ] Obtain a fresh adversarial `sll_luna_reviewer` verdict over the full accumulated diff and evidence.
- [ ] Obtain a fresh `sll_luna_security_auditor` verdict against the documented cooperative/equal-privilege boundary and elevated-tree prohibition.
- [ ] If either verdict requires fixes, re-enter the bounded fix/review/verify/document loop.
- [ ] Commit the verified accumulated change locally. Do not push, open a PR, merge, or deploy.
