import { test, expect, describe } from "bun:test";
import { parseSourceFile } from "../ast.ts";
import { findAllMutations } from "./registry.ts";

function unarySites(src: string) {
  const sf = parseSourceFile(src, "test.ts");
  const sites = findAllMutations(sf, "test.ts");
  return sites.filter((s) => s.category.kind === "unary");
}

describe("unary mutations", () => {
  test("mutates !expr to expr (remove ! prefix)", () => {
    const sites = unarySites("function f(x: boolean) { return !x; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "!x", mutatedText: "x" }));
  });

  test("mutates -expr to expr (remove unary -)", () => {
    const sites = unarySites("function f(x: number) { return -x; }");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "-x", mutatedText: "x" }));
  });
});
