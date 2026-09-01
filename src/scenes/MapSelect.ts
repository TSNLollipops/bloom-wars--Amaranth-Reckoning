// src/scenes/MapSelect.ts
// Not in the Build Brief's named scene list (Boot, Battle, Debrief) but a
// cheap, honest stand-in for "pick which mission to test" — there's no
// campaign/shop layer wired up yet (Build Brief steps 11-12), so this is
// how you reach any mission without playing the one before it to
// completion first. Backed by data/allCampaigns.ts's CAMPAIGNS array; the
// tab switcher below only renders when that array has more than one entry,
// so archiving a campaign out of CAMPAIGNS (Team One, currently) collapses
// this straight to a single mission list with no dead switcher UI, and the
// switcher comes back on its own if a second campaign is ever un-archived.
import Phaser from "phaser";
import { CAMPAIGNS } from "../data/allCampaigns";
import { loadCampaignState } from "../engine/campaignState";
import { makeShopButton } from "./shop/ShopPanel";
import { addMenuOverlayButton } from "./MenuOverlay";

const CARD_SPACING = 92;
const CARD_HEIGHT = 74;
const GAME_HEIGHT = 640;
const SCROLL_BOTTOM_MARGIN = 16;

export class MapSelect extends Phaser.Scene {
  private missionListLayer!: Phaser.GameObjects.Container;
  private tabButtons: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; campaignId: string }[] = [];
  private activeCampaignIndex = 0;
  // Scroll pass (23 Aug 2026, Amaranth missions 5-8 landing): eight
  // missions' worth of cards (listTop + 7*CARD_SPACING + half a card) run
  // to y~835, well past this scene's own 640px canvas height — mission 8's
  // card wasn't just visually cut off, it was outside the interactive area
  // entirely and un-clickable. renderMissionList's own layout math is
  // unchanged; this only adds a mouse-wheel offset to missionListLayer,
  // clamped so the list can't scroll past its own content in either
  // direction, plus a mask so scrolled-up cards clip at the list's own top
  // edge instead of drawing over the fixed header above it.
  private listScrollMinY = 0;
  private listMask?: Phaser.Display.Masks.GeometryMask;

  constructor() {
    super("MapSelect");
  }

  create() {
    this.activeCampaignIndex = Math.min(this.activeCampaignIndex, CAMPAIGNS.length - 1);
    this.cameras.main.setBackgroundColor("#0c0f12");
    this.add.text(480, 44, "THE BLOOM WARS", { fontFamily: "monospace", fontSize: "30px", color: "#e8e2d4" }).setOrigin(0.5);
    this.add
      .text(480, 76, "engine test pass — pick a mission", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);

    // Click-through-the-Act-tabs fix (30 Aug 2026, Maxime: "if I scroll
    // down the mission number and I then click on the act pannel, i hit
    // the mission underneath the act panel instead of the act panel").
    // missionListLayer is created FIRST now, before any of the fixed
    // header controls below (CAMPAIGN SHOP, MENU, the Act tab row) —
    // deliberately reordered from how this used to read. The mask further
    // down only clips RENDERING to [listTop, canvas bottom]; Phaser's input
    // plugin hit-tests every interactive object by its own bounds
    // regardless of any mask, and picks whichever masks it out or not
    // — the TOPMOST one in the display list wins a click at that screen
    // position. Once CAMPAIGNS.length > 1 made the Act tab row live (25
    // Aug 2026, Act I/II split), scrolling the list far enough moves an
    // upper mission card's rendered position up into the tab row's own
    // y~116 band — invisible there (masked), but tabButtons were created
    // BEFORE missionListLayer in the old code, so the scrolled, invisible
    // card sat later in the display list and Phaser handed it the click
    // instead of the tab underneath it. Creating missionListLayer first
    // means every fixed header control created after it (hangarLayer,
    // the MENU button, the tab row) is later in the display list and wins
    // that hit-test in the overlap band, exactly reversing the bug — with
    // zero visual change, since the mask already made those scrolled cards
    // invisible up there either way.
    this.missionListLayer = this.add.container(0, 0);

    // Hangar entry point (25 Aug 2026, Maxime: "make me a little box for
    // the ui I would see in the antfarm... from the mission menu") — fixed
    // in the header, not inside missionListLayer, so it survives scrolling
    // and campaign switches and stays reachable without finishing a
    // mission first (unlike Debrief's copy of the same shop).
    const hangarLayer = this.add.container(0, 0);
    makeShopButton(this, hangarLayer, 880, 20, 150, 30, "CAMPAIGN SHOP", true, () => {
      this.scene.start("Hangar");
    });

    // Shared MENU corner control (Main Menu / Save / Ironman UI Plan v1
    // §2) — top-left, clear of the CAMPAIGN SHOP button and the tab row.
    addMenuOverlayButton(this, 80, 20, 100, 28, () => loadCampaignState());

    // Same accumulation bug as Battle.ts's actionSlots (fixed 23 Aug 2026,
    // see that file's comment for the full mechanism): create() re-runs
    // every time this scene restarts, and Phaser destroys the previous
    // run's GameObjects on the way out but never touches this array on its
    // own — without the reset, a second visit would push more entries onto
    // stale, destroyed tab buttons instead of replacing them.
    this.tabButtons = [];
    const showTabs = CAMPAIGNS.length > 1;
    if (showTabs) {
      const tabWidth = 900 / CAMPAIGNS.length;
      CAMPAIGNS.forEach((campaign, i) => {
        const x = 30 + tabWidth * i + tabWidth / 2;
        const bg = this.add
          .rectangle(x, 116, tabWidth - 12, 40, i === this.activeCampaignIndex ? 0x2e5c7a : 0x1a2028, 1)
          .setStrokeStyle(1, 0x3a4552)
          .setInteractive({ useHandCursor: true });
        const label = this.add
          .text(x, 116, campaign.name, { fontFamily: "monospace", fontSize: "12px", color: "#e8e2d4", align: "center", wordWrap: { width: tabWidth - 24 } })
          .setOrigin(0.5);
        bg.on("pointerdown", () => this.selectCampaign(i));
        bg.on("pointerover", () => {
          if (i !== this.activeCampaignIndex) bg.setFillStyle(0x232b35, 1);
        });
        bg.on("pointerout", () => {
          if (i !== this.activeCampaignIndex) bg.setFillStyle(0x1a2028, 1);
        });
        this.tabButtons.push({ bg, label, campaignId: campaign.id });
      });
    }

    const listTop = showTabs ? 156 : 100;
    this.renderMissionList(listTop); // populates the container created above — doesn't move it in the display list

    // Mask the scrollable area to [listTop, canvas bottom] so a scrolled
    // card clips at the list's own top edge rather than drawing over the
    // fixed "THE BLOOM WARS" header, which isn't part of this container.
    // (Rendering only — see the reordering comment above for why the fixed
    // header controls ALSO have to be later in the display list, not just
    // masked, to stop a scrolled card from eating their clicks.)
    const maskShape = this.make.graphics({});
    maskShape.fillRect(0, listTop, 960, GAME_HEIGHT - listTop);
    this.listMask = maskShape.createGeometryMask();
    this.missionListLayer.setMask(this.listMask);

    this.input.off("wheel"); // same accumulation risk as tabButtons/actionSlots — this scene re-runs create() every visit
    this.input.on("wheel", (_pointer: unknown, _over: unknown, _dx: number, dy: number) => {
      const newY = Phaser.Math.Clamp(this.missionListLayer.y - dy * 0.5, this.listScrollMinY, 0);
      this.missionListLayer.y = newY;
    });
  }

  private selectCampaign(index: number) {
    if (index === this.activeCampaignIndex) return;
    this.activeCampaignIndex = index;
    this.tabButtons.forEach((t, i) => t.bg.setFillStyle(i === index ? 0x2e5c7a : 0x1a2028, 1));
    this.renderMissionList(156); // only reachable when showTabs was true
  }

  // subtitleY: 156 under the tab row, or 100 right under the header when
  // there's only one campaign and the tabs are skipped entirely.
  private renderMissionList(subtitleY: number) {
    this.missionListLayer.removeAll(true);
    this.missionListLayer.y = 0; // reset scroll — a campaign switch or re-entry starts back at the top of its own list
    const campaign = CAMPAIGNS[this.activeCampaignIndex];

    const subtitle = this.add
      .text(480, subtitleY, campaign.subtitle, { fontFamily: "monospace", fontSize: "11px", color: "#6b7a8a", align: "center", wordWrap: { width: 820 } })
      .setOrigin(0.5, 0);
    this.missionListLayer.add(subtitle);

    const listTop = subtitleY + 54;
    const contentBottom = listTop + (campaign.missions.length - 1) * CARD_SPACING + CARD_HEIGHT / 2 + SCROLL_BOTTOM_MARGIN;
    this.listScrollMinY = -Math.max(0, contentBottom - GAME_HEIGHT);

    campaign.missions.forEach((mission, i) => {
      const y = listTop + i * 92;
      const card = this.add.rectangle(480, y, 860, 74, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552).setInteractive({ useHandCursor: true });
      const title = this.add.text(140, y - 20, mission.displayName, { fontFamily: "monospace", fontSize: "17px", color: "#e8e2d4" });
      const brief = this.add.text(140, y + 6, mission.briefing, { fontFamily: "monospace", fontSize: "10px", color: "#8a97a6", wordWrap: { width: 700 } });
      card.on("pointerover", () => card.setFillStyle(0x232b35, 1));
      card.on("pointerout", () => card.setFillStyle(0x1a2028, 1));
      card.on("pointerdown", () => this.scene.start("TransporterPad", { missionId: mission.id }));
      this.missionListLayer.add([card, title, brief]);
    });
  }
}
