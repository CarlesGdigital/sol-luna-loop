import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8"));
}

test("release exposes a valid plugin manifest and root skill", () => {
  const manifest = readJson(".codex-plugin/plugin.json");
  const packageJson = readJson("package.json");
  assert.equal(manifest.name, "sol-luna-loop");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(packageJson.version, "1.0.0");
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.skills, "./skills");
  assert.equal(typeof manifest.repository, "string");
  assert.match(manifest.repository, /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/sol-luna-loop$/);
  assert.ok(existsSync(path.join(repositoryRoot, "skills", "sol-luna-loop-setup", "SKILL.md")));
  assert.deepEqual(Object.keys(manifest).filter((key) => key === "hooks"), []);
});

test("repo marketplace points at the single plugin root without a duplicate copy", () => {
  const marketplace = readJson(".agents/plugins/marketplace.json");
  assert.equal(marketplace.name, "sol-luna-loop");
  assert.equal(marketplace.plugins.length, 1);
  const [entry] = marketplace.plugins;
  assert.equal(entry.name, "sol-luna-loop");
  assert.deepEqual(entry.source, { source: "local", path: "./" });
  assert.equal(entry.policy.installation, "AVAILABLE");
  assert.equal(entry.policy.authentication, "ON_INSTALL");
  assert.equal(entry.category, "Developer Tools");
});

test("release includes trusted-by-user hook definition and no personal paths", () => {
  const hooks = readJson("hooks/hooks.json");
  assert.ok(Array.isArray(hooks.hooks.PreToolUse));
  assert.ok(hooks.hooks.PreToolUse.some((entry) => entry.matcher === "^Agent$|^spawn_agent$"));
  const serialized = JSON.stringify({ hooks });
  assert.doesNotMatch(serialized, /C:\\\\Users\\\\Carles/i);
  assert.doesNotMatch(serialized, /gho_[A-Za-z0-9_\-]+/i);
});

test("SubagentStart wiring reaches prohibited roles for quarantine", () => {
  const hooks = readJson("hooks/hooks.json");
  const [start] = hooks.hooks.SubagentStart;
  const matcher = new RegExp(start.matcher);
  assert.equal(matcher.test("sll_luna_probe"), true);
  assert.equal(matcher.test("worker"), true);
  assert.equal(matcher.test("default"), true);
  assert.equal(matcher.test("explorer"), true);
});

test("Windows hook commands use the Codex-expanded plugin root", () => {
  const hooks = readJson("hooks/hooks.json");
  for (const groups of Object.values(hooks.hooks)) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        assert.match(hook.command_windows, /\$\{PLUGIN_ROOT\}/);
        assert.doesNotMatch(hook.command_windows, /%PLUGIN_ROOT%/);
      }
    }
  }
});
