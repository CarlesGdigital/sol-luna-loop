import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";

export const MANIFEST_SCHEMA_VERSION = 1;
export const PLUGIN_NAME = "sol-luna-loop";
export const PLUGIN_VERSION = "0.1.0";
export const MANIFEST_FILE_NAME = "sol-luna-loop.lock.json";
export const LOCK_FILE_NAME = ".sol-luna-loop.lock";
export const BACKUP_DIRECTORY_NAME = ".sol-luna-loop-backups";

export const DEFINITIVE_AGENT_NAMES = Object.freeze([
  "sll_luna_probe",
  "sll_luna_explorer",
  "sll_luna_implementer",
  "sll_luna_fixer",
  "sll_luna_test_engineer",
  "sll_luna_reviewer",
  "sll_luna_security_auditor",
  "sll_luna_docs_writer",
]);

export const EXPECTED_SANDBOXES = Object.freeze({
  sll_luna_probe: "read-only",
  sll_luna_explorer: "read-only",
  sll_luna_implementer: "workspace-write",
  sll_luna_fixer: "workspace-write",
  sll_luna_test_engineer: "workspace-write",
  sll_luna_reviewer: "read-only",
  sll_luna_security_auditor: "read-only",
  sll_luna_docs_writer: "workspace-write",
});

const SHA256_RE = /^[a-f0-9]{64}$/;
const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TOP_LEVEL_KEYS = ["schemaVersion", "plugin", "pluginVersion", "scope", "generatedAt", "agents"];
const AGENT_KEYS = ["name", "pluginVersion", "expectedModel", "expectedReasoning", "expectedSandbox", "sha256", "templateOrigin"];

export function manifestError(code, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw manifestError("MANIFEST_INVALID", `${label} must be an object`);
  }
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value);
  const missing = expected.filter((key) => !Object.hasOwn(value, key));
  const extra = actual.filter((key) => !expected.includes(key));
  if (missing.length || extra.length) {
    throw manifestError(
      "MANIFEST_INVALID",
      `${label} keys are invalid (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
}

function parseVersion(value, label) {
  if (typeof value !== "string" || !VERSION_RE.test(value)) {
    throw manifestError("MANIFEST_INVALID", `${label} must be a semantic version string`);
  }
  return value.split(".").map((part) => Number.parseInt(part, 10));
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function validateManifest(manifest, { scope = undefined } = {}) {
  assertPlainObject(manifest, "manifest");
  assertExactKeys(manifest, TOP_LEVEL_KEYS, "manifest");
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw manifestError("MANIFEST_INVALID", `unsupported manifest schema version: ${String(manifest.schemaVersion)}`);
  }
  if (manifest.plugin !== PLUGIN_NAME) {
    throw manifestError("MANIFEST_INVALID", `manifest plugin must be ${PLUGIN_NAME}`);
  }
  const manifestVersion = parseVersion(manifest.pluginVersion, "manifest pluginVersion");
  if (compareVersions(manifestVersion, parseVersion(PLUGIN_VERSION, "current pluginVersion")) > 0) {
    throw manifestError("MANIFEST_INVALID", `manifest pluginVersion ${manifest.pluginVersion} is newer than ${PLUGIN_VERSION}`);
  }
  if (manifest.scope !== "user" && manifest.scope !== "project") {
    throw manifestError("MANIFEST_INVALID", "manifest scope must be user or project");
  }
  if (scope !== undefined && manifest.scope !== scope) {
    throw manifestError("MANIFEST_INVALID", `manifest scope ${manifest.scope} does not match requested ${scope}`);
  }
  if (typeof manifest.generatedAt !== "string" || Number.isNaN(Date.parse(manifest.generatedAt))) {
    throw manifestError("MANIFEST_INVALID", "manifest generatedAt must be an ISO timestamp");
  }
  assertPlainObject(manifest.agents, "manifest agents");
  if (Object.keys(manifest.agents).length !== DEFINITIVE_AGENT_NAMES.length) {
    throw manifestError("MANIFEST_INVALID", "manifest must contain exactly eight definitive agents");
  }
  for (const name of DEFINITIVE_AGENT_NAMES) {
    if (!Object.hasOwn(manifest.agents, name)) {
      throw manifestError("MANIFEST_INVALID", `manifest is missing agent ${name}`);
    }
  }
  for (const name of Object.keys(manifest.agents)) {
    if (!DEFINITIVE_AGENT_NAMES.includes(name)) {
      throw manifestError("MANIFEST_INVALID", `manifest contains unknown agent ${name}`);
    }
    const entry = manifest.agents[name];
    assertPlainObject(entry, `manifest agent ${name}`);
    assertExactKeys(entry, AGENT_KEYS, `manifest agent ${name}`);
    if (entry.name !== name) throw manifestError("MANIFEST_INVALID", `manifest agent ${name} has mismatched name`);
    const entryVersion = parseVersion(entry.pluginVersion, `manifest agent ${name} pluginVersion`);
    if (entry.pluginVersion !== manifest.pluginVersion) throw manifestError("MANIFEST_INVALID", `manifest agent ${name} has mismatched pluginVersion`);
    if (compareVersions(entryVersion, manifestVersion) !== 0) throw manifestError("MANIFEST_INVALID", `manifest agent ${name} has inconsistent pluginVersion`);
    if (entry.expectedModel !== "gpt-5.6-luna") throw manifestError("MANIFEST_INVALID", `manifest agent ${name} has an invalid model`);
    if (entry.expectedReasoning !== "max") throw manifestError("MANIFEST_INVALID", `manifest agent ${name} has an invalid reasoning effort`);
    if (entry.expectedSandbox !== EXPECTED_SANDBOXES[name]) throw manifestError("MANIFEST_INVALID", `manifest agent ${name} has an invalid sandbox`);
    if (typeof entry.sha256 !== "string" || !SHA256_RE.test(entry.sha256)) throw manifestError("MANIFEST_INVALID", `manifest agent ${name} has an invalid sha256`);
    if (entry.templateOrigin !== `agent-templates/${name}.toml`) throw manifestError("MANIFEST_INVALID", `manifest agent ${name} has an invalid template origin`);
  }
  return manifest;
}

function orderedAgentEntries(entries) {
  const result = {};
  for (const name of DEFINITIVE_AGENT_NAMES) {
    const entry = entries[name];
    result[name] = {
      name,
      pluginVersion: PLUGIN_VERSION,
      expectedModel: "gpt-5.6-luna",
      expectedReasoning: "max",
      expectedSandbox: EXPECTED_SANDBOXES[name],
      sha256: entry.sha256,
      templateOrigin: `agent-templates/${name}.toml`,
    };
  }
  return result;
}

export function createManifest({ scope, hashes, generatedAt = new Date().toISOString() }) {
  if (!Object.hasOwn(hashes ?? {}, DEFINITIVE_AGENT_NAMES[0])) {
    throw manifestError("MANIFEST_INVALID", "cannot create a manifest without all agent hashes");
  }
  const agents = {};
  for (const name of DEFINITIVE_AGENT_NAMES) {
    const value = hashes[name];
    if (typeof value === "string") agents[name] = { sha256: value };
    else if (value && typeof value === "object") agents[name] = { sha256: value.sha256 };
    else throw manifestError("MANIFEST_INVALID", `missing hash for ${name}`);
  }
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    plugin: PLUGIN_NAME,
    pluginVersion: PLUGIN_VERSION,
    scope,
    generatedAt,
    agents: orderedAgentEntries(agents),
  };
  return validateManifest(manifest, { scope });
}

export function serializeManifest(manifest) {
  validateManifest(manifest, { scope: manifest?.scope });
  const ordered = {
    schemaVersion: manifest.schemaVersion,
    plugin: manifest.plugin,
    pluginVersion: manifest.pluginVersion,
    scope: manifest.scope,
    generatedAt: manifest.generatedAt,
    agents: {},
  };
  for (const name of DEFINITIVE_AGENT_NAMES) {
    const entry = manifest.agents[name];
    ordered.agents[name] = {};
    for (const key of AGENT_KEYS) ordered.agents[name][key] = entry[key];
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

export async function readManifest(manifestPath, { scope = undefined } = {}) {
  try {
    const stats = await lstat(manifestPath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return {
        exists: true,
        valid: false,
        manifest: null,
        error: manifestError("MANIFEST_INVALID", "managed manifest path is not a regular file"),
      };
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  let bytes;
  try {
    bytes = await readFile(manifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, valid: false, manifest: null, error: null };
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    return { exists: true, valid: false, manifest: null, error: manifestError("MANIFEST_INVALID", `manifest is not valid JSON: ${error.message}`) };
  }
  try {
    validateManifest(parsed, { scope });
    return { exists: true, valid: true, manifest: parsed, error: null };
  } catch (error) {
    return { exists: true, valid: false, manifest: null, error };
  }
}

export function manifestOwns(manifest, name, actualSha256) {
  return Boolean(
    manifest &&
      manifest.agents &&
      Object.hasOwn(manifest.agents, name) &&
      manifest.agents[name].sha256 === actualSha256,
  );
}

export function manifestEntry(manifest, name) {
  return manifest?.agents?.[name] ?? null;
}
