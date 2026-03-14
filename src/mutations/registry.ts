import ts from "typescript";
import type { MutationSpan } from "../ast.ts";
import { walkAst } from "../ast.ts";
import { binaryMutators } from "./binary.ts";
import { unaryMutators } from "./unary.ts";
import { literalMutators } from "./literal.ts";
import { nullReturnMutators } from "./null-return.ts";

type MutationCategory =
  | { readonly kind: "binary"; readonly from: string; readonly to: string }
  | { readonly kind: "unary"; readonly operator: string }
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

// Each MutatorDef<T>'s guard narrows ts.Node to T before mutate is called,
// so the contravariant parameter is sound at runtime despite the type cast.
const allMutators = [
  ...binaryMutators,
  ...unaryMutators,
  ...literalMutators,
  ...nullReturnMutators,
] as readonly MutatorDef<ts.Node>[];

function findAllMutations(sourceFile: ts.SourceFile, filePath: string): readonly MutationSite[] {
  const sites: MutationSite[] = [];
  walkAst(sourceFile, (node) => collectMutations(node, sourceFile, filePath, sites));
  return sites;
}

function collectMutations(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
  sites: MutationSite[],
): void {
  for (const def of allMutators) {
    if (def.guard(node)) sites.push(...def.mutate(node, sourceFile, filePath));
  }
}

export { findAllMutations, allMutators };
export type { MutationSite, MutationCategory, MutatorDef };
