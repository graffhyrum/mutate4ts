# mutate4ts

Mutation testing CLI for TypeScript. Injects faults into a source file, runs your test suite against each mutation, and reports which mutations survived (tests that didn't catch the bug).

## Install

```bash
bun install
```

## Usage

```
mutate4ts [options] <sourceFile>

Options:
  --scan              List mutation sites without running tests
  --test-command CMD  Test command to run (default: "bun test")
  --lines N,N,...     Restrict mutations to specific lines
  --timeout-factor N  Timeout multiplier relative to baseline run (default: 2)
  --verbose           Show detailed output
  --help              Show this help message
```

**Run mutation testing:**

```bash
bun src/index.ts src/my-module.ts
```

**Preview mutation sites without running tests:**

```bash
bun src/index.ts --scan src/my-module.ts
```

**Use a custom test command:**

```bash
bun src/index.ts --test-command "bun test src/my-module.test.ts" src/my-module.ts
```

**Target specific lines:**

```bash
bun src/index.ts --lines 42,43,44 src/my-module.ts
```

## How it works

1. Parses the source file with the TypeScript compiler API
2. Runs the baseline test suite and records its duration
3. For each mutation site: applies the mutation, runs tests with a timeout of `baseline × timeoutFactor`, restores the original, records `killed` / `survived` / `timeout`
4. Prints a report and exits with code `1` if any mutations survived, `0` if all were killed

## Mutation operators

| Category    | What it mutates                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| **Binary**  | Arithmetic (`+↔-`, `*↔/`), logical (`&&↔\|\|`), equality (`==↔!=`, `===↔!==`), relational (`>↔>=`, `<↔<=`) |
| **Unary**   | Removes `!` (logical not) and `-` (numeric negation)                                                       |
| **Literal** | Flips `true↔false`; negates numeric literals                                                               |
| **Null**    | Replaces return values, variable initializers, and assignment RHS with `null`                              |

## Exit codes

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| `0`  | All mutations killed                              |
| `1`  | One or more mutations survived                    |
| `2`  | Fatal error (bad arguments, file not found, etc.) |

## Development

```bash
bun test              # run tests
bun test --watch      # watch mode
bun run typecheck     # tsc --noEmit
bun run lint          # oxlint type-aware
bun run fmt           # oxfmt formatter
bun run vet           # full gate: fmt → typecheck → lint:fix → test:coverage
bun run build         # tsc → dist/
```
