// vite.config.ts — first config file this project has needed (1 Sep 2026,
// feature-gap report A7). Everything Vite does here was already its
// default; the only addition is two build-time constants so the main
// menu can show a version and build stamp — the first question on every
// tester's bug report is "which build were you on," and until now there
// was no answer anywhere on screen. `define` is a compile-time text
// substitution (the string is baked into the bundle), so nothing here runs
// in the browser and there is no runtime file read. Declared for tsc in
// src/buildInfo.d.ts. Vitest reads this same config, so tests see the
// constants too.
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const stamp = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const buildTime = `${stamp.getUTCFullYear()}-${pad(stamp.getUTCMonth() + 1)}-${pad(stamp.getUTCDate())} ${pad(stamp.getUTCHours())}:${pad(stamp.getUTCMinutes())}Z`;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
});
