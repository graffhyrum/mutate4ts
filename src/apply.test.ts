import { test, expect, describe } from "bun:test";
import { applyMutation } from "./apply.ts";

describe("applyMutation", () => {
  test("replaces text at the correct span", () => {
    const result = applyMutation("a + b", { start: 2, end: 3 }, "-");
    expect(result).toBe("a - b");
  });

  test("preserves text before and after the span", () => {
    const result = applyMutation("hello world end", { start: 6, end: 11 }, "there");
    expect(result).toBe("hello there end");
  });

  test("handles replacement at the start of string", () => {
    const result = applyMutation("abc", { start: 0, end: 1 }, "X");
    expect(result).toBe("Xbc");
  });

  test("handles replacement at the end of string", () => {
    const result = applyMutation("abc", { start: 2, end: 3 }, "Z");
    expect(result).toBe("abZ");
  });

  test("works when replacement is longer than original", () => {
    const result = applyMutation("a+b", { start: 1, end: 2 }, " + ");
    expect(result).toBe("a + b");
  });

  test("works when replacement is shorter than original", () => {
    const result = applyMutation("a + b", { start: 1, end: 4 }, "+");
    expect(result).toBe("a+b");
  });
});
