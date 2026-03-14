import { test, expect, describe } from "bun:test";
import { parseSourceFile } from "../ast.ts";
import { findAllMutations } from "./registry.ts";

function binarySites(src: string) {
  const sf = parseSourceFile(src, "test.ts");
  const sites = findAllMutations(sf, "test.ts");
  return sites.filter((s) => s.category.kind === "binary");
}

describe("binary mutations", () => {
  test("mutates + to -", () => {
    const sites = binarySites("function f(a: number, b: number) { return a + b; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "+", mutatedText: "-" }));
  });

  test("mutates - to +", () => {
    const sites = binarySites("function f(a: number, b: number) { return a - b; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "-", mutatedText: "+" }));
  });

  test("mutates * to /", () => {
    const sites = binarySites("function f(a: number, b: number) { return a * b; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "*", mutatedText: "/" }));
  });

  test("mutates / to *", () => {
    const sites = binarySites("function f(a: number, b: number) { return a / b; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "/", mutatedText: "*" }));
  });

  test("mutates && to ||", () => {
    const sites = binarySites("function f(a: boolean, b: boolean) { return a && b; }");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "&&", mutatedText: "||" }),
    );
  });

  test("mutates || to &&", () => {
    const sites = binarySites("function f(a: boolean, b: boolean) { return a || b; }");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "||", mutatedText: "&&" }),
    );
  });

  test("mutates == to !=", () => {
    const sites = binarySites("function f(a: number, b: number) { return a == b; }");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "==", mutatedText: "!=" }),
    );
  });

  test("mutates != to ==", () => {
    const sites = binarySites("function f(a: number, b: number) { return a != b; }");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "!=", mutatedText: "==" }),
    );
  });

  test("mutates === to !==", () => {
    const sites = binarySites("function f(a: number, b: number) { return a === b; }");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "===", mutatedText: "!==" }),
    );
  });

  test("mutates !== to ===", () => {
    const sites = binarySites("function f(a: number, b: number) { return a !== b; }");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "!==", mutatedText: "===" }),
    );
  });

  test("mutates > to >=", () => {
    const sites = binarySites("function f(a: number, b: number) { return a > b; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: ">", mutatedText: ">=" }));
  });

  test("mutates >= to >", () => {
    const sites = binarySites("function f(a: number, b: number) { return a >= b; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: ">=", mutatedText: ">" }));
  });

  test("mutates < to <=", () => {
    const sites = binarySites("function f(a: number, b: number) { return a < b; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "<", mutatedText: "<=" }));
  });

  test("mutates <= to <", () => {
    const sites = binarySites("function f(a: number, b: number) { return a <= b; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "<=", mutatedText: "<" }));
  });

  test("does not mutate operators inside string literals", () => {
    const sites = binarySites('const s = "a + b";');
    expect(sites).toHaveLength(0);
  });

  test("does not mutate operators inside comments", () => {
    const sites = binarySites("// a + b\nconst x = 42;");
    expect(sites).toHaveLength(0);
  });

  test("does not mutate + used for string concatenation with string literal", () => {
    const sites = binarySites('function f(s: string) { return s + " world"; }');
    const plusSites = sites.filter((s) => s.originalText === "+");
    expect(plusSites).toHaveLength(0);
  });

  test("does not mutate + used for string concatenation with template literal", () => {
    const sites = binarySites("function f(s: string) { return s + `!`; }");
    const plusSites = sites.filter((s) => s.originalText === "+");
    expect(plusSites).toHaveLength(0);
  });
});
