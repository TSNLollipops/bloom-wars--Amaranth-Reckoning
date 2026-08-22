// src/scenes/Boot.ts
// No art pipeline for the placeholder pass (GDD §12.2) — everything is
// drawn with Phaser Graphics primitives, so Boot has nothing to load. It
// exists as the named entry point Build Brief §2.1's repo shape expects.
import Phaser from "phaser";

export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  create() {
    this.scene.start("MapSelect");
  }
}
