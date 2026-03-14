import { test, expect, describe } from "bun:test";
import { parseSourceFile } from "../ast.ts";
import { findAllMutations } from "./registry.ts";

function nullReturnSites(src: string) {
  const sf = parseSourceFile(src, "test.ts");
  const sites = findAllMutations(sf, "test.ts");
  return sites.filter((s) => s.category.kind === "null-return");
}

describe("null-return mutations", () => {
  test("mutates return expr to return null", () => {
    const sites = nullReturnSites("function f() { return 42; }");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "42", mutatedText: "null" }),
    );
  });

  test("does not mutate return null (already null)", () => {
    const sites = nullReturnSites("function f() { return null; }");
    expect(sites).toHaveLength(0);
  });

  test("does not mutate bare return with no expression", () => {
    const sites = nullReturnSites("function f() { return; }");
    expect(sites).toHaveLength(0);
  });

  test("mutates variable initializer to null", () => {
    const sites = nullReturnSites("const x = getValue();");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "getValue()", mutatedText: "null" }),
    );
  });

  test("does not mutate variable initializer that is already null", () => {
    const sites = nullReturnSites("const x = null;");
    const initSites = sites.filter((s) => s.description.includes("initializer"));
    expect(initSites).toHaveLength(0);
  });

  test("mutates assignment rhs to null", () => {
    const sites = nullReturnSites("let x; x = getValue();");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "getValue()", mutatedText: "null" }),
    );
  });

  test("does not mutate assignment rhs that is already null", () => {
    const sites = nullReturnSites("let x; x = null;");
    const assignSites = sites.filter((s) => s.description.includes("assigned"));
    expect(assignSites).toHaveLength(0);
  });
});
