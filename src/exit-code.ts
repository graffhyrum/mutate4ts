import { Cause } from "effect";
import type { MutationOutcome, MutationResult } from "./execute.ts";
import { RestoreError } from "./file-ops.ts";
import { describeFailure } from "./describe-failure.ts";

type ExitCode = 0 | 1 | 2 | 3 | 4;

function exitCodeFor(results: readonly MutationResult[]): ExitCode {
  return results.map((r) => OUTCOME_EXIT_CODE[r.outcome.status]).reduce(higher, 0);
}

type FatalOutcome = { readonly exitCode: ExitCode | 130; readonly message: string | null };

// Exit code and stderr line for a failure that ends the run before a report is printed.
// A failed restore is checked before the interrupt: SIGINT can interrupt a run whose restore
// then fails, and that file must still be named.
function fatalOutcome(cause: Cause.Cause<unknown>): FatalOutcome {
  const restoreError = findRestoreError(cause);
  if (restoreError) return { exitCode: 4, message: `Error: ${describeFailure(restoreError)}` };
  if (Cause.isInterrupted(cause)) return { exitCode: 130, message: null };
  return { exitCode: 2, message: `Error: ${describeFailure(Cause.squash(cause))}` };
}

function findRestoreError(cause: Cause.Cause<unknown>): RestoreError | undefined {
  return [...Cause.defects(cause), ...Cause.failures(cause)].find(
    (e): e is RestoreError => e instanceof RestoreError,
  );
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

export { exitCodeFor, fatalOutcome };
export type { FatalOutcome };
