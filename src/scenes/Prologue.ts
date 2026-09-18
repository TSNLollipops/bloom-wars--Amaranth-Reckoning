// src/scenes/Prologue.ts
// Universe Intro Plan v1, 17 Sep 2026 — new-campaign-only sequence between
// CampaignSetup's BEGIN CAMPAIGN and TransporterPad, so a first-time
// player gets oriented before being dropped into gameplay ("so player
// dont arrive dry"). See claude/Bloom_Wars_Universe_Intro_Plan_v1_
// 17Sep2026.md for the design (floor/recommended/ceiling options, the
// four locked decisions) and claude/Bloom_Wars_Universe_Intro_Mockup_v1_
// 17Sep2026.html for the pacing mockup this scene implements for real.
// Warden Company only — CampaignSetup.ts only routes the Warden side
// here; House Amaranth keeps going straight to TransporterPad, since its
// own intro is deliberately deferred to its post-EA reveal.
//
// Continuing or loading a save never touches this scene at all — only
// CampaignSetup's BEGIN CAMPAIGN handler starts it, the one place in the
// game a brand-new campaign is actually created.
//
// Visual language is the same "menu-type scene" family as MainMenu/
// CampaignSetup/LoadGame/Options: 960-wide legacy layout centred via
// centerLegacyLayout, the splash-art backdrop MainMenu already draws,
// Panel.ts's shared palette constants, and makeShopButton for every
// clickable control (with a tooltip on each, per this project's own
// "clickable = tooltip" standing rule).
import Phaser from "phaser";
import { PANEL_BG, PANEL_BORDER, PANEL_ACCENT, TEXT_MAIN, TEXT_DIM, TEXT_ACCENT } from "./ui/Panel";
import { makeShopButton } from "./shop/ShopPanel";
import { HoverTip } from "./ui/HoverTip";
import { wrapTipText } from "../engine/hoverTipLayout";
import { centerLegacyLayout } from "./ui/legacyCenter";
import { resolvePrologueBeats, type PrologueBeat } from "../data/prologueIntro";
import { DEFAULT_WARDEN_COMPANY_NAME } from "../engine/campaignState";

interface FrameBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class Prologue extends Phaser.Scene {
  private missionId!: string;
  private beats!: PrologueBeat[];
  private idx = 0;
  private hoverTip!: HoverTip;
  private frameBounds!: FrameBounds;
  private beatLabelText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private bodyLayer!: Phaser.GameObjects.Container;
  private navLayer!: Phaser.GameObjects.Container;

  constructor() {
    super("Prologue");
  }

  // Same shape as TransporterPad's own init(data: { missionId }) — this
  // scene passes missionId straight through, unread except at the very
  // end (finish()). companyName comes from CampaignSetup's own
  // state.companyName, already resolved (never blank — resolveCompanyName()
  // falls back to the side's default) before BEGIN CAMPAIGN's handler
  // reads it; the fallback here only covers a scene.start("Prologue", ...)
  // that skips that resolution entirely, e.g. a future test harness.
  init(data: { missionId: string; companyName?: string }) {
    this.missionId = data.missionId;
    const companyName = data.companyName && data.companyName.trim() ? data.companyName : DEFAULT_WARDEN_COMPANY_NAME;
    this.beats = resolvePrologueBeats(companyName);
    this.idx = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a0d10");
    centerLegacyLayout(this); // see ui/legacyCenter.ts — the 960-wide layout, centred on the 1074 canvas
    this.hoverTip = new HoverTip(this);

    this.drawSplashArt();
    this.drawFrame();
    this.bodyLayer = this.add.container(0, 0);
    this.navLayer = this.add.container(0, 0);
    this.renderBeat();
  }

  // Same pattern as MainMenu's own drawSplashArt — half-tone reuse of the
  // already-loaded title painting, no new art asset (Foundation.md's
  // locked "placeholder art, not sprites" rule). Dimmed a touch further
  // than MainMenu's own 0.45/0.42 pair so the panel text stays the clear
  // focus of a screen that's mostly reading, not a title screen's logo.
  private drawSplashArt() {
    if (!this.textures.exists("splash_intro_title")) return;
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;
    const art = this.add.image(cx, cy, "splash_intro_title").setScrollFactor(0).setAlpha(0.3);
    const scale = Math.max(this.cameras.main.width / art.width, this.cameras.main.height / art.height);
    art.setScale(scale);
    this.add.rectangle(cx, cy, this.cameras.main.width, this.cameras.main.height, 0x0a0d10, 0.55).setScrollFactor(0);
  }

  // The panel box, header row (beat counter + SKIP), and title row — drawn
  // once; renderBeat() below only rewrites the title text and rebuilds the
  // body/nav layers, same "rebuild wholesale, don't patch in place"
  // discipline every other panel in this game already follows.
  private drawFrame() {
    const bounds: FrameBounds = { left: 170, right: 790, top: 70, bottom: 510 };
    this.frameBounds = bounds;
    const cx = (bounds.left + bounds.right) / 2;

    this.add
      .rectangle(cx, (bounds.top + bounds.bottom) / 2, bounds.right - bounds.left, bounds.bottom - bounds.top, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER);

    this.beatLabelText = this.add
      .text(bounds.left + 14, bounds.top + 16, "", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(0, 0.5);

    const skipTip = ["Skip", "", ...wrapTipText("Jumps ahead to the final beat, skipping the rest of the intro text.", 42)];
    makeShopButton(
      this,
      this.add.container(0, 0),
      bounds.right - 50,
      bounds.top + 16,
      84,
      24,
      "SKIP",
      true,
      () => {
        this.idx = this.beats.length - 1;
        this.renderBeat();
      },
      skipTip,
      this.hoverTip
    );

    this.titleText = this.add
      .text(cx, bounds.top + 44, "", { fontFamily: "monospace", fontSize: "15px", color: TEXT_ACCENT, letterSpacing: 2 })
      .setOrigin(0.5);
    this.add.rectangle(cx, bounds.top + 62, bounds.right - bounds.left - 24, 1, PANEL_BORDER, 0.8);
  }

  private renderBeat() {
    // Caught live via a Playwright screenshot check, 17 Sep 2026: BACK/NEXT/
    // MUSTER are destroyed and rebuilt at the same screen position every
    // beat change (renderNav's own "rebuild wholesale" pattern, same as
    // every other panel in this game), so a pointer that hasn't physically
    // moved since the click never re-fires pointerover on the new button —
    // MUSTER's tooltip showed NEXT's old text until the mouse moved. Hiding
    // here, not inside renderNav alone, so it's also cleared on SKIP (which
    // jumps straight to the final beat without an intervening render).
    this.hoverTip.hide();

    const beat = this.beats[this.idx];
    const { left, right, top } = this.frameBounds;

    this.beatLabelText.setText(`${this.idx + 1} / ${this.beats.length}`);
    this.titleText.setText(beat.title.toUpperCase()); // same TransporterPad convention: companyNameOf(...).toUpperCase() for a header

    this.bodyLayer.removeAll(true);
    const innerLeft = left + 28;
    const innerWidth = right - left - 56;
    let y = top + 82;
    for (const para of beat.body) {
      const t = this.add
        .text(innerLeft, y, para, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: TEXT_MAIN,
          wordWrap: { width: innerWidth },
          lineSpacing: 6,
        })
        .setOrigin(0, 0);
      this.bodyLayer.add(t);
      y += t.height + 18;
    }

    this.renderNav();
  }

  private renderNav() {
    this.navLayer.removeAll(true);
    const { left, right, bottom } = this.frameBounds;
    const navY = bottom - 26;
    const cx = (left + right) / 2;

    const backEnabled = this.idx > 0;
    const backTipBody = backEnabled ? "Returns to the previous beat." : "Already at the first beat.";
    const backTip = ["Back", "", ...wrapTipText(backTipBody, 42)];
    makeShopButton(this, this.navLayer, left + 74, navY, 108, 32, "◂ BACK", backEnabled, () => this.goBack(), backTip, this.hoverTip);

    const isLast = this.idx === this.beats.length - 1;
    const nextLabel = isLast ? "MUSTER ▸" : "NEXT ▸";
    const nextTipBody = isLast
      ? "Ends the intro and beams the lance down to the opening mission."
      : "Advances to the next beat.";
    const nextTip = [isLast ? "Muster" : "Next", "", ...wrapTipText(nextTipBody, 42)];
    makeShopButton(this, this.navLayer, right - 74, navY, 108, 32, nextLabel, true, () => this.goNext(), nextTip, this.hoverTip);

    const dotSpacing = 14;
    const dotsStartX = cx - ((this.beats.length - 1) * dotSpacing) / 2;
    for (let i = 0; i < this.beats.length; i++) {
      const active = i === this.idx;
      const dot = this.add
        .rectangle(dotsStartX + i * dotSpacing, navY, 7, 7, active ? PANEL_ACCENT : 0x000000, active ? 1 : 0)
        .setStrokeStyle(1, active ? PANEL_ACCENT : 0x5a6572);
      this.navLayer.add(dot);
    }
  }

  private goNext() {
    if (this.idx < this.beats.length - 1) {
      this.idx++;
      this.renderBeat();
    } else {
      this.finish();
    }
  }

  private goBack() {
    if (this.idx > 0) {
      this.idx--;
      this.renderBeat();
    }
  }

  private finish() {
    this.scene.start("TransporterPad", { missionId: this.missionId });
  }
}
