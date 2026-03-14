import { Data, Effect } from "effect";

class FileError extends Data.TaggedError("FileError")<{ path: string; cause: unknown }> {
  get message(): string {
    const reason = this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `${this.path}: ${reason}`;
  }
}

function writeTemporaryMutation(path: string, content: string): Effect.Effect<void, FileError> {
  return bunWrite(path, content);
}

function restoreOriginal(path: string, original: string): Effect.Effect<void, FileError> {
  return bunWrite(path, original);
}

function bunWrite(path: string, content: string): Effect.Effect<void, FileError> {
  return Effect.tryPromise({
    try: () => Bun.write(path, content).then(() => undefined),
    catch: (cause) => new FileError({ path, cause }),
  });
}

export { writeTemporaryMutation, restoreOriginal, FileError };
