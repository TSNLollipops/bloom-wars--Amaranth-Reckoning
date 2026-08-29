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
import { createWardenCampaignState, loadCampaignState, saveCampaignState, type CampaignState } from "../engine/campaignState";
import { ShopPanel, makeShopButton, showSaveAsOverlay } from "./shop/ShopPanel";
import { addMenuOverlayButton } from "./MenuOverlay";

const CARD_W = 900;
const CARD_L = 480 - CARD_W / 2;
const CARD_R = 480 + CARD_W / 2;

export class Hangar extends Phaser.Scene {
  private state!: CampaignState;
  private shop!: ShopPanel;
  private footerLayer!: Phaser.GameObjects.Container;

  constructor() {
    super("Hangar");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0c0f12");

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
      makeShopButton(this, this.footerLayer, CARD_L + 280, 604, 140, 30, "SAVE AS...", true, () => {
        showSaveAsOverlay(this, this.state, (slot) => this.flashSavedMessage(slot));
      });
    }
    makeShopButton(this, this.footerLayer, CARD_R - 130, 604, 260, 34, "BACK TO MISSION SELECT", true, () => {
      saveCampaignState(this.state);
      this.scene.start("MapSelect");
    });
    // Entry point for the Hub scene prototype (Walkable Hub Build Plan
    // Phase 1, 25 Aug 2026). Own row, above the balance/back-button row —
    // sharing that row would overlap the "Company Points" label, which
    // starts right at CARD_L and has no fixed width to dodge. Labeled
    // PROTOTYPE deliberately — this doesn't claim the Antfarm's actual
    // Hangar Deck fiction is live, same discipline this file's own header
    // already holds itself to.
    makeShopButton(this, this.footerLayer, 480, 572, 260, 30, "WALKABLE HUB (PROTOTYPE)", true, () => {
      saveCampaignState(this.state);
      this.scene.start("Hub");
    });
  }

  private flashSavedMessage(slot: number): void {
    const msg = this.add.text(480, 630, `Saved to Slot ${slot + 1}.`, { fontFamily: "monospace", fontSize: "11px", color: "#4ade80" }).setOrigin(0.5);
    this.time.delayedCall(2200, () => msg.destroy());
  }
}
