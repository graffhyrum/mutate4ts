import type { MutationOutcome, MutationResult } from "./execute.ts";
import { RestoreError } from "./file-ops.ts";

type ExitCode = 0 | 1 | 2 | 3 | 4;

function exitCodeFor(results: readonly MutationResult[]): ExitCode {
  return results.map((r) => OUTCOME_EXIT_CODE[r.outcome.status]).reduce(higher, 0);
}

// Exit code for a failure that ends the run before a report is printed.
function fatalExitCode(failure: unknown): ExitCode {
  return failure instanceof RestoreError ? 4 : 2;
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

export { exitCodeFor, fatalExitCode };
