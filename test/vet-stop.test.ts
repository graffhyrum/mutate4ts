import { type } from "arktype";
import { describe, expect, test } from "bun:test";
import {
  blockStopOutput,
  CommonHookInputSchema,
  parseHookPayload,
  shouldRunStopGate,
  StopHookInputSchema,
  StopHookOutputSchema,
} from "../.cursor/hooks/hook-schema";
import {
  buildFollowup,
  isCodePath,
  porcelainHasCodeChanges,
  scrubEnvSecrets,
} from "../.cursor/hooks/vet-stop";

describe("isCodePath", () => {
  test("accepts src test scripts hooks and root configs", () => {
    expect(isCodePath("src/cli.ts")).toBe(true);
    expect(isCodePath("test/acceptance.test.ts")).toBe(true);
    expect(isCodePath("scripts/build.ts")).toBe(true);
    expect(isCodePath(".cursor/hooks/vet-stop.ts")).toBe(true);
    for (const file of [
      "package.json",
      "tsconfig.json",
      "bunfig.toml",
      ".oxlintrc.json",
      ".oxfmtrc.json",
      "bun.lock",
    ]) {
      expect(isCodePath(file)).toBe(true);
    }
  });

  test("rejects docs beads and nested package.json", () => {
    expect(isCodePath("docs/PRD.md")).toBe(false);
    expect(isCodePath(".beads/issues.jsonl")).toBe(false);
    expect(isCodePath("packages/foo/package.json")).toBe(false);
    expect(isCodePath("README.md")).toBe(false);
  });

  test("normalizes backslashes", () => {
    expect(isCodePath("src\\cli.ts")).toBe(true);
  });
});

describe("porcelainHasCodeChanges", () => {
  test("true when code path dirty", () => {
    expect(porcelainHasCodeChanges(" M src/cli.ts\n")).toBe(true);
    expect(porcelainHasCodeChanges("?? test/new.test.ts\n")).toBe(true);
    expect(porcelainHasCodeChanges("R  src/a.ts -> src/b.ts\n")).toBe(true);
    expect(porcelainHasCodeChanges('?? "src/has space.ts"\n')).toBe(true);
    expect(porcelainHasCodeChanges('R  "src/old name.ts" -> "src/new name.ts"\n')).toBe(true);
  });

  test("false for empty or non-code dirt", () => {
    expect(porcelainHasCodeChanges("")).toBe(false);
    expect(porcelainHasCodeChanges(" M docs/PRD.md\n M .beads/issues.jsonl\n")).toBe(false);
  });
});

describe("scrubEnvSecrets", () => {
  test("no-op unless scrub env enabled", () => {
    const text = "token=supersecretvalue";
    expect(scrubEnvSecrets(text, { API_TOKEN: "supersecretvalue" })).toBe(text);
  });

  test("redacts secret-like env values when enabled", () => {
    const out = scrubEnvSecrets("leak supersecretvalue here", {
      MUTATE4TS_VET_SCRUB_ENV: "1",
      API_TOKEN: "supersecretvalue",
      PATH: "/usr/bin",
      SHORT: "abc",
    });
    expect(out).toContain("[scrubbed:API_TOKEN]");
    expect(out).not.toContain("supersecretvalue");
    expect(out).toContain("leak ");
  });

  test("skips non-secret keys and short values", () => {
    const text = "HOME=/Users/me/project and SHORT=abcdefg";
    expect(
      scrubEnvSecrets(text, {
        MUTATE4TS_VET_SCRUB_ENV: "1",
        HOME: "/Users/me/project",
        SHORT: "abcdefg",
      }),
    ).toBe(text);
  });
});

describe("buildFollowup", () => {
  test("wraps failure output in fenced text block", () => {
    const msg = buildFollowup(2, "oops", "");
    expect(msg).toContain("exit code 2");
    expect(msg).toContain("`bun run vet`");
    expect(msg).toContain("```text");
    expect(msg).toContain("oops");
  });

  test("keeps tail of oversized combined output", () => {
    const head = `HEAD_MARKER_${"x".repeat(10_000)}`;
    const tail = `${"y".repeat(10_000)}_TAIL_MARKER`;
    const msg = buildFollowup(1, head, tail);
    expect(msg).toContain("…(truncated)");
    expect(msg).toContain("_TAIL_MARKER");
    expect(msg).not.toContain("HEAD_MARKER_");
  });

  test("neutralizes nested fences in tool output", () => {
    const msg = buildFollowup(1, "before ``` inject after", "");
    expect(msg).toContain("before ''' inject after");
    expect(msg).not.toContain("before ``` inject");
  });
});

describe("hook-schema stop I/O", () => {
  test("parses minimal and full stop input", () => {
    expect(parseHookPayload(StopHookInputSchema, { status: "completed" })).toEqual({
      status: "completed",
    });
    const full = parseHookPayload(StopHookInputSchema, {
      conversation_id: "conv-1",
      generation_id: "gen-1",
      model: "composer",
      model_id: "composer-1",
      model_params: [{ id: "effort", value: "max" }],
      hook_event_name: "stop",
      cursor_version: "1.7.2",
      workspace_roots: ["/proj"],
      user_email: null,
      transcript_path: null,
      status: "error",
      loop_count: 2,
    });
    expect(full.status).toBe("error");
    expect(full.loop_count).toBe(2);
    expect(full.workspace_roots).toEqual(["/proj"]);
  });

  test("rejects invalid stop status", () => {
    expect(() => parseHookPayload(StopHookInputSchema, { status: "nope" })).toThrow();
  });

  test("rejects negative loop_count", () => {
    expect(() =>
      parseHookPayload(StopHookInputSchema, { status: "completed", loop_count: -1 }),
    ).toThrow();
  });

  test("stop output accepts empty, followup, or dual block payload", () => {
    expect(parseHookPayload(StopHookOutputSchema, {})).toEqual({});
    expect(parseHookPayload(StopHookOutputSchema, { followup_message: "retry" })).toEqual({
      followup_message: "retry",
    });
    const blocked = blockStopOutput("fix vet");
    expect(parseHookPayload(StopHookOutputSchema, blocked)).toEqual({
      decision: "block",
      reason: "fix vet",
      followup_message: "fix vet",
    });
  });

  test("shouldRunStopGate honors Cursor status and Grok reason", () => {
    expect(shouldRunStopGate({ status: "completed" })).toBe(true);
    expect(shouldRunStopGate({ status: "aborted" })).toBe(false);
    expect(shouldRunStopGate({ reason: "end_turn" })).toBe(true);
    expect(shouldRunStopGate({ reason: "channel_closed" })).toBe(false);
    expect(shouldRunStopGate({ reason: "end_turn", status: "completed" })).toBe(true);
    expect(shouldRunStopGate({})).toBe(true);
  });

  test("parses Grok stop envelope without status", () => {
    const input = parseHookPayload(StopHookInputSchema, {
      hookEventName: "stop",
      reason: "end_turn",
      stopHookActive: false,
      sessionId: "s1",
      workspaceRoot: "/proj",
    });
    expect(input.reason).toBe("end_turn");
    expect(input.stopHookActive).toBe(false);
  });

  test("CommonHookInputSchema.merge composes hook-specific fields", () => {
    const Schema = CommonHookInputSchema.merge(type({ tool_name: "string" }));
    const value = parseHookPayload(Schema, { conversation_id: "c", tool_name: "Shell" });
    expect(value.tool_name).toBe("Shell");
    expect(value.conversation_id).toBe("c");
    expect(parseHookPayload(CommonHookInputSchema, { model: "x" }).model).toBe("x");
  });
});

describe("vet-stop hook process", () => {
  async function runHook(stdin: string, vetCmd: string) {
    const proc = Bun.spawn(["bun", ".cursor/hooks/vet-stop.ts"], {
      stdin: new Blob([stdin]),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, MUTATE4TS_VET_CMD: vetCmd },
    });
    const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    return { stdout: stdout.trim(), exitCode };
  }

  test("emits {} when vet passes", async () => {
    const { stdout, exitCode } = await runHook('{"status":"completed"}', "true");
    expect(exitCode).toBe(0);
    expect(stdout).toBe("{}");
  });

  test("emits block decision with followup when vet fails", async () => {
    const { stdout, exitCode } = await runHook('{"status":"completed"}', "false");
    expect(exitCode).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.decision).toBe("block");
    expect(out.followup_message).toBe(out.reason);
    expect(out.reason).toContain("`false` failed (exit code 1)");
  });

  test("emits {} without running vet for aborted turns", async () => {
    const { stdout, exitCode } = await runHook('{"status":"aborted"}', "false");
    expect(exitCode).toBe(0);
    expect(stdout).toBe("{}");
  });

  test("emits {} on unparseable stdin", async () => {
    const { stdout, exitCode } = await runHook("not json", "false");
    expect(exitCode).toBe(0);
    expect(stdout).toBe("{}");
  });
});
