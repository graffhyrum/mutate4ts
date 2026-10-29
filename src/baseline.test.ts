import { test, expect } from "bun:test";
import { Effect } from "effect";
import { BaselineFailedError, SpawnError, runBaseline } from "./baseline.ts";

test("a passing command gives its duration", async () => {
  const result = await Effect.runPromise(runBaseline(["true"]));
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
});

test("a failing command fails with BaselineFailedError and its exit code", async () => {
  const failure = await Effect.runPromise(Effect.flip(runBaseline(["false"])));
  expect(failure).toBeInstanceOf(BaselineFailedError);
  expect(failure).toMatchObject({ exitCode: 1 });
});

test("a command that cannot be spawned fails with SpawnError naming the command", async () => {
  const failure = await Effect.runPromise(
    Effect.flip(runBaseline(["mutate4ts-no-such-binary", "x"])),
  );
  expect(failure).toBeInstanceOf(SpawnError);
  expect(failure.message).toContain("could not run mutate4ts-no-such-binary x");
});
