import ts from "typescript";
import { toMutationSpan } from "../ast.ts";
import type { MutatorDef, MutationSite } from "./registry.ts";

function isTrueKeyword(node: ts.Node): node is ts.Node {
  return node.kind === ts.SyntaxKind.TrueKeyword;
}

function isFalseKeyword(node: ts.Node): node is ts.Node {
  return node.kind === ts.SyntaxKind.FalseKeyword;
}

function isNumericLiteral(node: ts.Node): node is ts.NumericLiteral {
  return ts.isNumericLiteral(node);
}

function mutateTrueLiteral(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
): readonly MutationSite[] {
  return [buildLiteralSite(node, sourceFile, filePath, "true", "false")];
}

function mutateFalseLiteral(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
): readonly MutationSite[] {
  return [buildLiteralSite(node, sourceFile, filePath, "false", "true")];
}

function mutateNumericLiteral(
  node: ts.NumericLiteral,
  sourceFile: ts.SourceFile,
  filePath: string,
): readonly MutationSite[] {
  if (node.text === "0") return [buildLiteralSite(node, sourceFile, filePath, "0", "1")];
  if (node.text === "1") return [buildLiteralSite(node, sourceFile, filePath, "1", "0")];
  return [];
}

function buildLiteralSite(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
  from: string,
  to: string,
): MutationSite {
  const span = toMutationSpan(node, sourceFile);
  const pos = ts.getLineAndCharacterOfPosition(sourceFile, span.start);
  return {
    filePath,
    span,
    originalText: from,
    mutatedText: to,
    category: { kind: "literal", from, to },
    description: `Replace ${from} with ${to}`,
    line: pos.line + 1,
    column: pos.character,
  };
}

const literalMutators: readonly MutatorDef<ts.Node>[] = [
  { guard: isTrueKeyword, mutate: mutateTrueLiteral },
  { guard: isFalseKeyword, mutate: mutateFalseLiteral },
  {
    guard: isNumericLiteral as (node: ts.Node) => node is ts.Node,
    mutate: mutateNumericLiteral as (
      node: ts.Node,
      sourceFile: ts.SourceFile,
      filePath: string,
    ) => readonly MutationSite[],
  },
];

export { literalMutators };
