# 0001: Mutation exit codes

## Status

Accepted, 2026-10-29.

## Context

In v1, usage errors (bad arguments) exited `1`, the same code as surviving mutants. A caller could not tell "your tests are weak" from "you called the tool wrong". Timed-out and errored mutations exited `0`, so a run where nothing could be evaluated still looked like a pass.

## Decision

| Code  | Meaning                                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `0`   | Every mutation was detected (killed or timed out)                                                                                         |
| `1`   | One or more mutations survived                                                                                                            |
| `2`   | Fatal before any mutation result: bad arguments, missing or unreadable file, baseline failure, or an unexpected internal error. No report |
| `3`   | The run finished, but one or more mutations errored (for example, the test command could not be spawned)                                  |
| `4`   | Fatal: restoring the source file failed; the file may still contain a mutation. Restore it before using it.                               |
| `130` | Interrupted (SIGINT)                                                                                                                      |

`--help` and `--scan` exit `0` on success without running any tests, so a `0` from them does not mean mutations were detected. `--scan` on a missing file still exits `2`.

- A timed-out mutation counts as killed. The mutant made the tests hang, so the tests detected it. It counts in the Mutation Score as `(killed + timeout) / total`.
- An errored mutation is not killed. The score is incomplete, so the run exits `3`.
- When a run has several outcomes, the exit code is the highest mapped code. Survivors plus errors exit `3`. The report still lists both.
- `3` is not shared with `2`. Code `2` means nothing was measured. Code `3` means the run finished but some mutants could not be evaluated. Callers can tell the two apart.
- `4` is not shared with `2` or `3`. Code `2` means nothing was measured, and code `3` means the run finished. After a failed restore the run stops, and the source file may still contain a mutation. Callers must know to repair the file (for example from version control) before they use it, so this case needs its own code. Code `4` covers only a failed restore. A failure while writing the mutant itself is reported as an errored mutation (`3`). Then the release step does not run, because `acquireUseRelease` skips it when the acquire step fails, so a partial write can stay in the file until the restore of a later mutation rewrites the original; after the last mutation nothing rewrites it.

## Consequences

- This is a breaking change. It ships as a major version.
- Callers that treated `1` as a usage error must check for `2` instead.
- CI gates should fail on any non-zero code.
- The mapping lives only in `src/exit-code.ts`.
