# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
bun test                   # run tests
bun test --watch           # watch mode
bun test --coverage        # with coverage (sets AGENT=1)
bun run typecheck          # tsc --noEmit
bun run lint               # oxlint type-aware
bun run lint:fix           # oxlint with auto-fix
bun run fmt                # oxfmt formatter
bun run fmt:check          # check formatting without writing
bun run vet                # full gate: fmt → typecheck → lint:fix → rule-validator → test:coverage
bun run stepdown           # enforce stepdown rule across src/
bun run build              # tsc → dist/
```

Single test file: `bun test src/path/to/file.test.ts`

## Runtime

Bun is the runtime — not Node. Use `Bun.file`, `Bun.$`, `bun:sqlite`, etc. instead of Node equivalents.

## Toolchain

- **Formatter**: `oxfmt` (not prettier/biome)
- **Linter**: `oxlint` with type-aware checks via `oxlint-tsgolint`
- **Validation**: `arktype` — use `type("string.json.parse").to(schema)` at system boundaries, never raw `JSON.parse`
- **TypeScript compiler**: `@typescript/native-preview` (peer dep — the native TS compiler)

## Architecture

Early-stage project. Source lives in `src/`, compiled output in `dist/`. The `vet` script is the canonical pre-commit quality gate.
