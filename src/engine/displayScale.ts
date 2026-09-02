// src/engine/displayScale.ts
//
// Screen Resolution Plan v1 (2 Sep 2026) — the player-facing half of the fix.
// main.ts's Phaser.Scale.FIT (1 Sep 2026, feature-gap report A5) solved "a
// small box in the middle of a big monitor" by letting the fixed 1074x640
// logical canvas stretch to fill whatever window/screen it's given. It had
// no upper bound: on a 1440p/4K/ultrawide monitor the canvas gets stretched
// 2-3x past its authored size, and every hand-placed pixel coordinate in
// Hub.ts/Battle.ts/etc. blows up right along with it — Maxime's own "the UI
// gotten too big" report, 2 Sep 2026. Full diagnosis and the bigger options
// that were flagged but NOT taken (a true responsive per-scene relayout is
// a structural rework): claude/Bloom_Wars_Screen_Resolution_Plan_v1.md.
//
// The fix here is a ceiling, not a redesign: bound how far FIT is allowed
// to stretch the canvas (index.html's #app gets a max-width/max-height, in
// CSS pixels, read from the two custom properties this module writes), and
// let the player choose where that ceiling sits (Options.ts). Below the
// ceiling, on a small window or a laptop screen, FIT still shrinks exactly
// as it always did — this only ever caps growth, never forces a size.
//
// Deliberately Phaser-free, same reason hubGeometry.ts is one: every scene
// file imports Phaser at module scope, which throws outside a real browser,
// so keeping this file free of that import is what lets it be unit-tested
// directly instead of only eyeballed in the browser. Also DOM-guarded (safe
// to import from a test file, or any other non-browser context, where
// `document`/`localStorage` don't exist) — vitest's default environment
// here is plain Node, no jsdom, so every DOM access below is defensive.

export const GAME_WIDTH = 1074;
export const GAME_HEIGHT = 640;

export type DisplayScaleId = "100" | "125" | "150" | "175" | "fill";

export interface DisplayScaleOption {
  id: DisplayScaleId;
  /** Short label for a button, e.g. "150%". */
  shortLabel: string;
  /** Fuller description for a status line, e.g. "150% (default)". */
  label: string;
  /** Multiplier on the base 1074x640 canvas, or null for "fill" — no cap, the old uncapped FIT behavior. */
  multiplier: number | null;
}

export const DISPLAY_SCALE_OPTIONS: DisplayScaleOption[] = [
  { id: "100", shortLabel: "100%", label: "100% — native size, sharpest on any monitor", multiplier: 1 },
  { id: "125", shortLabel: "125%", label: "125%", multiplier: 1.25 },
  { id: "150", shortLabel: "150%", label: "150% (default)", multiplier: 1.5 },
  { id: "175", shortLabel: "175%", label: "175%", multiplier: 1.75 },
  { id: "fill", shortLabel: "FILL", label: "Fill screen — no cap, may look oversized on a big monitor", multiplier: null },
];

export const DEFAULT_DISPLAY_SCALE: DisplayScaleId = "150";

const STORAGE_KEY = "bloomwars_display_scale_v1";

export function getDisplayScaleOption(id: string | null | undefined): DisplayScaleOption {
  return DISPLAY_SCALE_OPTIONS.find((o) => o.id === id) ?? DISPLAY_SCALE_OPTIONS.find((o) => o.id === DEFAULT_DISPLAY_SCALE)!;
}

/** Reads the player's saved choice (Options.ts), defaulting to 150% if nothing's saved yet or storage isn't available. */
export function getStoredDisplayScaleId(): DisplayScaleId {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_DISPLAY_SCALE;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && DISPLAY_SCALE_OPTIONS.some((o) => o.id === raw)) return raw as DisplayScaleId;
  } catch {
    // localStorage can throw in a locked-down embed (same reason Options.ts's
    // own clipboard write is wrapped in try/catch) — fall through to the default.
  }
  return DEFAULT_DISPLAY_SCALE;
}

export function setStoredDisplayScaleId(id: DisplayScaleId): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Best-effort — a failed save just means the choice doesn't survive reload.
  }
}

/**
 * The CSS pixel cap on the game's parent element (#app) for a given option,
 * computed from the base canvas size. Pure function, no DOM access, so it's
 * directly testable without a browser.
 */
export function capFor(option: DisplayScaleOption): { maxWidthPx: number | null; maxHeightPx: number | null } {
  if (option.multiplier === null) return { maxWidthPx: null, maxHeightPx: null };
  return {
    maxWidthPx: Math.round(GAME_WIDTH * option.multiplier),
    maxHeightPx: Math.round(GAME_HEIGHT * option.multiplier),
  };
}

/**
 * Applies a display-scale option to the live page by setting the two CSS
 * custom properties index.html's #app reads as its own max-width/max-height.
 * No-op outside a browser (safe to call from a test or from Node tooling).
 *
 * This does NOT tell Phaser to re-measure its parent — a CSS variable change
 * doesn't fire a resize event on its own. Call `scene.scale.refresh()` (any
 * live Scene has a `.scale` reference to the game-wide Scale Manager) right
 * after this if the game is already running, same as any other manual
 * resize of the Scale Manager's parent element.
 */
export function applyDisplayScale(id: DisplayScaleId): void {
  const option = getDisplayScaleOption(id);
  const { maxWidthPx, maxHeightPx } = capFor(option);
  try {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--bw-max-w", maxWidthPx === null ? "none" : `${maxWidthPx}px`);
    root.style.setProperty("--bw-max-h", maxHeightPx === null ? "none" : `${maxHeightPx}px`);
  } catch {
    // Non-fatal — worst case the page keeps whatever cap it already had.
  }
}
