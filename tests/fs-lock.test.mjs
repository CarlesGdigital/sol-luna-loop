import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, open as openReal, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as fsLock from "../scripts/lib/fs-lock.mjs";

const { acquireExclusiveLock } = fsLock;

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function withRoot(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "sll-fs-lock-test-"));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("release retries after a replacement token is restored", async () => {
  await withRoot(async (root) => {
    const agents = path.join(root, ".codex", "agents");
    await mkdir(agents, { recursive: true });
    const lockPath = path.join(agents, ".sol-luna-loop.lock");
    const lock = await acquireExclusiveLock(lockPath);
    const originalBytes = await readFile(lockPath);
    const replacementBytes = Buffer.from('{"pid":99999,"token":"replacement-owner-token"}\n');

    await writeFile(lockPath, replacementBytes);
    await assert.rejects(
      () => lock.release(),
      (error) => {
        assert.equal(error?.code, "LOCK_LOST");
        return true;
      },
    );
    assert.deepEqual(await readFile(lockPath), replacementBytes);

    await writeFile(lockPath, originalBytes);
    await lock.release();
    assert.equal(await exists(lockPath), false);
  });
});

test("failed exclusive acquisition removes a partially initialized lock", async () => {
  await withRoot(async (root) => {
    const agents = path.join(root, ".codex", "agents");
    await mkdir(agents, { recursive: true });
    const lockPath = path.join(agents, ".sol-luna-loop.lock");
    const syncFailure = new Error("stable sync sentinel");
    const open = async (...args) => {
      const realHandle = await openReal(...args);
      return {
        writeFile: (...writeArgs) => realHandle.writeFile(...writeArgs),
        sync: async () => {
          await realHandle.sync();
          throw syncFailure;
        },
        close: (...closeArgs) => realHandle.close(...closeArgs),
      };
    };

    assert.equal(
      typeof fsLock.__acquireExclusiveLockForTest,
      "function",
      "the narrow lock test seam must be exported before the production implementation",
    );
    await assert.rejects(
      () => fsLock.__acquireExclusiveLockForTest(lockPath, { open }),
      (error) => {
        assert.strictEqual(error, syncFailure);
        return true;
      },
    );
    assert.equal(await exists(lockPath), false);

    const lock = await acquireExclusiveLock(lockPath);
    await lock.release();
    assert.equal(await exists(lockPath), false);
  });
});
