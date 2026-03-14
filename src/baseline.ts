import { runTestCommand } from "./runner.ts";

type BaselineResult = {
  readonly durationMs: number;
};

function runBaseline(testCommand: string): BaselineResult {
  const start = performance.now();
  const result = runTestCommand(testCommand, 120_000);
  const durationMs = performance.now() - start;
  if (result.exitCode !== 0)
    throw new Error(`Baseline tests failed with exit code ${result.exitCode}`);
  return { durationMs };
}

export { runBaseline };
export type { BaselineResult };
