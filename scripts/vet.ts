type Step = {
  readonly label: string;
  readonly argv: readonly string[];
};

type Capture = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

const steps: readonly Step[] = [
  { label: "fmt", argv: ["bun", "run", "fmt"] },
  { label: "typecheck", argv: ["bun", "run", "typecheck"] },
  { label: "lint", argv: ["bun", "run", "lint"] },
  { label: "rule-validator", argv: ["bun", "run", "rule-validator"] },
  { label: "stepdown", argv: ["bun", "run", "stepdown"] },
  { label: "test:coverage", argv: ["bun", "run", "test:coverage"] },
];

await runGate(steps);

async function runGate(gateSteps: readonly Step[]): Promise<void> {
  for (const step of gateSteps) {
    await runStep(step);
  }
  process.exit(0);
}

async function runStep(step: Step): Promise<void> {
  const result = await capture(step.argv);
  if (result.exitCode === 0) return;
  reportFailure(step.label, result);
  process.exit(result.exitCode);
}

async function capture(argv: readonly string[]): Promise<Capture> {
  const proc = Bun.spawn([...argv], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await readStream(proc.stdout);
  const stderr = await readStream(proc.stderr);
  const exitCode = await proc.exited;
  return { exitCode: normalizeExitCode(exitCode), stdout, stderr };
}

function normalizeExitCode(exitCode: number | null): number {
  if (exitCode === null) return 1;
  return exitCode;
}

async function readStream(
  stream: ReadableStream<Uint8Array> | number | null | undefined,
): Promise<string> {
  if (stream == null || typeof stream === "number") return "";
  return new Response(stream).text();
}

function reportFailure(label: string, result: Capture): void {
  process.stderr.write(`vet: step "${label}" failed (exit ${result.exitCode})\n`);
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
}
