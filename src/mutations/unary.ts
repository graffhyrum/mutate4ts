import ts from "typescript";
import { toMutationSpan, getSpanPosition } from "../ast.ts";
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
    return [buildUnaryRemovalSite(node, sourceFile, filePath, "!", "Remove ! prefix")];
  if (node.operator === ts.SyntaxKind.MinusToken)
    return [buildUnaryRemovalSite(node, sourceFile, filePath, "-", "Remove unary -")];
  return [];
}

function buildUnaryRemovalSite(
  node: ts.PrefixUnaryExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  operator: "!" | "-",
  description: string,
): MutationSite {
  const span = toMutationSpan(node, sourceFile);
  const operandText = node.operand.getText(sourceFile);
  const { line, column } = getSpanPosition(sourceFile, span);
  return {
    filePath,
    span,
    originalText: `${operator}${operandText}`,
    mutatedText: operandText,
    category: { kind: "unary", operator },
    description,
    line,
    column,
  };
}

const unaryMutators: readonly MutatorDef<ts.Node>[] = [adaptMutator(isPrefixUnary, mutateUnary)];

export { unaryMutators };
