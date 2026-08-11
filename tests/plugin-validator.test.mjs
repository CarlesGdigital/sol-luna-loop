import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validatePluginRoot } from "../scripts/validate-plugin.mjs";

test("the release validator accepts the repository plugin root", async () => {
  assert.deepEqual(await validatePluginRoot(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")), []);
});
