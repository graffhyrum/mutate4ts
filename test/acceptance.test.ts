import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");
const cli = join(projectRoot, "src/index.ts");

function run(args: readonly string[], cwd?: string) {
  const result = Bun.spawnSync(["bun", "run", cli, ...args], { cwd });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function writeTempProject(dir: string, files: Record<string, string>): void {
  writeFileSync(join(dir, "package.json"), '{ "name": "test-proj" }\n');
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
}

describe("mutate4ts CLI", () => {
  test("--help displays usage", () => {
    const result = run(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });

  test("rejects non-.ts files", () => {
    const result = run(["somefile.js"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("must be a .ts or .tsx file");
  });

  test("--scan lists mutation sites", () => {
    const result = run(["--scan", "test/fixtures/sample.ts"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("mutation sites");
  });

  test("--scan --lines restricts to specific lines", () => {
    const result = run(["--scan", "--lines", "2", "test/fixtures/sample.ts"]);
    expect(result.exitCode).toBe(0);
    const siteLines = result.stdout.split("\n").filter((l) => l.includes("sample.ts:"));
    for (const line of siteLines) {
      expect(line).toMatch(/sample\.ts:2:/);
    }
  });

  describe("boolean mutations detected and killed by tests", () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = mkdtempSync(join(tmpdir(), "mutate4ts-bool-"));
      writeTempProject(tempDir, {
        "src/target.ts": "export function isTrue() { return true; }\n",
        "src/target.test.ts": [
          'import { test, expect } from "bun:test";',
          'import { isTrue } from "./target.ts";',
          'test("isTrue", () => { expect(isTrue()).toBe(true); });',
          "",
        ].join("\n"),
      });
    });

    afterAll(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("KILLED when test catches boolean mutation", () => {
      const result = Bun.spawnSync(
        ["bun", "run", cli, "--test-command", "bun test", "src/target.ts"],
        { cwd: tempDir },
      );
      const stdout = result.stdout.toString();
      expect(stdout).toContain("KILLED");
    });
  });

  describe("baseline test failure exits with code 2", () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = mkdtempSync(join(tmpdir(), "mutate4ts-fail-"));
      writeTempProject(tempDir, {
        "src/target.ts": "export function f() { return 1; }\n",
        "src/target.test.ts": [
          'import { test, expect } from "bun:test";',
          'import { f } from "./target.ts";',
          'test("f", () => { expect(1).toBe(2); });',
          "",
        ].join("\n"),
      });
    });

    afterAll(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test("exits with code 2 when baseline tests fail", () => {
      const result = Bun.spawnSync(
        ["bun", "run", cli, "--test-command", "bun test", "src/target.ts"],
        { cwd: tempDir },
      );
      expect(result.exitCode).toBe(2);
    });
  });

  test("rejects invalid --lines value", () => {
    const result = run(["--lines", "abc", "test/fixtures/sample.ts"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid");
  });

  describe("comparison operator mutations killed by tests", () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = mkdtempSync(join(tmpdir(), "mutate4ts-cmp-"));
      writeTempProject(tempDir, {
        "src/target.ts": "export function isPositive(n: number) { return n > 0; }\n",
        "src/target.test.ts": [
          'import { test, expect } from "bun:test";',
          'import { isPositive } from "./target.ts";',
          'test("positive", () => { expect(isPositive(1)).toBe(true); expect(isPositive(-1)).toBe(false); });',
          "",
        ].join("\n"),
      });
    });

    afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

    test("KILLED when test catches comparison mutation", () => {
      const result = Bun.spawnSync(
        ["bun", "run", cli, "--test-command", "bun test", "src/target.ts"],
        { cwd: tempDir },
      );
      expect(result.stdout.toString()).toContain("KILLED");
    });
  });

  describe("unary operator mutations killed by tests", () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = mkdtempSync(join(tmpdir(), "mutate4ts-unary-"));
      writeTempProject(tempDir, {
        "src/target.ts": "export function invert(b: boolean) { return !b; }\n",
        "src/target.test.ts": [
          'import { test, expect } from "bun:test";',
          'import { invert } from "./target.ts";',
          'test("invert", () => { expect(invert(true)).toBe(false); expect(invert(false)).toBe(true); });',
          "",
        ].join("\n"),
      });
    });

    afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

    test("KILLED when test catches unary mutation", () => {
      const result = Bun.spawnSync(
        ["bun", "run", cli, "--test-command", "bun test", "src/target.ts"],
        { cwd: tempDir },
      );
      expect(result.stdout.toString()).toContain("KILLED");
    });
  });

  describe("null-return mutations killed by tests", () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = mkdtempSync(join(tmpdir(), "mutate4ts-null-"));
      writeTempProject(tempDir, {
        "src/target.ts": "export function getName() { return 'alice'; }\n",
        "src/target.test.ts": [
          'import { test, expect } from "bun:test";',
          'import { getName } from "./target.ts";',
          'test("getName", () => { expect(getName()).not.toBeNull(); });',
          "",
        ].join("\n"),
      });
    });

    afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

    test("KILLED when test catches null-return mutation", () => {
      const result = Bun.spawnSync(
        ["bun", "run", cli, "--test-command", "bun test", "src/target.ts"],
        { cwd: tempDir },
      );
      expect(result.stdout.toString()).toContain("KILLED");
    });
  });

  test("--scan on generics fixture ignores generic angle brackets", () => {
    const result = run(["--scan", "test/fixtures/generics.ts"]);
    expect(result.exitCode).toBe(0);
    const siteLines = result.stdout.split("\n").filter((l) => l.includes("generics.ts:"));
    const hasCompare = siteLines.some((l) => l.includes("generics.ts:11:"));
    expect(hasCompare).toBe(true);
    const hasGenericAngle = siteLines.some(
      (l) => l.includes("generics.ts:2:") || l.includes("generics.ts:6:"),
    );
    expect(hasGenericAngle).toBe(false);
  });
});
