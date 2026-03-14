import ts from "typescript";
import type { MutationSpan } from "../ast.ts";

type MutationCategory =
  | { readonly kind: "binary"; readonly from: string; readonly to: string }
  | { readonly kind: "unary"; readonly operator: "!" | "-" }
  | { readonly kind: "literal"; readonly from: string; readonly to: string }
  | { readonly kind: "null-return" };

type MutationSite = {
  readonly filePath: string;
  readonly span: MutationSpan;
  readonly originalText: string;
  readonly mutatedText: string;
  readonly category: MutationCategory;
  readonly description: string;
  readonly line: number;
  readonly column: number;
};

type MutatorDef<T extends ts.Node> = {
  readonly guard: (node: ts.Node) => node is T;
  readonly mutate: (
    node: T,
    sourceFile: ts.SourceFile,
    filePath: string,
  ) => readonly MutationSite[];
};

function adaptMutator<T extends ts.Node>(
  guard: (node: ts.Node) => node is T,
  mutate: (node: T, sf: ts.SourceFile, fp: string) => readonly MutationSite[],
): MutatorDef<ts.Node> {
  return {
    guard: (node: ts.Node): node is ts.Node => guard(node),
    mutate: (node: ts.Node, sf: ts.SourceFile, fp: string) =>
      guard(node) ? mutate(node, sf, fp) : [],
  };
}

export { adaptMutator };
export type { MutationSite, MutationCategory, MutatorDef };
