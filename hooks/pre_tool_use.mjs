#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DEFINITIVE_AGENT_TYPES = Object.freeze([
  "sll_luna_probe",
  "sll_luna_explorer",
  "sll_luna_implementer",
  "sll_luna_fixer",
  "sll_luna_test_engineer",
  "sll_luna_reviewer",
  "sll_luna_security_auditor",
  "sll_luna_docs_writer",
]);

function deny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

export function evaluatePreToolUse(event) {
  const toolName = event?.tool_name ?? event?.toolName;
  if (toolName !== "Agent" && toolName !== "spawn_agent") return null;
  const input = event?.tool_input ?? event?.toolInput ?? {};
  const agentType = input.agent_type ?? input.agentType;
  if (!DEFINITIVE_AGENT_TYPES.includes(agentType)) {
    return deny(`sol-luna-loop permits only a definitive sll_luna_* agent; requested ${String(agentType ?? "unknown")}`);
  }
  if (input.model !== undefined && input.model !== "gpt-5.6-luna") {
    return deny(`sol-luna-loop denies incompatible model override for ${agentType}`);
  }
  if (input.reasoning_effort !== undefined && input.reasoning_effort !== "max") {
    return deny(`sol-luna-loop denies incompatible reasoning override for ${agentType}`);
  }
  return null;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

const modulePath = realpathSync(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : null;
const isMainModule = invokedPath != null && (
  process.platform === "win32"
    ? invokedPath.toLowerCase() === modulePath.toLowerCase()
    : invokedPath === modulePath
);

if (isMainModule) {
  const raw = await readStdin();
  if (raw) {
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      process.stderr.write("sol-luna-loop hook received invalid JSON\n");
      process.exitCode = 2;
    }
    if (event) {
      const result = evaluatePreToolUse(event);
      if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
    }
  }
}
