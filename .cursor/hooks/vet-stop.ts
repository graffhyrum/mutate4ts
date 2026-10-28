/**
 * Stop hook: run `bun run vet` after each agent turn (Cursor + Grok).
 * Always exits 0 so harness fail-open never drops the agent loop.
 * - `bun run vet` non-zero or timed out → block finish with failure context:
 *   Cursor: `followup_message`; Grok: `decision: "block"` + `reason`
 * - parse fail / non-completed / session-end / skip → stdout `{}`
 *
 * This file is process I/O only (ignored by bun coverage; test/vet-stop.test.ts
 * spawns it). Pure logic lives in vet-stop-lib.ts.
 *
 * Opt-in env:
 * - MUTATE4TS_VET_SKIP_NO_CODE=1 — skip vet when git porcelain has no code paths
 * - MUTATE4TS_VET_SCRUB_ENV=1 — redact secret-like env values in followup_message
 * - MUTATE4TS_VET_CMD — override the vet command (split on whitespace, no quoted args)
 * - MUTATE4TS_VET_TIMEOUT_MS — vet timeout, positive integer (default 280000)
 */
import { stdin } from "bun";
import {
  type StopHookInput,
  type StopHookOutput,
  StopHookInputSchema,
  StopHookOutputSchema,
  blockStopOutput,
  parseHookPayload,
  shouldRunStopGate,
} from "./hook-schema";
import {
  ENV_SKIP_NO_CODE,
  MAX_OUTPUT_CHARS,
  MAX_STDIN_CHARS,
  buildFollowup,
  keepTail,
  porcelainHasCodeChanges,
  vetCommand,
  vetTimeoutMs,
} from "./vet-stop-lib";

type VetResult = { exitCode: number; stdout: string; stderr: string; timedOut: boolean };

if (import.meta.main) {
  await runEntry();
}

async function runEntry(): Promise<void> {
  try {
    await main();
  } catch (error) {
    // Raw write: the fallback must not go through the asserting emit().
    console.error("[vet-stop] fatal", error);
    process.stdout.write("{}\n");
  }
  // Windows: brief pause so Cursor can capture stdout before process exit
  await Bun.sleep(50);
  process.exit(0);
}

export async function main(): Promise<void> {
  let input: StopHookInput;
  try {
    input = await readStopInput();
  } catch (error) {
    console.error("[vet-stop] stdin parse failed", error);
    emit({});
    return;
  }

  if (!shouldRunStopGate(input)) {
    emit({});
    return;
  }

  if (process.env[ENV_SKIP_NO_CODE] === "1") {
    const hasCode = await hasRelevantCodeChanges();
    if (!hasCode) {
      console.error(`[vet-stop] skip: no code changes (${ENV_SKIP_NO_CODE}=1)`);
      emit({});
      return;
    }
  }

  const commandLabel = vetCommand().join(" ");
  try {
    const { exitCode, stdout, stderr, timedOut } = await runVet();
    if (timedOut) {
      console.error(`[vet-stop] ${commandLabel} timed out`);
      emit(blockStopOutput(buildTimeoutFollowup(commandLabel, stdout, stderr)));
      return;
    }
    if (exitCode === 0) {
      emit({});
      return;
    }
    console.error(`[vet-stop] ${commandLabel} exited ${exitCode}`);
    emit(blockStopOutput(buildFollowup(exitCode, stdout, stderr, commandLabel)));
  } catch (error) {
    console.error("[vet-stop] vet run failed", error);
    emit(
      blockStopOutput(
        buildFollowup(1, "", error instanceof Error ? error.message : String(error), commandLabel),
      ),
    );
  }
}

function buildTimeoutFollowup(commandLabel: string, stdout: string, stderr: string): string {
  const timeoutMs = vetTimeoutMs();
  const failure = buildFollowup(1, stdout, stderr, commandLabel);
  return `Stop hook: \`${commandLabel}\` timed out after ${timeoutMs} ms and was killed.\n\n${failure}`;
}

async function runVet(): Promise<VetResult> {
  const proc = Bun.spawn(vetCommand(), {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
    // Own process group, so a timeout can kill vet's children too; otherwise
    // they keep the pipes open and readTail never resolves.
    detached: true,
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killGroup(proc.pid);
  }, vetTimeoutMs());
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      readTail(proc.stdout, MAX_OUTPUT_CHARS),
      readTail(proc.stderr, MAX_OUTPUT_CHARS),
      proc.exited,
    ]);
    return { exitCode: exitCode ?? 1, stdout, stderr, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

function killGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    console.error("[vet-stop] kill group failed", error);
  }
}

async function readTail(
  stream: ReadableStream<Uint8Array> | null,
  maxChars: number,
): Promise<string> {
  if (!stream) {
    return "";
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      out = keepTail(out + decoder.decode(value, { stream: true }), maxChars);
    }
    return keepTail(out + decoder.decode(), maxChars);
  } finally {
    reader.releaseLock();
  }
}

async function hasRelevantCodeChanges(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["git", "status", "--porcelain", "--untracked-files=all"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    if (exitCode !== 0) {
      return true;
    }
    return porcelainHasCodeChanges(stdout);
  } catch (error) {
    console.error("[vet-stop] git status failed", error);
    return true;
  }
}

async function readStopInput(): Promise<StopHookInput> {
  const text = await stdin.text();
  if (text.length > MAX_STDIN_CHARS) {
    throw new Error(`stdin exceeds ${MAX_STDIN_CHARS} chars`);
  }
  if (!text.trim()) {
    return { status: "completed" };
  }
  return parseHookPayload(StopHookInputSchema, JSON.parse(text));
}

function emit(payload: StopHookOutput): void {
  const validated = parseHookPayload(StopHookOutputSchema, payload);
  process.stdout.write(`${JSON.stringify(validated)}\n`);
}
