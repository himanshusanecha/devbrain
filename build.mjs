import { build } from "esbuild";
import { readdirSync, statSync } from "fs";
import { join } from "path";

function collectEntryPoints(dir, entries = []) {
  for (const file of readdirSync(dir)) {
    const full = join(dir, file);
    if (statSync(full).isDirectory()) {
      collectEntryPoints(full, entries);
    } else if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
      entries.push(full);
    }
  }
  return entries;
}

const entryPoints = collectEntryPoints("src");

await build({
  entryPoints,
  outdir: "dist",
  bundle: false,
  platform: "node",
  format: "cjs",
  target: "node18",
  sourcemap: true,
  outExtension: { ".js": ".js" },
});

console.log("Build complete →", entryPoints.length, "files");
