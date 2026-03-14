import { test, expect, describe } from "bun:test";
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
