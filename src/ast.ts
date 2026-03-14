import ts from "typescript";

type MutationSpan = {
  readonly start: number;
  readonly end: number;
};

function toMutationSpan(node: ts.Node, sourceFile: ts.SourceFile): MutationSpan {
  return { start: node.getStart(sourceFile), end: node.getEnd() };
}

function getSpanPosition(
  sourceFile: ts.SourceFile,
  span: MutationSpan,
): { readonly line: number; readonly column: number } {
  const pos = ts.getLineAndCharacterOfPosition(sourceFile, span.start);
  return { line: pos.line + 1, column: pos.character };
}

function extractOriginalText(sourceFile: ts.SourceFile, span: MutationSpan): string {
  return sourceFile.text.slice(span.start, span.end);
}

function parseSourceFile(text: string, filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    detectScriptKind(filePath),
  );
}

function walkAst(sourceFile: ts.SourceFile, visitor: (node: ts.Node) => void): void {
  visitNode(sourceFile, visitor);
}

function visitNode(node: ts.Node, visitor: (node: ts.Node) => void): void {
  if (isTypeOnlyNode(node)) return;
  visitor(node);
  ts.forEachChild(node, (child) => visitNode(child, visitor));
}

// Type-only nodes are erased at compile time, so mutations to them have no runtime effect.
function isTypeOnlyNode(node: ts.Node): boolean {
  return ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node);
}

function detectScriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) return ts.ScriptKind.TSX;
  return ts.ScriptKind.TS;
}

export {
  parseSourceFile,
  walkAst,
  toMutationSpan,
  extractOriginalText,
  getSpanPosition,
  detectScriptKind,
  isTypeOnlyNode,
};
export type { MutationSpan };
