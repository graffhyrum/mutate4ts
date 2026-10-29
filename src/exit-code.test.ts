import { test, expect, describe } from "bun:test";
import { OUTCOME_EXIT_CODE, exitCodeFor } from "./exit-code.ts";
import type { MutationOutcome, MutationResult } from "./execute.ts";

function resultWith(outcome: MutationOutcome): MutationResult {
  return {
    site: {
      filePath: "a.ts",
      span: { start: 0, end: 1 },
      originalText: "a",
      mutatedText: "b",
      category: { kind: "null-return" },
      description: "d",
      line: 1,
      column: 1,
    },
    outcome,
    durationMs: 0,
    testOutput: "",
  };
}

const killed = resultWith({ status: "killed", exitCode: 1 });
const survived = resultWith({ status: "survived" });
const timeout = resultWith({ status: "timeout", timeoutMs: 10 });
const errored = resultWith({ status: "error", message: "boom" });

describe("exitCodeFor", () => {
  test("empty results exit 0", () => {
    expect(exitCodeFor([])).toBe(0);
  });

  test("killed-only results exit 0", () => {
    expect(exitCodeFor([killed, killed])).toBe(0);
  });

  test("any survived exits 1", () => {
    expect(exitCodeFor([killed, survived])).toBe(1);
  });

  test("any timeout exits 1", () => {
    expect(exitCodeFor([killed, timeout])).toBe(1);
  });

  test("any error exits 1", () => {
    expect(exitCodeFor([killed, errored])).toBe(1);
  });

  test("result is the maximum mapped code, read from the table", () => {
    const table = OUTCOME_EXIT_CODE;
    for (const r of [killed, survived, timeout, errored]) {
      expect(exitCodeFor([r])).toBe(table[r.outcome.status]);
    }
    const highest = Math.max(
      ...[killed, survived, timeout, errored].map((r) => table[r.outcome.status]),
    );
    expect<number>(exitCodeFor([killed, survived, timeout, errored])).toBe(highest);
  });
});
