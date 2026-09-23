import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dist = new URL("../dist/", import.meta.url);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: [fileURLToPath(new URL("../src/background.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("./background.js", dist)),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome116",
  sourcemap: true
});

await build({
  entryPoints: [fileURLToPath(new URL("../src/content.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("./content.js", dist)),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome116",
  sourcemap: true
});

await cp(
  new URL("../manifest.json", import.meta.url),
  new URL("./manifest.json", dist)
);

console.log("Built Chrome extension to apps/extension/dist");
