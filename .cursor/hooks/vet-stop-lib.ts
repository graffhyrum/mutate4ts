/**
 * Pure helpers for the vet Stop hook. No process I/O here, so bun coverage
 * counts this file; the I/O half lives in vet-stop.ts.
 */
export const MAX_OUTPUT_CHARS = 12_000;
export const MAX_STDIN_CHARS = 8_192;
export const DEFAULT_VET_TIMEOUT_MS = 280_000;
export const ENV_SKIP_NO_CODE = "MUTATE4TS_VET_SKIP_NO_CODE";
export const ENV_SCRUB_ENV = "MUTATE4TS_VET_SCRUB_ENV";
export const ENV_VET_CMD = "MUTATE4TS_VET_CMD";
export const ENV_VET_TIMEOUT_MS = "MUTATE4TS_VET_TIMEOUT_MS";

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

/** Positive integer from env, else the default. */
export function vetTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  const raw = env[ENV_VET_TIMEOUT_MS]?.trim();
  if (raw && POSITIVE_INTEGER.test(raw) && Number.isSafeInteger(Number(raw))) {
    return Number(raw);
  }
  return DEFAULT_VET_TIMEOUT_MS;
}

export function buildFollowup(
  exitCode: number,
  stdout: string,
  stderr: string,
  commandLabel = "bun run vet",
): string {
  const combined = [stdout, stderr]
    .filter((s) => s.trim().length > 0)
    .join("\n")
    .trim();
  const body = sanitizeFence(combined || "(no output captured)");
  const truncated =
    body.length > MAX_OUTPUT_CHARS ? `…(truncated)\n${keepTail(body, MAX_OUTPUT_CHARS)}` : body;
  const message = [
    `Stop hook: \`${commandLabel}\` failed (exit code ${exitCode}).`,
    "Fix every issue in the untrusted tool output below, then end the turn so the hook re-runs.",
    "",
    "```text",
    truncated,
    "```",
  ].join("\n");
  return scrubEnvSecrets(message, process.env);
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
    normalized.startsWith(".cursor/hooks/")
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
