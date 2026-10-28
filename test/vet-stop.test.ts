import { type } from "arktype";
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  blockStopOutput,
  CommonHookInputSchema,
  parseHookPayload,
  shouldRunStopGate,
  StopHookInputSchema,
  StopHookOutputSchema,
} from "../.cursor/hooks/hook-schema";
import { runEntry } from "../.cursor/hooks/vet-stop";
import {
  buildFollowup,
  buildTimeoutFollowup,
  DEFAULT_VET_TIMEOUT_MS,
  isCodePath,
  keepTail,
  MAX_STDIN_CHARS,
  porcelainHasCodeChanges,
  resolveStopInput,
  scrubEnvSecrets,
  vetCommand,
  vetTimeoutMs,
} from "../.cursor/hooks/vet-stop-lib";

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

describe("buildTimeoutFollowup", () => {
  test("states the timeout without a fake exit code and fences the output", () => {
    const msg = buildTimeoutFollowup("sh slow.sh", 500, "partial out", "partial err");
    expect(msg).toContain("Stop hook: `sh slow.sh` timed out after 500 ms and was killed.");
    expect(msg).toContain("Fix every issue in the untrusted tool output below");
    expect(msg).toContain("```text\npartial out\npartial err\n```");
    expect(msg).not.toContain("exit code");
  });

  test("sanitizes fences, truncates and reports empty output", () => {
    expect(buildTimeoutFollowup("x", 1, "a ``` b", "")).toContain("a ''' b");
    expect(buildTimeoutFollowup("x", 1, "", "")).toContain("(no output captured)");
    const msg = buildTimeoutFollowup("x", 1, `HEAD_${"z".repeat(13_000)}`, "TAIL");
    expect(msg).toContain("…(truncated)");
    expect(msg).not.toContain("HEAD_");
  });
});

describe("resolveStopInput", () => {
  test("parses a valid stop payload with no problem", () => {
    expect(resolveStopInput('{"status":"aborted","loop_count":1}')).toEqual({
      input: { status: "aborted", loop_count: 1 },
      problem: null,
    });
  });

  test("treats empty stdin as a completed turn without a problem", () => {
    expect(resolveStopInput("  \n")).toEqual({ input: { status: "completed" }, problem: null });
  });

  test("falls back to a completed turn and names the problem", () => {
    const oversized = resolveStopInput(" ".repeat(MAX_STDIN_CHARS + 1));
    expect(oversized.input).toEqual({ status: "completed" });
    expect(oversized.problem).toBe(`stdin exceeds ${MAX_STDIN_CHARS} chars`);
    expect(resolveStopInput(" ".repeat(MAX_STDIN_CHARS)).problem).toBeNull();

    for (const bad of ["not json", '{"status":"nope"}', '"str"', '{"loop_count":-1}']) {
      const result = resolveStopInput(bad);
      expect(result.input).toEqual({ status: "completed" });
      expect(result.problem).toContain("not a valid stop payload");
    }
  });
});

describe("vetTimeoutMs", () => {
  test("uses a positive integer from env", () => {
    expect(vetTimeoutMs({ MUTATE4TS_VET_TIMEOUT_MS: "500" })).toBe(500);
    expect(vetTimeoutMs({ MUTATE4TS_VET_TIMEOUT_MS: " 42 " })).toBe(42);
  });

  test("falls back to the default for anything else", () => {
    for (const bad of ["", "0", "-5", "1.5", "abc", "10ms", "1e3", "99999999999999999999"]) {
      expect(vetTimeoutMs({ MUTATE4TS_VET_TIMEOUT_MS: bad })).toBe(DEFAULT_VET_TIMEOUT_MS);
    }
    expect(vetTimeoutMs({})).toBe(280_000);
  });
});

describe("vetCommand", () => {
  test("defaults to bun run vet", () => {
    expect(vetCommand({})).toEqual(["bun", "run", "vet"]);
    expect(vetCommand({ MUTATE4TS_VET_CMD: "   " })).toEqual(["bun", "run", "vet"]);
  });

  test("splits the override on whitespace without quote handling", () => {
    expect(vetCommand({ MUTATE4TS_VET_CMD: "  sh  a/b.sh " })).toEqual(["sh", "a/b.sh"]);
    expect(vetCommand({ MUTATE4TS_VET_CMD: `sh -c "x y"` })).toEqual(["sh", "-c", `"x`, `y"`]);
  });
});

describe("keepTail", () => {
  test("keeps short text and trims long text from the front", () => {
    expect(keepTail("abc", 5)).toBe("abc");
    expect(keepTail("abcdef", 3)).toBe("def");
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

  test("shouldRunStopGate skips when Grok stopHookActive is true", () => {
    expect(shouldRunStopGate({ reason: "end_turn", stopHookActive: true })).toBe(false);
    expect(shouldRunStopGate({ stopHookActive: true })).toBe(false);
    expect(shouldRunStopGate({ reason: "end_turn", stopHookActive: false })).toBe(true);
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

describe("runEntry fail-open", () => {
  test("prints {} and exits 0 when the run throws", async () => {
    const stdout = spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = spyOn(console, "error").mockImplementation(() => {});
    const exit = spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const sleep = spyOn(Bun, "sleep").mockImplementation(async () => {});
    try {
      await runEntry(async () => {
        throw new Error("boom");
      });
      expect(stdout.mock.calls).toEqual([["{}\n"]]);
      expect(stderr.mock.calls[0]?.[0]).toBe("[vet-stop] fatal");
      expect(exit.mock.calls).toEqual([[0]]);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
      exit.mockRestore();
      sleep.mockRestore();
    }
  });
});

describe("vet-stop hook process", () => {
  async function runHook(stdin: string, vetCmd: string, extraEnv: Record<string, string> = {}) {
    const proc = Bun.spawn(["bun", ".cursor/hooks/vet-stop.ts"], {
      stdin: new Blob([stdin]),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, MUTATE4TS_VET_CMD: vetCmd, ...extraEnv },
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

  test("runs the gate on unparseable stdin (vet passes)", async () => {
    const { stdout, exitCode } = await runHook("not json", "true");
    expect(exitCode).toBe(0);
    expect(stdout).toBe("{}");
  });

  test("runs the gate on unparseable stdin (vet fails)", async () => {
    const { stdout, exitCode } = await runHook("not json", "false");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout).decision).toBe("block");
  });

  test("runs the gate on oversized stdin", async () => {
    const { stdout, exitCode } = await runHook(" ".repeat(MAX_STDIN_CHARS + 1), "false");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout).decision).toBe("block");
  });

  test("emits {} without running vet when stopHookActive is true", async () => {
    const { stdout, exitCode } = await runHook(
      '{"status":"completed","stopHookActive":true}',
      "false",
    );
    expect(exitCode).toBe(0);
    expect(stdout).toBe("{}");
  });

  describe("timeout", () => {
    let dir: string | undefined;
    let marker: string | undefined;

    afterEach(async () => {
      // Safety net: kill leftover sleepers (marker is unique to this run) by pid.
      if (marker) {
        for (const pid of sleeperPids(marker)) {
          process.kill(pid, "SIGKILL");
        }
      }
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
      dir = undefined;
      marker = undefined;
    });

    test.skipIf(!hasPgrep)(
      "kills the whole vet process group and blocks with a timed-out message",
      async () => {
        dir = await mkdtemp(join(tmpdir(), "vet-stop-timeout-"));
        marker = `31.${Date.now()}`;
        const script = join(dir, "slow.sh");
        await Bun.write(script, `sleep ${marker} &\nsleep ${marker}\n`);

        const started = Date.now();
        const { stdout, exitCode } = await runHook('{"status":"completed"}', `sh ${script}`, {
          MUTATE4TS_VET_TIMEOUT_MS: "500",
        });

        expect(Date.now() - started).toBeLessThan(10_000);
        expect(exitCode).toBe(0);
        const out = JSON.parse(stdout);
        expect(out.decision).toBe("block");
        expect(out.reason).toContain(`\`sh ${script}\` timed out after 500 ms and was killed.`);
        expect(out.reason).not.toContain("exit code 1");
        expect(sleeperPids(marker)).toEqual([]);
      },
      15_000,
    );
  });
});

const hasPgrep = Bun.which("pgrep") !== null;

function sleeperPids(marker: string): number[] {
  const { stdout } = Bun.spawnSync(["pgrep", "-f", `sleep ${marker}`]);
  return stdout.toString().split("\n").filter(Boolean).map(Number);
}
