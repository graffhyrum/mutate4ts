import { test, expect } from "bun:test";
import { FileError } from "./file-ops.ts";

test("FileError message joins the path and an Error cause", () => {
  const err = new FileError({ path: "a.ts", cause: new Error("denied") });
  expect(err.message).toBe("a.ts: denied");
});

test("FileError message stringifies a non-Error cause", () => {
  const err = new FileError({ path: "a.ts", cause: "gone" });
  expect(err.message).toBe("a.ts: gone");
});
