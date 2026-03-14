type RunResult = {
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly stdout: string;
  readonly stderr: string;
};

function runTestCommand(command: readonly string[], timeoutMs: number): RunResult {
  const result = Bun.spawnSync([...command], { timeout: timeoutMs });
  return {
    exitCode: result.exitCode,
    timedOut: result.exitedDueToTimeout ?? false,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

export { runTestCommand };
export type { RunResult };
