import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REQUIRED_PINS, TEMPLATE_PATH } from "../scripts/bootstrap-agents.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repositoryRoot, "scripts", "bootstrap-agents.mjs");

function targetFor(home) {
  return path.join(home, ".codex", "agents", "sll_bootstrap_luna_max.toml");
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "pipe"],
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

async function withHome(callback) {
  const home = await mkdtemp(path.join(os.tmpdir(), "sll-bootstrap-test-"));
  try {
    return await callback(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

test("template contains the default Codex-only literals", async () => {
  const text = await readFile(TEMPLATE_PATH, "utf8");
  for (const [name, literal] of Object.entries(REQUIRED_PINS)) {
    assert.ok(text.includes(literal), `missing ${name} literal`);
  }
  assert.match(text, /description\s*=\s*"[^"]+"/);
  assert.match(text, /developer_instructions\s*=\s*"[^"]+"/);
});

test("install writes the exact template and reports its hash", async () => {
  await withHome(async (home) => {
    const result = await runCli(["install", "--user-home", home, "--json"]);
    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    const template = await readFile(TEMPLATE_PATH);
    const expectedHash = createHash("sha256").update(template).digest("hex");
    assert.equal(payload.ok, true);
    assert.equal(payload.changed, true);
    assert.equal(payload.expectedSha256, expectedHash);
    assert.deepEqual(await readFile(targetFor(home)), template);
  });
});

test("check proves existence, exact bytes, hash, and required literals", async () => {
  await withHome(async (home) => {
    const install = await runCli(["install", "--user-home", home]);
    assert.equal(install.code, 0, install.stderr);

    const result = await runCli(["check", "--user-home", home, "--json"]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout.trim().split("\n").length, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.exists, true);
    assert.equal(payload.exactBytes, true);
    assert.equal(payload.sha256.match, true);
    assert.ok(Object.values(payload.requiredLiterals).every(Boolean));
  });
});

test("re-install is idempotent on an exact match", async () => {
  await withHome(async (home) => {
    const first = await runCli(["install", "--user-home", home, "--json"]);
    assert.equal(first.code, 0, first.stderr);
    const target = targetFor(home);
    const before = await stat(target);
    const second = await runCli(["install", "--user-home", home, "--json"]);
    assert.equal(second.code, 0, second.stderr);
    const payload = JSON.parse(second.stdout);
    assert.equal(payload.changed, false);
    assert.equal(payload.idempotent, true);
    const after = await stat(target);
    assert.equal(after.size, before.size);
    assert.equal(await readFile(target, "utf8"), await readFile(TEMPLATE_PATH, "utf8"));
  });
});

test("dry-run never creates the target or parent directories", async () => {
  await withHome(async (home) => {
    const result = await runCli(["install", "--user-home", home, "--dry-run", "--json"]);
    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.wouldWrite, true);
    assert.equal(await exists(targetFor(home)), false);
    assert.equal(await exists(path.join(home, ".codex")), false);
  });
});

test("a conflicting foreign file is refused and preserved", async () => {
  await withHome(async (home) => {
    const target = targetFor(home);
    await mkdirFor(target);
    const foreign = Buffer.from("foreign content\n", "utf8");
    await writeFile(target, foreign);
    const result = await runCli(["install", "--user-home", home, "--json"]);
    assert.notEqual(result.code, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.conflict, true);
    assert.deepEqual(await readFile(target), foreign);
  });
});

test("check detects tampering", async () => {
  await withHome(async (home) => {
    const install = await runCli(["install", "--user-home", home]);
    assert.equal(install.code, 0, install.stderr);
    const target = targetFor(home);
    await writeFile(target, `${await readFile(target, "utf8")}tampered\n`);
    const result = await runCli(["check", "--user-home", home, "--json"]);
    assert.notEqual(result.code, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.exactBytes, false);
    assert.equal(payload.sha256.match, false);
    assert.ok(!Object.values(payload.requiredLiterals).every(Boolean) || payload.exactBytes === false);
  });
});

test("JSON output is one machine-readable object without template content", async () => {
  await withHome(async (home) => {
    const result = await runCli(["check", "--user-home", home, "--json"]);
    assert.notEqual(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.trim().split("\n").length, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(typeof payload.expectedSha256, "string");
    assert.equal(result.stdout.includes("developer_instructions ="), false);
  });
});

async function mkdirFor(filePath) {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(filePath), { recursive: true });
}
