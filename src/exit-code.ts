import type { MutationOutcome, MutationResult } from "./execute.ts";

type ExitCode = 0 | 1 | 3;

function exitCodeFor(results: readonly MutationResult[]): ExitCode {
  return results.map((r) => OUTCOME_EXIT_CODE[r.outcome.status]).reduce(higher, 0);
}

function higher(a: ExitCode, b: ExitCode): ExitCode {
  return b > a ? b : a;
}

// Rationale for each code: docs/adr/0001-mutation-exit-codes.md
const OUTCOME_EXIT_CODE: Record<MutationOutcome["status"], ExitCode> = {
  killed: 0,
  survived: 1,
  timeout: 0,
  error: 3,
};

export { exitCodeFor };
