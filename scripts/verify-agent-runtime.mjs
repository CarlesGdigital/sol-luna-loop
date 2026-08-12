#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFINITIVE_AGENT_NAMES, EXPECTED_SANDBOXES } from "./lib/manifest.mjs";

const THREAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function parseArguments(argv) {
  const options = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (!["--sessions-dir", "--thread-id", "--expected-role"].includes(argument)) {
      throw new Error(`unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  options.sessionsDir ??= path.join(process.env.CODEX_HOME || path.join(homedir(), ".codex"), "sessions");
  if (!THREAD_ID_RE.test(options.threadId ?? "")) throw new Error("--thread-id must be a lowercase UUID");
  if (!DEFINITIVE_AGENT_NAMES.includes(options.expectedRole)) throw new Error("--expected-role must name a definitive sll_luna agent");
  return options;
}

async function findRollouts(directory, suffix, matches = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await findRollouts(entryPath, suffix, matches);
    else if (entry.isFile() && entry.name.endsWith(suffix)) matches.push(entryPath);
  }
  return matches;
}

function oneObservedValue(turns, selector, label) {
  const values = [...new Set(turns.map(selector))];
  if (values.length !== 1 || values[0] == null || values[0] === "") {
    throw new Error(`rollout has missing or conflicting ${label}`);
  }
  return values[0];
}

async function readRuntimeEvidence(options) {
  const matches = await findRollouts(path.resolve(options.sessionsDir), `-${options.threadId}.jsonl`);
  if (matches.length !== 1) throw new Error(`expected exactly one rollout for thread ${options.threadId}; found ${matches.length}`);
  const records = (await readFile(matches[0], "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const sessions = records.filter((record) => record.type === "session_meta").map((record) => record.payload);
  const turns = records.filter((record) => record.type === "turn_context").map((record) => record.payload);
  if (sessions.length !== 1) throw new Error("rollout has missing or ambiguous session metadata");
  if (!turns.length) throw new Error("rollout has no turn context");
  const session = sessions[0];
  if (session.id !== options.threadId) throw new Error("rollout session id does not match the requested thread");
  return {
    rollout: matches[0],
    threadId: session.id,
    parentThreadId: session.parent_thread_id ?? null,
    agentRole: session.agent_role ?? null,
    agentPath: session.agent_path ?? null,
    model: oneObservedValue(turns, (turn) => turn.model, "model"),
    effort: oneObservedValue(turns, (turn) => turn.effort, "reasoning effort"),
    liveSandbox: oneObservedValue(turns, (turn) => turn.sandbox_policy?.type, "sandbox policy"),
    permissionProfile: oneObservedValue(turns, (turn) => turn.permission_profile?.type, "permission profile"),
    approvalPolicy: oneObservedValue(turns, (turn) => turn.approval_policy, "approval policy"),
  };
}

function evaluateEvidence(evidence, expectedRole) {
  const issues = [];
  if (evidence.agentRole !== expectedRole) {
    issues.push({ code: "ROLE_MISMATCH", expected: expectedRole, actual: evidence.agentRole });
  }
  if (evidence.model !== "gpt-5.6-luna") {
    issues.push({ code: "MODEL_MISMATCH", expected: "gpt-5.6-luna", actual: evidence.model });
  }
  if (evidence.effort !== "max") {
    issues.push({ code: "EFFORT_MISMATCH", expected: "max", actual: evidence.effort });
  }
  const defaultSandbox = EXPECTED_SANDBOXES[expectedRole];
  return {
    ok: issues.length === 0,
    ...evidence,
    expectedRole,
    defaultSandbox,
    sandboxOverride: evidence.liveSandbox !== defaultSandbox,
    issues,
  };
}

export async function verifyAgentRuntime(options) {
  return evaluateEvidence(await readRuntimeEvidence(options), options.expectedRole);
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    const report = await verifyAgentRuntime(options);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    const payload = { ok: false, error: { code: "RUNTIME_EVIDENCE_INVALID", message: error.message } };
    if (options?.json ?? process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(payload)}\n`);
    else process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
