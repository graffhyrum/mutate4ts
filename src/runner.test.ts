import { test, expect, describe } from "bun:test";
import { runTestCommand } from "./runner.ts";

describe("runTestCommand", () => {
  test("captures exit code 0 for successful command", () => {
    const result = runTestCommand(["echo", "hello"], 5000);
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  test("captures non-zero exit code for failing command", () => {
    const result = runTestCommand(["false"], 5000);
    expect(result.exitCode).not.toBe(0);
    expect(result.timedOut).toBe(false);
  });

  test("detects timeout via .timedOut", () => {
    const result = runTestCommand(["sleep", "10"], 100);
    expect(result.timedOut).toBe(true);
  });
});
