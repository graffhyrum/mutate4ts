import { test, expect } from "bun:test";
import { describeFailure } from "./describe-failure.ts";
import { RestoreError } from "./file-ops.ts";
import { ScanError } from "./scan.ts";
import { SpawnError } from "./baseline.ts";

test("a ScanError names the path and the cause", () => {
  const failure = new ScanError({ path: "src/gone.ts", cause: new Error("ENOENT: no such file") });
  expect(describeFailure(failure)).toBe("src/gone.ts: ENOENT: no such file");
});

test("a SpawnError names the command and the cause", () => {
  const failure = new SpawnError({
    command: ["bun", "test", "--bail"],
    cause: new Error("spawn failed"),
  });
  expect(describeFailure(failure)).toBe("could not run bun test --bail: spawn failed");
});

test("a RestoreError names the file, the risk and the cause", () => {
  const failure = new RestoreError({ path: "src/a.ts", cause: new Error("EISDIR") });
  const text = describeFailure(failure);
  expect(text).toContain("src/a.ts");
  expect(text).toContain("may still contain a mutation");
  expect(text).toContain("version control");
  expect(text).toContain("EISDIR");
});

test("an Error instance gives its message", () => {
  expect(describeFailure(new Error("boom"))).toBe("boom");
});

test("an Error with an empty message gives its name", () => {
  const failure = new Error("");
  failure.name = "BaselineFailedError";
  expect(describeFailure(failure)).toBe("BaselineFailedError");
});

test("an object with only a _tag gives the tag", () => {
  expect(describeFailure({ _tag: "SpawnError" })).toBe("SpawnError");
});

test("an object with a _tag and a message gives both", () => {
  expect(describeFailure({ _tag: "FileError", message: "no access" })).toBe("FileError: no access");
});

test("an object with neither gives UnknownError", () => {
  expect(describeFailure({})).toBe("UnknownError");
});

test("a non-object gives its string form", () => {
  expect(describeFailure("plain")).toBe("plain");
});
