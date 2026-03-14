import { Data, Effect } from "effect";
import { parseSourceFile } from "./ast.ts";
import { findAllMutations } from "./mutations/registry.ts";
import type { MutationSite } from "./mutations/registry.ts";

class ScanError extends Data.TaggedError("ScanError")<{ path: string; cause: unknown }> {}

function scanFile(
  filePath: string,
  lines?: readonly number[],
): Effect.Effect<readonly MutationSite[], ScanError> {
  return readFile(filePath).pipe(
    Effect.map((text) => {
      const sites = findAllMutations(parseSourceFile(text, filePath), filePath);
      return lines ? filterByLines(sites, lines) : sites;
    }),
  );
}

function readFile(filePath: string): Effect.Effect<string, ScanError> {
  return Effect.tryPromise({
    try: () => Bun.file(filePath).text(),
    catch: (cause) => new ScanError({ path: filePath, cause }),
  });
}

function filterByLines(
  sites: readonly MutationSite[],
  lines: readonly number[],
): readonly MutationSite[] {
  const lineSet = new Set(lines);
  return sites.filter((s) => lineSet.has(s.line));
}

export { scanFile, readFile, ScanError };
