# Release validation ledger

This ledger records the final state of the GitHub publication attempt. It does
not promote static templates or local files to runtime evidence.

## Status

`BLOCKED_EXTERNAL`

The repository is public and `main` is green, but `v1.0.0` has not been tagged
or released because the current Codex host does not enforce the role sandbox
contract and its `codex.exe` cannot execute the marketplace CLI (`Access
denied`). The real Codex marketplace install, hook-trust flow, and model-backed
fixture loop therefore remain unverified. No release tag or release asset was
created under this gate.

## GitHub and deterministic publication

- Owner/repository: `CarlesGdigital/sol-luna-loop` (public).
- Default branch: `main`.
- Verified source commit: `413e02df2b250ea2c583e0d020412e5fb642bc51`.
- GitHub CI run `31463052840` (`main`) passed on Ubuntu, macOS, and Windows.
- No `v1.0.0` tag or GitHub Release exists; no `SHA256SUMS` is published.
- Official Python plugin validator: passed.
- Local Node validator: passed.
- `npm ci`, `npm audit --omit=dev --audit-level=high`, syntax checks, and
  `git show --check --oneline HEAD`: passed.
- Full suite: 51/51 passed, with zero failures, skips, or todos.
- `npm pack --dry-run`: passed; 52 files, with no `.git`, `node_modules`,
  credentials, or local user data.

## Clean-room distribution evidence

- Fresh clone source: `https://github.com/CarlesGdigital/sol-luna-loop`.
- Final clone commit: `03e5779542baa7d8ca2351a54323cd8076806ddc`.
- From that clone: `npm ci`, `npm test` (51/51), and plugin validation passed.
- The implementation clean-room at `8e73b19f33f727cf3d208927babf6aa364706662`
  also passed package dry-run and the disposable project lifecycle below; the
  later commit only records the blocked release ledger and documentation.
- A disposable project-scoped fixture from that clone completed install,
  `check`, `doctor`, and `uninstall`; all eight role hashes were exact and the
  managed manifest reported plugin version `1.0.0`.
- A separate packed/extracted clean-room with a path containing spaces passed
  tests, validators, real hook stdin checks, and user-scope lifecycle. The npm
  tarball intentionally omits `package-lock.json`; source CI remains the
  lockfile gate, while the extracted artifact is tested without `npm ci`.

## Real user-scope evidence

After explicit install from the verified working tree:

- `node scripts/bootstrap-agents.mjs install --scope user --json`: passed;
- `check --scope user --json`: `ok:true`, manifest `1.0.0`, eight exact owned
  roles, zero issues;
- `doctor --scope user --json`: `ok:true`, inactive lock, zero issues;
- independent SHA-256 validation: all eight manifest hashes matched;
- foreign entries preserved: `sll_bootstrap_luna_max.toml` and the three
  `sol-advisor-*.toml` files remain untouched.

## Runtime routing evidence

Fresh child session metadata files recorded every native role with model
`gpt-5.6-luna` and effort `max`. The same host metadata reports
`sandbox_policy.type=danger-full-access` and `permission_profile.type=disabled`
for all children, so the expected read-only/workspace-write sandbox contract is
not observed and the rows are not accepted as a full routing pass.

| Agent | Model observed | Effort observed | Sandbox observed | Result |
| --- | --- | --- | --- | --- |
| `sll_luna_probe` | `gpt-5.6-luna` | `max` | host `danger-full-access` | blocked |
| `sll_luna_explorer` | `gpt-5.6-luna` | `max` | host `danger-full-access` | blocked |
| `sll_luna_implementer` | `gpt-5.6-luna` | `max` | host `danger-full-access` | blocked |
| `sll_luna_fixer` | `gpt-5.6-luna` | `max` | host `danger-full-access` | blocked |
| `sll_luna_test_engineer` | `gpt-5.6-luna` | `max` | host `danger-full-access` | blocked |
| `sll_luna_reviewer` | `gpt-5.6-luna` | `max` | host `danger-full-access` | blocked |
| `sll_luna_security_auditor` | `gpt-5.6-luna` | `max` | host `danger-full-access` | blocked |
| `sll_luna_docs_writer` | `gpt-5.6-luna` | `max` | host `danger-full-access` | blocked |

The parent session metadata observed `gpt-5.6-sol` with `high` effort. The
parent→child→parent model-change sequence was not accepted as a release gate
because the plugin could not be installed and exercised by the real Codex
marketplace CLI in this host.

## Negative routing and hooks

Static and subprocess hook tests passed for Terra, Sol, worker, default,
explorer, unknown agents, incompatible model, incompatible effort, canonical
allow, malformed JSON, `SubagentStart`, `SubagentStop`, and `Stop`. These prove
the hook policy and handler output, not the host's trusted-hook boundary.

## Loop and security gates

- State machine tests cover valid/illegal transitions, repeated failure
  fingerprints, strategy changes, and terminal protection.
- Installer tests cover user/project scopes, ownership, hashes, backups,
  rollback, tampering, conflicts, symlink/junction refusal, unsafe paths, lock
  loss, partial lock cleanup, check, doctor, and uninstall.
- Security review found no production network/subprocess/eval/dependency/secret
  path; the documented residual limitation is equal-privilege filesystem TOCTOU.
- A model-backed fixture loop with real replan/fix/security/documentation and
  final acceptance was not run because the marketplace/runtime gate is blocked.

## Resume gate

After a fresh Codex runtime is available, run the exact public command from the
README, review/trust `/hooks`, repeat the eight minimal probes, execute the
seeded fixture loop, then create the annotated `v1.0.0` tag, `SHA256SUMS`, and
GitHub Release. Until then the only valid terminal status is
`BLOCKED_EXTERNAL`.
