import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repositoryRoot, "scripts", "bootstrap-agents.mjs");

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function withRoot(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "sll-doctor-test-"));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("doctor reports a healthy user install with stable keys", async () => {
  await withRoot(async (root) => {
    const install = await runCli(["install", "--scope", "user", "--user-home", root, "--json"]);
    assert.equal(install.code, 0, install.stderr);
    const doctor = await runCli(["doctor", "--scope", "user", "--user-home", root, "--json"]);
    assert.equal(doctor.code, 0, doctor.stderr);
    const payload = JSON.parse(doctor.stdout);
    assert.deepEqual(Object.keys(payload), ["action", "ok", "scope", "platform", "node", "paths", "lock", "manifest", "agents", "issues"]);
    assert.equal(payload.action, "doctor");
    assert.equal(payload.ok, true);
    assert.equal(payload.scope, "user");
    assert.equal(payload.node.supported, true);
    assert.equal(payload.manifest.valid, true);
    assert.equal(payload.agents.length, 8);
    assert.deepEqual(payload.issues, []);
  });
});

test("doctor reports deterministic missing-install issues", async () => {
  await withRoot(async (root) => {
    const doctor = await runCli(["doctor", "--scope", "user", "--user-home", root, "--json"]);
    assert.equal(doctor.code, 1);
    const payload = JSON.parse(doctor.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.manifest.exists, false);
    assert.deepEqual([...new Set(payload.issues.map((issue) => issue.code))].sort(), ["AGENT_MISSING", "MANIFEST_MISSING"]);
  });
});

test("doctor reports malformed manifests and foreign conflicts without mutation", async () => {
  await withRoot(async (root) => {
    const agents = path.join(root, ".codex", "agents");
    await mkdir(agents, { recursive: true });
    await writeFile(path.join(agents, "sol-luna-loop.lock.json"), "[]\n");
    await writeFile(path.join(agents, "sll_luna_probe.toml"), "foreign\n");
    const before = await readFile(path.join(agents, "sol-luna-loop.lock.json"), "utf8");
    const doctor = await runCli(["doctor", "--scope", "user", "--user-home", root, "--json"]);
    assert.equal(doctor.code, 1);
    const payload = JSON.parse(doctor.stdout);
    assert.equal(payload.manifest.valid, false);
    assert.ok(payload.issues.some((issue) => issue.code === "MANIFEST_INVALID"));
    assert.ok(payload.issues.some((issue) => issue.code === "AGENT_CONFLICT"));
    assert.equal(await readFile(path.join(agents, "sol-luna-loop.lock.json"), "utf8"), before);
  });
});

test("doctor supports project scope and exposes node/platform diagnostics", async () => {
  await withRoot(async (root) => {
    const project = path.join(root, "project");
    const install = await runCli(["install", "--scope", "project", "--project-root", project, "--json"]);
    assert.equal(install.code, 0, install.stderr);
    const doctor = await runCli(["doctor", "--scope", "project", "--project-root", project, "--json"]);
    assert.equal(doctor.code, 0, doctor.stderr);
    const payload = JSON.parse(doctor.stdout);
    assert.equal(payload.scope, "project");
    assert.equal(payload.paths.agentsDir, path.join(project, ".codex", "agents"));
    assert.equal(typeof payload.platform.name, "string");
    assert.equal(typeof payload.node.version, "string");
    assert.equal(typeof payload.node.major, "number");
  });
});
