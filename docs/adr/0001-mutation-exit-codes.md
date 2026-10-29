# 0001: Mutation exit codes

## Status

Accepted, 2026-10-29.

## Context

In v1, usage errors (bad arguments) exited `1`, the same code as surviving mutants. A caller could not tell "your tests are weak" from "you called the tool wrong". Timed-out and errored mutations exited `0`, so a run where nothing could be evaluated still looked like a pass.

## Decision

| Code  | Meaning                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------- |
| `0`   | Every mutation was detected (killed or timed out)                                                        |
| `1`   | One or more mutations survived                                                                           |
| `2`   | Fatal: bad arguments, missing file, baseline failure. Nothing was measured                               |
| `3`   | The run finished, but one or more mutations errored (for example, the test command could not be spawned) |
| `130` | Interrupted (SIGINT)                                                                                     |

- A timed-out mutation counts as killed. The mutant made the tests hang, so the tests detected it. It counts in the Mutation Score as `(killed + timeout) / total`.
- An errored mutation is not killed. The score is incomplete, so the run exits `3`.
- When a run has several outcomes, the exit code is the highest mapped code. Survivors plus errors exit `3`. The report still lists both.
- `3` is not shared with `2`. Code `2` means nothing was measured. Code `3` means the run finished but some mutants could not be evaluated. Callers can tell the two apart.

## Consequences

- This is a breaking change. It ships as a major version.
- Callers that treated `1` as a usage error must check for `2` instead.
- CI gates should fail on any non-zero code.
- The mapping lives only in `src/exit-code.ts`.
