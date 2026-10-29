import { test, expect } from "bun:test";
import { formatReport } from "./report.ts";
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

test("a timeout counts as killed in the Mutation Score", () => {
  const report = formatReport([
    resultWith({ status: "killed", exitCode: 1 }),
    resultWith({ status: "timeout", timeoutMs: 10 }),
    resultWith({ status: "survived" }),
    resultWith({ status: "survived" }),
  ]);
  expect(report).toContain("Mutation Score: 50.0%");
  expect(report).toContain("1 killed, 2 survived, 1 timed out, 0 errors");
});

test("no results score 0.0%", () => {
  expect(formatReport([])).toContain("Mutation Score: 0.0%");
});
