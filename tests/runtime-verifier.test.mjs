import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifierPath = path.join(repositoryRoot, "scripts", "verify-agent-runtime.mjs");
const threadId = "019ff43e-7199-7ea3-8c6a-7d1e5791a201";

function writeRollout(root, { role = "sll_luna_probe", model = "gpt-5.6-luna", effort = "max", sandbox = "danger-full-access" } = {}) {
  const directory = path.join(root, "2026", "08", "12");
  mkdirSync(directory, { recursive: true });
  const rolloutPath = path.join(directory, `rollout-2026-08-12T06-32-40-${threadId}.jsonl`);
  const records = [
    {
      type: "session_meta",
      payload: {
        id: threadId,
        parent_thread_id: "019ff43a-37a3-7f71-998d-040cb764ad32",
        agent_role: role,
        agent_path: "/root/tempra_runtime_probe",
        model_provider: "openai",
      },
    },
    {
      type: "turn_context",
      payload: {
        model,
        effort,
        sandbox_policy: { type: sandbox },
        permission_profile: { type: "disabled" },
        approval_policy: "never",
      },
    },
  ];
  writeFileSync(rolloutPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
}

function runVerifier(sessionsDirectory, expectedRole = "sll_luna_probe", { useCodexHome = false } = {}) {
  const argumentsList = [verifierPath];
  if (!useCodexHome) argumentsList.push("--sessions-dir", sessionsDirectory);
  argumentsList.push("--thread-id", threadId, "--expected-role", expectedRole, "--json");
  const options = { encoding: "utf8" };
  if (useCodexHome) options.env = { ...process.env, CODEX_HOME: path.dirname(sessionsDirectory) };
  return spawnSync(process.execPath, argumentsList, options);
}

test("runtime verification accepts danger-full-access as a live parent override", (t) => {
  const sessionsDirectory = mkdtempSync(path.join(tmpdir(), "sol-luna-runtime "));
  t.after(() => rmSync(sessionsDirectory, { recursive: true, force: true }));
  writeRollout(sessionsDirectory);

  const result = runVerifier(sessionsDirectory);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.agentRole, "sll_luna_probe");
  assert.equal(report.model, "gpt-5.6-luna");
  assert.equal(report.effort, "max");
  assert.equal(report.liveSandbox, "danger-full-access");
  assert.equal(report.defaultSandbox, "read-only");
  assert.equal(report.sandboxOverride, true);
  assert.deepEqual(report.issues, []);
});

test("runtime verification rejects a wrong model without blaming the sandbox override", (t) => {
  const sessionsDirectory = mkdtempSync(path.join(tmpdir(), "sol-luna-runtime "));
  t.after(() => rmSync(sessionsDirectory, { recursive: true, force: true }));
  writeRollout(sessionsDirectory, { model: "gpt-5.6-terra" });

  const result = runVerifier(sessionsDirectory);

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.sandboxOverride, true);
  assert.deepEqual(report.issues.map((issue) => issue.code), ["MODEL_MISMATCH"]);
});

test("runtime verification discovers the sessions directory from CODEX_HOME", (t) => {
  const codexHome = mkdtempSync(path.join(tmpdir(), "sol-luna-codex-home "));
  t.after(() => rmSync(codexHome, { recursive: true, force: true }));
  const sessionsDirectory = path.join(codexHome, "sessions");
  writeRollout(sessionsDirectory);

  const result = runVerifier(sessionsDirectory, "sll_luna_probe", { useCodexHome: true });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test("runtime verification accepts every definitive role under danger-full-access", (t) => {
  const roles = [
    "sll_luna_probe",
    "sll_luna_explorer",
    "sll_luna_implementer",
    "sll_luna_fixer",
    "sll_luna_test_engineer",
    "sll_luna_reviewer",
    "sll_luna_security_auditor",
    "sll_luna_docs_writer",
  ];
  for (const role of roles) {
    const sessionsDirectory = mkdtempSync(path.join(tmpdir(), "sol-luna-runtime "));
    t.after(() => rmSync(sessionsDirectory, { recursive: true, force: true }));
    writeRollout(sessionsDirectory, { role });
    const result = runVerifier(sessionsDirectory, role);
    assert.equal(result.status, 0, `${role}: ${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true, role);
    assert.equal(report.liveSandbox, "danger-full-access", role);
    assert.equal(report.sandboxOverride, report.defaultSandbox !== "danger-full-access", role);
  }
});
