import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdtemp, mkdir, readFile, readdir, rm, stat, lstat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repositoryRoot, "scripts", "bootstrap-agents.mjs");
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

function agentsDir(root, scope = "user") {
  return path.join(root, ".codex", "agents");
}

function targetFor(root, role) {
  return path.join(agentsDir(root), `${role}.toml`);
}

function manifestFor(root) {
  return path.join(agentsDir(root), "sol-luna-loop.lock.json");
}

function lockFor(root) {
  return path.join(agentsDir(root), ".sol-luna-loop.lock");
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

async function withRoots(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "sll-definitive-test-"));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function install(root, ...flags) {
  return runCli(["install", "--scope", "user", "--user-home", root, ...flags]);
}

test("user install writes exactly eight role files and an owned manifest", async () => {
  await withRoots(async (root) => {
    const result = await install(root, "--json");
    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.action, "install");
    assert.equal(payload.scope, "user");
    assert.equal(payload.agents.length, 8);
    assert.deepEqual(payload.agents.map((entry) => entry.name), roles);
    const entries = await readdir(agentsDir(root));
    assert.deepEqual(entries.filter((name) => name.endsWith(".toml")).sort(), roles.map((role) => `${role}.toml`).sort());
    const manifest = JSON.parse(await readFile(manifestFor(root), "utf8"));
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.plugin, "sol-luna-loop");
    assert.equal(manifest.pluginVersion, "0.1.0");
    assert.equal(manifest.scope, "user");
    assert.deepEqual(Object.keys(manifest.agents), roles);
    for (const role of roles) {
      const bytes = await readFile(targetFor(root, role));
      const entry = manifest.agents[role];
      assert.equal(entry.name, role);
      assert.equal(entry.expectedModel, "gpt-5.6-luna");
      assert.equal(entry.expectedReasoning, "max");
      assert.ok(["read-only", "workspace-write"].includes(entry.expectedSandbox));
      assert.equal(entry.sha256, createHash("sha256").update(bytes).digest("hex"));
      assert.equal(entry.templateOrigin, `agent-templates/${role}.toml`);
    }
  });
});

test("project scope resolves under project root and rejects user-home", async () => {
  await withRoots(async (root) => {
    const project = path.join(root, "project");
    const result = await runCli(["install", "--scope", "project", "--project-root", project, "--json"]);
    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.scope, "project");
    assert.equal(payload.paths.agentsDir, path.join(project, ".codex", "agents"));
    assert.equal(await exists(path.join(project, ".codex", "agents", "sll_luna_probe.toml")), true);
    const invalid = await runCli(["check", "--scope", "project", "--project-root", project, "--user-home", root, "--json"]);
    assert.equal(invalid.code, 2);
    assert.match(JSON.parse(invalid.stdout).error, /user-home.*valid/i);
  });
});

test("install is byte-idempotent and check proves manifest ownership", async () => {
  await withRoots(async (root) => {
    const first = await install(root, "--json");
    assert.equal(first.code, 0, first.stderr);
    const before = await stat(targetFor(root, roles[0]));
    const second = await install(root, "--json");
    assert.equal(second.code, 0, second.stderr);
    const payload = JSON.parse(second.stdout);
    assert.equal(payload.changed, false);
    assert.equal(payload.idempotent, true);
    assert.equal((await stat(targetFor(root, roles[0]))).mtimeMs, before.mtimeMs);
    const check = await runCli(["check", "--scope", "user", "--user-home", root, "--json"]);
    assert.equal(check.code, 0, check.stderr);
    const checked = JSON.parse(check.stdout);
    assert.equal(checked.ok, true);
    assert.equal(checked.manifest.valid, true);
    assert.equal(checked.agents.every((entry) => entry.exact && entry.owned), true);
  });
});

test("dry-run is pure and JSON emits exactly one object", async () => {
  await withRoots(async (root) => {
    const result = await install(root, "--dry-run", "--json");
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.trim().split("\n").length, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.dryRun, true);
    assert.equal(payload.wouldChange, true);
    assert.equal(await exists(path.join(root, ".codex")), false);
    assert.equal(result.stdout.includes("developer_instructions"), false);
  });
});

test("foreign files and symlinks are preserved as conflicts", async () => {
  await withRoots(async (root) => {
    const target = targetFor(root, roles[0]);
    await mkdir(path.dirname(target), { recursive: true });
    const foreign = Buffer.from("foreign\n");
    await writeFile(target, foreign);
    const result = await install(root, "--json");
    assert.notEqual(result.code, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.ok(payload.conflicts.some((entry) => entry.name === roles[0]));
    assert.deepEqual(await readFile(target), foreign);

    await rm(target);
    const source = path.join(root, "foreign-source.toml");
    await writeFile(source, foreign);
    try {
      await import("node:fs/promises").then(({ symlink }) => symlink(source, target));
    } catch (error) {
      // Windows without Developer Mode refuses unprivileged symlinks; a
      // directory still exercises the same non-file refusal path.
      if (error?.code !== "EPERM") throw error;
      await mkdir(target);
    }
    const symlinkResult = await install(root, "--json");
    assert.notEqual(symlinkResult.code, 0);
    const unsafe = await lstat(target);
    assert.equal(unsafe.isSymbolicLink() || unsafe.isDirectory(), true);
  });
});

test("tampered managed files fail closed and check reports hash mismatch", async () => {
  await withRoots(async (root) => {
    assert.equal((await install(root, "--json")).code, 0);
    const target = targetFor(root, roles[1]);
    await writeFile(target, `${await readFile(target, "utf8")}tampered\n`);
    const result = await install(root, "--json");
    assert.notEqual(result.code, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.ok(payload.conflicts.some((entry) => entry.name === roles[1] && entry.reason === "tampered-managed-file"));
    const check = await runCli(["check", "--scope", "user", "--user-home", root, "--json"]);
    assert.notEqual(check.code, 0);
    const checked = JSON.parse(check.stdout);
    assert.equal(checked.agents.find((entry) => entry.name === roles[1]).hash.match, false);
  });
});

test("uninstall removes only exact owned files and preserves conflicts", async () => {
  await withRoots(async (root) => {
    assert.equal((await install(root, "--json")).code, 0);
    const tampered = targetFor(root, roles[2]);
    await writeFile(tampered, `${await readFile(tampered, "utf8")}local\n`);
    const result = await runCli(["uninstall", "--scope", "user", "--user-home", root, "--json"]);
    assert.notEqual(result.code, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.ok(payload.conflicts.some((entry) => entry.name === roles[2]));
    assert.equal(await exists(tampered), true);
    assert.equal(await exists(manifestFor(root)), true);
    for (const role of roles.filter((role) => role !== roles[2])) {
      assert.equal(await exists(targetFor(root, role)), false);
    }
    const second = await runCli(["uninstall", "--scope", "user", "--user-home", root, "--json"]);
    assert.notEqual(second.code, 0);
    assert.equal(await exists(tampered), true);
  });
});

test("active lock refuses mutation and read-only actions only report it", async () => {
  await withRoots(async (root) => {
    await mkdir(path.dirname(lockFor(root)), { recursive: true });
    await writeFile(lockFor(root), JSON.stringify({ pid: 12345, startedAt: new Date().toISOString() }));
    const installResult = await install(root, "--json");
    assert.equal(installResult.code, 2);
    assert.match(JSON.parse(installResult.stdout).error, /lock/i);
    const doctor = await runCli(["doctor", "--scope", "user", "--user-home", root, "--json"]);
    assert.equal(doctor.code, 1);
    const payload = JSON.parse(doctor.stdout);
    assert.equal(payload.lock.active, true);
    assert.ok(payload.issues.some((issue) => issue.code === "LOCK_ACTIVE"));
  });
});

test("malformed manifest is refused without removing files", async () => {
  await withRoots(async (root) => {
    await mkdir(path.dirname(manifestFor(root)), { recursive: true });
    await writeFile(manifestFor(root), "{malformed\n");
    const result = await install(root, "--json");
    assert.equal(result.code, 2);
    assert.match(JSON.parse(result.stdout).error, /manifest/i);
    assert.equal(await readFile(manifestFor(root), "utf8"), "{malformed\n");
  });
});

test("managed update creates a verified recoverable backup", async () => {
  await withRoots(async (root) => {
    const first = await install(root, "--json");
    assert.equal(first.code, 0, first.stderr);
    const manifest = JSON.parse(await readFile(manifestFor(root), "utf8"));
    const role = roles[0];
    const target = targetFor(root, role);
    const old = await readFile(target);
    // The installer accepts an explicit template root for this isolated test;
    // the CLI always uses the repository canonical templates.
    const altTemplates = path.join(root, "templates");
    await mkdir(altTemplates, { recursive: true });
    for (const name of roles) {
      const source = path.join(repositoryRoot, "agent-templates", `${name}.toml`);
      const bytes = await readFile(source);
      const updated = name === role
        ? Buffer.from(bytes.toString("utf8").replace("A minimal read-only routing probe", "An updated minimal read-only routing probe"))
        : bytes;
      await writeFile(path.join(altTemplates, `${name}.toml`), updated);
    }
    const { install: installWithRoot } = await import("../scripts/lib/agent-installer.mjs");
    const result = await installWithRoot({ scope: "user", userHome: root, templateDirectory: altTemplates });
    assert.equal(result.ok, true);
    const backupRoot = path.join(agentsDir(root), ".sol-luna-loop-backups");
    const backupRuns = await readdir(backupRoot);
    assert.equal(backupRuns.length, 1);
    const backup = path.join(backupRoot, backupRuns[0], `${role}.toml`);
    assert.deepEqual(await readFile(backup), old);
    assert.equal(createHash("sha256").update(await readFile(backup)).digest("hex"), manifest.agents[role].sha256);
  });
});
