// src/scenes/CampaignSetup.ts
// Main Menu / Save / Ironman UI Plan v1 §4, 28 Aug 2026 — the New Campaign
// screen, and the actual location the Ironman decision was given three days
// earlier (Bloom_Wars_Spitball_Ideas.md, 25 Aug 2026): "Ironman is a
// checkbox on the New Game/campaign-creation screen itself, presented once,
// locked in for that campaign — not something flipped later from a settings
// menu, not changeable mid-run." This screen just gives that decision an
// actual place to live.
import Phaser from "phaser";
import { createWardenCampaignState, saveCampaignState } from "../engine/campaignState";
import { makeShopButton } from "./shop/ShopPanel";
import { AMARANTH_ACT1 } from "../data/campaignAmaranth";

export class CampaignSetup extends Phaser.Scene {
  private ironmanChecked = true; // checked by default — Ironman is the base experience, not an opt-in extra (§4)
  private checkboxBg!: Phaser.GameObjects.Rectangle;
  private checkboxMark!: Phaser.GameObjects.Text;

  constructor() {
    super("CampaignSetup");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a0d10");
    this.ironmanChecked = true;

    this.add.text(480, 50, "NEW CAMPAIGN", { fontFamily: "monospace", fontSize: "26px", color: "#e8e2d4" }).setOrigin(0.5);

    this.drawSideSelect();
    this.drawIronmanCheckbox();
    this.drawBeginButton();

    makeShopButton(this, this.add.container(0, 0), 100, 604, 160, 30, "BACK", true, () => {
      this.scene.start("MainMenu");
    });
  }

  // Side select (§5): "Warden Company" vs. "House Amaranth" once the latter
  // exists. Today it renders pre-selected with nothing else to choose —
  // cheap to leave the slot in the layout now (per §4's own note) rather
  // than retrofit it once a second side is actually built.
  private drawSideSelect() {
    this.add.text(480, 110, "SIDE", { fontFamily: "monospace", fontSize: "12px", color: "#6b7a8a" }).setOrigin(0.5);
    this.add
      .rectangle(480, 140, 300, 40, 0x2e5c7a, 1)
      .setStrokeStyle(1, 0x4a7a9a);
    this.add.text(480, 140, "WARDEN COMPANY", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
    this.add
      .text(480, 168, "House Amaranth's side isn't built yet — Warden Company is the only choice today.", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#5a6472",
        align: "center",
        wordWrap: { width: 500 },
      })
      .setOrigin(0.5);
  }

  private drawIronmanCheckbox() {
    const y = 260;
    this.checkboxBg = this.add.rectangle(370, y, 26, 26, 0x1a2028, 1).setStrokeStyle(1, 0x4a7a9a).setInteractive({ useHandCursor: true });
    this.checkboxMark = this.add.text(370, y, "X", { fontFamily: "monospace", fontSize: "16px", color: "#facc15" }).setOrigin(0.5);
    this.add.text(392, y, "IRONMAN", { fontFamily: "monospace", fontSize: "15px", color: "#e8e2d4" }).setOrigin(0, 0.5);

    this.checkboxBg.on("pointerdown", () => {
      this.ironmanChecked = !this.ironmanChecked;
      this.checkboxMark.setVisible(this.ironmanChecked);
    });

    this.add
      .text(370, y + 34, "One save, no going back. A pilot lost stays lost, same as always — but so does everything that leads there: no manual saves, no rewinding a bad call. Uncheck this to keep save slots you can return to.", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8a97a6",
        wordWrap: { width: 560 },
      })
      .setOrigin(0, 0);
  }

  private drawBeginButton() {
    // Routing fix, 28 Aug 2026 (Maxime: "as you start a new campaign you go
    // into the 1st mission"). Used to land on MapSelect's flat mission list
    // — harmless for an engine-test pass with nothing to pick between yet,
    // but wrong for a real campaign start: a fresh Warden roster has
    // exactly one mission actually available (nothing else is unlocked in
    // any real sense — MapSelect just doesn't enforce order), so the list
    // was a needless extra click in front of a foregone choice. Straight to
    // TransporterPad for Act I's own opening mission instead — still gets
    // the real squad-review/BEAM DOWN screen, same as picking it manually
    // would have, just without the pointless intermediate list.
    //
    // AMARANTH_ACT1[0].id rather than a second "mission_amaranth_1" string
    // literal — derived from the same array MapSelect itself renders, so
    // this can never silently drift from whatever Act I's actual opening
    // mission is if that array's order ever changes.
    makeShopButton(this, this.add.container(0, 0), 480, 540, 320, 48, "BEGIN CAMPAIGN", true, () => {
      const state = createWardenCampaignState();
      state.ironman = this.ironmanChecked;
      saveCampaignState(state);
      this.scene.start("TransporterPad", { missionId: AMARANTH_ACT1[0].id });
    });
  }
}
