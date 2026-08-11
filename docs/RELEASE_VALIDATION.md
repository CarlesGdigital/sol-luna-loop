# Release validation ledger

This ledger separates deterministic package evidence, live Codex evidence, and
external GitHub publication. Static files and child claims are not promoted to
runtime proof.

## Status

`RELEASE_CANDIDATE_VALIDATION`

The public repository, eight-role routing, staged sandbox verification,
model-backed failure/replan/fix loop, and the `v1.0.0` release passed their
recorded gates. A post-release positive smoke then exposed that Codex reports
approval policy `never` to `SubagentStart` as `bypassPermissions`; `v1.0.0`
incorrectly quarantined that valid event. The corrected `v1.0.1` candidate
accepts this documented mapping while retaining quarantine for unknown, null,
or malformed permission modes. Candidate CI, marketplace upgrade, live positive
and negative hook smokes, and clean-room artifact tests have now passed. The
annotated `v1.0.1` tag and GitHub Release remain the final publication gate.

## Deterministic package evidence

- Package and plugin version: `1.0.1`.
- Full suite: 60/60 passed; zero failures, skips, or todos.
- Local plugin validator and `git diff --check`: passed.
- User installer `check` and `doctor`: `ok:true`, manifest `1.0.1`, eight exact
  owned role hashes, inactive lock, zero issues.
- Candidate TGZ and ZIP both passed 60/60 tests, plugin validation, lifecycle
  hook execution from paths containing spaces, and user/project
  install/check/doctor/uninstall cycles. Candidate SHA-256 values were
  `d692da30a715adbc12eb8d05573cac8a198846b8ad7d46a054b00f3b37034d4a`
  (TGZ) and
  `953c19c0ba66cb3e740c257e1d090d1ae4a4a1475dd446721a4c7cbadd2375f8`
  (ZIP). Publication artifacts are regenerated from the final ledger commit.
- The repository is dependency-free at runtime; source CI uses the committed
  npm lockfile and audits production dependencies.

## GitHub and marketplace evidence

- Public repository: `CarlesGdigital/sol-luna-loop`; default branch `main`.
- Corrective commit `52b44794f1f1e392b62e6ba64569650033252388` passed
  GitHub Actions runs `31515731170` (`main`) and `31515731177`
  (`feat/sol-luna-loop`) on Ubuntu, macOS, and Windows.
- The marketplace source was added from the public GitHub repository and
  `sol-luna-loop@sol-luna-loop` version `1.0.0` was installed and enabled in the
  real Codex plugin cache. That immutable release is superseded by the pending
  `v1.0.1` corrective release. The real marketplace was then upgraded from
  public `main` and Codex reported version `1.0.1` installed and enabled.
- Codex listed four installed plugin hooks. After the marketplace upgrade, all
  four definitions were explicitly trusted through the official app-server
  config API. The Windows commands resolved to absolute plugin-cache paths.

## Runtime routing evidence

Fresh Codex CLI sessions observed all eight exact custom roles with model
`gpt-5.6-luna`, effort `max`, managed permissions, restricted network, approval
`never`, and no model fallback. Codex reapplies the parent turn's live sandbox,
so the contract was verified in two groups.

| Agent | Live sandbox | Result |
| --- | --- | --- |
| `sll_luna_probe` | `read-only` | pass |
| `sll_luna_explorer` | `read-only` | pass |
| `sll_luna_reviewer` | `read-only` | pass |
| `sll_luna_security_auditor` | `read-only` | pass |
| `sll_luna_implementer` | `workspace-write` | pass |
| `sll_luna_fixer` | `workspace-write` | pass |
| `sll_luna_test_engineer` | `workspace-write` | pass |
| `sll_luna_docs_writer` | `workspace-write` | pass |

The read-only security-auditor rerun completed in child session
`019ff187-807e-7ad0-bb72-137c57ce7ff6`; the other three read-only roles were
observed under parent session `019ff185-7aac-7323-956d-773d5a2cb360`. The four
writing roles were observed under parent session
`019ff180-3334-7e41-a843-84964fd6d108`.

## Hook boundary evidence

Unit and subprocess evaluation prove canonical allow, prohibited type/model/
effort denial, malformed input handling, and supported lifecycle output. A live
negative test also proved that current collaboration v2 can bypass the standard
`PreToolUse` path: `worker`, `default`, and built-in `explorer` started, while an
unknown `sol` type was rejected by the runtime. This is why the release adds a
`SubagentStart` quarantine for any non-definitive role and documents hooks as
guardrails rather than complete enforcement. The quarantine also rejects a
canonical role with a wrong reported model and normalizes untrusted role/model
tokens before emitting context. Codex maps approval policy `never` to the known
lifecycle value `bypassPermissions`, so that value is accepted; unknown, null,
or malformed permission modes remain quarantined, and malformed lifecycle JSON
exits 2. Reasoning effort and sandbox mode are not present in that event, so the
parent runtime remains authoritative for those controls. Its global matcher
intentionally quarantines unrelated child roles while the plugin is enabled,
an availability tradeoff documented for users.
The first Windows live run exposed a real packaging defect: `%PLUGIN_ROOT%`
remained literal and `SubagentStart` exited 1. Regression coverage was added,
the commands were changed to Codex-expanded `${PLUGIN_ROOT}`, and CI repeated.
In fresh app-server parent session `019ff1bb-47e5-7680-97a2-54e2d77a375f`,
worker child `019ff1bb-6a7b-72b2-8cd4-f343ec7cf46d` then produced an observed
`hook/completed` status of `completed`, received the quarantine context, called
no tools, and returned exactly `ROUTING_DENIED worker`. The parent `Stop` hook
also completed successfully.

The corrected `v1.0.1` candidate was exercised again under approval `never`.
Parent session `019ff1ca-f571-7b62-9ca8-50778bcdf541` spawned real child
`019ff1cb-18ab-7280-bb55-025c79d1046f` as `sll_luna_probe`; its persisted turn
context recorded `gpt-5.6-luna`, effort `max`, managed `read-only`, approval
`never`, and it returned exactly `ROLE_OK`. Parent session
`019ff1cb-990d-7ef3-a650-c30e0b828ea7` then spawned a real `worker` child; the
lifecycle hook injected the quarantine instruction, the child called no tools,
and returned exactly `ROUTING_DENIED worker`.

The first packed-artifact run in a path containing spaces exposed a second
real defect: URL-encoded module paths prevented both hook entrypoints from
recognizing direct execution. The entrypoint check now compares normalized
filesystem paths via `fileURLToPath`; a dedicated copied-plugin regression in a
space-containing path passes for both hook processes.

## Model-backed loop E2E

A separate disposable Git repository seeded a vulnerable path validator, an
insufficient test, and stale documentation. Real custom roles completed:

```text
PREFLIGHT -> DISCOVERY -> PLAN -> IMPLEMENT -> INTEGRATE -> REVIEW -> VERIFY
          -> REPLAN -> FIX -> SECURITY -> DOCUMENT -> FINAL_VERIFY
          -> VERIFIED_READY
```

The test engineer added regression cases and produced an observed 1-pass/1-fail
RED. The reviewer replanned, the fixer produced 2/2 GREEN, the security auditor
returned `SECURITY_PASS`, the docs writer corrected the contract, and the final
reviewer returned `FINAL_VERIFY_PASS`. The clean fixture result is local commit
`ceead41`; generated dependency artifacts were moved to a recoverable quarantine
outside both repositories.

## Publication gate

Before changing this status to `VERIFIED_READY`, the primary session must:

1. [x] push the `v1.0.1` candidate and wait for all GitHub CI jobs;
2. [x] upgrade the real installed plugin, review/trust the hooks, and prove
   both a positive definitive-role start and the negative quarantine;
3. [x] create and extract the release archives, rerun tests/validator/lifecycle,
   and write `SHA256SUMS` from independently computed hashes;
4. [x] rerun user `check`/`doctor`, secret/local-path scans, and final diff
   review;
5. [ ] push the final ledger commit, wait for CI again, then create annotated
   tag `v1.0.1` and the GitHub Release with all assets.
