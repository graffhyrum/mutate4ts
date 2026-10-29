import { test, expect } from "bun:test";
import { describeFailure } from "./describe-failure.ts";

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
