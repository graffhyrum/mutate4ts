/**
 * Pure helpers for the vet Stop hook. No process I/O here, so bun coverage
 * counts this file; the I/O half lives in vet-stop.ts.
 */
import { type } from "arktype";
import { type StopHookInput, StopHookInputSchema } from "./hook-schema";
export const MAX_OUTPUT_CHARS = 12_000;
// Size check applied after stdin is fully read; it is not a memory cap.
export const MAX_STDIN_CHARS = 1_048_576;
export const DEFAULT_VET_TIMEOUT_MS = 280_000;
// Largest delay setTimeout accepts (32-bit signed); above it the timer fires after ~1 ms.
export const MAX_TIMER_MS = 2_147_483_647;
export const ENV_SKIP_NO_CODE = "MUTATE4TS_VET_SKIP_NO_CODE";
export const ENV_SCRUB_ENV = "MUTATE4TS_VET_SCRUB_ENV";
export const ENV_VET_CMD = "MUTATE4TS_VET_CMD";
export const ENV_VET_TIMEOUT_MS = "MUTATE4TS_VET_TIMEOUT_MS";

const StopInputFromJson = type("string.json.parse").to(StopHookInputSchema);
const FIX_INSTRUCTION =
  "Fix every issue in the untrusted tool output below, then end the turn so the hook re-runs.";
const SECRET_ENV_KEY = /SECRET|TOKEN|PASSWORD|API[_-]?KEY|CREDENTIAL|PRIVATE[_-]?KEY|AUTH/i;
const MIN_SECRET_VALUE_LEN = 8;
const POSITIVE_INTEGER = /^[1-9]\d*$/;
const ROOT_CODE_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "bunfig.toml",
  ".oxlintrc.json",
  ".oxfmtrc.json",
  "bun.lock",
]);

export function vetCommand(env: Record<string, string | undefined> = process.env): string[] {
  const override = env[ENV_VET_CMD]?.trim();
  if (override) {
    // Split on whitespace only: quoted arguments are not supported in overrides.
    return override.split(/\s+/).filter(Boolean);
  }
  return ["bun", "run", "vet"];
}

/** Positive integer from env, at most MAX_TIMER_MS, else the default. */
export function vetTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  const raw = env[ENV_VET_TIMEOUT_MS]?.trim();
  if (raw && POSITIVE_INTEGER.test(raw)) {
    const ms = Number(raw);
    if (Number.isSafeInteger(ms) && ms <= MAX_TIMER_MS) {
      return ms;
    }
  }
  return DEFAULT_VET_TIMEOUT_MS;
}

/**
 * Parse raw stop stdin. Bad input must not skip the gate: on any problem return
 * the fallback input (a completed turn) plus the reason, so the caller logs it.
 */
export function resolveStopInput(text: string): { input: StopHookInput; problem: string | null } {
  if (text.length > MAX_STDIN_CHARS) {
    return fallbackStopInput(
      `stdin exceeds ${MAX_STDIN_CHARS} chars (size check after reading, not a memory cap)`,
    );
  }
  if (!text.trim()) {
    return { input: completedStopInput(), problem: null };
  }
  const parsed = StopInputFromJson(text);
  if (parsed instanceof type.errors) {
    return fallbackStopInput(`stdin is not a valid stop payload: ${parsed.summary}`);
  }
  return { input: parsed, problem: null };
}

function fallbackStopInput(problem: string): { input: StopHookInput; problem: string } {
  return { input: completedStopInput(), problem };
}

// Fresh object per call so no caller can mutate a shared fallback.
function completedStopInput(): StopHookInput {
  return { status: "completed" };
}

export function buildFollowup(
  exitCode: number,
  stdout: string,
  stderr: string,
  commandLabel = "bun run vet",
  env: Record<string, string | undefined> = process.env,
): string {
  return buildMessage(
    `Stop hook: \`${commandLabel}\` failed (exit code ${exitCode}).`,
    stdout,
    stderr,
    env,
  );
}

export function buildTimeoutFollowup(
  commandLabel: string,
  timeoutMs: number,
  stdout: string,
  stderr: string,
  env: Record<string, string | undefined> = process.env,
): string {
  return buildMessage(
    `Stop hook: \`${commandLabel}\` timed out after ${timeoutMs} ms and was killed.`,
    stdout,
    stderr,
    env,
  );
}

function buildMessage(
  header: string,
  stdout: string,
  stderr: string,
  env: Record<string, string | undefined>,
): string {
  const combined = [stdout, stderr]
    .filter((s) => s.trim().length > 0)
    .join("\n")
    .trim();
  const body = sanitizeFence(combined || "(no output captured)");
  const truncated =
    body.length > MAX_OUTPUT_CHARS ? `…(truncated)\n${keepTail(body, MAX_OUTPUT_CHARS)}` : body;
  const message = [header, FIX_INSTRUCTION, "", "```text", truncated, "```"].join("\n");
  return scrubEnvSecrets(message, env);
}

export function scrubEnvSecrets(
  text: string,
  env: Record<string, string | undefined> = process.env,
): string {
  if (env[ENV_SCRUB_ENV] !== "1") {
    return text;
  }
  let out = text;
  for (const [key, value] of Object.entries(env)) {
    if (!value || value.length < MIN_SECRET_VALUE_LEN) {
      continue;
    }
    if (!SECRET_ENV_KEY.test(key)) {
      continue;
    }
    out = out.split(value).join(`[scrubbed:${key}]`);
  }
  return out;
}

export function keepTail(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(text.length - maxChars);
}

export function porcelainHasCodeChanges(porcelain: string): boolean {
  for (const line of porcelain.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const path = porcelainPath(line);
    if (path && isCodePath(path)) {
      return true;
    }
  }
  return false;
}

export function isCodePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  if (ROOT_CODE_FILES.has(normalized)) {
    return true;
  }
  return (
    normalized.startsWith("src/") ||
    normalized.startsWith("test/") ||
    normalized.startsWith("scripts/") ||
    normalized.startsWith(".cursor/") ||
    normalized.startsWith(".grok/") ||
    normalized.startsWith(".github/")
  );
}

function sanitizeFence(text: string): string {
  return text.replaceAll("```", "'''");
}

/** Best-effort porcelain path (destination on renames). Split rename before unquote. */
function porcelainPath(line: string): string | null {
  if (line.length < 4) {
    return null;
  }
  const rest = line.slice(3);
  const arrow = rest.lastIndexOf(" -> ");
  const raw = arrow >= 0 ? rest.slice(arrow + 4) : rest;
  return unquoteGitPath(raw.trim()).replaceAll("\\", "/");
}

function unquoteGitPath(path: string): string {
  if (path.length >= 2 && path.startsWith('"') && path.endsWith('"')) {
    return path.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
  }
  return path;
}
