// src/scenes/MainMenu.ts
// Main Menu / Save / Ironman UI Plan v1, 28 Aug 2026 — the game's first real
// title screen. Before this pass Boot.ts fell straight through to MapSelect
// (that scene's own header comment: "a cheap, honest stand-in for 'pick
// which mission to test' — there's no campaign/shop layer wired up yet").
// Boot.ts's timed-out-mission recall notice is unaffected — it still runs
// first, skipping this screen on purpose (a mid-campaign continuation, not
// a fresh boot).
//
// Routing fix, 28 Aug 2026 (Maxime: "if you continu. it goes to the hub. so
// you move to the hangar bay to chose next mission"). CONTINUE used to land
// on MapSelect directly, same placeholder-era target this whole file's
// intro paragraph describes Boot.ts falling through to before this pass.
// Now lands in the Hub instead — Hub.ts already had a real, working "walk
// to the BAY, press E" deploy prompt that itself starts MapSelect (see
// Hub.ts's own isAtBay()/deploy()), so this doesn't add a new interaction,
// it just makes CONTINUE stop skipping straight past the Hub to a scene
// that was always meant to be reached by walking there. Boot.ts's recall
// notice "RETURN TO BASE" button follows the same logic — see that file's
// own comment.
//
// Visual direction, per the plan doc §3: polished within the locked art
// constraint, not a new one. Boot.ts's own comment states the rule this
// still follows — "No art pipeline for the placeholder pass (GDD §12.2) —
// everything is drawn with Phaser Graphics primitives." "Polished" here
// means composition, typography, and a cheap procedural backdrop motif, not
// illustrated art. If real illustrated art is ever wanted, that's a
// separate, bigger scope call (an actual art pipeline decision) — not
// something this pass quietly assumed into "polished."
import Phaser from "phaser";
import { loadCampaignState, listManualSlots } from "../engine/campaignState";
import { makeShopButton } from "./shop/ShopPanel";

export class MainMenu extends Phaser.Scene {
  private confirmLayer!: Phaser.GameObjects.Container;

  constructor() {
    super("MainMenu");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a0d10");
    this.drawBackdrop();
    this.drawTitle();
    this.drawButtons();

    this.confirmLayer = this.add.container(0, 0).setDepth(10).setVisible(false);
  }

  // Cheap, vector-only atmosphere: a faint dot grid (a hex-grid stand-in —
  // an actual hex tiling is more Graphics calls for no real visual gain at
  // this scale) plus two slow-drifting tendril lines. Nothing here is a
  // sprite or an image asset; all Phaser Graphics primitives, all disposed
  // automatically when this scene stops (no cleanup needed — same as every
  // other scene's own Graphics use in this codebase).
  private drawBackdrop() {
    const dots = this.add.graphics();
    dots.fillStyle(0x1a2028, 0.6);
    // Tier 6 hotfix, 30 Aug 2026 — main.ts's canvas grew wider (Hub.ts's
    // chat window); reading the live camera width here instead of the old
    // hardcoded 960 keeps this dot grid covering the whole screen instead
    // of stopping short and leaving a bare strip on the right.
    for (let x = 20; x < this.cameras.main.width; x += 42) {
      for (let y = 20; y < 640; y += 42) {
        dots.fillCircle(x, y, 1.1);
      }
    }

    const tendril1 = this.add.graphics();
    this.drawTendril(tendril1, 0x2e5c3a, 0.22, 120);
    const tendril2 = this.add.graphics();
    this.drawTendril(tendril2, 0x2e5c7a, 0.16, 460);

    this.tweens.add({ targets: tendril1, x: 40, duration: 9000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: tendril2, x: -30, duration: 12000, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: 500 });
  }

  private drawTendril(g: Phaser.GameObjects.Graphics, color: number, alpha: number, baseY: number) {
    g.lineStyle(2, color, alpha);
    g.beginPath();
    g.moveTo(-40, baseY);
    for (let x = -40; x <= 1000; x += 60) {
      const y = baseY + Math.sin(x * 0.012) * 26;
      g.lineTo(x, y);
    }
    g.strokePath();
  }

  private drawTitle() {
    this.add.text(480, 150, "THE BLOOM WARS", { fontFamily: "monospace", fontSize: "44px", color: "#e8e2d4" }).setOrigin(0.5);
    this.add
      .text(480, 194, "an advance-war-lite for the browser", { fontFamily: "monospace", fontSize: "13px", color: "#6b7a8a" })
      .setOrigin(0.5);
  }

  private drawButtons() {
    const state = loadCampaignState();
    const hasLiveSave = state !== null;
    const slots = listManualSlots();
    const hasAnyManualSlot = slots.some((s) => s !== null);
    const loadGameEnabled = hasLiveSave && state!.ironman === false && hasAnyManualSlot;

    const layer = this.add.container(0, 0);
    const cx = 480;
    const w = 300;
    const h = 46;
    const spacing = 58;
    let y = 300;

    makeShopButton(this, layer, cx, y, w, h, "CONTINUE", hasLiveSave, () => {
      this.scene.start("Hub");
    });
    y += spacing;

    makeShopButton(this, layer, cx, y, w, h, "NEW CAMPAIGN", true, () => {
      if (hasLiveSave) this.showNewCampaignConfirm();
      else this.scene.start("CampaignSetup");
    });
    y += spacing;

    makeShopButton(this, layer, cx, y, w, h, "LOAD GAME", loadGameEnabled, () => {
      this.scene.start("LoadGame");
    });
    y += spacing;

    makeShopButton(this, layer, cx, y, w, h, "OPTIONS", true, () => {
      this.scene.start("Options", { returnScene: "MainMenu" });
    });

    if (!hasLiveSave) {
      this.add
        .text(cx, y + 50, "no saved campaign yet — start with NEW CAMPAIGN", { fontFamily: "monospace", fontSize: "10px", color: "#5a6472" })
        .setOrigin(0.5);
    }
  }

  // "This will start fresh — your current campaign stays saved unless you
  // overwrite it" (plan doc §3) — a real confirmation, not a silent
  // overwrite. Nothing is actually touched here either way: NEW CAMPAIGN
  // only ever writes the live key once BEGIN CAMPAIGN is pressed on
  // CampaignSetup, so declining this leaves the live save completely
  // untouched, and confirming just moves on to that screen exactly as a
  // fresh-save NEW CAMPAIGN click already would.
  private showNewCampaignConfirm() {
    this.confirmLayer.removeAll(true);
    this.confirmLayer.setVisible(true);

    // Tier 6 hotfix, 30 Aug 2026 — same camera-size fix as drawBackdrop's
    // dot grid above (see its own comment) and MenuOverlay.ts's own shared
    // backdrop.
    const backdrop = this.add
      .rectangle(this.cameras.main.centerX, this.cameras.main.centerY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7)
      .setInteractive();
    const panel = this.add.rectangle(480, 320, 560, 240, 0x141a20, 1).setStrokeStyle(1, 0x3a4552);
    const msg = this.add
      .text(
        480,
        290,
        "There's only one live save. Starting a new campaign overwrites it the moment you press BEGIN CAMPAIGN. If you already saved this run to a slot (SAVE AS, on the Hangar or Debrief screen), it's safe — LOAD GAME will bring it back. If not, it's gone once you begin.",
        { fontFamily: "monospace", fontSize: "12px", color: "#e8e2d4", align: "center", wordWrap: { width: 460 } }
      )
      .setOrigin(0.5);
    this.confirmLayer.add([backdrop, panel, msg]);

    makeShopButton(this, this.confirmLayer, 380, 380, 180, 38, "GO BACK", true, () => {
      this.confirmLayer.setVisible(false);
    });
    makeShopButton(this, this.confirmLayer, 580, 380, 180, 38, "START NEW CAMPAIGN", true, () => {
      this.confirmLayer.setVisible(false);
      this.scene.start("CampaignSetup");
    });
  }
}
