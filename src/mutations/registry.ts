import ts from "typescript";
import { walkAst } from "../ast.ts";
import { binaryMutators } from "./binary.ts";
import { unaryMutators } from "./unary.ts";
import { literalMutators } from "./literal.ts";
import { nullReturnMutators } from "./null-return.ts";
import type { MutatorDef, MutationSite } from "./types.ts";

export type { MutationSite, MutationCategory, MutatorDef } from "./types.ts";

const allMutators: readonly MutatorDef<ts.Node>[] = [
  ...binaryMutators,
  ...unaryMutators,
  ...literalMutators,
  ...nullReturnMutators,
];

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
