// src/scenes/Hangar.ts
// New 25 Aug 2026, Maxime: "can you make me a little box for the ui I would
// see in the antfarm. so I can buy stuff and upgrade between mission" —
// clarified via follow-up answers: reachable "from the mission menu" (not
// gated behind finishing a mission, unlike Debrief's shop) and "actually
// working in the game" (a real scene against live CampaignState, not a
// mockup).
//
// This is scenes/Debrief.ts's "CAMPAIGN SHOP" section, standalone: same
// ShopPanel (scenes/shop/ShopPanel.ts), same live CampaignState, same
// costs, same purchase functions — nothing new was built, this is a second
// entry point onto the exact engine Tier 0 already shipped
// (engine/campaignState.ts, engine/campaignEconomy.ts). Deliberately does
// NOT touch anything mission-specific: no computeMissionEarnings, no
// permanentLosses application, no checkMuntiGuarantee, no bonus-objective
// reveal — those all require a just-finished Mission instance and stay
// exclusive to Debrief.ts. A player can open this, spend points, close it,
// and nothing about "what just happened in a mission" is involved.
//
// Naming (flagged, not decided): claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md
// section 10 leaves open whether Act I's meta-screen gets any visual
// identity/room-name branding at all, or stays deliberately bare — that's
// still unresolved as of this file. Kept unbranded and purely functional
// here, same discipline TransporterPad.ts's own header documents for
// itself ("no Providence references, no crew banter, no narrative
// dressing"). "Hangar" below is only this file's internal scene key/title,
// not a claim that the Antfarm's actual Hangar Deck room fiction is live.
import Phaser from "phaser";
import { createWardenCampaignState, loadCampaignState, saveCampaignState, baseSceneKeyFor, type CampaignState } from "../engine/campaignState";
import { ShopPanel, makeShopButton, showSaveAsOverlay } from "./shop/ShopPanel";
import { addMenuOverlayButton } from "./MenuOverlay";
import { HoverTip } from "./ui/HoverTip";
import { wrapTipText } from "../engine/hoverTipLayout";

const CARD_W = 900;
const CARD_L = 480 - CARD_W / 2;
const CARD_R = 480 + CARD_W / 2;

export class Hangar extends Phaser.Scene {
  private state!: CampaignState;
  private shop!: ShopPanel;
  private footerLayer!: Phaser.GameObjects.Container;
  // Tooltip pass, 12 Sep 2026 (standing rule — see
  // claude/Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md).
  // Covers only this scene's own footer buttons — the embedded ShopPanel
  // instance already has its own tooltips, done 11 Sep 2026.
  private hoverTip!: HoverTip;

  constructor() {
    super("Hangar");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0c0f12");
    this.hoverTip = new HoverTip(this);

    this.state = loadCampaignState() ?? createWardenCampaignState();

    this.add.text(480, 16, "CAMPAIGN SHOP", { fontFamily: "monospace", fontSize: "22px", color: "#e8e2d4" }).setOrigin(0.5);
    this.add
      .text(480, 40, "buy and upgrade between missions", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);

    // Shared MENU corner control (Main Menu / Save / Ironman UI Plan v1 §2).
    addMenuOverlayButton(this, 890, 16, 100, 22, () => this.state);

    const viewportTop = 66;
    const viewportBottom = 566;

    this.footerLayer = this.add.container(0, 0);
    this.shop = new ShopPanel(this, this.state, viewportTop, viewportBottom, () => this.renderFooter());
    this.shop.render();
  }

  // ---- Footer: live company balance + Back to Mission Select -------------
  private renderFooter(): void {
    this.footerLayer.removeAll(true);
    this.footerLayer.add(
      this.add
        .text(CARD_L + 16, 604, `Company Points: ${this.state.points}`, { fontFamily: "monospace", fontSize: "12px", color: "#facc15" })
        .setOrigin(0, 0.5)
    );
    // SAVE AS... (Main Menu / Save / Ironman UI Plan v1 §6) — only shown for
    // a non-Ironman campaign; an Ironman save has no manual slots to offer
    // at all, per that doc's own "only reachable when the live campaign for
    // that side is non-Ironman" rule.
    if (this.state.ironman === false) {
      makeShopButton(
        this,
        this.footerLayer,
        CARD_L + 280,
        604,
        140,
        30,
        "SAVE AS...",
        true,
        () => {
          showSaveAsOverlay(this, this.state, (slot) => this.flashSavedMessage(slot));
        },
        ["Save As...", "", ...wrapTipText("Opens the save-slot picker — saves your campaign, including anything just bought here, to a slot of your choosing.", 42)],
        this.hoverTip
      );
    }
    makeShopButton(
      this,
      this.footerLayer,
      CARD_R - 130,
      604,
      260,
      34,
      "BACK TO MISSION SELECT",
      true,
      () => {
        saveCampaignState(this.state);
        this.scene.start("MapSelect");
      },
      ["Back to Mission Select", "", ...wrapTipText("Saves your campaign and returns to the mission list.", 42)],
      this.hoverTip
    );
    // Entry point for the Hub scene prototype (Walkable Hub Build Plan
    // Phase 1, 25 Aug 2026). Own row, above the balance/back-button row —
    // sharing that row would overlap the "Company Points" label, which
    // starts right at CARD_L and has no fixed width to dodge. Labeled
    // PROTOTYPE deliberately — this doesn't claim the Antfarm's actual
    // Hangar Deck fiction is live, same discipline this file's own header
    // already holds itself to.
    //
    // Gated 1 Sep 2026 (House Amaranth Mission Select wiring pass): only
    // shown for a Warden Company save (baseSceneKeyFor, engine/
    // campaignState.ts) — Hub.ts is built entirely around WARDEN_PILOTS
    // and has no House Amaranth roster of its own to render, so offering
    // this button to a House Amaranth save would route straight into the
    // exact broken-Hub problem baseSceneKeyFor exists to avoid everywhere
    // else in this codebase.
    //
    // MOVED, 3 Sep 2026, from (480, 572) to the shared footer row at y=604.
    // y=572 collided head-on with ShopPanel's own page-navigation row,
    // which sits at `viewportBottom + 8` = 574 and is 24px tall: "< PREV"
    // and "NEXT >" drew straight over this 260px-wide button, leaving the
    // label clipped to the gibberish "BLE HUB (PROTO" between them.
    //
    // Why nobody saw it: that pager only renders when the shop has more
    // than one page (ShopPanel.render's own `pages.length > 1` guard). A
    // fresh five-pilot Warden save is one page, so the row is empty and
    // this button looks fine. It takes a mid-campaign roster — three
    // lances, the state most of this game is actually played in — to draw
    // both at once. A bug that only appears once the player has invested
    // twenty hours is the worst kind to ship, and the reason the UI sweep
    // that found it runs against a midgame save rather than a new one.
    //
    // x=525 on the 604 row sits in the real gap between SAVE AS...
    // (CARD_L + 280 = 310, 140 wide, so 240..380) and BACK TO MISSION
    // SELECT (CARD_R - 130 = 800, 260 wide, so 670..930): 395..655 with
    // clearance either side, and wider still on an Ironman save where
    // SAVE AS... isn't drawn at all.
    // 6 Sep 2026, House Amaranth Hub — any save with a hub (both sides now;
    // only the archived Team One roster still lands on "Hangar") gets the
    // button, and it goes to THAT side's hub.
    const hubKey = baseSceneKeyFor(this.state);
    if (hubKey !== "Hangar") {
      makeShopButton(
        this,
        this.footerLayer,
        525,
        604,
        260,
        30,
        "BACK TO THE SHIP",
        true,
        () => {
          saveCampaignState(this.state);
          this.scene.start(hubKey);
        },
        ["Walkable Hub", "", ...wrapTipText("Saves your campaign and enters the walkable Hub for this side — the same shop, just a different way to reach it.", 42)],
        this.hoverTip
      );
    }
  }

  private flashSavedMessage(slot: number): void {
    const msg = this.add.text(480, 630, `Saved to Slot ${slot + 1}.`, { fontFamily: "monospace", fontSize: "11px", color: "#4ade80" }).setOrigin(0.5);
    this.time.delayedCall(2200, () => msg.destroy());
  }
}
