import { test, expect, describe } from "bun:test";
import { exitCodeFor, fatalOutcome } from "./exit-code.ts";
import { FileError, RestoreError } from "./file-ops.ts";
import type { MutationSite } from "./mutations/registry.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect, FiberId } from "effect";
import { executeMutations } from "./execute.ts";
import type { MutationOutcome, MutationResult } from "./execute.ts";

async function runRealMutation(testCommand: readonly string[], timeoutMs: number) {
  const dir = mkdtempSync(join(tmpdir(), "exit-code-"));
  try {
    const filePath = join(dir, "fixture.ts");
    const originalSource = "export const flag = true;\n";
    await Bun.write(filePath, originalSource);
    const start = originalSource.indexOf("true");
    const site = {
      ...baseSite,
      filePath,
      span: { start, end: start + 4 },
      originalText: "true",
      mutatedText: "false",
    };
    return await Effect.runPromise(
      executeMutations({
        sites: [site],
        filePath,
        originalSource,
        testCommand,
        timeoutMs,
        onProgress: () => undefined,
      }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function resultWith(outcome: MutationOutcome): MutationResult {
  return {
    site: baseSite,
    outcome,
    durationMs: 0,
    testOutput: "",
  };
}

const baseSite: MutationSite = {
  filePath: "a.ts",
  span: { start: 0, end: 1 },
  originalText: "a",
  mutatedText: "b",
  category: { kind: "null-return" },
  description: "d",
  line: 1,
  column: 1,
};

const killed = resultWith({ status: "killed", exitCode: 1 });
const survived = resultWith({ status: "survived" });
const timeout = resultWith({ status: "timeout", timeoutMs: 10 });
const errored = resultWith({ status: "error", message: "boom" });

describe("exitCodeFor through executeMutations", () => {
  test("a test command that outlives timeoutMs is a timeout and exits 0", async () => {
    const results = await runRealMutation(["bun", "-e", "await Bun.sleep(3000)"], 300);
    expect(results.map((r) => r.outcome.status)).toEqual(["timeout"]);
    expect(exitCodeFor(results)).toBe(0);
  });

  test("a failing test command is killed and exits 0", async () => {
    const results = await runRealMutation(["false"], 1000);
    expect(results.map((r) => r.outcome.status)).toEqual(["killed"]);
    expect(exitCodeFor(results)).toBe(0);
  });

  test("a passing test command is a survivor and exits 1", async () => {
    const results = await runRealMutation(["true"], 1000);
    expect(results.map((r) => r.outcome.status)).toEqual(["survived"]);
    expect(exitCodeFor(results)).toBe(1);
  });

  test("a file that cannot be written is an error and exits 3", async () => {
    // Writing to a path that is a directory fails, which is the FileError path.
    const dir = mkdtempSync(join(tmpdir(), "exit-code-"));
    try {
      const results = await Effect.runPromise(
        executeMutations({
          sites: [baseSite],
          filePath: dir,
          originalSource: "a",
          testCommand: ["true"],
          timeoutMs: 1000,
          onProgress: () => undefined,
        }),
      );
      expect(results.map((r) => r.outcome.status)).toEqual(["error"]);
      expect(exitCodeFor(results)).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a test command that cannot be spawned is an error and exits 3", async () => {
    const results = await runRealMutation(["mutate4ts-no-such-binary"], 1000);
    expect(results.map((r) => r.outcome.status)).toEqual(["error"]);
    expect(exitCodeFor(results)).toBe(3);
  });
});

describe("fatalOutcome", () => {
  const restoreError = new RestoreError({ path: "a.ts", cause: new Error("denied") });
  const interrupt = Cause.interrupt(FiberId.none);

  test("an interrupt alone exits 130 with no message", () => {
    expect(fatalOutcome(interrupt)).toEqual({ exitCode: 130, message: null });
  });

  test("a failed source restore exits 4 and names the path", () => {
    const outcome = fatalOutcome(Cause.die(restoreError));
    expect(outcome.exitCode).toBe(4);
    expect(outcome.message).toContain("a.ts may still contain a mutation");
  });

  test("a failed restore wins over an interrupt, whether sequential or parallel", () => {
    const causes = [
      Cause.sequential(interrupt, Cause.die(restoreError)),
      Cause.sequential(Cause.die(restoreError), interrupt),
      Cause.parallel(interrupt, Cause.die(restoreError)),
    ];
    const outcomes = causes.map(fatalOutcome);
    expect(outcomes.map((o) => o.exitCode)).toEqual([4, 4, 4]);
    expect(outcomes.every((o) => o.message?.includes("a.ts may still"))).toBe(true);
  });

  test("a typed failure exits 2 with its description", () => {
    const outcome = fatalOutcome(Cause.fail(new FileError({ path: "b.ts", cause: "x" })));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.message).toStartWith("Error: b.ts");
  });

  test("any other defect exits 2", () => {
    expect(fatalOutcome(Cause.die(new Error("boom")))).toEqual({
      exitCode: 2,
      message: "Error: boom",
    });
  });
});

describe("exitCodeFor", () => {
  test("maps killed 0, survived 1, timeout 0, error 3 (ADR 0001)", () => {
    const codes = [killed, survived, timeout, errored].map((r) => exitCodeFor([r]));
    expect(codes).toEqual([0, 1, 0, 3]);
  });

  test("empty results exit 0", () => {
    expect(exitCodeFor([])).toBe(0);
  });

  test("killed and timeout results exit 0", () => {
    expect(exitCodeFor([killed, timeout])).toBe(0);
  });

  test("survived and error together exit 3, the highest code", () => {
    expect(exitCodeFor([survived, errored, killed])).toBe(3);
  });
});
