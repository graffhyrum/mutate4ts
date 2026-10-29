function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export { causeMessage };
