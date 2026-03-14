import ts from "typescript";
import { toMutationSpan, getSpanPosition } from "../ast.ts";
import { adaptMutator } from "./types.ts";
import type { MutatorDef, MutationSite } from "./types.ts";

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

// Only 0 and 1 are mutated — they are the only literals with a meaningful numeric swap that
// doesn't change the semantic type of the expression (int stays int).
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
  const { line, column } = getSpanPosition(sourceFile, span);
  return {
    filePath,
    span,
    originalText: from,
    mutatedText: to,
    category: { kind: "literal", from, to },
    description: `Replace ${from} with ${to}`,
    line,
    column,
  };
}

const literalMutators: readonly MutatorDef<ts.Node>[] = [
  adaptMutator(isTrueKeyword, mutateTrueLiteral),
  adaptMutator(isFalseKeyword, mutateFalseLiteral),
  adaptMutator(isNumericLiteral, mutateNumericLiteral),
];

export { literalMutators };
