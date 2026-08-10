#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import {
  BACKUP_DIRECTORY_NAME,
  DEFINITIVE_AGENTS,
  EXPECTED_AGENT_SCHEMA,
  LOCK_FILE_NAME,
  MANIFEST_FILE_NAME,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  TEMPLATE_DIRECTORY,
  TEMPLATE_KEYS,
  check,
  discoverTemplates,
  doctor,
  install,
  installerError,
  resolveScope,
  uninstall,
  validateTemplate,
} from "./lib/agent-installer.mjs";

export {
  BACKUP_DIRECTORY_NAME,
  DEFINITIVE_AGENTS,
  EXPECTED_AGENT_SCHEMA,
  LOCK_FILE_NAME,
  MANIFEST_FILE_NAME,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  TEMPLATE_DIRECTORY,
  TEMPLATE_KEYS,
  discoverTemplates,
  resolveScope,
  validateTemplate,
};

// The accepted bootstrap template remains available as a repository asset, but
// it is intentionally outside the definitive managed eight-role set.
export const AGENT_NAME = "sll_bootstrap_luna_max";
export const AGENT_FILE_NAME = `${AGENT_NAME}.toml`;
export const TEMPLATE_PATH = path.resolve(TEMPLATE_DIRECTORY, AGENT_FILE_NAME);
export const REQUIRED_PINS = Object.freeze({
  name: 'name = "sll_bootstrap_luna_max"',
  model: 'model = "gpt-5.6-luna"',
  model_reasoning_effort: 'model_reasoning_effort = "max"',
  sandbox_mode: 'sandbox_mode = "workspace-write"',
  description: "description =",
  developer_instructions: "developer_instructions =",
});

function parseArgs(argv) {
  const [action, ...rest] = argv;
  if (!["install", "check", "doctor", "uninstall"].includes(action)) {
    throw installerError("ARGUMENT_INVALID", "usage: node scripts/bootstrap-agents.mjs <install|check|doctor|uninstall> [--scope user|project] [--user-home <path>] [--project-root <path>] [--dry-run] [--json]");
  }
  const options = {
    action,
    scope: "user",
    userHome: undefined,
    projectRoot: undefined,
    dryRun: false,
    json: false,
  };
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--json" || argument === "--dry-run") {
      if (seen.has(argument)) throw installerError("ARGUMENT_INVALID", `${argument} may be specified only once`);
      seen.add(argument);
      if (argument === "--json") options.json = true;
      else options.dryRun = true;
      continue;
    }
    if (!["--scope", "--user-home", "--project-root"].includes(argument)) {
      throw installerError("ARGUMENT_INVALID", `unknown argument: ${argument}`);
    }
    if (seen.has(argument)) throw installerError("ARGUMENT_INVALID", `${argument} may be specified only once`);
    seen.add(argument);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--") || value.trim() === "") {
      throw installerError("ARGUMENT_INVALID", `${argument} requires a non-empty value`);
    }
    if (argument === "--scope") {
      if (value !== "user" && value !== "project") throw installerError("ARGUMENT_INVALID", "--scope must be user or project");
      options.scope = value;
    } else if (argument === "--user-home") options.userHome = value;
    else options.projectRoot = value;
    index += 1;
  }
  // Resolve now so contradictory path flags fail before any filesystem action.
  resolveScope({ scope: options.scope, userHome: options.userHome, projectRoot: options.projectRoot });
  return options;
}

function safeError(error) {
  if (error?.code && typeof error.code === "string") return `${error.code}: ${error.message ?? "operation failed"}`;
  return error instanceof Error ? error.message : String(error);
}

function humanResult(result) {
  if (result.ok) {
    if (result.action === "install") {
      if (result.wouldChange) console.log(`Dry run: would install eight Luna roles under ${result.paths.agentsDir}`);
      else if (result.changed) console.log(`Installed eight Luna roles under ${result.paths.agentsDir}`);
      else console.log(`Luna roles are already exact under ${result.paths.agentsDir}`);
    } else if (result.action === "check") console.log(`Check passed for ${result.paths.agentsDir}`);
    else if (result.action === "doctor") console.log(`Doctor passed for ${result.scope} scope`);
    else if (result.action === "uninstall") console.log(`Uninstalled managed Luna roles from ${result.paths.agentsDir}`);
    return;
  }
  if (result.action === "doctor") console.error(`Doctor found ${result.issues.length} issue(s)`);
  else console.error(`ERROR: ${result.error ?? "operation failed"}`);
}

export async function run(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
    const inputs = {
      scope: options.scope,
      userHome: options.userHome,
      projectRoot: options.projectRoot,
      dryRun: options.dryRun,
    };
    let result;
    if (options.action === "install") result = await install(inputs);
    else if (options.action === "check") result = await check(inputs);
    else if (options.action === "doctor") result = await doctor(inputs);
    else result = await uninstall(inputs);
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else humanResult(result);
    return result.ok ? 0 : 1;
  } catch (error) {
    const result = { action: options?.action ?? argv[0] ?? null, ok: false, error: safeError(error) };
    if (argv.includes("--json")) process.stdout.write(`${JSON.stringify(result)}\n`);
    else console.error(`ERROR: ${result.error}`);
    return error?.code === "LOCK_ACTIVE" || error?.code?.startsWith("ARGUMENT") || error?.code?.startsWith("TEMPLATE") || error?.code?.startsWith("MANIFEST") ? 2 : 2;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entrypoint && import.meta.url === entrypoint) process.exitCode = await run();
