import { capture, type Capture } from "./capture.ts";

const coverage = await capture(["bun", "test", "--coverage", "--coverage-reporter=lcov"], {
  env: { AGENT: "1" },
});
if (coverage.exitCode !== 0) fail("coverage", coverage);

const score = await capture([
  "crap4ts",
  "-c",
  "coverage/lcov.info",
  "-f",
  "lcov",
  "--include",
  "src/**/*.ts",
  "--exclude",
  "**/*.test.ts",
  "--quiet",
]);
if (score.exitCode !== 0) fail("score", score);

function fail(label: string, result: Capture): never {
  process.stderr.write(`crap4ts: ${label} failed (exit ${result.exitCode})\n`);
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}
