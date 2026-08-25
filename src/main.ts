// src/main.ts
import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
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
  scene: [Boot, MapSelect, TransporterPad, Battle, Debrief, Hangar, Hub],
  render: { pixelArt: false, antialias: true },
});
