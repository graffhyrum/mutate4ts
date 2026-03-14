import { runTestCommand } from "./runner.ts";

type BaselineResult = {
  readonly durationMs: number;
};

function runBaseline(testCommand: readonly string[], timeoutMs = 120_000): BaselineResult {
  const start = performance.now();
  const result = runTestCommand(testCommand, timeoutMs);
  const durationMs = performance.now() - start;
  if (result.exitCode !== 0)
    throw new Error(`Baseline tests failed with exit code ${result.exitCode}`);
  return { durationMs };
}

export { runBaseline };
export type { BaselineResult };
