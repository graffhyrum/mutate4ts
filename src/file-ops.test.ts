import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { FileError, RestoreError, restoreOriginal } from "./file-ops.ts";

test("restoreOriginal fails with RestoreError when the path cannot be written", async () => {
  const dir = mkdtempSync(join(tmpdir(), "file-ops-"));
  try {
    const failure = await Effect.runPromise(Effect.flip(restoreOriginal(dir, "original")));
    expect(failure).toBeInstanceOf(RestoreError);
    expect(failure.message).toContain(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("FileError message joins the path and an Error cause", () => {
  const err = new FileError({ path: "a.ts", cause: new Error("denied") });
  expect(err.message).toBe("a.ts: denied");
});

test("FileError message stringifies a non-Error cause", () => {
  const err = new FileError({ path: "a.ts", cause: "gone" });
  expect(err.message).toBe("a.ts: gone");
});
