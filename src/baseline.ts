import { Data, Effect } from "effect";
import { runTestCommand } from "./runner.ts";

type BaselineResult = {
  readonly durationMs: number;
};

class BaselineFailedError extends Data.TaggedError("BaselineFailedError")<{
  exitCode: number;
}> {}

class SpawnError extends Data.TaggedError("SpawnError")<{ cause: unknown }> {}

function runBaseline(
  testCommand: readonly string[],
  timeoutMs = 120_000,
): Effect.Effect<BaselineResult, BaselineFailedError | SpawnError> {
  const start = performance.now();
  return Effect.try({
    try: () => runTestCommand(testCommand, timeoutMs),
    catch: (cause) => new SpawnError({ cause }),
  }).pipe(
    Effect.flatMap((result) =>
      result.exitCode !== 0
        ? Effect.fail(new BaselineFailedError({ exitCode: result.exitCode }))
        : Effect.succeed({ durationMs: performance.now() - start }),
    ),
  );
}

export { runBaseline, BaselineFailedError, SpawnError };
export type { BaselineResult };
