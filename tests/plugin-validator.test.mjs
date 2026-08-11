import assert from "node:assert/strict";
import { cp, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validatePluginRoot } from "../scripts/validate-plugin.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the release validator accepts the repository plugin root", async () => {
  assert.deepEqual(await validatePluginRoot(repositoryRoot), []);
});

test("the release validator reports a malformed marketplace instead of throwing", async () => {
  const fixture = await mkdtemp(path.join(await realpath(os.tmpdir()), "sll-validator-test-"));
  try {
    await cp(path.join(repositoryRoot, ".codex-plugin"), path.join(fixture, ".codex-plugin"), { recursive: true });
    await cp(path.join(repositoryRoot, ".agents"), path.join(fixture, ".agents"), { recursive: true });
    await cp(path.join(repositoryRoot, "hooks"), path.join(fixture, "hooks"), { recursive: true });
    await cp(path.join(repositoryRoot, "skills"), path.join(fixture, "skills"), { recursive: true });
    await writeFile(path.join(fixture, ".agents", "plugins", "marketplace.json"), JSON.stringify({ plugins: {} }));
    const errors = await validatePluginRoot(fixture);
    assert.ok(errors.some((error) => error.includes("marketplace.plugins must be an array")));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
