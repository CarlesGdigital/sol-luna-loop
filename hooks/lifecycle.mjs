#!/usr/bin/env node

import { DEFINITIVE_AGENT_TYPES } from "./pre_tool_use.mjs";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ALLOWED_PERMISSION_MODES = new Set(["default", "acceptEdits", "plan", "dontAsk"]);

function safeToken(value, fallback) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(value) ? value : fallback;
}

function quarantine(agentType, reason) {
  return {
    systemMessage: `sol-luna-loop: ${reason}; the child has been quarantined after spawn.`,
    hookSpecificOutput: {
      hookEventName: "SubagentStart",
      additionalContext: `sol-luna-loop routing violation. Do not call tools or modify files. Reply exactly ROUTING_DENIED ${agentType} to the parent and stop.`,
    },
  };
}

export function evaluateLifecycle(event) {
  const eventName = event?.hook_event_name ?? event?.hookEventName;
  if (eventName === "SubagentStart") {
    const agentType = safeToken(event?.agent_type ?? event?.agentType, "unknown");
    if (!DEFINITIVE_AGENT_TYPES.includes(agentType)) {
      return quarantine(agentType, `${agentType} is a prohibited child role`);
    }
    const rawModel = event?.model;
    if (rawModel !== undefined && rawModel !== "gpt-5.6-luna") {
      const model = safeToken(rawModel, "unknown-model");
      return quarantine(agentType, `${model} is a prohibited model for ${agentType}`);
    }
    const hasPermissionMode = event != null && (
      Object.prototype.hasOwnProperty.call(event, "permission_mode") ||
      Object.prototype.hasOwnProperty.call(event, "permissionMode")
    );
    const rawPermissionMode = event?.permission_mode ?? event?.permissionMode;
    if (hasPermissionMode && !ALLOWED_PERMISSION_MODES.has(rawPermissionMode)) {
      const permissionMode = safeToken(rawPermissionMode, "unknown-mode");
      return quarantine(agentType, `permission mode ${permissionMode} is prohibited for ${agentType}`);
    }
    return {
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: "sol-luna-loop routing evidence: this is a definitive allowed role. PreToolUse is the primary guardrail on supported tool paths; specialized spawn paths still require runtime verification.",
      },
    };
  }
  if (eventName === "SubagentStop") {
    return { systemMessage: "sol-luna-loop lifecycle evidence: the bounded Luna agent completed; inspect its result before continuing." };
  }
  if (eventName === "Stop") {
    return { systemMessage: "sol-luna-loop stop observed; final verification remains the parent Sol/High responsibility." };
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
      process.stderr.write("sol-luna-loop lifecycle hook received invalid JSON\n");
      process.exitCode = 2;
    }
    if (event) {
      const result = evaluateLifecycle(event);
      if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
    }
  }
}
