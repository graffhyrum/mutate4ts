# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
bun test                   # run tests
bun test --watch           # watch mode
bun test --coverage        # with coverage (sets AGENT=1)
bun run typecheck          # bun check (needs Bun 1.4.4)
bun run lint               # oxlint type-aware rules
bun run lint:fix           # oxlint with auto-fix
bun run fmt                # bun fmt
bun run fmt:check          # bun fmt --check
bun run vet                # full gate: fmt → audit → typecheck → lint → rule-validator → stepdown → crap4ts → test:coverage (quiet on success)
bun run stepdown           # enforce stepdown rule across src/
bun run crap4ts            # coverage + CRAP score gate (crap4ts on lcov)
bun run build              # tsc → dist/
```

Single test file: `bun test src/path/to/file.test.ts`

## Runtime

Bun is the runtime — not Node. Use `Bun.file`, `Bun.$`, `bun:sqlite`, etc. instead of Node equivalents.

## Toolchain

- **Coverage**: `bunfig.toml` sets a 0.95 threshold (funcs and lines). Only `.cursor/hooks/vet-stop.ts` (process I/O) is ignored there; `test/vet-stop.test.ts` tests it by spawning it. The pure logic in `.cursor/hooks/vet-stop-lib.ts` is counted by coverage.
- **Agent hook**: Cursor/Grok Stop hook (`.cursor/hooks.json`, `.grok/hooks/vet-stop.json`) runs `bun run vet` after each agent turn. Env: `MUTATE4TS_VET_CMD` (override command; split on whitespace, quoted arguments are not supported), `MUTATE4TS_VET_TIMEOUT_MS` (vet timeout, positive integer, capped at 2147483647 ms, default 280000), `MUTATE4TS_VET_SKIP_NO_CODE=1` (skip when no code paths changed), `MUTATE4TS_VET_SCRUB_ENV=1` (redact secrets in output). Stdin that is over 1 MiB (a size check after all of stdin is read, not a memory cap), not JSON or not a stop payload is logged to stderr and the gate runs anyway. Grok sends `stopHookActive` after one block, so Grok gets one fix-up round per stop; Cursor gets up to `loop_limit` (5) rounds.
- **Audit in vet**: the `audit` step (plain `bun audit`) needs network and fails on any new advisory, including ones published after merge. Offline, or with a fresh advisory, the gate fails and blocks the Stop hook until the network is back or the advisory is addressed (dependency bump or documented exception). Grok gets one fix-up round; Cursor gets up to `loop_limit` (5).
- **Formatter**: `bun fmt` (Bun 1.4.4). Reads `.oxfmtrc.json`.
- **Typecheck**: `bun check` (Bun 1.4.4). The `typescript` dependency stays for the compiler API.
- **Linter**: `oxlint` with type-aware checks via `oxlint-tsgolint`.
- **Validation**: `arktype` — use `type("string.json.parse").to(schema)` at system boundaries, never raw `JSON.parse`
- **TypeScript compiler**: `@typescript/native-preview` (peer dep — the native TS compiler)

## Architecture

Early-stage project. Source lives in `src/`, compiled output in `dist/`. The `vet` script is the canonical pre-commit quality gate.

## Toolkit

| Tool | Purpose                      | Key constraint                                                                     |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------- |
| bd   | Issue tracker + triage       | `bd prime` at session start; `git push` at session end (Dolt auto-commits locally) |
| ms   | Skill discovery              | `ms suggest --machine --cwd .` at session start                                    |
| cass | Session search (episodic)    | `cass search "<q>" --json --limit 5`                                               |
| s2p  | Source→prompt bundler        | TUI only; do not run headless                                                      |
| toon | Token codec (40-60% savings) | Pipe: `--format toon \| toon -d`                                                   |
| ubs  | Security scanner             | `ubs --diff .` before commits                                                      |

All tools support `--help`.
