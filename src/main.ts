// src/main.ts
import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import { MainMenu } from "./scenes/MainMenu";
import { CampaignSetup } from "./scenes/CampaignSetup";
import { LoadGame } from "./scenes/LoadGame";
import { Options } from "./scenes/Options";
import { Codex } from "./scenes/Codex";
import { MapSelect } from "./scenes/MapSelect";
import { TransporterPad } from "./scenes/TransporterPad";
import { Battle } from "./scenes/Battle";
import { Debrief } from "./scenes/Debrief";
import { Hangar } from "./scenes/Hangar";
import { Hub } from "./scenes/Hub";
import { applyDisplayScale, getStoredDisplayScaleId } from "./engine/displayScale";

// Screen Resolution Plan v1, 2 Sep 2026 — apply the player's saved display-
// scale cap (Options screen, defaults to 150%) to #app's max-width/max-
// height BEFORE the game boots, so Scale.FIT never even briefly renders at
// the wrong size on the very first frame. See src/engine/displayScale.ts
// and index.html's own :root fallback for the pre-script default.
applyDisplayScale(getStoredDisplayScaleId());

const __bwGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  // Tier 6 hotfix, 30 Aug 2026 — Maxime: "increase the size of the chat
  // window... double it for now." Hub.ts's own "OVERHEARD" chat sidebar was
  // already using every pixel of free space around the game board (full
  // room height, out to the old canvas edge) — there was nowhere left to
  // grow it without widening the game window itself. +114 here exactly
  // doubles that sidebar's width (see CHAT_LOG_WIDTH's own header in
  // Hub.ts) and CHAT_LOG_VISIBLE_LINES was doubled alongside it.
  //
  // Widening this canvas has a real blast radius: every OTHER scene's full-
  // screen darkening/backdrop rectangles (pause menu, mission-result
  // overlays, the new-campaign confirm) used to be hardcoded to the old
  // 960x640, which would have left a gap on the right showing whatever's
  // underneath instead of dimming it. Those were all switched to read the
  // live camera width/height instead of a hardcoded number, in Battle.ts,
  // MenuOverlay.ts (the shared MENU button used by Hub/MapSelect/Hangar/
  // Debrief), and MainMenu.ts — see each file's own Tier 6 hotfix comment.
  // Everything else (room boards, panels, buttons) stays at its existing
  // position — only full-screen coverage elements were touched, not a
  // whole-game recenter.
  width: 1074,
  height: 640,
  backgroundColor: "#0c0f12",
  // Scale to the window (1 Sep 2026, feature-gap report A5). Without this
  // the canvas rendered at a fixed 1074x640 CSS pixels — a small box in the
  // middle of any larger monitor, and the first thing a paying Electron
  // player would have complained about. FIT keeps the 1074x640 logical
  // coordinate space every scene is laid out in (nothing else in the game
  // changes: pointer events already arrive in game coordinates, and the
  // Hub's DOM chat input rides the same transform), letterboxing to the
  // window while preserving aspect ratio. CENTER_BOTH pins it mid-window.
  // Every scene's own hardcoded positions keep working precisely because
  // this scales the whole canvas rather than resizing it.
  //
  // Screen Resolution Plan v1, 2 Sep 2026 — FIT itself has no upper bound,
  // so on a 1440p/4K/ultrawide monitor it stretched this canvas 2-3x past
  // its authored size (Maxime's "the UI gotten too big"). The actual cap
  // lives one layer up, on #app itself (index.html's --bw-max-w/--bw-max-h,
  // applied by the call above) — FIT still does exactly what the comment
  // above describes, it just now fits inside a bounded parent instead of
  // an unbounded one. See claude/Bloom_Wars_Screen_Resolution_Plan_v1.md.
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Main Menu / Save / Ironman UI Plan v1, 28 Aug 2026 — MainMenu,
  // CampaignSetup, LoadGame and Options join the scene list here; nothing
  // about the order matters to Phaser (only Boot.ts's own fall-through,
  // below, decides what runs first), but MainMenu is placed right after
  // Boot to keep the "what a fresh launch flows through" reading order
  // intact for the next person skimming this file.
  //
  // Codex joins 1 Sep 2026 (Forgotten Plans Audit — the Onboarding
  // Tutorial's missing HOW_TO_PLAY.html link, built out as an in-game
  // codex instead per Maxime's own call) — reachable from both MainMenu
  // and every in-play MenuOverlay, same returnScene pattern as Options.
  scene: [Boot, MainMenu, CampaignSetup, LoadGame, Options, Codex, MapSelect, TransporterPad, Battle, Debrief, Hangar, Hub],
  render: { pixelArt: false, antialias: true },
  // Build Plan §9 piece #3, 26 Aug 2026 — first use of Phaser's DOM Element
  // game object in this project, for the Hub's real typed-chat input
  // (Hub.ts). createContainer:true is required for this.add.dom(...) to
  // work at all; off by default. No effect on any other scene.
  dom: { createContainer: true },
});

// Playwright verification harness (31 Aug 2026, see tools/verify/'s own
// README) — exposes the live Phaser.Game instance on window so a headless
// browser test can read real scene state (NPC positions, stuckMs, etc.)
// instead of only screenshotting pixels. Dev-only: import.meta.env.DEV is
// Vite's own build-time flag (false in `vite build`, true under `vite dev`
// or `vite preview --mode development`), so this never reaches the shipped
// production bundle — `npm run build`'s tsc pass also doesn't see it change
// any exported surface, since it's a plain window property, not a module
// export.
if (import.meta.env.DEV) {
  (window as unknown as { __bwGame: Phaser.Game }).__bwGame = __bwGame;
}
