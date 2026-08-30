// src/main.ts
import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import { MainMenu } from "./scenes/MainMenu";
import { CampaignSetup } from "./scenes/CampaignSetup";
import { LoadGame } from "./scenes/LoadGame";
import { Options } from "./scenes/Options";
import { MapSelect } from "./scenes/MapSelect";
import { TransporterPad } from "./scenes/TransporterPad";
import { Battle } from "./scenes/Battle";
import { Debrief } from "./scenes/Debrief";
import { Hangar } from "./scenes/Hangar";
import { Hub } from "./scenes/Hub";

new Phaser.Game({
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
  // Main Menu / Save / Ironman UI Plan v1, 28 Aug 2026 — MainMenu,
  // CampaignSetup, LoadGame and Options join the scene list here; nothing
  // about the order matters to Phaser (only Boot.ts's own fall-through,
  // below, decides what runs first), but MainMenu is placed right after
  // Boot to keep the "what a fresh launch flows through" reading order
  // intact for the next person skimming this file.
  scene: [Boot, MainMenu, CampaignSetup, LoadGame, Options, MapSelect, TransporterPad, Battle, Debrief, Hangar, Hub],
  render: { pixelArt: false, antialias: true },
  // Build Plan §9 piece #3, 26 Aug 2026 — first use of Phaser's DOM Element
  // game object in this project, for the Hub's real typed-chat input
  // (Hub.ts). createContainer:true is required for this.add.dom(...) to
  // work at all; off by default. No effect on any other scene.
  dom: { createContainer: true },
});
