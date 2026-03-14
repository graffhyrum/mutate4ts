import ts from "typescript";
import { toMutationSpan, extractOriginalText } from "../ast.ts";
import { adaptMutator } from "./types.ts";
import type { MutatorDef, MutationSite } from "./types.ts";

function isReturnStatement(node: ts.Node): node is ts.ReturnStatement {
  return ts.isReturnStatement(node);
}

function isVariableDeclaration(node: ts.Node): node is ts.VariableDeclaration {
  return ts.isVariableDeclaration(node);
}

function isAssignmentExpression(node: ts.Node): node is ts.BinaryExpression {
  return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
}

function mutateReturn(
  node: ts.ReturnStatement,
  sourceFile: ts.SourceFile,
  filePath: string,
): readonly MutationSite[] {
  if (!node.expression) return [];
  if (isAlreadyNull(node.expression)) return [];
  return [buildNullSite(node.expression, sourceFile, filePath, "Replace return value with null")];
}

function mutateVariableDeclaration(
  node: ts.VariableDeclaration,
  sourceFile: ts.SourceFile,
  filePath: string,
): readonly MutationSite[] {
  if (!node.initializer) return [];
  if (isAlreadyNull(node.initializer)) return [];
  return [buildNullSite(node.initializer, sourceFile, filePath, "Replace initializer with null")];
}

function mutateAssignment(
  node: ts.BinaryExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
): readonly MutationSite[] {
  if (isAlreadyNull(node.right)) return [];
  return [buildNullSite(node.right, sourceFile, filePath, "Replace assigned value with null")];
}

function buildNullSite(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  filePath: string,
  description: string,
): MutationSite {
  const span = toMutationSpan(expression, sourceFile);
  const original = extractOriginalText(sourceFile, span);
  const pos = ts.getLineAndCharacterOfPosition(sourceFile, span.start);
  return {
    filePath,
    span,
    originalText: original,
    mutatedText: "null",
    category: { kind: "null-return" },
    description,
    line: pos.line + 1,
    column: pos.character,
  };
}

function isAlreadyNull(node: ts.Expression): boolean {
  return node.kind === ts.SyntaxKind.NullKeyword;
}

const nullReturnMutators: readonly MutatorDef<ts.Node>[] = [
  adaptMutator(isReturnStatement, mutateReturn),
  adaptMutator(isVariableDeclaration, mutateVariableDeclaration),
  adaptMutator(isAssignmentExpression, mutateAssignment),
];

export { nullReturnMutators };
