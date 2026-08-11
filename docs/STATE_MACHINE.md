# State machine

The legal phases are defined in `scripts/lib/loop-state.mjs`:

```text
PREFLIGHT → DISCOVERY → PLAN → IMPLEMENT → INTEGRATE → REVIEW → VERIFY
                                      ↑                    ↓
                                      └──── REPLAN ←───────┘
                                                ↓
                                      FIX → SECURITY → DOCUMENT → FINAL_VERIFY
                                                                        ↓
                                                                  VERIFIED_READY
```

`BLOCKED_EXTERNAL` and `RESTART_REQUIRED` are terminal states for their
respective run. `VERIFIED_READY` is terminal and cannot be continued. A
repeated failure fingerprint records `focused-fix`, then `change-hypothesis`,
then `independent-review`; it never pretends that a repeated failure is ready.

The state module is deterministic and covered by `tests/loop-state.test.mjs`.
It records a loop contract; it does not claim to execute Codex agents itself.
