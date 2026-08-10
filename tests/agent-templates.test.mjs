import assert from "node:assert/strict";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFINITIVE_AGENTS,
  EXPECTED_AGENT_SCHEMA,
  TEMPLATE_DIRECTORY,
  validateTemplate,
} from "../scripts/bootstrap-agents.mjs";
import { discoverTemplates } from "../scripts/lib/agent-installer.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the definitive set is exactly the eight ordered Luna roles", () => {
  assert.deepEqual(DEFINITIVE_AGENTS, [
    "sll_luna_probe",
    "sll_luna_explorer",
    "sll_luna_implementer",
    "sll_luna_fixer",
    "sll_luna_test_engineer",
    "sll_luna_reviewer",
    "sll_luna_security_auditor",
    "sll_luna_docs_writer",
  ]);
  assert.equal(Object.isFrozen(DEFINITIVE_AGENTS), true);
  assert.equal(Object.keys(EXPECTED_AGENT_SCHEMA).length, 8);
});

test("every definitive template validates with exact Luna pins and role sandbox", async () => {
  const discovered = await discoverTemplates({ templateDirectory: TEMPLATE_DIRECTORY });
  assert.deepEqual(discovered.map((entry) => entry.name), DEFINITIVE_AGENTS);
  assert.equal(discovered.length, 8);

  for (const name of DEFINITIVE_AGENTS) {
    const bytes = await readFile(path.join(TEMPLATE_DIRECTORY, `${name}.toml`));
    const metadata = validateTemplate(name, bytes);
    const expected = EXPECTED_AGENT_SCHEMA[name];
    assert.equal(metadata.name, name);
    assert.equal(metadata.model, "gpt-5.6-luna");
    assert.equal(metadata.reasoning, "max");
    assert.equal(metadata.sandbox, expected.sandbox);
    assert.match(metadata.description, /\S/);
    assert.match(metadata.developerInstructions, /\S/);
    assert.doesNotMatch(metadata.model, /sol|terra/i);
  }
});

test("template validation rejects malformed UTF-8, duplicates, wrong pins, and unknown roles", () => {
  assert.throws(
    () => validateTemplate("sll_luna_probe", Buffer.from([0xc3, 0x28])),
    /UTF-8/i,
  );
  const valid = Buffer.from([
    'name = "sll_luna_probe"',
    'model = "gpt-5.6-luna"',
    'model_reasoning_effort = "max"',
    'sandbox_mode = "read-only"',
    'description = "probe"',
    'developer_instructions = "probe"',
    'name = "sll_luna_probe"',
  ].join("\n"));
  assert.throws(() => validateTemplate("sll_luna_probe", valid), /duplicate.*name/i);
  const single = valid.toString().replace(/\nname = "sll_luna_probe"$/, "");
  assert.throws(() => validateTemplate("sll_luna_probe", Buffer.from(single.replace('gpt-5.6-luna', 'gpt-5.6-' + 'sol'))), /Sol|model/i);
  assert.throws(() => validateTemplate("not_definitive", valid), /definitive|unknown/i);
  assert.throws(() => validateTemplate("sll_luna_probe", Buffer.from(single.replace('sandbox_mode = "read-only"', 'sandbox_mode = "workspace-write"'))), /sandbox/i);
});

test("template discovery rejects an extra sll_luna role while preserving the bootstrap template", async () => {
  const extra = path.join(TEMPLATE_DIRECTORY, "sll_luna_unapproved.toml");
  try {
    await writeFile(extra, 'name = "sll_luna_unapproved"\n', { flag: "wx" });
    await assert.rejects(
      () => discoverTemplates({ templateDirectory: TEMPLATE_DIRECTORY }),
      /unknown.*template|unapproved/i,
    );
  } finally {
    await rm(extra, { force: true });
  }
  const bootstrap = await readFile(path.join(TEMPLATE_DIRECTORY, "sll_bootstrap_luna_max.toml"), "utf8");
  assert.match(bootstrap, /sll_bootstrap_luna_max/);
});
