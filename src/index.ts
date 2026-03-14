import { parseCliOptions } from "./cli.ts";
import type { ResolvedOptions } from "./cli.ts";
import { scanFile, readFile } from "./scan.ts";
import { runBaseline } from "./baseline.ts";
import { executeMutations } from "./execute.ts";
import type { MutationResult } from "./execute.ts";
import { formatReport } from "./report.ts";
import type { MutationSite } from "./mutations/registry.ts";

async function main(): Promise<void> {
  const opts = parseCliOptions(Bun.argv);
  validateSourceFile(opts.sourceFile);
  const sites = await scanFile(opts.sourceFile, opts.lines);
  if (opts.scan) return printScanResults(sites);
  return runMutationTesting(opts, sites);
}

function validateSourceFile(filePath: string): void {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx"))
    throw new Error(`File must be a .ts or .tsx file: ${filePath}`);
}

function printScanResults(sites: readonly MutationSite[]): void {
  console.log(`Found ${sites.length} mutation sites:\n`);
  for (const site of sites) printSite(site);
}

function printSite(site: MutationSite): void {
  console.log(`  ${site.filePath}:${site.line}:${site.column} ${site.description}`);
}

async function runMutationTesting(
  opts: ResolvedOptions,
  sites: readonly MutationSite[],
): Promise<void> {
  if (sites.length === 0) return console.log("No mutation sites found.");
  const original = await readFile(opts.sourceFile);
  const baseline = runBaseline(opts.testCommand);
  const timeoutMs = Math.max(baseline.durationMs * opts.timeoutFactor, 5000);
  const results = await executeMutations({
    sites,
    originalSource: original,
    testCommand: opts.testCommand,
    timeoutMs,
    onProgress: opts.verbose ? verboseProgress : defaultProgress,
  });
  console.log(`\n${formatReport(results)}`);
  exitWithScore(results);
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

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
