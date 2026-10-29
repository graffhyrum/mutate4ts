import type { MutationOutcome, MutationResult } from "./execute.ts";

function exitCodeFor(results: readonly MutationResult[]): 0 | 1 {
  return results.reduce<0 | 1>(
    (max, r) => (OUTCOME_EXIT_CODE[r.outcome.status] > max ? 1 : max),
    0,
  );
}

// Open question: timeouts and errors count as failures for now. Flip them by editing this table only.
const OUTCOME_EXIT_CODE: Record<MutationOutcome["status"], 0 | 1> = {
  killed: 0,
  survived: 1,
  timeout: 1,
  error: 1,
};

export { OUTCOME_EXIT_CODE, exitCodeFor };
