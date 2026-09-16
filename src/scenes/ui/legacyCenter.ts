// src/scenes/ui/legacyCenter.ts
// Ship audit, 16 Sep 2026 (§2, "every menu screen sits 57px left of
// centre"). The canvas grew from 960 to 1074 wide on 30 Aug 2026 (Hub's
// chat sidebar — see main.ts) and the menu-type scenes (MainMenu,
// CampaignSetup, LoadGame, Options, Boot's recall notice) kept their
// hand-placed x=480 layouts, so each one renders with a dead 114px strip on
// the right — visible on the very first screen. Rather than re-author every
// x coordinate in five files, the camera is shifted once: scrolling it left
// by half the extra width puts world x=480 at screen x=537, the true centre.
// Pointer hit-testing, HoverTip (scrollFactor 0, screen-space pointer) and
// Phaser DOM elements all honour camera scroll, so nothing else changes.
// Anything a scene wants pinned to a real screen edge (a version stamp, a
// full-screen backdrop) gets setScrollFactor(0) and screen coordinates.
import type Phaser from "phaser";

/** The authored width these scenes were laid out for. */
export const LEGACY_LAYOUT_W = 960;

/** Shift the main camera so a 960-wide layout renders centred on the live canvas. Returns the shift in pixels (0 on a 960 canvas). */
export function centerLegacyLayout(scene: Phaser.Scene): number {
  const cam = scene.cameras.main;
  const shift = Math.max(0, Math.round((cam.width - LEGACY_LAYOUT_W) / 2));
  cam.setScroll(-shift, 0);
  return shift;
}
