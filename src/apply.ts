import type { MutationSpan } from "./ast.ts";

function applyMutation(source: string, span: MutationSpan, replacement: string): string {
  return source.slice(0, span.start) + replacement + source.slice(span.end);
}

export { applyMutation };
