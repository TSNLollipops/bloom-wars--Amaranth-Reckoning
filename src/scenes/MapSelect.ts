// src/scenes/MapSelect.ts
// Not in the Build Brief's named scene list (Boot, Battle, Debrief) but a
// cheap, honest stand-in for "pick which of the four slice missions to
// test" — there's no campaign/shop layer wired up yet (Build Brief steps
// 11-12), so this is how you reach mission 1b/2/3 without playing 1a to
// completion first.
import Phaser from "phaser";
import { CAMPAIGN } from "../data/campaign";

export class MapSelect extends Phaser.Scene {
  constructor() {
    super("MapSelect");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0c0f12");
    this.add.text(480, 60, "THE BLOOM WARS", { fontFamily: "monospace", fontSize: "32px", color: "#e8e2d4" }).setOrigin(0.5);
    this.add
      .text(480, 96, "engine test pass — pick a mission", { fontFamily: "monospace", fontSize: "14px", color: "#8a97a6" })
      .setOrigin(0.5);

    CAMPAIGN.forEach((mission, i) => {
      const y = 170 + i * 90;
      const card = this.add.rectangle(480, y, 640, 70, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552).setInteractive({ useHandCursor: true });
      this.add.text(180, y - 18, mission.displayName, { fontFamily: "monospace", fontSize: "18px", color: "#e8e2d4" });
      this.add.text(180, y + 8, mission.briefing, { fontFamily: "monospace", fontSize: "11px", color: "#8a97a6", wordWrap: { width: 600 } });
      card.on("pointerover", () => card.setFillStyle(0x232b35, 1));
      card.on("pointerout", () => card.setFillStyle(0x1a2028, 1));
      card.on("pointerdown", () => this.scene.start("Battle", { missionId: mission.id }));
    });
  }
}
