// src/scenes/LoadGame.ts
// Main Menu / Save / Ironman UI Plan v1 §7, 28 Aug 2026 — the manual-slot
// picker. Only reachable from MainMenu when the live campaign is
// non-Ironman and at least one slot has something in it (that gate lives in
// MainMenu.ts's own button-enable check); this scene still degrades
// honestly if reached with nothing to show, rather than assuming it can't
// happen.
import Phaser from "phaser";
import { listManualSlots, loadManualSlot, saveCampaignState, rankDisplayTitle, MANUAL_SAVE_SLOT_COUNT } from "../engine/campaignState";
import { makeShopButton } from "./shop/ShopPanel";

export class LoadGame extends Phaser.Scene {
  constructor() {
    super("LoadGame");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a0d10");
    this.add.text(480, 44, "LOAD GAME", { fontFamily: "monospace", fontSize: "24px", color: "#e8e2d4" }).setOrigin(0.5);
    this.add
      .text(480, 72, "loading a slot replaces your current live save with it — same as a rewind, not a branch", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8a97a6",
        align: "center",
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5);

    this.renderSlots();

    makeShopButton(this, this.add.container(0, 0), 480, 590, 260, 34, "BACK TO MAIN MENU", true, () => {
      this.scene.start("MainMenu");
    });
  }

  private renderSlots() {
    const slots = listManualSlots();
    const layer = this.add.container(0, 0);
    const top = 110;
    const rowH = 90;

    for (let i = 0; i < MANUAL_SAVE_SLOT_COUNT; i++) {
      const meta = slots[i];
      const y = top + i * rowH + rowH / 2;
      const card = this.add.rectangle(480, y, 700, rowH - 12, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552);
      layer.add(card);

      if (!meta) {
        this.add.text(150, y, `Slot ${i + 1}`, { fontFamily: "monospace", fontSize: "13px", color: "#5a6472" }).setOrigin(0, 0.5);
        this.add.text(150, y + 20, "no manual save yet", { fontFamily: "monospace", fontSize: "11px", color: "#3a4552" }).setOrigin(0, 0.5);
        continue;
      }

      const when = new Date(meta.savedAt).toLocaleString();
      this.add.text(150, y - 12, `Slot ${i + 1}`, { fontFamily: "monospace", fontSize: "13px", color: "#e8e2d4" }).setOrigin(0, 0.5);
      this.add
        .text(150, y + 12, `${when} — ${meta.rosterSize} pilots — ${rankDisplayTitle(meta.rourkeRank)}`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#8a97a6",
        })
        .setOrigin(0, 0.5);

      makeShopButton(this, layer, 720, y, 140, 34, "LOAD", true, () => {
        const loaded = loadManualSlot(i);
        if (!loaded) return; // shouldn't happen — meta and state can drift only if storage was edited by hand outside this game
        saveCampaignState(loaded); // rewind semantics — the loaded slot becomes the new live/continuing save
        this.scene.start("MapSelect");
      });
    }

    if (slots.every((s) => s === null)) {
      this.add
        .text(480, top + MANUAL_SAVE_SLOT_COUNT * rowH + 30, "no manual saves yet — use SAVE AS on the Hangar or Debrief screen", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#5a6472",
        })
        .setOrigin(0.5);
    }
  }
}
