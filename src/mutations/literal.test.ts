import { test, expect, describe } from "bun:test";
import { parseSourceFile } from "../ast.ts";
import { findAllMutations } from "./registry.ts";

function literalSites(src: string) {
  const sf = parseSourceFile(src, "test.ts");
  const sites = findAllMutations(sf, "test.ts");
  return sites.filter((s) => s.category.kind === "literal");
}

describe("literal mutations", () => {
  test("mutates true to false", () => {
    const sites = literalSites("const x = true;");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "true", mutatedText: "false" }),
    );
  });

  test("mutates false to true", () => {
    const sites = literalSites("const x = false;");
    expect(sites).toContainEqual(
      expect.objectContaining({ originalText: "false", mutatedText: "true" }),
    );
  });

  test("mutates 0 to 1", () => {
    const sites = literalSites("const x = 0;");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "0", mutatedText: "1" }));
  });

  test("mutates 1 to 0", () => {
    const sites = literalSites("const x = 1;");
    expect(sites).toContainEqual(expect.objectContaining({ originalText: "1", mutatedText: "0" }));
  });

  test("does not mutate numeric literals other than 0 and 1", () => {
    const sites = literalSites("const x = 42;");
    expect(sites).toHaveLength(0);
  });
});
