// src/scenes/Options.ts
// Main Menu / Save / Ironman UI Plan v1 §7, 28 Aug 2026 — deliberately thin.
// The plan doc's own scope note for this screen: nothing here beyond a
// "reset tutorial hints" toggle for a first pass — no audio/graphics
// settings exist anywhere in this codebase yet to put on a real options
// screen, and stubbing controls for systems that don't exist would be
// exactly the kind of unflagged scope growth the project's own build rules
// warn against. Reachable from two places (MainMenu's own OPTIONS button,
// and every in-play MenuOverlay's OPTIONS row) — both pass a `returnScene`
// so BACK lands wherever this was actually opened from, not a hardcoded
// MainMenu.
import Phaser from "phaser";
import { hasSeenTutorial, resetTutorialSeen } from "../engine/campaignState";
import { makeShopButton } from "./shop/ShopPanel";

export class Options extends Phaser.Scene {
  private returnScene = "MainMenu";
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super("Options");
  }

  init(data: { returnScene?: string }) {
    this.returnScene = data.returnScene ?? "MainMenu";
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a0d10");
    this.add.text(480, 60, "OPTIONS", { fontFamily: "monospace", fontSize: "26px", color: "#e8e2d4" }).setOrigin(0.5);

    this.add
      .text(480, 220, "TUTORIAL HINTS", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(480, 246, "", { fontFamily: "monospace", fontSize: "11px", color: "#6b7a8a" })
      .setOrigin(0.5);
    this.refreshStatus();

    const layer = this.add.container(0, 0);
    makeShopButton(this, layer, 480, 300, 320, 40, "RESET TUTORIAL HINTS", true, () => {
      resetTutorialSeen();
      this.refreshStatus();
    });

    makeShopButton(this, this.add.container(0, 0), 480, 590, 260, 34, "BACK", true, () => {
      this.scene.start(this.returnScene);
    });
  }

  private refreshStatus() {
    this.statusText.setText(
      hasSeenTutorial() ? "already shown on this browser — reset to see them again on your next Mission 1" : "not shown yet — nothing to reset"
    );
  }
}
