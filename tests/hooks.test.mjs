import assert from "node:assert/strict";
import test from "node:test";

import { evaluateLifecycle } from "../hooks/lifecycle.mjs";
import { DEFINITIVE_AGENT_TYPES, evaluatePreToolUse } from "../hooks/pre_tool_use.mjs";

test("PreToolUse allows a canonical Luna agent without overrides", () => {
  const result = evaluatePreToolUse({
    tool_name: "Agent",
    tool_input: { agent_type: "sll_luna_probe" },
  });
  assert.equal(result, null);
});

for (const agentType of ["worker", "default", "explorer", "terra", "sol", "unknown_agent"]) {
  test(`PreToolUse denies prohibited agent ${agentType} before execution`, () => {
    const result = evaluatePreToolUse({
      tool_name: "Agent",
      tool_input: { agent_type: agentType },
    });
    assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
    assert.match(result.hookSpecificOutput.permissionDecisionReason, new RegExp(agentType, "i"));
  });
}

test("PreToolUse denies incompatible model and reasoning overrides", () => {
  for (const input of [
    { agent_type: "sll_luna_probe", model: "gpt-5.6-terra" },
    { agent_type: "sll_luna_probe", reasoning_effort: "high" },
    { agent_type: "sll_luna_probe", model: "gpt-5.6-luna", reasoning_effort: "high" },
  ]) {
    const result = evaluatePreToolUse({ tool_name: "spawn_agent", tool_input: input });
    assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  }
});

test("hook policy keeps the canonical allow-list explicit", () => {
  assert.deepEqual([...DEFINITIVE_AGENT_TYPES].sort(), [
    "sll_luna_docs_writer",
    "sll_luna_explorer",
    "sll_luna_fixer",
    "sll_luna_implementer",
    "sll_luna_probe",
    "sll_luna_reviewer",
    "sll_luna_security_auditor",
    "sll_luna_test_engineer",
  ]);
});

test("lifecycle hooks use supported observational output shapes", () => {
  const start = evaluateLifecycle({ hook_event_name: "SubagentStart", agent_type: "sll_luna_probe" });
  assert.equal(start.hookSpecificOutput.hookEventName, "SubagentStart");
  const stop = evaluateLifecycle({ hook_event_name: "SubagentStop", agent_type: "sll_luna_probe" });
  assert.equal(typeof stop.systemMessage, "string");
  const end = evaluateLifecycle({ hook_event_name: "Stop" });
  assert.equal(typeof end.systemMessage, "string");
});
