import { type } from "arktype";

const CliOptionsSchema = type({
  sourceFile: "string",
  "scan?": "boolean",
  "testCommand?": "string",
  "lines?": "number.integer[]",
  "verbose?": "boolean",
  "timeoutFactor?": "number > 0",
});

type CliOptions = typeof CliOptionsSchema.infer;

type ResolvedOptions = {
  readonly sourceFile: string;
  readonly scan: boolean;
  readonly testCommand: readonly string[];
  readonly lines: readonly number[] | undefined;
  readonly verbose: boolean;
  readonly timeoutFactor: number;
};

function parseCliOptions(argv: readonly string[]): ResolvedOptions {
  const raw = preprocessArgv(argv.slice(2));
  return validateAndResolve(raw);
}

function resolveDefaults(opts: CliOptions): ResolvedOptions {
  return {
    sourceFile: opts.sourceFile,
    scan: opts.scan ?? false,
    testCommand: (opts.testCommand ?? "bun test").split(" "),
    lines: opts.lines,
    verbose: opts.verbose ?? false,
    timeoutFactor: opts.timeoutFactor ?? 2,
  };
}

function validateAndResolve(raw: Record<string, unknown>): ResolvedOptions {
  const result = CliOptionsSchema(raw);
  if (result instanceof type.errors) exitWithUsage(result.summary);
  return resolveDefaults(result);
}

function preprocessArgv(args: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let i = 0;
  while (i < args.length) {
    i = processArg(args, i, result);
  }
  return result;
}

function processArg(args: readonly string[], i: number, result: Record<string, unknown>): number {
  const arg = args[i];
  if (arg === "--scan") return setBoolFlag(result, "scan", i);
  if (arg === "--verbose") return setBoolFlag(result, "verbose", i);
  if (arg === "--test-command") return setStringFlag(args, result, "testCommand", i);
  if (arg === "--lines") return setLinesFlag(args, result, i);
  if (arg === "--timeout-factor") return setNumberFlag(args, result, "timeoutFactor", i);
  if (arg === "--help") return showHelp();
  if (arg.startsWith("-")) return exitWithUsage(`Unknown flag: ${arg}`);
  result["sourceFile"] = arg;
  return i + 1;
}

function setBoolFlag(result: Record<string, unknown>, key: string, i: number): number {
  result[key] = true;
  return i + 1;
}

function setStringFlag(
  args: readonly string[],
  result: Record<string, unknown>,
  key: string,
  i: number,
): number {
  result[key] = args[i + 1];
  return i + 2;
}

function setNumberFlag(
  args: readonly string[],
  result: Record<string, unknown>,
  key: string,
  i: number,
): number {
  const val = Number(args[i + 1]);
  if (Number.isNaN(val)) return exitWithUsage(`Invalid number for --${key}: ${args[i + 1]}`);
  result[key] = val;
  return i + 2;
}

function setLinesFlag(args: readonly string[], result: Record<string, unknown>, i: number): number {
  result["lines"] = parseLines(args[i + 1]);
  return i + 2;
}

function parseLines(value: string): readonly number[] {
  const nums = value.split(",").map(Number);
  if (nums.some(Number.isNaN)) return exitWithUsage(`Invalid --lines value: ${value}`);
  return nums;
}

function showHelp(): never {
  console.log(USAGE);
  return process.exit(0);
}

function exitWithUsage(message: string): never {
  console.error(`Error: ${message}\n`);
  console.error(USAGE);
  return process.exit(1);
}

const USAGE = `Usage: mutate4ts [options] <sourceFile>

Options:
  --scan              List mutation sites without running tests
  --test-command CMD  Test command to run (default: "bun test")
  --lines N,N,...     Restrict mutations to specific lines
  --timeout-factor N  Timeout multiplier for test runs (default: 2)
  --verbose           Show detailed output
  --help              Show this help message`;

export { parseCliOptions, exitWithUsage };
export type { CliOptions, ResolvedOptions };
