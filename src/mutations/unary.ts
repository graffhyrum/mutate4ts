import ts from "typescript";
import { toMutationSpan } from "../ast.ts";
import { adaptMutator } from "./types.ts";
import type { MutatorDef, MutationSite } from "./types.ts";

function isPrefixUnary(node: ts.Node): node is ts.PrefixUnaryExpression {
  return ts.isPrefixUnaryExpression(node);
}

function mutateUnary(
  node: ts.PrefixUnaryExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
): readonly MutationSite[] {
  if (node.operator === ts.SyntaxKind.ExclamationToken)
    return [buildRemoveBang(node, sourceFile, filePath)];
  if (node.operator === ts.SyntaxKind.MinusToken)
    return [buildRemoveNegation(node, sourceFile, filePath)];
  return [];
}

function buildRemoveBang(
  node: ts.PrefixUnaryExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
): MutationSite {
  const span = toMutationSpan(node, sourceFile);
  const operandText = node.operand.getText(sourceFile);
  const pos = ts.getLineAndCharacterOfPosition(sourceFile, span.start);
  return {
    filePath,
    span,
    originalText: `!${operandText}`,
    mutatedText: operandText,
    category: { kind: "unary", operator: "!" },
    description: `Remove ! prefix`,
    line: pos.line + 1,
    column: pos.character,
  };
}

function buildRemoveNegation(
  node: ts.PrefixUnaryExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
): MutationSite {
  const span = toMutationSpan(node, sourceFile);
  const operandText = node.operand.getText(sourceFile);
  const pos = ts.getLineAndCharacterOfPosition(sourceFile, span.start);
  return {
    filePath,
    span,
    originalText: `-${operandText}`,
    mutatedText: operandText,
    category: { kind: "unary", operator: "-" },
    description: `Remove unary -`,
    line: pos.line + 1,
    column: pos.character,
  };
}

const unaryMutators: readonly MutatorDef<ts.Node>[] = [adaptMutator(isPrefixUnary, mutateUnary)];

export { unaryMutators };
