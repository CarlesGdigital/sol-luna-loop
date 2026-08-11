import { randomUUID } from "node:crypto";
import { lstat as lstatReal, open as openReal, readFile as readFileReal, unlink as unlinkReal } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const REAL_IO = Object.freeze({
  open: openReal,
  lstat: lstatReal,
  readFile: readFileReal,
  unlink: unlinkReal,
});
const IO_KEYS = Object.freeze(["open", "lstat", "readFile", "unlink"]);

export function lockError(code, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

async function inspectLockWithIo(lockPath, io) {
  let stats;
  try {
    stats = await io.lstat(lockPath);
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
    metadata = JSON.parse((await io.readFile(lockPath, "utf8")).toString());
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

export async function inspectLock(lockPath) {
  return inspectLockWithIo(lockPath, REAL_IO);
}

function describeIoError(error) {
  return {
    code: error?.code ?? "ERROR",
    message: error?.message ?? String(error),
  };
}

function attachCleanupEvidence(error, evidence) {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return;
  try {
    const existing = error.details && typeof error.details === "object" && !Array.isArray(error.details)
      ? error.details
      : {};
    error.details = { ...existing, cleanup: evidence };
  } catch {
    // Preserve the original setup failure even when its shape is immutable.
  }
}

async function cleanupCreatedLock(lockPath, metadata, io) {
  if (!metadata?.token) return { attempted: false, skipped: "metadata-unavailable" };
  try {
    const stats = await io.lstat(lockPath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return { attempted: false, skipped: "unsafe-type" };
    }
    let current;
    try {
      current = JSON.parse((await io.readFile(lockPath, "utf8")).toString());
    } catch {
      return { attempted: false, skipped: "metadata-unreadable" };
    }
    if (!current || current.token !== metadata.token) {
      return { attempted: false, skipped: "token-mismatch" };
    }
    try {
      await io.unlink(lockPath);
      return { attempted: true, removed: true };
    } catch (error) {
      return { attempted: true, removed: false, failure: describeIoError(error) };
    }
  } catch (error) {
    if (error?.code === "ENOENT") return { attempted: false, skipped: "missing" };
    return { attempted: false, failure: describeIoError(error) };
  }
}

function mergeIoOverrides(overrides) {
  if (overrides === undefined || overrides === null) return { ...REAL_IO };
  if (typeof overrides !== "object") throw new TypeError("lock I/O overrides must be an object");
  const merged = { ...REAL_IO };
  for (const key of IO_KEYS) {
    if (Object.hasOwn(overrides, key)) merged[key] = overrides[key];
  }
  return merged;
}

async function acquireExclusiveLockWithIo(lockPath, io) {
  let handle;
  let created = false;
  let metadata;
  try {
    handle = await io.open(lockPath, "wx", 0o600);
    created = true;
    metadata = {
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
        let stats;
        try {
          stats = await io.lstat(lockPath);
        } catch (error) {
          throw lockError("LOCK_LOST", `lock owner token cannot be verified at ${lockPath}`, { cause: error?.code ?? "MISSING" });
        }
        if (stats.isSymbolicLink() || !stats.isFile()) {
          throw lockError("LOCK_LOST", `lock owner token cannot be verified at ${lockPath}`, { cause: "UNSAFE_TYPE" });
        }
        let current;
        try {
          current = JSON.parse((await io.readFile(lockPath, "utf8")).toString());
        } catch (error) {
          throw lockError("LOCK_LOST", `lock owner token cannot be verified at ${lockPath}`, { cause: error?.code ?? "MALFORMED" });
        }
        if (!current || current.token !== metadata.token) {
          throw lockError("LOCK_LOST", `lock owner token changed at ${lockPath}`, { cause: "TOKEN_MISMATCH" });
        }
        try {
          await io.unlink(lockPath);
        } catch (error) {
          if (error?.code === "ENOENT") {
            throw lockError("LOCK_LOST", `lock owner token disappeared at ${lockPath}`, { cause: "MISSING" });
          }
          throw error;
        }
        released = true;
      },
    };
  } catch (error) {
    if (!created) {
      if (error?.code === "EEXIST") {
        throw lockError("LOCK_ACTIVE", `lock is already active at ${lockPath}`, await inspectLockWithIo(lockPath, io));
      }
      throw error;
    }

    let closeFailure = null;
    if (handle) {
      try {
        await handle.close();
      } catch (closeError) {
        closeFailure = closeError;
      }
      handle = undefined;
    }
    const cleanup = await cleanupCreatedLock(lockPath, metadata, io);
    if (closeFailure || cleanup.failure) {
      attachCleanupEvidence(error, {
        ...(closeFailure ? { close: describeIoError(closeFailure) } : {}),
        ...(cleanup.failure ? { path: cleanup.failure } : {}),
        ...(cleanup.attempted !== undefined ? { attempted: cleanup.attempted } : {}),
        ...(cleanup.removed !== undefined ? { removed: cleanup.removed } : {}),
        ...(cleanup.skipped ? { skipped: cleanup.skipped } : {}),
      });
    }
    throw error;
  }
}

export async function acquireExclusiveLock(lockPath) {
  return acquireExclusiveLockWithIo(lockPath, REAL_IO);
}

export async function __acquireExclusiveLockForTest(lockPath, overrides = undefined) {
  return acquireExclusiveLockWithIo(lockPath, mergeIoOverrides(overrides));
}

export async function withExclusiveLock(lockPath, callback) {
  const lock = await acquireExclusiveLock(lockPath);
  try {
    return await callback(lock);
  } finally {
    await lock.release();
  }
}
