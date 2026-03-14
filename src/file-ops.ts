function writeTemporaryMutation(path: string, content: string): Promise<void> {
  return Bun.write(path, content).then(() => undefined);
}

function restoreOriginal(path: string, original: string): Promise<void> {
  return Bun.write(path, original).then(() => undefined);
}

export { writeTemporaryMutation, restoreOriginal };
