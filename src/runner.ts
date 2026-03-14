type RunResult = {
  readonly exitCode: number;
  readonly timedOut: boolean;
};

function runTestCommand(command: string, timeoutMs: number): RunResult {
  const parts = command.split(" ");
  const result = Bun.spawnSync(parts, { timeout: timeoutMs });
  return {
    exitCode: result.exitCode,
    timedOut: result.exitedDueToTimeout ?? false,
  };
}

export { runTestCommand };
export type { RunResult };
