export {};

const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "bun",
  minify: true,
  // Keep runtime deps external — npm install handles them
  external: ["typescript", "arktype"],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await prependShebang("dist/index.js");
await Bun.$`chmod +x dist/index.js`;
console.log("Built dist/index.js");

async function prependShebang(path: string): Promise<void> {
  const content = await Bun.file(path).text();
  await Bun.write(path, `#!/usr/bin/env bun\n${content}`);
}
