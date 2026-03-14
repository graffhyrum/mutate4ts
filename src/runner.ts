type RunResult = {
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly stdout: string;
  readonly stderr: string;
};

function runTestCommand(command: string, timeoutMs: number): RunResult {
  const parts = command.split(" ");
  const result = Bun.spawnSync(parts, { timeout: timeoutMs });
  return {
    exitCode: result.exitCode,
    timedOut: result.exitedDueToTimeout ?? false,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

export { runTestCommand };
export type { RunResult };
