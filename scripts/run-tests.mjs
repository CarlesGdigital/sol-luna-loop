#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const testsDirectory = path.resolve(scriptsDirectory, "..", "tests");
const testFiles = (await readdir(testsDirectory))
  .filter((fileName) => fileName.endsWith(".test.mjs"))
  .sort()
  .map((fileName) => path.join(testsDirectory, fileName));

if (!testFiles.length) {
  process.stderr.write(`No test files found under ${testsDirectory}\n`);
  process.exitCode = 1;
} else {
  const child = spawn(process.execPath, ["--test", ...testFiles], { stdio: "inherit" });
  child.on("error", (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal) process.exitCode = 1;
    else if (code !== null) process.exitCode = code;
  });
}
