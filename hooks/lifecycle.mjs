#!/usr/bin/env node

export function evaluateLifecycle(event) {
  const eventName = event?.hook_event_name ?? event?.hookEventName;
  if (eventName === "SubagentStart") {
    return {
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: "sol-luna-loop routing evidence: this lifecycle event is observational; PreToolUse is the blocking boundary.",
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

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll("\\", "/"))) {
  const raw = await readStdin();
  if (raw) {
    const event = JSON.parse(raw);
    const result = evaluateLifecycle(event);
    if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}
