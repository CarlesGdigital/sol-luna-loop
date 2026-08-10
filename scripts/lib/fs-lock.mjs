import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function lockError(code, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

export async function inspectLock(lockPath) {
  let stats;
  try {
    stats = await lstat(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { path: lockPath, active: false, exists: false, valid: true, metadata: null };
    }
    return { path: lockPath, active: true, exists: true, valid: false, metadata: null, error: `${error.code ?? "ERROR"}: ${error.message}` };
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    return { path: lockPath, active: true, exists: true, valid: false, metadata: null, error: "lock path is not a regular file" };
  }
  let metadata = null;
  let errorMessage = null;
  try {
    metadata = JSON.parse(await readFile(lockPath, "utf8"));
  } catch (error) {
    errorMessage = `${error.code ?? "LOCK_INVALID"}: ${error.message}`;
  }
  return {
    path: lockPath,
    active: true,
    exists: true,
    valid: errorMessage === null,
    metadata,
    ...(errorMessage ? { error: errorMessage } : {}),
  };
}

export async function acquireExclusiveLock(lockPath) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
    const metadata = {
      pid: process.pid,
      process: process.title,
      platform: process.platform,
      host: os.hostname(),
      startedAt: new Date().toISOString(),
      token: randomUUID(),
    };
    await handle.writeFile(`${JSON.stringify(metadata)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    let released = false;
    return {
      path: lockPath,
      metadata,
      async release() {
        if (released) return;
        released = true;
        await unlink(lockPath).catch((error) => {
          if (error?.code !== "ENOENT") throw error;
        });
      },
    };
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (error?.code === "EEXIST") {
      throw lockError("LOCK_ACTIVE", `lock is already active at ${lockPath}`, await inspectLock(lockPath));
    }
    throw error;
  }
}

export async function withExclusiveLock(lockPath, callback) {
  const lock = await acquireExclusiveLock(lockPath);
  try {
    return await callback(lock);
  } finally {
    await lock.release();
  }
}
