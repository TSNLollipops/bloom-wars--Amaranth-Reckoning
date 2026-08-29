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
  width: 960,
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
