export type Capture = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type CaptureOptions = {
  readonly env?: Readonly<Record<string, string>>;
};

export async function capture(
  argv: readonly string[],
  options: CaptureOptions = {},
): Promise<Capture> {
  const proc = Bun.spawn([...argv], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...options.env },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
    proc.exited,
  ]);
  return { exitCode: normalizeExitCode(exitCode), stdout, stderr };
}

function normalizeExitCode(exitCode: number | null): number {
  if (exitCode === null) return 1;
  return exitCode;
}

async function readStream(
  stream: ReadableStream<Uint8Array> | number | null | undefined,
): Promise<string> {
  if (stream == null || typeof stream === "number") return "";
  return new Response(stream).text();
}
