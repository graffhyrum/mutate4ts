import { Cause, Effect, Exit, Fiber } from "effect";
import { parseCliOptions } from "./cli.ts";
import type { ResolvedOptions } from "./cli.ts";
import { scanFile, readFile } from "./scan.ts";
import type { ScanError } from "./scan.ts";
import { runBaseline } from "./baseline.ts";
import type { BaselineFailedError, SpawnError } from "./baseline.ts";
import { executeMutations } from "./execute.ts";
import type { MutationResult } from "./execute.ts";
import type { FileError } from "./file-ops.ts";
import { formatReport } from "./report.ts";
import type { MutationSite } from "./mutations/registry.ts";

function main(): void {
  const opts = parseCliOptions(Bun.argv);
  validateSourceFile(opts.sourceFile);
  const program = opts.scan ? buildScanProgram(opts) : buildTestProgram(opts);
  const fiber = Effect.runFork(program);
  let interrupted = false;
  process.on("SIGINT", () => {
    if (interrupted) return;
    interrupted = true;
    Effect.runFork(Fiber.interrupt(fiber));
  });
  fiber.addObserver((exit) => {
    if (!Exit.isFailure(exit)) return;
    if (Cause.isInterrupted(exit.cause)) {
      process.exit(130);
    } else {
      console.error(Cause.squash(exit.cause));
      process.exit(2);
    }
  });
}

function validateSourceFile(filePath: string): void {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx"))
    throw new Error(`File must be a .ts or .tsx file: ${filePath}`);
}

function buildScanProgram(opts: ResolvedOptions): Effect.Effect<void, ScanError> {
  return scanFile(opts.sourceFile, opts.lines).pipe(Effect.map(printScanResults));
}

function buildTestProgram(
  opts: ResolvedOptions,
): Effect.Effect<void, FileError | ScanError | BaselineFailedError | SpawnError> {
  return Effect.gen(function* () {
    const sites = yield* scanFile(opts.sourceFile, opts.lines);
    if (sites.length === 0) {
      yield* Effect.sync(() => console.log("No mutation sites found."));
      return;
    }
    yield* runMutationTesting(opts, sites);
  });
}

function runMutationTesting(
  opts: ResolvedOptions,
  sites: readonly MutationSite[],
): Effect.Effect<void, FileError | ScanError | BaselineFailedError | SpawnError> {
  return Effect.gen(function* () {
    const original = yield* readFile(opts.sourceFile);
    const command = opts.testCommand.split(" ");
    const baseline = yield* runBaseline(command);
    yield* runMutations(opts, sites, original, command, baseline.durationMs);
  });
}

function runMutations(
  opts: ResolvedOptions,
  sites: readonly MutationSite[],
  original: string,
  command: string[],
  baselineDurationMs: number,
): Effect.Effect<void, FileError> {
  const timeoutMs = Math.max(baselineDurationMs * opts.timeoutFactor, 5000);
  return executeMutations({
    sites,
    filePath: opts.sourceFile,
    originalSource: original,
    testCommand: command,
    timeoutMs,
    onProgress: opts.verbose ? verboseProgress : defaultProgress,
  }).pipe(
    Effect.map((results) => {
      console.log(`\n${formatReport(results)}`);
      exitWithScore(results);
    }),
  );
}

function printScanResults(sites: readonly MutationSite[]): void {
  console.log(`Found ${sites.length} mutation sites:\n`);
  for (const site of sites) printSite(site);
}

function printSite(site: MutationSite): void {
  console.log(`  ${site.filePath}:${site.line}:${site.column} ${site.description}`);
}

function defaultProgress(current: number, total: number, result: MutationResult): void {
  const status = result.outcome.status.toUpperCase();
  const loc = `${result.site.filePath}:${result.site.line}`;
  console.log(`[${current}/${total}] ${status} ${loc} ${result.site.description}`);
}

function verboseProgress(current: number, total: number, result: MutationResult): void {
  defaultProgress(current, total, result);
  console.log(`  - ${result.site.originalText}`);
  console.log(`  + ${result.site.mutatedText}`);
  if (result.testOutput) console.log(indent(result.testOutput));
  console.log();
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

function exitWithScore(results: readonly MutationResult[]): void {
  const survived = results.some((r) => r.outcome.status === "survived");
  process.exit(survived ? 1 : 0);
}

main();
