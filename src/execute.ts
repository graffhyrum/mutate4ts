import { Effect } from "effect";
import type { MutationSite } from "./mutations/registry.ts";
import { applyMutation } from "./apply.ts";
import { writeTemporaryMutation, restoreOriginal } from "./file-ops.ts";
import type { FileError } from "./file-ops.ts";
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

function executeMutations(opts: ExecuteOptions): Effect.Effect<readonly MutationResult[], never> {
  return Effect.forEach(
    Array.from(opts.sites.entries()),
    ([index, site]) =>
      runSingleMutation(opts, site).pipe(
        Effect.tap((r) => Effect.sync(() => opts.onProgress(index + 1, opts.sites.length, r))),
        Effect.catchAll((err) => Effect.succeed(buildErrorResult(site, err))),
      ),
    { concurrency: 1 },
  );
}

function runSingleMutation(
  opts: ExecuteOptions,
  site: MutationSite,
): Effect.Effect<MutationResult, FileError> {
  const mutated = applyMutation(opts.originalSource, site.span, site.mutatedText);
  return Effect.acquireUseRelease(
    writeTemporaryMutation(opts.filePath, mutated),
    () => useMutation(opts, site),
    (_res, _exit) => Effect.uninterruptible(releaseMutation(opts.filePath, opts.originalSource)),
  );
}

function useMutation(
  opts: ExecuteOptions,
  site: MutationSite,
): Effect.Effect<MutationResult, never> {
  return Effect.sync(() => {
    try {
      const start = performance.now();
      const r = classifyRun(opts.testCommand, opts.timeoutMs);
      return { site, ...r, durationMs: performance.now() - start };
    } catch (err) {
      return buildErrorResult(site, err);
    }
  });
}

function releaseMutation(filePath: string, original: string): Effect.Effect<void, never> {
  return restoreOriginal(filePath, original).pipe(Effect.catchAll(Effect.die));
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

function buildErrorResult(site: MutationSite, err: unknown): MutationResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    site,
    outcome: { status: "error", message },
    durationMs: 0,
    testOutput: "",
  };
}

export { executeMutations };
export type { MutationOutcome, MutationResult, ExecuteOptions };
