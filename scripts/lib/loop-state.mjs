export const LOOP_PHASES = Object.freeze([
  "PREFLIGHT",
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
  "BLOCKED_EXTERNAL",
  "RESTART_REQUIRED",
]);

const TRANSITIONS = Object.freeze({
  PREFLIGHT: ["DISCOVERY", "BLOCKED_EXTERNAL", "RESTART_REQUIRED"],
  DISCOVERY: ["PLAN", "BLOCKED_EXTERNAL", "RESTART_REQUIRED"],
  PLAN: ["IMPLEMENT", "BLOCKED_EXTERNAL"],
  IMPLEMENT: ["INTEGRATE", "REPLAN", "BLOCKED_EXTERNAL"],
  INTEGRATE: ["REVIEW", "REPLAN"],
  REVIEW: ["VERIFY", "REPLAN"],
  VERIFY: ["SECURITY", "REPLAN", "VERIFIED_READY", "BLOCKED_EXTERNAL"],
  REPLAN: ["FIX", "IMPLEMENT", "BLOCKED_EXTERNAL"],
  FIX: ["VERIFY", "SECURITY", "REPLAN"],
  SECURITY: ["DOCUMENT", "REPLAN", "BLOCKED_EXTERNAL"],
  DOCUMENT: ["FINAL_VERIFY", "REPLAN"],
  FINAL_VERIFY: ["VERIFIED_READY", "REPLAN", "BLOCKED_EXTERNAL"],
  VERIFIED_READY: [],
  BLOCKED_EXTERNAL: [],
  RESTART_REQUIRED: [],
});

const FAILURE_STRATEGIES = Object.freeze([
  "focused-fix",
  "change-hypothesis",
  "independent-review",
]);

export function createLoopState({ phase = "PREFLIGHT" } = {}) {
  if (!LOOP_PHASES.includes(phase)) throw new Error(`LOOP_PHASE_INVALID: ${phase}`);
  return {
    phase,
    history: [phase],
    failures: [],
    failureStrategy: null,
    terminal: ["VERIFIED_READY", "BLOCKED_EXTERNAL", "RESTART_REQUIRED"].includes(phase),
  };
}

export function transition(state, nextPhase, { reason = "" } = {}) {
  if (!state || !LOOP_PHASES.includes(state.phase)) throw new Error("LOOP_STATE_INVALID");
  if (state.terminal) throw new Error(`LOOP_TERMINAL: ${state.phase}`);
  if (!LOOP_PHASES.includes(nextPhase) || !TRANSITIONS[state.phase].includes(nextPhase)) {
    throw new Error(`LOOP_TRANSITION_INVALID: ${state.phase} -> ${nextPhase}`);
  }
  return {
    ...state,
    phase: nextPhase,
    history: [...state.history, nextPhase],
    lastReason: reason,
    terminal: ["VERIFIED_READY", "BLOCKED_EXTERNAL", "RESTART_REQUIRED"].includes(nextPhase),
  };
}

export function recordFailure(state, fingerprint) {
  if (!state || !LOOP_PHASES.includes(state.phase)) throw new Error("LOOP_STATE_INVALID");
  if (state.terminal) throw new Error(`LOOP_TERMINAL: ${state.phase}`);
  if (typeof fingerprint !== "string" || !fingerprint.trim()) throw new Error("LOOP_FAILURE_INVALID");
  const failures = [...state.failures, fingerprint];
  const count = failures.filter((value) => value === fingerprint).length;
  const failureStrategy = FAILURE_STRATEGIES[Math.min(count, FAILURE_STRATEGIES.length) - 1];
  return { ...state, failures, failureStrategy, lastFailure: fingerprint, terminal: false };
}
