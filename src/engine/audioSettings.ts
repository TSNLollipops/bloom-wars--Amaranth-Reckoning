// src/engine/audioSettings.ts
//
// Audio, "enough for EA" scope (feature-gap report A6, 9 Sep 2026 — "im at
// school i cant try thing with my hand. can we do 2-3," Maxime, picking this
// over Electron packaging). The report's own spec: "one ambient loop for
// the Hub, one for battle, a hit/miss/kill sound, a UI click, a mission-win
// sting, a pilot-lost sting... a 60-line audio manager, and two volume
// sliders in Options." This file is the settings half of that — the two
// sliders' own persistence — mirroring displayScale.ts's shape exactly:
// Phaser-free (src/engine may not import Phaser) and DOM-guarded (safe to
// import from a vitest file, which runs in plain Node, no jsdom). The
// Phaser-touching half (actually loading and playing the files) is
// scenes/audio/AudioManager.ts, which imports the two getters below.
//
// Real CC0 audio (Kenney.nl, freesound — the report's own suggested source)
// is unreachable from the sandbox this pass was built in; the eight files
// under public/audio/ are procedurally synthesized placeholders instead
// (tools/synth_placeholder_audio.py — rerunnable, and the exact place to
// swap in real licensed assets later without touching any code: same
// filenames, same folder, done).

export type VolumeChannel = "music" | "sfx";

const MUSIC_KEY = "bloomwars_volume_music_v1";
const SFX_KEY = "bloomwars_volume_sfx_v1";

/** Neither slider defaults to 0 or 100 — audio existing at all is new, and a
 * silent-by-default or startlingly-loud-by-default first impression are both
 * worse than a moderate, adjustable starting point. */
export const DEFAULT_MUSIC_VOLUME = 55;
export const DEFAULT_SFX_VOLUME = 70;

function readStoredPercent(key: string, fallback: number): number {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(100, Math.max(0, Math.round(n)));
  } catch {
    // localStorage can throw in a locked-down embed (same guard
    // displayScale.ts's own getStoredDisplayScaleId uses) — fall back.
    return fallback;
  }
}

function writeStoredPercent(key: string, value: number): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, String(Math.min(100, Math.max(0, Math.round(value)))));
  } catch {
    // Best-effort — a failed save just means the slider resets on reload.
  }
}

/** 0-100. The ambient Hub/battle loop's volume. */
export function getMusicVolume(): number {
  return readStoredPercent(MUSIC_KEY, DEFAULT_MUSIC_VOLUME);
}

export function setMusicVolume(percent: number): void {
  writeStoredPercent(MUSIC_KEY, percent);
}

/** 0-100. Every one-shot sting (hit/dodge/kill/click/mission-win/pilot-lost). */
export function getSfxVolume(): number {
  return readStoredPercent(SFX_KEY, DEFAULT_SFX_VOLUME);
}

export function setSfxVolume(percent: number): void {
  writeStoredPercent(SFX_KEY, percent);
}
