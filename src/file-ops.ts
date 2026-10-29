import { Data, Effect } from "effect";
import { causeMessage } from "./cause-message.ts";

class FileError extends Data.TaggedError("FileError")<{ path: string; cause: unknown }> {
  get message(): string {
    return `${this.path}: ${causeMessage(this.cause)}`;
  }
}

// Kept apart from FileError: after this failure the source file may still hold a mutation.
class RestoreError extends Data.TaggedError("RestoreError")<{ path: string; cause: unknown }> {
  get message(): string {
    return `${this.path} may still contain a mutation. Restore it (for example from version control). Cause: ${causeMessage(this.cause)}`;
  }
}

function writeTemporaryMutation(path: string, content: string): Effect.Effect<void, FileError> {
  return bunWrite(path, content, (cause) => new FileError({ path, cause }));
}

function restoreOriginal(path: string, original: string): Effect.Effect<void, RestoreError> {
  return bunWrite(path, original, (cause) => new RestoreError({ path, cause }));
}

function bunWrite<E>(
  path: string,
  content: string,
  toError: (cause: unknown) => E,
): Effect.Effect<void, E> {
  return Effect.tryPromise({
    try: () => Bun.write(path, content).then(() => undefined),
    catch: toError,
  });
}

export { writeTemporaryMutation, restoreOriginal, FileError, RestoreError };
