#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_INTERFACE_FIELDS = [
  "displayName",
  "shortDescription",
  "longDescription",
  "developerName",
  "category",
  "capabilities",
  "defaultPrompt",
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readJson(filePath, errors, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
    return null;
  }
}

async function requireFile(filePath, errors, label) {
  try {
    await readFile(filePath);
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
  }
}

export async function validatePluginRoot(pluginRoot) {
  const root = path.resolve(pluginRoot);
  const errors = [];
  const manifest = await readJson(path.join(root, ".codex-plugin", "plugin.json"), errors, "plugin manifest");
  if (!isObject(manifest)) return errors;
  if (manifest.name !== "sol-luna-loop") errors.push("manifest name must be sol-luna-loop");
  if (manifest.version !== "1.0.2") errors.push("manifest version must be 1.0.2");
  if (typeof manifest.description !== "string" || !manifest.description.trim()) errors.push("manifest description is required");
  if (manifest.license !== "MIT") errors.push("manifest license must be MIT");
  if (typeof manifest.repository !== "string" || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/sol-luna-loop$/.test(manifest.repository)) errors.push("manifest repository must be a real GitHub sol-luna-loop URL");
  if (!isObject(manifest.author) || typeof manifest.author.name !== "string" || !manifest.author.name.trim()) errors.push("manifest author.name is required");
  if (manifest.skills !== "./skills") errors.push("manifest skills must be ./skills");
  if (Object.hasOwn(manifest, "hooks")) errors.push("manifest hooks must be omitted so default hooks/hooks.json is used");
  if (!isObject(manifest.interface)) errors.push("manifest interface is required");
  else {
    for (const field of REQUIRED_INTERFACE_FIELDS) {
      const value = manifest.interface[field];
      if (typeof value !== "string" && field !== "capabilities" && field !== "defaultPrompt") errors.push(`manifest interface.${field} is required`);
    }
    if (!Array.isArray(manifest.interface.capabilities) || !manifest.interface.capabilities.length) errors.push("manifest interface.capabilities is required");
    if (!Array.isArray(manifest.interface.defaultPrompt) || !manifest.interface.defaultPrompt.length || manifest.interface.defaultPrompt.length > 3) errors.push("manifest interface.defaultPrompt must contain one to three prompts");
  }
  await requireFile(path.join(root, "skills", "sol-luna-loop-setup", "SKILL.md"), errors, "setup skill");
  const hooks = await readJson(path.join(root, "hooks", "hooks.json"), errors, "hooks manifest");
  if (!Array.isArray(hooks?.hooks?.PreToolUse)) errors.push("hooks manifest must define PreToolUse");
  await requireFile(path.join(root, "hooks", "pre_tool_use.mjs"), errors, "PreToolUse command");
  await requireFile(path.join(root, "hooks", "lifecycle.mjs"), errors, "lifecycle command");
  const marketplace = await readJson(path.join(root, ".agents", "plugins", "marketplace.json"), errors, "marketplace");
  const entries = Array.isArray(marketplace?.plugins) ? marketplace.plugins : [];
  if (marketplace && !Array.isArray(marketplace.plugins)) errors.push("marketplace.plugins must be an array");
  const entry = entries.find((item) => item?.name === "sol-luna-loop");
  if (!entry) errors.push("marketplace must expose sol-luna-loop");
  else {
    if (entry.source?.source !== "local" || entry.source?.path !== "./") errors.push("marketplace must point to the single plugin root with ./");
    if (entry.policy?.installation !== "AVAILABLE" || entry.policy?.authentication !== "ON_INSTALL") errors.push("marketplace policy must be AVAILABLE/ON_INSTALL");
  }
  const serialized = JSON.stringify({ manifest, hooks, marketplace });
  if (/C:[\\/]Users[\\/]/i.test(serialized) || /(?:gho_|github_pat_)[A-Za-z0-9_-]{12,}/i.test(serialized)) errors.push("release metadata contains a personal path or credential");
  return errors;
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll("\\", "/"))) {
  const errors = await validatePluginRoot(process.argv[2] ?? process.cwd());
  if (errors.length) {
    process.stderr.write(`Plugin validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Plugin validation passed: ${path.resolve(process.argv[2] ?? process.cwd())}\n`);
  }
}
