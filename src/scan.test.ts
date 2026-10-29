import { test, expect } from "bun:test";
import { join } from "node:path";
import { Effect } from "effect";
import { ScanError, scanFile } from "./scan.ts";

const sample = join(import.meta.dir, "..", "test", "fixtures", "sample.ts");

test("scanFile finds mutation sites in a file", async () => {
  const sites = await Effect.runPromise(scanFile(sample));
  expect(sites.length).toBeGreaterThan(0);
});

test("scanFile keeps only the requested lines", async () => {
  const sites = await Effect.runPromise(scanFile(sample, [2]));
  expect(sites.length).toBeGreaterThan(0);
  expect(sites.every((s) => s.line === 2)).toBe(true);
});

test("a missing file fails with ScanError naming the path", async () => {
  const path = join(import.meta.dir, "does-not-exist.ts");
  const failure = await Effect.runPromise(Effect.flip(scanFile(path)));
  expect(failure).toBeInstanceOf(ScanError);
  expect(failure.message).toContain(path);
});
