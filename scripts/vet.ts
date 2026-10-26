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
    const ok = await runStep(step);
    if (!ok) return;
  }
}

async function runStep(step: Step): Promise<boolean> {
  const result = await capture(step.argv);
  if (result.exitCode === 0) return true;
  reportFailure(step.label, result);
  process.exitCode = result.exitCode;
  return false;
}

async function capture(argv: readonly string[]): Promise<Capture> {
  const proc = Bun.spawn([...argv], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
    proc.exited,
  ]);
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
