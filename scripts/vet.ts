import { capture, type Capture } from "./capture.ts";

type Step = {
  readonly label: string;
  readonly argv: readonly string[];
};

const steps: readonly Step[] = [
  { label: "fmt", argv: ["bun", "run", "fmt"] },
  { label: "audit", argv: ["bun", "audit"] },
  { label: "typecheck", argv: ["bun", "run", "typecheck"] },
  { label: "lint", argv: ["bun", "run", "lint"] },
  { label: "rule-validator", argv: ["bun", "run", "rule-validator"] },
  { label: "stepdown", argv: ["bun", "run", "stepdown"] },
  { label: "crap4ts", argv: ["bun", "run", "crap4ts"] },
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

function reportFailure(label: string, result: Capture): void {
  process.stderr.write(`vet: step "${label}" failed (exit ${result.exitCode})\n`);
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
}
