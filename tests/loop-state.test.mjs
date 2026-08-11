import assert from "node:assert/strict";
import test from "node:test";

import {
  createLoopState,
  recordFailure,
  transition,
} from "../scripts/lib/loop-state.mjs";

test("loop state accepts the verified iterative path", () => {
  let state = createLoopState();
  for (const phase of [
    "DISCOVERY",
    "PLAN",
    "IMPLEMENT",
    "INTEGRATE",
    "REVIEW",
    "VERIFY",
    "REPLAN",
    "FIX",
    "SECURITY",
    "DOCUMENT",
    "FINAL_VERIFY",
    "VERIFIED_READY",
  ]) {
    state = transition(state, phase, { reason: `fixture-${phase}` });
  }
  assert.equal(state.phase, "VERIFIED_READY");
  assert.equal(state.history.length, 13);
});

test("loop state rejects illegal transitions and terminal continuation", () => {
  const state = createLoopState({ phase: "PLAN" });
  assert.throws(() => transition(state, "SECURITY"), /LOOP_TRANSITION_INVALID/);
  const terminal = createLoopState({ phase: "VERIFIED_READY" });
  assert.throws(() => transition(terminal, "PLAN"), /LOOP_TERMINAL/);
});

test("repeated failure fingerprints change strategy without terminating the loop", () => {
  let state = createLoopState({ phase: "VERIFY" });
  state = recordFailure(state, "hash-mismatch");
  assert.equal(state.failureStrategy, "focused-fix");
  state = recordFailure(state, "hash-mismatch");
  assert.equal(state.failureStrategy, "change-hypothesis");
  state = recordFailure(state, "hash-mismatch");
  assert.equal(state.failureStrategy, "independent-review");
  assert.equal(state.phase, "VERIFY");
  assert.equal(state.terminal, false);
});
