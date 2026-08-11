# Release validation

This file is the evidence ledger for the `v1.0.0` release. It distinguishes
deterministic repository evidence from local Codex runtime evidence.

## Baseline and deterministic evidence

- Release branch: `feat/sol-luna-loop` before publication.
- Pre-release implementation base: `ac651292336861e2fb1fe1448fea2838e12338e5`.
- Existing installer suite: 33/33 pass before release packaging.
- User-scope `check` and `doctor`: eight exact owned roles, matching SHA-256,
  inactive lock, zero issues.
- GitHub identity: `CarlesGdigital`, HTTPS protocol, `repo`/`workflow` scopes.

The final release section below must be updated with fresh commit, tag, CI,
clean-room, asset, routing, negative-policy, and E2E evidence before claiming
`RELEASED_VERIFIED`.

## Required final gates

1. Plugin validator, package dry-run, full tests, syntax, diff check, secret and
   dependency scans.
2. Three-OS GitHub Actions green.
3. Clean clone from the published tag, marketplace add, plugin install, hook
   trust review, agent setup, check, and doctor.
4. Fresh-session parent Sol/High plus 8/8 Luna/Max runtime probes.
5. Negative routing for Terra, Sol child, worker, default, explorer, unknown,
   incompatible model, and incompatible effort; no prohibited child starts.
6. Real fixture loop with a seeded failure, replan, fix, security review,
   documentation, and final verification.
7. Final security review, release assets, SHA256SUMS, clean status, and exact
   README post-release install smoke.

## Runtime evidence table

| Agent | Expected | Observed | Effort | Status |
| --- | --- | --- | --- | --- |
| `sll_luna_probe` | Luna | pending fresh-session evidence | max | pending |
| `sll_luna_explorer` | Luna | pending fresh-session evidence | max | pending |
| `sll_luna_implementer` | Luna | pending fresh-session evidence | max | pending |
| `sll_luna_fixer` | Luna | pending fresh-session evidence | max | pending |
| `sll_luna_test_engineer` | Luna | pending fresh-session evidence | max | pending |
| `sll_luna_reviewer` | Luna | pending fresh-session evidence | max | pending |
| `sll_luna_security_auditor` | Luna | pending fresh-session evidence | max | pending |
| `sll_luna_docs_writer` | Luna | pending fresh-session evidence | max | pending |

Do not replace `pending` with `OK` from static files alone.
