import { randomUUID, createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  copyFile,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BACKUP_DIRECTORY_NAME,
  DEFINITIVE_AGENT_NAMES,
  EXPECTED_SANDBOXES,
  LOCK_FILE_NAME,
  MANIFEST_FILE_NAME,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  createManifest,
  manifestEntry,
  manifestError,
  readManifest,
  serializeManifest,
  sha256,
  validateManifest,
} from "./manifest.mjs";
import { acquireExclusiveLock, inspectLock } from "./fs-lock.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "..", "..", "agent-templates");

export const DEFINITIVE_AGENTS = DEFINITIVE_AGENT_NAMES;
export const EXPECTED_AGENT_SCHEMA = Object.freeze(
  Object.fromEntries(
    DEFINITIVE_AGENTS.map((name) => [
      name,
      Object.freeze({ model: "gpt-5.6-luna", reasoning: "max", sandbox: EXPECTED_SANDBOXES[name] }),
    ]),
  ),
);

export const TEMPLATE_KEYS = Object.freeze([
  "name",
  "model",
  "model_reasoning_effort",
  "sandbox_mode",
  "description",
  "developer_instructions",
]);

export function installerError(code, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function asBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) return Buffer.from(bytes);
  throw installerError("TEMPLATE_INVALID", "template bytes must be a Buffer or Uint8Array");
}

function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw installerError("TEMPLATE_INVALID_UTF8", `template is not valid UTF-8: ${error.message}`);
  }
}

function parseTomlStringAssignments(text, name) {
  const values = {};
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"((?:\\.|[^"\\])*)"\s*(?:#.*)?$/);
    if (!match) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: invalid top-level TOML assignment on line ${index + 1}`);
    const key = match[1];
    if (Object.hasOwn(values, key)) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: duplicate key ${key}`);
    let value;
    try {
      value = JSON.parse(`"${match[2]}"`);
    } catch (error) {
      throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: invalid string for ${key}: ${error.message}`);
    }
    values[key] = value;
  }
  const missing = TEMPLATE_KEYS.filter((key) => !Object.hasOwn(values, key));
  const extra = Object.keys(values).filter((key) => !TEMPLATE_KEYS.includes(key));
  if (missing.length) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: missing keys ${missing.join(", ")}`);
  if (extra.length) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: unknown keys ${extra.join(", ")}`);
  return values;
}

export function validateTemplate(name, bytes) {
  if (!DEFINITIVE_AGENTS.includes(name)) throw installerError("TEMPLATE_UNKNOWN", `${name} is not a definitive agent role`);
  const buffer = asBuffer(bytes);
  const text = decodeUtf8(buffer);
  const values = parseTomlStringAssignments(text, name);
  if (values.name !== name) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: name assignment does not match the file role`);
  if (/sol|terra/i.test(values.model) || /sol|terra/i.test(values.model_reasoning_effort)) {
    throw installerError("TEMPLATE_FORBIDDEN_PIN", `${name}: forbidden Sol/Terra model pin`);
  }
  const expected = EXPECTED_AGENT_SCHEMA[name];
  if (values.model !== expected.model) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: model must be ${expected.model}`);
  if (values.model_reasoning_effort !== expected.reasoning) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: model_reasoning_effort must be ${expected.reasoning}`);
  if (values.sandbox_mode !== expected.sandbox) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: sandbox_mode must be ${expected.sandbox}`);
  if (!values.description.trim()) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: description must not be empty`);
  if (!values.developer_instructions.trim()) throw installerError("TEMPLATE_INVALID_SCHEMA", `${name}: developer_instructions must not be empty`);
  return {
    name,
    model: values.model,
    reasoning: values.model_reasoning_effort,
    model_reasoning_effort: values.model_reasoning_effort,
    sandbox: values.sandbox_mode,
    sandbox_mode: values.sandbox_mode,
    description: values.description,
    developerInstructions: values.developer_instructions,
    developer_instructions: values.developer_instructions,
    sha256: sha256(buffer),
    bytes: buffer,
  };
}

export async function discoverTemplates({ templateDirectory = TEMPLATE_DIRECTORY } = {}) {
  let names;
  try {
    names = await readdir(templateDirectory);
  } catch (error) {
    throw installerError("TEMPLATE_DISCOVERY_FAILED", `cannot read template directory ${templateDirectory}: ${error.message}`);
  }
  const extra = names
    .filter((entry) => /^sll_luna_.+\.toml$/i.test(entry))
    .map((entry) => entry.slice(0, -5))
    .filter((name) => !DEFINITIVE_AGENTS.includes(name));
  if (extra.length) throw installerError("TEMPLATE_UNKNOWN", `unknown definitive template(s): ${extra.join(", ")}`);
  const result = [];
  for (const name of DEFINITIVE_AGENTS) {
    const filePath = path.join(templateDirectory, `${name}.toml`);
    let stats;
    try {
      stats = await lstat(filePath);
    } catch (error) {
      throw installerError("TEMPLATE_MISSING", `${name}: missing template ${filePath}`);
    }
    if (stats.isSymbolicLink() || !stats.isFile()) throw installerError("TEMPLATE_INVALID", `${name}: template is not a regular file`);
    let bytes;
    try {
      bytes = await readFile(filePath);
    } catch (error) {
      throw installerError("TEMPLATE_DISCOVERY_FAILED", `${name}: cannot read template: ${error.message}`);
    }
    result.push({ path: filePath, ...validateTemplate(name, bytes) });
  }
  return result;
}

export function resolveScope({ scope = "user", userHome = undefined, projectRoot = undefined } = {}) {
  if (scope !== "user" && scope !== "project") throw installerError("ARGUMENT_INVALID", "--scope must be user or project");
  if (scope === "user") {
    if (projectRoot !== undefined) throw installerError("ARGUMENT_INVALID", "--project-root is only valid in project scope");
    const root = userHome === undefined ? os.homedir() : userHome;
    if (typeof root !== "string" || root.trim() === "") throw installerError("ARGUMENT_INVALID", "--user-home must be a non-empty path");
    const home = path.resolve(root);
    const agentsDir = path.join(home, ".codex", "agents");
    return makeScopePaths({ scope, root: home, agentsDir });
  }
  if (userHome !== undefined) throw installerError("ARGUMENT_INVALID", "--user-home is only valid in user scope");
  const root = projectRoot === undefined ? process.cwd() : projectRoot;
  if (typeof root !== "string" || root.trim() === "") throw installerError("ARGUMENT_INVALID", "--project-root must be a non-empty path");
  const project = path.resolve(root);
  const agentsDir = path.join(project, ".codex", "agents");
  return makeScopePaths({ scope, root: project, agentsDir });
}

function makeScopePaths({ scope, root, agentsDir }) {
  const manifest = path.join(agentsDir, MANIFEST_FILE_NAME);
  const lock = path.join(agentsDir, LOCK_FILE_NAME);
  const backups = path.join(agentsDir, BACKUP_DIRECTORY_NAME);
  return {
    scope,
    root,
    agentsDir,
    manifest,
    manifestPath: manifest,
    lock,
    lockPath: lock,
    backups,
    backupRoot: backups,
  };
}

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureSafeDirectory(directory) {
  const target = path.resolve(directory);
  const parsed = path.parse(target);
  const relative = path.relative(parsed.root, target);
  let current = parsed.root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stats;
    try {
      stats = await lstat(current);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(current).catch((createError) => {
        if (createError?.code !== "EEXIST") throw createError;
      });
      stats = await lstat(current);
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw installerError("PATH_UNSAFE", `refusing symlink or non-directory path component: ${current}`);
    }
  }
}

async function inspectTarget(name, target, expectedBytes) {
  let stats;
  try {
    stats = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { name, target, exists: false, type: "missing", exact: false, actualSha256: null, pins: false, pinError: null, bytes: null };
    }
    throw error;
  }
  if (stats.isSymbolicLink()) return { name, target, exists: true, type: "symlink", exact: false, actualSha256: null, pins: false, pinError: "symlink target refused", bytes: null };
  if (!stats.isFile()) return { name, target, exists: true, type: "non-file", exact: false, actualSha256: null, pins: false, pinError: "non-file target refused", bytes: null };
  let bytes;
  try {
    bytes = await readFile(target);
  } catch (error) {
    if (error?.code === "ENOENT") return { name, target, exists: false, type: "missing", exact: false, actualSha256: null, pins: false, pinError: null, bytes: null };
    throw error;
  }
  let pins = true;
  let pinError = null;
  try {
    validateTemplate(name, bytes);
  } catch (error) {
    pins = false;
    pinError = error.message;
  }
  return {
    name,
    target,
    exists: true,
    type: "file",
    exact: bytes.equals(expectedBytes),
    actualSha256: sha256(bytes),
    pins,
    pinError,
    bytes,
  };
}

async function inspectState(paths, templates) {
  const manifestInfo = await readManifest(paths.manifest, { scope: paths.scope });
  const agents = [];
  const conflicts = [];
  for (const template of templates) {
    const target = path.join(paths.agentsDir, `${template.name}.toml`);
    const inspected = await inspectTarget(template.name, target, template.bytes);
    const entry = manifestInfo.valid ? manifestEntry(manifestInfo.manifest, template.name) : null;
    const hashMatchesManifest = Boolean(entry && inspected.actualSha256 && inspected.actualSha256 === entry.sha256);
    const owned = Boolean(entry && inspected.exists && inspected.type === "file" && hashMatchesManifest);
    let status = inspected.type;
    let reason = null;
    if (!inspected.exists) {
      status = entry ? "missing-managed" : "missing";
    } else if (inspected.type !== "file") {
      status = "conflict";
      reason = "foreign-type";
    } else if (!manifestInfo.valid) {
      status = "conflict";
      reason = manifestInfo.exists ? "manifest-invalid" : "unowned-file";
    } else if (!entry) {
      status = "conflict";
      reason = "unowned-file";
    } else if (!hashMatchesManifest) {
      status = "conflict";
      reason = "tampered-managed-file";
    } else if (inspected.exact) {
      status = "exact";
    } else {
      status = "managed-update";
    }
    const agent = {
      name: template.name,
      target,
      exists: inspected.exists,
      type: inspected.type,
      status,
      exact: inspected.exact,
      owned,
      managed: Boolean(entry),
      expectedSha256: template.sha256,
      hash: { expected: template.sha256, actual: inspected.actualSha256, match: inspected.actualSha256 === template.sha256 },
      pins: inspected.pins,
      pinError: inspected.pinError,
      ...(reason ? { reason } : {}),
    };
    agents.push(agent);
    if (status === "conflict") conflicts.push({ name: template.name, target, reason });
  }
  return { manifestInfo, agents, conflicts };
}

function publicManifestInfo(manifestInfo) {
  return {
    exists: manifestInfo.exists,
    valid: manifestInfo.valid,
    schemaVersion: manifestInfo.manifest?.schemaVersion ?? null,
    pluginVersion: manifestInfo.manifest?.pluginVersion ?? null,
    ...(manifestInfo.error ? { error: manifestInfo.error.message } : {}),
  };
}

function publicPaths(paths, templates) {
  return {
    root: paths.root,
    agentsDir: paths.agentsDir,
    manifest: paths.manifest,
    lock: paths.lock,
    backups: paths.backups,
    templates: path.dirname(templates[0]?.path ?? TEMPLATE_DIRECTORY),
  };
}

function baseResult(action, paths, templates, dryRun) {
  return {
    action,
    scope: paths.scope,
    dryRun: Boolean(dryRun),
    paths: publicPaths(paths, templates),
  };
}

async function writeFlushed(filePath, bytes) {
  const parent = path.dirname(filePath);
  await mkdir(parent, { recursive: true });
  const temporary = path.join(parent, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, filePath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

async function publishNewFile(filePath, bytes) {
  const parent = path.dirname(filePath);
  await mkdir(parent, { recursive: true });
  const temporary = path.join(parent, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    try {
      await link(temporary, filePath);
      await unlink(temporary);
    } catch (error) {
      if (error?.code === "EEXIST") throw installerError("TARGET_CONFLICT", `target appeared during publication: ${filePath}`);
      if (!["EXDEV", "EPERM", "ENOTSUP"].includes(error?.code)) throw error;
      if (await pathExists(filePath)) throw installerError("TARGET_CONFLICT", `target appeared during publication: ${filePath}`);
      await rename(temporary, filePath);
    }
  } finally {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

async function replaceOwnedFile(filePath, bytes) {
  const parent = path.dirname(filePath);
  await mkdir(parent, { recursive: true });
  const temporary = path.join(parent, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    try {
      await rename(temporary, filePath);
      return;
    } catch (error) {
      if (!["EEXIST", "EPERM", "EACCES"].includes(error?.code)) throw error;
    }
    const displaced = path.join(parent, `.${path.basename(filePath)}.${randomUUID()}.old`);
    await rename(filePath, displaced);
    try {
      await rename(temporary, filePath);
    } catch (error) {
      await rename(displaced, filePath).catch(() => {});
      throw error;
    }
    await unlink(displaced).catch(() => {});
  } finally {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

function makeBackupRun(paths) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(paths.backups, `${stamp}-${randomUUID()}`);
}

async function createBackup(runDirectory, name, bytes, expectedHash) {
  const backupPath = path.join(runDirectory, `${name}.toml`);
  await writeFlushed(backupPath, bytes);
  const verified = await readFile(backupPath);
  const actual = sha256(verified);
  if (actual !== expectedHash) throw installerError("BACKUP_VERIFY_FAILED", `${name}: backup hash verification failed`);
  return backupPath;
}

async function rollbackChanges(changes) {
  for (const change of [...changes].reverse()) {
    try {
      if (change.kind === "created") {
        const info = await inspectTarget(change.name, change.target, Buffer.alloc(0));
        if (info.exists && info.type === "file" && info.actualSha256 === change.newHash) await unlink(change.target);
      } else if (change.kind === "replaced") {
        await replaceOwnedFile(change.target, change.oldBytes);
      }
    } catch {
      // Keep the original failure as the actionable result; the target remains
      // either a complete old or complete new file because publication is atomic.
    }
  }
}

async function loadTemplates(templateDirectory) {
  return discoverTemplates({ templateDirectory });
}

export async function install({
  scope = "user",
  userHome = undefined,
  projectRoot = undefined,
  dryRun = false,
  templateDirectory = TEMPLATE_DIRECTORY,
} = {}) {
  const paths = resolveScope({ scope, userHome, projectRoot });
  const templates = await loadTemplates(templateDirectory);
  const base = baseResult("install", paths, templates, dryRun);
  if (dryRun) {
    const state = await inspectState(paths, templates);
    if (state.manifestInfo.error) throw state.manifestInfo.error;
    const actionable = state.agents.some((agent) => ["missing", "missing-managed", "managed-update"].includes(agent.status));
    const conflicts = state.conflicts;
    return {
      ...base,
      ok: conflicts.length === 0,
      changed: false,
      wouldChange: conflicts.length === 0 && actionable,
      idempotent: conflicts.length === 0 && !actionable,
      agents: state.agents,
      conflicts,
      manifest: publicManifestInfo(state.manifestInfo),
      ...(conflicts.length ? { error: "one or more targets are unowned, tampered, or unsafe" } : {}),
    };
  }

  await ensureSafeDirectory(paths.agentsDir);
  const lock = await acquireExclusiveLock(paths.lock);
  try {
    const state = await inspectState(paths, templates);
    if (state.manifestInfo.error) throw state.manifestInfo.error;
    if (state.conflicts.length) {
      return {
        ...base,
        ok: false,
        changed: false,
        agents: state.agents,
        conflicts: state.conflicts,
        manifest: publicManifestInfo(state.manifestInfo),
        error: "one or more targets are unowned, tampered, or unsafe; refusing to overwrite",
      };
    }
    const actionable = state.agents.filter((agent) => ["missing", "missing-managed", "managed-update"].includes(agent.status));
    if (!actionable.length && state.manifestInfo.valid) {
      return {
        ...base,
        ok: true,
        changed: false,
        idempotent: true,
        agents: state.agents,
        conflicts: [],
        manifest: publicManifestInfo(state.manifestInfo),
      };
    }
    const changes = [];
    const backupCandidates = actionable.filter((agent) => agent.status === "managed-update");
    const backupRun = backupCandidates.length ? makeBackupRun(paths) : null;
    const backupPaths = new Map();
    try {
      if (backupRun) await ensureSafeDirectory(backupRun);
      for (const agent of actionable) {
        const template = templates.find((entry) => entry.name === agent.name);
        const oldBytes = agent.exists && agent.type === "file" ? await readFile(agent.target) : null;
        if (agent.status === "managed-update") {
          const oldEntry = manifestEntry(state.manifestInfo.manifest, agent.name);
          const backupPath = await createBackup(backupRun, agent.name, oldBytes, oldEntry.sha256);
          backupPaths.set(agent.name, backupPath);
          await replaceOwnedFile(agent.target, template.bytes);
          changes.push({ kind: "replaced", name: agent.name, target: agent.target, oldBytes, newHash: template.sha256, backupPath });
        } else {
          await publishNewFile(agent.target, template.bytes);
          changes.push({ kind: "created", name: agent.name, target: agent.target, newHash: template.sha256 });
        }
      }
      const hashes = Object.fromEntries(templates.map((template) => [template.name, template.sha256]));
      const manifest = createManifest({ scope: paths.scope, hashes });
      const manifestBytes = Buffer.from(serializeManifest(manifest), "utf8");
      if (state.manifestInfo.exists) await replaceOwnedFile(paths.manifest, manifestBytes);
      else await publishNewFile(paths.manifest, manifestBytes);
      const after = await inspectState(paths, templates);
      return {
        ...base,
        ok: true,
        changed: true,
        idempotent: false,
        agents: after.agents,
        conflicts: [],
        manifest: publicManifestInfo(after.manifestInfo),
        ...(backupRun ? { backupDirectory: backupRun, backups: [...backupPaths.entries()].map(([name, filePath]) => ({ name, path: filePath })) } : {}),
      };
    } catch (error) {
      await rollbackChanges(changes);
      throw error;
    }
  } finally {
    await lock.release();
  }
}

export async function check({
  scope = "user",
  userHome = undefined,
  projectRoot = undefined,
  dryRun = false,
  templateDirectory = TEMPLATE_DIRECTORY,
} = {}) {
  const paths = resolveScope({ scope, userHome, projectRoot });
  const templates = await loadTemplates(templateDirectory);
  const base = baseResult("check", paths, templates, dryRun);
  const state = await inspectState(paths, templates);
  const issues = [];
  if (!state.manifestInfo.exists) issues.push({ code: "MANIFEST_MISSING", message: "managed manifest is missing" });
  else if (!state.manifestInfo.valid) issues.push({ code: "MANIFEST_INVALID", message: state.manifestInfo.error?.message ?? "managed manifest is invalid" });
  for (const agent of state.agents) {
    if (agent.status === "missing" || agent.status === "missing-managed") issues.push({ code: "AGENT_MISSING", name: agent.name, message: `${agent.name} is missing` });
    else if (agent.status === "conflict") issues.push({ code: "AGENT_CONFLICT", name: agent.name, reason: agent.reason, message: `${agent.name} is not safely managed` });
    else if (agent.status === "managed-update") issues.push({ code: "AGENT_STALE", name: agent.name, message: `${agent.name} differs from the canonical template` });
    else if (!agent.pins) issues.push({ code: "AGENT_INVALID", name: agent.name, message: `${agent.name} has invalid pins` });
  }
  const manifest = publicManifestInfo(state.manifestInfo);
  return {
    ...base,
    ok: issues.length === 0,
    manifest,
    agents: state.agents,
    issues,
    ...(issues.length ? { error: "managed agents are missing, stale, invalid, or unowned" } : {}),
  };
}

function doctorIssues(paths, state, lockState) {
  const issues = [];
  if (lockState.active) issues.push({ code: "LOCK_ACTIVE", message: `mutation lock is active at ${paths.lock}` });
  if (!state.manifestInfo.exists) issues.push({ code: "MANIFEST_MISSING", message: "managed manifest is missing" });
  else if (!state.manifestInfo.valid) issues.push({ code: "MANIFEST_INVALID", message: state.manifestInfo.error?.message ?? "managed manifest is invalid" });
  for (const agent of state.agents) {
    if (agent.status === "missing" || agent.status === "missing-managed") issues.push({ code: "AGENT_MISSING", name: agent.name, message: `${agent.name} is missing` });
    if (agent.status === "conflict") issues.push({ code: "AGENT_CONFLICT", name: agent.name, reason: agent.reason, message: `${agent.name} is a conflict` });
    if (agent.status === "managed-update") issues.push({ code: "AGENT_STALE", name: agent.name, message: `${agent.name} is stale` });
    if (agent.exists && !agent.pins && agent.status !== "conflict") issues.push({ code: "AGENT_INVALID", name: agent.name, message: `${agent.name} has invalid pins` });
  }
  return issues.sort((a, b) => `${a.code}:${a.name ?? ""}`.localeCompare(`${b.code}:${b.name ?? ""}`));
}

export async function doctor({
  scope = "user",
  userHome = undefined,
  projectRoot = undefined,
  dryRun = false,
  templateDirectory = TEMPLATE_DIRECTORY,
} = {}) {
  const paths = resolveScope({ scope, userHome, projectRoot });
  const templates = await loadTemplates(templateDirectory);
  const state = await inspectState(paths, templates);
  const lockState = await inspectLock(paths.lock);
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  const issues = doctorIssues(paths, state, lockState);
  if (major < 20) issues.push({ code: "NODE_VERSION_UNSUPPORTED", message: "Node.js 20 or newer is required" });
  return {
    action: "doctor",
    ok: issues.length === 0,
    scope: paths.scope,
    platform: { name: process.platform, arch: process.arch, pathSeparator: path.sep },
    node: { version: process.version, major, supported: major >= 20 },
    paths: publicPaths(paths, templates),
    lock: lockState,
    manifest: publicManifestInfo(state.manifestInfo),
    agents: state.agents,
    issues: issues.sort((a, b) => `${a.code}:${a.name ?? ""}`.localeCompare(`${b.code}:${b.name ?? ""}`)),
  };
}

export async function uninstall({
  scope = "user",
  userHome = undefined,
  projectRoot = undefined,
  dryRun = false,
  templateDirectory = TEMPLATE_DIRECTORY,
} = {}) {
  const paths = resolveScope({ scope, userHome, projectRoot });
  const templates = await loadTemplates(templateDirectory);
  const base = baseResult("uninstall", paths, templates, dryRun);
  const state = await inspectState(paths, templates);
  if (!state.manifestInfo.exists) {
    return { ...base, ok: true, changed: false, removed: [], conflicts: [], manifest: publicManifestInfo(state.manifestInfo), agents: state.agents };
  }
  if (!state.manifestInfo.valid) throw state.manifestInfo.error;
  const conflicts = state.conflicts.filter((entry) => entry.reason === "tampered-managed-file" || entry.reason === "foreign-type" || entry.reason === "unowned-file");
  const removable = state.agents.filter((agent) => agent.exists && agent.type === "file" && agent.owned);
  const missingOwned = state.agents.filter((agent) => !agent.exists && manifestEntry(state.manifestInfo.manifest, agent.name));
  const wouldRemove = [...removable.map((agent) => agent.name), ...missingOwned.map((agent) => agent.name)];
  if (dryRun) {
    return { ...base, ok: conflicts.length === 0, changed: false, wouldChange: conflicts.length === 0 && Boolean(wouldRemove.length || state.manifestInfo.exists), wouldRemove, removed: [], conflicts, manifest: publicManifestInfo(state.manifestInfo), agents: state.agents, ...(conflicts.length ? { error: "uninstall conflicts preserve managed files" } : {}) };
  }
  const lock = await acquireExclusiveLock(paths.lock);
  try {
    for (const agent of removable) await unlink(agent.target);
    if (conflicts.length) {
      return {
        ...base,
        ok: false,
        changed: removable.length > 0,
        removed: removable.map((agent) => agent.name),
        conflicts,
        manifest: publicManifestInfo(state.manifestInfo),
        agents: state.agents,
        error: "uninstall conflicts preserve managed files",
      };
    }
    await unlink(paths.manifest).catch((error) => { if (error?.code !== "ENOENT") throw error; });
    return { ...base, ok: true, changed: true, removed: wouldRemove, conflicts: [], manifest: { exists: false, valid: false, schemaVersion: null, pluginVersion: null }, agents: [], };
  } finally {
    await lock.release();
  }
}

export { MANIFEST_FILE_NAME, LOCK_FILE_NAME, BACKUP_DIRECTORY_NAME, PLUGIN_NAME, PLUGIN_VERSION };
