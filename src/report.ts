import type { MutationResult } from "./execute.ts";

function formatReport(results: readonly MutationResult[]): string {
  const lines = results.map(formatResult);
  return [...lines, "", formatSummary(results)].join("\n");
}

function formatResult(result: MutationResult): string {
  const loc = `${result.site.filePath}:${result.site.line}`;
  const status = result.outcome.status.toUpperCase();
  return `  ${status.padEnd(9)} ${loc} ${result.site.description}`;
}

function formatSummary(results: readonly MutationResult[]): string {
  const killed = count(results, "killed");
  const survived = count(results, "survived");
  const timeout = count(results, "timeout");
  const uncovered = count(results, "uncovered");
  const errors = count(results, "error");
  const tested = results.length - uncovered;
  const score = tested > 0 ? ((killed / tested) * 100).toFixed(1) : "0.0";
  return [
    `Mutation Score: ${score}%`,
    `  ${killed} killed, ${survived} survived, ${timeout} timed out, ${uncovered} uncovered, ${errors} errors`,
    `  ${results.length} total mutations`,
  ].join("\n");
}

function count(results: readonly MutationResult[], status: string): number {
  return results.filter((r) => r.outcome.status === status).length;
}

export { formatReport, formatSummary };
