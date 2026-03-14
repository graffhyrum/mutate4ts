import { test, expect, describe } from "bun:test";
import ts from "typescript";
import {
  parseSourceFile,
  walkAst,
  toMutationSpan,
  extractOriginalText,
  detectScriptKind,
} from "./ast.ts";

describe("parseSourceFile", () => {
  test("produces a valid SourceFile", () => {
    const sf = parseSourceFile("const x = 1;", "test.ts");
    expect(sf.kind).toBe(ts.SyntaxKind.SourceFile);
    expect(sf.fileName).toBe("test.ts");
    expect(sf.text).toBe("const x = 1;");
  });
});

describe("walkAst", () => {
  test("visits expression nodes", () => {
    const sf = parseSourceFile("const x = 1 + 2;", "test.ts");
    const kinds: ts.SyntaxKind[] = [];
    walkAst(sf, (node) => kinds.push(node.kind));
    expect(kinds).toContain(ts.SyntaxKind.BinaryExpression);
    expect(kinds).toContain(ts.SyntaxKind.NumericLiteral);
  });

  test("skips type-only nodes", () => {
    const code = [
      "interface Foo { bar: string; }",
      "type Baz = number;",
      "const x: string = 'hello';",
    ].join("\n");
    const sf = parseSourceFile(code, "test.ts");
    const kinds: ts.SyntaxKind[] = [];
    walkAst(sf, (node) => kinds.push(node.kind));
    expect(kinds).not.toContain(ts.SyntaxKind.InterfaceDeclaration);
    expect(kinds).not.toContain(ts.SyntaxKind.TypeAliasDeclaration);
    expect(kinds).not.toContain(ts.SyntaxKind.TypeReference);
  });
});

describe("detectScriptKind", () => {
  test("returns TSX for .tsx files", () => {
    expect(detectScriptKind("app.tsx")).toBe(ts.ScriptKind.TSX);
  });

  test("returns TSX for .jsx files", () => {
    expect(detectScriptKind("app.jsx")).toBe(ts.ScriptKind.TSX);
  });

  test("returns TS for .ts files", () => {
    expect(detectScriptKind("app.ts")).toBe(ts.ScriptKind.TS);
  });
});

describe("toMutationSpan", () => {
  test("produces correct start/end excluding leading trivia", () => {
    const code = "  const x = 42;";
    const sf = parseSourceFile(code, "test.ts");
    const stmt = sf.statements[0] as ts.VariableStatement;
    const decl = stmt.declarationList.declarations[0];
    const init = decl.initializer!;
    const span = toMutationSpan(init, sf);
    expect(span.start).toBe(code.indexOf("42"));
    expect(span.end).toBe(code.indexOf("42") + 2);
  });
});

describe("extractOriginalText", () => {
  test("produces the correct text slice", () => {
    const code = "const x = 42;";
    const sf = parseSourceFile(code, "test.ts");
    const stmt = sf.statements[0] as ts.VariableStatement;
    const decl = stmt.declarationList.declarations[0];
    const init = decl.initializer!;
    const span = toMutationSpan(init, sf);
    expect(extractOriginalText(sf, span)).toBe("42");
  });
});
