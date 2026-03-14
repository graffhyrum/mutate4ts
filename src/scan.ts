import { parseSourceFile } from "./ast.ts";
import { findAllMutations } from "./mutations/registry.ts";
import type { MutationSite } from "./mutations/registry.ts";

async function scanFile(
  filePath: string,
  lines?: readonly number[],
): Promise<readonly MutationSite[]> {
  const text = await readFile(filePath);
  const sites = findAllMutations(parseSourceFile(text, filePath), filePath);
  return lines ? filterByLines(sites, lines) : sites;
}

async function readFile(filePath: string): Promise<string> {
  return Bun.file(filePath).text();
}

function filterByLines(
  sites: readonly MutationSite[],
  lines: readonly number[],
): readonly MutationSite[] {
  const lineSet = new Set(lines);
  return sites.filter((s) => lineSet.has(s.line));
}

export { scanFile, readFile };
