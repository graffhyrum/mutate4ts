import type { MutationOutcome, MutationResult } from "./execute.ts";

function exitCodeFor(results: readonly MutationResult[]): 0 | 1 | 3 {
  return results.reduce<0 | 1 | 3>(
    (max, r) =>
      OUTCOME_EXIT_CODE[r.outcome.status] > max ? OUTCOME_EXIT_CODE[r.outcome.status] : max,
    0,
  );
}

// Rationale for each code: docs/adr/0001-mutation-exit-codes.md
const OUTCOME_EXIT_CODE: Record<MutationOutcome["status"], 0 | 1 | 3> = {
  killed: 0,
  survived: 1,
  timeout: 0,
  error: 3,
};

export { OUTCOME_EXIT_CODE, exitCodeFor };
