import { test, expect, describe, spyOn } from "bun:test";
import { parseCliOptions } from "./cli.ts";

function argv(...args: string[]): string[] {
  return ["bun", "script.ts", ...args];
}

describe("parseCliOptions", () => {
  test("parses positional sourceFile argument", () => {
    const opts = parseCliOptions(argv("src/index.ts"));
    expect(opts.sourceFile).toBe("src/index.ts");
  });

  test("parses --scan flag", () => {
    const opts = parseCliOptions(argv("--scan", "src/index.ts"));
    expect(opts.scan).toBe(true);
  });

  test("parses --test-command", () => {
    const opts = parseCliOptions(argv("--test-command", "npm test", "src/index.ts"));
    expect(opts.testCommand).toEqual(["npm", "test"]);
  });

  test("parses --lines into number array", () => {
    const opts = parseCliOptions(argv("--lines", "1,5,10", "src/index.ts"));
    expect(opts.lines).toEqual([1, 5, 10]);
  });

  test("parses --timeout-factor", () => {
    const opts = parseCliOptions(argv("--timeout-factor", "3", "src/index.ts"));
    expect(opts.timeoutFactor).toBe(3);
  });

  test("parses --verbose flag", () => {
    const opts = parseCliOptions(argv("--verbose", "src/index.ts"));
    expect(opts.verbose).toBe(true);
  });

  test("applies defaults", () => {
    const opts = parseCliOptions(argv("src/index.ts"));
    expect(opts.scan).toBe(false);
    expect(opts.testCommand).toEqual(["bun", "test"]);
    expect(opts.timeoutFactor).toBe(2);
    expect(opts.verbose).toBe(false);
  });
});

describe("exit paths", () => {
  class ExitSignal extends Error {
    constructor(readonly code: number | undefined) {
      super(`exit ${code}`);
    }
  }

  function captureExit(run: () => unknown): { code: number | undefined; out: string; err: string } {
    const logs: string[] = [];
    const errors: string[] = [];
    const exit = spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitSignal(code);
    }) as never);
    const log = spyOn(console, "log").mockImplementation(
      (...a: unknown[]) => void logs.push(a.join(" ")),
    );
    const error = spyOn(console, "error").mockImplementation(
      (...a: unknown[]) => void errors.push(a.join(" ")),
    );
    try {
      run();
      throw new Error("expected process.exit to be called");
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
      return { code: e.code, out: logs.join("\n"), err: errors.join("\n") };
    } finally {
      exit.mockRestore();
      log.mockRestore();
      error.mockRestore();
    }
  }

  test("--help prints usage and exits 0", () => {
    const { code, out } = captureExit(() => parseCliOptions(argv("--help")));
    expect(code).toBe(0);
    expect(out).toStartWith("Usage: mutate4ts [options] <sourceFile>");
  });

  test("invalid --lines value prints error and usage to stderr, exits 2", () => {
    const { code, err } = captureExit(() =>
      parseCliOptions(argv("--lines", "1,x", "src/index.ts")),
    );
    expect(code).toBe(2);
    expect(err).toContain("Error: Invalid --lines value: 1,x");
    expect(err).toContain("Usage: mutate4ts");
  });

  test("missing source file prints error and usage, exits 2", () => {
    const { code, err } = captureExit(() => parseCliOptions(argv("--scan")));
    expect(code).toBe(2);
    expect(err).toContain("Error: ");
    expect(err).toContain("Usage: mutate4ts");
  });

  test("unknown flag exits 2", () => {
    const { code, err } = captureExit(() => parseCliOptions(argv("--nope")));
    expect(code).toBe(2);
    expect(err).toContain("Unknown flag: --nope");
  });

  test("invalid --timeout-factor exits 2", () => {
    const { code, err } = captureExit(() =>
      parseCliOptions(argv("--timeout-factor", "abc", "a.ts")),
    );
    expect(code).toBe(2);
    expect(err).toContain("Invalid number for --timeoutFactor: abc");
  });
});
