function describeFailure(failure: unknown): string {
  // Effect tagged errors have an empty message; their name is the tag.
  if (failure instanceof Error) return failure.message || failure.name;
  if (typeof failure === "object" && failure !== null) return describeObject(failure);
  return String(failure);
}

function describeObject(failure: object): string {
  const tag = "_tag" in failure ? String(failure._tag) : "UnknownError";
  const message = "message" in failure ? `: ${String(failure.message)}` : "";
  return `${tag}${message}`;
}

export { describeFailure };
