// src/main.ts
import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import { MapSelect } from "./scenes/MapSelect";
import { Battle } from "./scenes/Battle";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 960,
  height: 640,
  backgroundColor: "#0c0f12",
  scene: [Boot, MapSelect, Battle],
  render: { pixelArt: false, antialias: true },
});
