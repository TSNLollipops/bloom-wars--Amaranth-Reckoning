// src/scenes/audio/AudioManager.ts
//
// Audio, "enough for EA" scope (feature-gap report A6, 9 Sep 2026) — the
// Phaser-touching half. engine/audioSettings.ts owns the two volume
// sliders' own persistence (Phaser-free, so it's unit-testable); this file
// is the ~60-line manager the report itself asked for: load the eight
// files once, play one ambient loop at a time, fire one-shot stings.
//
// Deliberately module-level state, not a per-scene class instance:
// Phaser's sound manager is already a GAME-wide singleton under the hood
// (`scene.sound` on every scene resolves to the same `game.sound`), so
// every scene calling into the same handful of functions here is simpler
// than threading an instance through init()/create() data on every scene
// transition, and it's what lets playAmbient() correctly stop a PREVIOUS
// scene's loop no matter which scene is calling.
//
// Ambient does NOT persist across a scene transition on purpose — Hub and
// Battle each call playAmbient() in their own create() and stopAmbient() in
// their own SHUTDOWN handler (see each file's own call site), so leaving to
// Options (or anywhere else) silences it and coming back restarts the loop
// from 0. That's a minor placeholder-era quirk, not a bug: real persistence
// (fading the SAME loop through a settings screen instead of restarting it)
// is a nice-to-have for later, not part of this pass's asked-for scope.
import Phaser from "phaser";
import { getMusicVolume, getSfxVolume } from "../../engine/audioSettings";

export type AmbientKey = "hub" | "battle";
export type SfxKey = "hit" | "dodge" | "kill" | "click" | "mission_win" | "pilot_lost";

// Cache-key -> file map. Real-asset swap-in later is exactly this: replace
// the file under public/audio/ with the same name, nothing else changes.
const FILES: Record<AmbientKey | SfxKey, string> = {
  hub: "hub_ambient",
  battle: "battle_ambient",
  hit: "sfx_hit",
  dodge: "sfx_dodge",
  kill: "sfx_kill",
  click: "sfx_click",
  mission_win: "sfx_mission_win",
  pilot_lost: "sfx_pilot_lost",
};

function cacheKey(id: AmbientKey | SfxKey): string {
  return `audio_${id}`;
}

/** Registers every file above with this.load — call once, from Preloader.ts's own preload(), same place portraits/splash art already loads. */
export function preloadAudio(scene: Phaser.Scene): void {
  for (const id of Object.keys(FILES) as (AmbientKey | SfxKey)[]) {
    // Relative, not "/audio/..." — itch.io asset-path fix, 16 Sep 2026. See
    // Preloader.ts's own comment on its portrait/splash loop for why.
    scene.load.audio(cacheKey(id), `audio/${FILES[id]}.ogg`);
  }
}

let currentAmbient: Phaser.Sound.BaseSound | null = null;
let currentAmbientKey: AmbientKey | null = null;

/** Starts looping the given ambient track, stopping whichever one (if any) was already playing. A repeat call for the SAME key that's already playing is a no-op — Hub re-running create() shouldn't restart its own loop mid-note. */
export function playAmbient(scene: Phaser.Scene, key: AmbientKey): void {
  if (currentAmbientKey === key && currentAmbient?.isPlaying) return;
  stopAmbient();
  // Missing-file guard, 16 Sep 2026 — same reason as playSfx below:
  // sound.add() throws on an uncached key, and this runs inside Hub/
  // Battle's own create(), where a throw would abort the rest of setup.
  if (!scene.cache.audio.exists(cacheKey(key))) return;
  const sound = scene.sound.add(cacheKey(key), { loop: true, volume: getMusicVolume() / 100 });
  sound.play();
  currentAmbient = sound;
  currentAmbientKey = key;
}

export function stopAmbient(): void {
  currentAmbient?.stop();
  currentAmbient?.destroy();
  currentAmbient = null;
  currentAmbientKey = null;
}

/**
 * Re-reads the current music-volume slider and applies it live — Options.ts
 * calls this on every slider move so the change is heard immediately.
 *
 * Restarts the currently-playing loop from 0 rather than adjusting its
 * volume in place: `BaseSound` (the type `scene.sound.add()` actually
 * returns) has no `volume`/`setVolume` in this Phaser version's own
 * typings — that lives only on the concrete backend classes
 * (WebAudioSound/HTML5AudioSound), which differ by browser and aren't
 * worth an unsafe cast to reach for a placeholder-era slider. A 12-second
 * ambient loop restarting the instant you move the slider that controls it
 * reads as immediate feedback, not a glitch.
 */
export function applyMusicVolumeLive(scene: Phaser.Scene): void {
  if (!currentAmbientKey) return;
  const key = currentAmbientKey;
  stopAmbient();
  playAmbient(scene, key);
}

/** One-shot stings — hit/dodge/kill/click/mission_win/pilot_lost. Fire-and-forget: Phaser's own scene.sound.play() manages the temporary Sound instance's lifetime, nothing here needs to track or destroy it. */
export function playSfx(scene: Phaser.Scene, key: SfxKey): void {
  // Missing-file guard, 16 Sep 2026 — this is the actual link between "40
  // assets 404'd" and "NEW CAMPAIGN does nothing" on itch.io (and very
  // likely the 10 Sep Electron "main menu buttons don't respond" bug too):
  // Phaser's sound.play() THROWS when the key isn't in the audio cache, and
  // makeShopButton (scenes/shop/ShopPanel.ts) calls playSfx("click")
  // BEFORE the button's own onClick — so one missing click sound turned
  // every shared button in the game into a dead click. A missing sound
  // should cost a sound, never a click, so skip quietly instead.
  const k = cacheKey(key);
  if (!scene.cache.audio.exists(k)) return;
  scene.sound.play(k, { volume: getSfxVolume() / 100 });
}
