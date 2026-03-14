import ts from "typescript";
import { toMutationSpan, extractOriginalText, getSpanPosition } from "../ast.ts";
import { adaptMutator } from "./types.ts";
import type { MutatorDef, MutationSite } from "./types.ts";

const binarySwaps: ReadonlyMap<ts.SyntaxKind, readonly ts.SyntaxKind[]> = new Map([
  [ts.SyntaxKind.PlusToken, [ts.SyntaxKind.MinusToken]],
  [ts.SyntaxKind.MinusToken, [ts.SyntaxKind.PlusToken]],
  [ts.SyntaxKind.AsteriskToken, [ts.SyntaxKind.SlashToken]],
  [ts.SyntaxKind.SlashToken, [ts.SyntaxKind.AsteriskToken]],
  [ts.SyntaxKind.AmpersandAmpersandToken, [ts.SyntaxKind.BarBarToken]],
  [ts.SyntaxKind.BarBarToken, [ts.SyntaxKind.AmpersandAmpersandToken]],
  [ts.SyntaxKind.EqualsEqualsToken, [ts.SyntaxKind.ExclamationEqualsToken]],
  [ts.SyntaxKind.ExclamationEqualsToken, [ts.SyntaxKind.EqualsEqualsToken]],
  [ts.SyntaxKind.EqualsEqualsEqualsToken, [ts.SyntaxKind.ExclamationEqualsEqualsToken]],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, [ts.SyntaxKind.EqualsEqualsEqualsToken]],
  [ts.SyntaxKind.GreaterThanToken, [ts.SyntaxKind.GreaterThanEqualsToken]],
  [ts.SyntaxKind.GreaterThanEqualsToken, [ts.SyntaxKind.GreaterThanToken]],
  [ts.SyntaxKind.LessThanToken, [ts.SyntaxKind.LessThanEqualsToken]],
  [ts.SyntaxKind.LessThanEqualsToken, [ts.SyntaxKind.LessThanToken]],
]);

const operatorText = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.PlusToken, `+`],
  [ts.SyntaxKind.MinusToken, `-`],
  [ts.SyntaxKind.AsteriskToken, `*`],
  [ts.SyntaxKind.SlashToken, `/`],
  [ts.SyntaxKind.AmpersandAmpersandToken, `&&`],
  [ts.SyntaxKind.BarBarToken, `||`],
  [ts.SyntaxKind.EqualsEqualsToken, `==`],
  [ts.SyntaxKind.ExclamationEqualsToken, `!=`],
  [ts.SyntaxKind.EqualsEqualsEqualsToken, `===`],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, `!==`],
  [ts.SyntaxKind.GreaterThanToken, `>`],
  [ts.SyntaxKind.GreaterThanEqualsToken, `>=`],
  [ts.SyntaxKind.LessThanToken, `<`],
  [ts.SyntaxKind.LessThanEqualsToken, `<=`],
]);

function isBinaryExpression(node: ts.Node): node is ts.BinaryExpression {
  return ts.isBinaryExpression(node);
}

function mutateBinary(
  node: ts.BinaryExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
): readonly MutationSite[] {
  const swaps = binarySwaps.get(node.operatorToken.kind);
  if (!swaps) return [];
  if (isPlusOnStrings(node)) return [];
  return swaps.map((target) => buildBinarySite(node, sourceFile, filePath, target));
}

function isPlusOnStrings(node: ts.BinaryExpression): boolean {
  return (
    node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    (isStringNode(node.left) || isStringNode(node.right))
  );
}

function isStringNode(node: ts.Node): boolean {
  return (
    ts.isStringLiteral(node) ||
    ts.isTemplateExpression(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  );
}

function buildBinarySite(
  node: ts.BinaryExpression,
  sourceFile: ts.SourceFile,
  filePath: string,
  targetKind: ts.SyntaxKind,
): MutationSite {
  const span = toMutationSpan(node.operatorToken, sourceFile);
  const from = extractOriginalText(sourceFile, span);
  const to = operatorText.get(targetKind);
  if (!to) throw new Error(`No operator text for ${targetKind}`);
  const { line, column } = getSpanPosition(sourceFile, span);
  return {
    filePath,
    span,
    originalText: from,
    mutatedText: to,
    category: { kind: "binary", from, to },
    description: `Replace ${from} with ${to}`,
    line,
    column,
  };
}

const binaryMutators: readonly MutatorDef<ts.Node>[] = [
  adaptMutator(isBinaryExpression, mutateBinary),
];

export { binaryMutators };
