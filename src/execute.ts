import type { MutationSite } from "./mutations/registry.ts";
import { applyMutation } from "./apply.ts";
import { writeTemporaryMutation, restoreOriginal } from "./file-ops.ts";
import { runTestCommand } from "./runner.ts";

type MutationOutcome =
  | { readonly status: "killed"; readonly exitCode: number }
  | { readonly status: "survived" }
  | { readonly status: "timeout"; readonly timeoutMs: number }
  | { readonly status: "error"; readonly message: string };

type MutationResult = {
  readonly site: MutationSite;
  readonly outcome: MutationOutcome;
  readonly durationMs: number;
  readonly testOutput: string;
};

type ExecuteOptions = {
  readonly sites: readonly MutationSite[];
  readonly filePath: string;
  readonly originalSource: string;
  readonly testCommand: readonly string[];
  readonly timeoutMs: number;
  readonly onProgress: (current: number, total: number, result: MutationResult) => void;
};

async function executeMutations(opts: ExecuteOptions): Promise<readonly MutationResult[]> {
  const results: MutationResult[] = [];
  const { filePath } = opts;
  const handler = () => restoreOriginal(filePath, opts.originalSource);
  process.on("SIGINT", handler);
  try {
    for (let i = 0; i < opts.sites.length; i++) {
      const result = await runSingleMutation(opts, opts.sites[i], filePath);
      results.push(result);
      opts.onProgress(i + 1, opts.sites.length, result);
    }
  } finally {
    await restoreOriginal(filePath, opts.originalSource);
    process.removeListener("SIGINT", handler);
  }
  return results;
}

async function runSingleMutation(
  opts: ExecuteOptions,
  site: MutationSite,
  filePath: string,
): Promise<MutationResult> {
  const mutated = applyMutation(opts.originalSource, site.span, site.mutatedText);
  await writeTemporaryMutation(filePath, mutated);
  const start = performance.now();
  try {
    const { outcome, testOutput } = classifyRun(opts.testCommand, opts.timeoutMs);
    return { site, outcome, durationMs: performance.now() - start, testOutput };
  } catch (err) {
    return buildErrorResult(site, start, err);
  }
}

function classifyRun(
  testCommand: readonly string[],
  timeoutMs: number,
): { outcome: MutationOutcome; testOutput: string } {
  const run = runTestCommand(testCommand, timeoutMs);
  const testOutput = [run.stdout, run.stderr].filter(Boolean).join("\n").trim();
  if (run.timedOut) return { outcome: { status: "timeout", timeoutMs }, testOutput };
  if (run.exitCode !== 0)
    return { outcome: { status: "killed", exitCode: run.exitCode }, testOutput };
  return { outcome: { status: "survived" }, testOutput };
}

function buildErrorResult(site: MutationSite, start: number, err: unknown): MutationResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    site,
    outcome: { status: "error", message },
    durationMs: performance.now() - start,
    testOutput: "",
  };
}

export { executeMutations };
export type { MutationOutcome, MutationResult, ExecuteOptions };
