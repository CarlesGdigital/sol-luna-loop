#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, link, lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const AGENT_NAME = "sll_bootstrap_luna_max";
export const AGENT_FILE_NAME = `${AGENT_NAME}.toml`;
export const REQUIRED_PINS = Object.freeze({
  name: 'name = "sll_bootstrap_luna_max"',
  model: 'model = "gpt-5.6-luna"',
  model_reasoning_effort: 'model_reasoning_effort = "max"',
  sandbox_mode: 'sandbox_mode = "workspace-write"',
  description: "description =",
  developer_instructions: "developer_instructions =",
});

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE_PATH = path.resolve(
  SCRIPT_DIRECTORY,
  "..",
  "agent-templates",
  AGENT_FILE_NAME,
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function targetPathFor(userHome) {
  if (typeof userHome !== "string" || userHome.trim() === "") {
    throw new TypeError("--user-home must be a non-empty path");
  }
  return path.join(path.resolve(userHome), ".codex", "agents", AGENT_FILE_NAME);
}

async function loadTemplate() {
  const bytes = await readFile(TEMPLATE_PATH);
  const text = bytes.toString("utf8");
  const missing = Object.entries(REQUIRED_PINS)
    .filter(([, literal]) => !text.includes(literal))
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`template is missing required literal pins: ${missing.join(", ")}`);
  }
  return { bytes, expectedSha256: sha256(bytes) };
}

function literalResults(text) {
  return Object.fromEntries(
    Object.entries(REQUIRED_PINS).map(([name, literal]) => [name, text.includes(literal)]),
  );
}

async function inspectTarget(target, expectedBytes) {
  let stats;
  try {
    stats = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        exists: false,
        exactBytes: false,
        actualSha256: null,
        requiredLiterals: Object.fromEntries(
          Object.keys(REQUIRED_PINS).map((name) => [name, false]),
        ),
      };
    }
    throw error;
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    return {
      exists: true,
      exactBytes: false,
      actualSha256: null,
      requiredLiterals: Object.fromEntries(
        Object.keys(REQUIRED_PINS).map((name) => [name, false]),
      ),
      foreignType: true,
    };
  }

  let bytes;
  try {
    bytes = await readFile(target);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        exists: false,
        exactBytes: false,
        actualSha256: null,
        requiredLiterals: Object.fromEntries(
          Object.keys(REQUIRED_PINS).map((name) => [name, false]),
        ),
      };
    }
    throw error;
  }
  const text = bytes.toString("utf8");
  return {
    exists: true,
    exactBytes: bytes.equals(expectedBytes),
    actualSha256: sha256(bytes),
    requiredLiterals: literalResults(text),
    bytes,
  };
}

function resultBase(action, target, expectedSha256, dryRun) {
  return { action, target, expectedSha256, dryRun: Boolean(dryRun) };
}

function conflictResult(base, existing) {
  return {
    ...base,
    ok: false,
    conflict: true,
    exists: true,
    actualSha256: existing.actualSha256,
    error: "target exists with different content; refusing to overwrite",
  };
}

async function install({ userHome, dryRun }) {
  const template = await loadTemplate();
  const target = targetPathFor(userHome);
  const base = resultBase("install", target, template.expectedSha256, dryRun);
  const existing = await inspectTarget(target, template.bytes);

  if (existing.exists) {
    if (existing.exactBytes) {
      return {
        ...base,
        ok: true,
        changed: false,
        idempotent: true,
        exists: true,
        actualSha256: existing.actualSha256,
      };
    }
    return conflictResult(base, existing);
  }

  if (dryRun) {
    return {
      ...base,
      ok: true,
      changed: false,
      wouldWrite: true,
      exists: false,
    };
  }

  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });

  // Re-check after creating the parent. This closes the common race where a
  // different process creates the target while the parent is being made.
  const afterMkdir = await inspectTarget(target, template.bytes);
  if (afterMkdir.exists) {
    if (afterMkdir.exactBytes) {
      return {
        ...base,
        ok: true,
        changed: false,
        idempotent: true,
        exists: true,
        actualSha256: afterMkdir.actualSha256,
      };
    }
    return conflictResult(base, afterMkdir);
  }

  const temporary = path.join(parent, `.${AGENT_FILE_NAME}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(template.bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;

    // A hard link publishes the fully flushed temporary file without the
    // overwrite semantics of rename(). It is supported by Windows, macOS,
    // and Linux filesystems used for a user home; a foreign target yields
    // EEXIST and is handled as a closed conflict below.
    try {
      await link(temporary, target);
    } catch (error) {
      if (error?.code === "EEXIST") {
        const raced = await inspectTarget(target, template.bytes);
        if (raced.exists && raced.exactBytes) {
          return {
            ...base,
            ok: true,
            changed: false,
            idempotent: true,
            exists: true,
            actualSha256: raced.actualSha256,
          };
        }
        return conflictResult(base, raced);
      }
      throw error;
    }

    return {
      ...base,
      ok: true,
      changed: true,
      idempotent: false,
      exists: true,
      actualSha256: template.expectedSha256,
    };
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await unlink(temporary).catch(() => {});
  }
}

async function check({ userHome, dryRun }) {
  const template = await loadTemplate();
  const target = targetPathFor(userHome);
  const existing = await inspectTarget(target, template.bytes);
  const hashMatches = existing.exists && existing.actualSha256 === template.expectedSha256;
  const literalsMatch = Object.values(existing.requiredLiterals).every(Boolean);
  const ok = existing.exists && existing.exactBytes && hashMatches && literalsMatch;
  return {
    ...resultBase("check", target, template.expectedSha256, dryRun),
    ok,
    exists: existing.exists,
    exactBytes: existing.exactBytes,
    sha256: {
      expected: template.expectedSha256,
      actual: existing.actualSha256,
      match: hashMatches,
    },
    requiredLiterals: existing.requiredLiterals,
    ...(ok ? {} : { error: "target is missing or does not match the exact bootstrap template" }),
  };
}

function parseArgs(argv) {
  const [action, ...rest] = argv;
  if (action !== "install" && action !== "check") {
    throw new Error("usage: node scripts/bootstrap-agents.mjs install|check [--user-home <path>] [--dry-run] [--json]");
  }

  const options = { action, userHome: os.homedir(), dryRun: false, json: false };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--user-home") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--user-home requires a path");
      }
      options.userHome = value;
      index += 1;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--json") {
      options.json = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

function safeError(error) {
  if (error?.code && typeof error.code === "string") {
    return `${error.code}: ${error.message ?? "operation failed"}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function printHuman(result) {
  if (result.ok) {
    if (result.action === "install") {
      if (result.changed) {
        console.log(`Installed ${result.target} (sha256 ${result.expectedSha256})`);
      } else if (result.wouldWrite) {
        console.log(`Dry run: would install ${result.target} (sha256 ${result.expectedSha256})`);
      } else {
        console.log(`Already installed ${result.target} (sha256 ${result.expectedSha256})`);
      }
    } else {
      console.log(`Check passed for ${result.target} (sha256 ${result.expectedSha256})`);
    }
    return;
  }
  console.error(`ERROR: ${result.error}`);
}

export async function run(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
    const result = options.action === "install" ? await install(options) : await check(options);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else {
      printHuman(result);
    }
    return result.ok ? 0 : 1;
  } catch (error) {
    const json = argv.includes("--json");
    const result = { ok: false, action: options?.action ?? null, error: safeError(error) };
    if (json) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else {
      console.error(`ERROR: ${result.error}`);
    }
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run();
}
