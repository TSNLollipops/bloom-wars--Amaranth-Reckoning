// Build-time constants injected by vite.config.ts's `define` (1 Sep 2026).
// Ambient declarations only — nothing is exported; the values are
// substituted into the bundle at build time.
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

// VITE_DEMO_MISSION_CAP (12 Sep 2026, Business Plan v1 §2b/§13) is a
// Vite-native env var, not a `define` constant — Vite exposes any
// VITE_-prefixed variable on import.meta.env by itself, no config needed.
// This just gives it a real declared type instead of falling back to
// vite/client's own untyped index signature. See src/data/demoCap.ts,
// .env.demo, and package.json's "build:demo" script.
interface ImportMetaEnv {
  readonly VITE_DEMO_MISSION_CAP?: string;
}
