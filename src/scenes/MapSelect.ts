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
import { CAMPAIGNS, WARDEN_MISSION_CHAIN, HOUSE_AMARANTH_MISSION_CHAIN } from "../data/allCampaigns";
import type { CampaignMission } from "../data/types";
import { baseSceneKeyFor, loadCampaignState, isMissionUnlocked } from "../engine/campaignState";
import { isMissionDemoLocked, DEMO_LOCK_MESSAGE } from "../data/demoCap";
import { makeShopButton } from "./shop/ShopPanel";
import { addMenuOverlayButton } from "./MenuOverlay";
import { TEXT_MAIN, TEXT_DIM, PANEL_BORDER, PANEL_CARD_BORDER, PANEL_ACCENT, TEXT_ACCENT } from "./ui/Panel";
import { HoverTip } from "./ui/HoverTip";
import { wrapTipText } from "../engine/hoverTipLayout";

const CARD_SPACING = 92;
const CARD_HEIGHT = 74;
const GAME_HEIGHT = 640;
const SCROLL_BOTTOM_MARGIN = 16;
// UI Prettiness Pass v1, 10 Sep 2026 — Claude's own call on the specific
// values (Maxime asked for color/contrast and typography/spacing in
// general, not these exact pixels): a slim accent bar on each card's left
// edge, same PANEL_ACCENT gold Panel.ts's corner brackets use, so the list
// reads as "the same game" as the newly-reskinned Workshop/Vault rather
// than a third, unrelated visual language. CARD_ACCENT_W is inside the
// card's own existing bounds, not added width — nothing downstream that
// measures CARD_SPACING/CARD_HEIGHT (the scroll-clamp math below) needed to
// change for this.
const CARD_ACCENT_W = 4;

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
  // Tooltip pass, 12 Sep 2026 (standing rule — see
  // claude/Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md).
  // Plain scene class, no competing scene-wide hover system — one shared
  // instance covers the header buttons, campaign tabs, and mission cards.
  private hoverTip!: HoverTip;

  constructor() {
    super("MapSelect");
  }

  create() {
    this.activeCampaignIndex = Math.min(this.activeCampaignIndex, CAMPAIGNS.length - 1);
    this.cameras.main.setBackgroundColor("#0c0f12");
    this.hoverTip = new HoverTip(this);
    // "engine test pass — pick a mission" removed here, 10 Sep 2026 (EA
    // Dev-Cleanup Checklist v1's first confirmed item) — real dev-comment
    // text that had been rendering on screen since before MainMenu.ts (28
    // Aug) gave this scene a front door, describing a scene that no longer
    // needed the excuse. Not replaced with new flavor text of its own —
    // inventing a new line in Maxime's voice isn't this pass's call to
    // make, so the header gets a quieter accent rule instead of a swapped-in
    // sentence.
    this.add.text(480, 40, "THE BLOOM WARS", { fontFamily: "monospace", fontSize: "30px", color: TEXT_MAIN, letterSpacing: 2 }).setOrigin(0.5);
    this.add.rectangle(480, 66, 220, 1, PANEL_BORDER, 0.9);

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
    makeShopButton(
      this,
      hangarLayer,
      880,
      20,
      150,
      30,
      "CAMPAIGN SHOP",
      true,
      () => {
        this.scene.start("Hangar");
      },
      ["Campaign Shop", "", ...wrapTipText("Buy gear, recruit, and manage lances between missions — no mission needs to be finished first to reach it.", 42)],
      this.hoverTip
    );

    // Back-to-Hub button — EA Launch Plan Week 1 finding (Readiness Plan
    // §3.1, 1 Sep 2026): this scene was the only real dead end in the
    // deploy loop (Hub -> walk to BAY -> MapSelect -> TransporterPad ->
    // Battle -> Debrief -> Hub), reachable from CONTINUE/RETURN TO BASE
    // but with no way back except finishing a mission. Same header row,
    // same makeShopButton styling as CAMPAIGN SHOP, positioned clear of
    // both that button and the centered title text above.
    makeShopButton(
      this,
      hangarLayer,
      730,
      20,
      140,
      30,
      "BACK TO HUB",
      true,
      () => {
        // 6 Sep 2026, House Amaranth Hub — whichever side's hub this save
        // belongs to (a save without one falls back to the Campaign Shop,
        // the same way every other return-to-base button already routes).
        const state = loadCampaignState();
        this.scene.start(state ? baseSceneKeyFor(state) : "Hub");
      },
      ["Back to Hub", "", ...wrapTipText("Returns to your side's Hub to walk around in (or the Campaign Shop, for a House Amaranth save with no Hub of its own yet).", 42)],
      this.hoverTip
    );

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
        const active = i === this.activeCampaignIndex;
        const bg = this.add
          .rectangle(x, 116, tabWidth - 12, 40, active ? 0x2e5c7a : 0x1a2028, 1)
          .setStrokeStyle(1, active ? PANEL_ACCENT : PANEL_BORDER)
          .setInteractive({ useHandCursor: true });
        const label = this.add
          .text(x, 116, campaign.name, {
            fontFamily: "monospace",
            fontSize: "12px",
            color: active ? TEXT_MAIN : TEXT_DIM,
            align: "center",
            letterSpacing: 0.5,
            wordWrap: { width: tabWidth - 24 },
          })
          .setOrigin(0.5);
        const tabTip = [campaign.name, "", ...wrapTipText(campaign.subtitle, 42)];
        bg.on("pointerdown", () => this.selectCampaign(i));
        bg.on("pointerover", (pointer: Phaser.Input.Pointer) => {
          if (i !== this.activeCampaignIndex) bg.setFillStyle(0x232b35, 1);
          this.hoverTip.show(tabTip, pointer.x, pointer.y);
        });
        bg.on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(tabTip, pointer.x, pointer.y));
        bg.on("pointerout", () => {
          if (i !== this.activeCampaignIndex) bg.setFillStyle(0x1a2028, 1);
          this.hoverTip.hide();
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
    // Border/label color now carry the active state too (10 Sep 2026 — see
    // create()'s own tab-row comment), so switching campaigns has to update
    // all three together or the PREVIOUS tab is left with the active
    // border/label color and the new one never gets it — same "every place
    // that sets this has to agree" trap the fill-only version never hit
    // because it only ever touched one property.
    this.tabButtons.forEach((t, i) => {
      const active = i === index;
      t.bg.setFillStyle(active ? 0x2e5c7a : 0x1a2028, 1);
      t.bg.setStrokeStyle(1, active ? PANEL_ACCENT : PANEL_BORDER);
      t.label.setColor(active ? TEXT_MAIN : TEXT_DIM);
    });
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

    // Mission-order gating, 12 Sep 2026 (Maxime: "make the mission in the
    // campaign gated on completing the previous mission 1st"). One load per
    // render rather than per card — loadCampaignState() already reads
    // localStorage fresh every call, same cost this scene's own BACK TO HUB
    // button already pays per click, just amortized over one render instead
    // of N cards. `state` can be null here (no save at all reachable this
    // scene) — treated as "don't gate anything," same permissive fallback
    // isMissionUnlocked() itself uses for state.completedMissionIds ===
    // undefined, so a missing save never LOOKS locked, just unlocked.
    const state = loadCampaignState();
    // Which side's continuous 36-mission chain this tab's cards gate
    // against — a UI/tab-id concern, not the save's own side (see
    // WARDEN_MISSION_CHAIN/HOUSE_AMARANTH_MISSION_CHAIN's own comment):
    // a Warden save browsing a House Amaranth tab just sees that chain's
    // own mission 1 unlocked and nothing past it, since it can never have
    // won a House Amaranth mission — no special-casing needed here for
    // that already-documented cross-side permissiveness.
    const chain: readonly CampaignMission[] = campaign.id.startsWith("house_amaranth") ? HOUSE_AMARANTH_MISSION_CHAIN : WARDEN_MISSION_CHAIN;

    campaign.missions.forEach((mission, i) => {
      const y = listTop + i * CARD_SPACING;
      // Demo mission cap, 12 Sep 2026 (Business Plan v1 §2b/§13, decision
      // 1) — checked ALONGSIDE the progression lock above, not instead of
      // it: a card is playable only when both allow it. In every non-demo
      // build (the normal browser build, Electron, `npm test`) isDemoLocked
      // is always false, so this changes nothing there — see data/demoCap.ts.
      const progressionUnlocked = !state || isMissionUnlocked(state, chain, mission.id);
      const demoLocked = isMissionDemoLocked(campaign.id, chain, mission.id);
      const unlocked = progressionUnlocked && !demoLocked;
      // Only meaningful in the progression-lock branch below (`!unlocked &&
      // !demoLocked`) — isMissionUnlocked's own contract guarantees a
      // progression-locked mission is never its chain's own first entry, so
      // chainIndex > 0 always holds THERE. A demo-locked House Amaranth
      // mission can freely be chainIndex 0 (its own chain's first mission),
      // but requiredMission is never read in that case — the demoLocked
      // branch in briefText/cardTip below is checked first.
      const chainIndex = chain.findIndex((m) => m.id === mission.id);
      const requiredMission = chainIndex > 0 ? chain[chainIndex - 1] : undefined;

      // PANEL_CARD_BORDER, not PANEL_BORDER — Codex UI match, 11 Sep 2026:
      // a mission card is a Codex-style card, not a chip/tab, so it takes
      // the darker of Codex's two border shades (see ui/Panel.ts's own
      // PANEL_CARD_BORDER comment). Locked cards stay on this same border
      // (no new color introduced) but a darker fill and dimmed text carry
      // the "can't touch this yet" read instead — same "hover always
      // wired, click gated separately" shape this doc's own tooltip
      // checklist already documents for a disabled Recruit-row candidate.
      // One shared "locked" visual for both reasons (progression or demo)
      // — no new third look invented for the demo case, per the Business
      // Plan's own "one flag, one panel... not a new system" framing.
      const card = this.add
        .rectangle(480, y, 860, CARD_HEIGHT, unlocked ? 0x1a2028 : 0x14181c, 1)
        .setStrokeStyle(1, PANEL_CARD_BORDER)
        .setInteractive({ useHandCursor: unlocked });
      // Left accent bar + mission index — 10 Sep 2026, see the CARD_ACCENT_W
      // comment up top. A UI numbering device only (i+1 into this
      // campaign's own mission array), not new mission content — the same
      // "don't invent what isn't there" line the removed placeholder header
      // was on the wrong side of. Locked cards dim the accent from gold to
      // TEXT_DIM's own shade — still a numbering device, just reading as
      // "not yours yet" rather than "next up."
      const accent = this.add.rectangle(50 + CARD_ACCENT_W / 2, y, CARD_ACCENT_W, CARD_HEIGHT - 2, unlocked ? PANEL_ACCENT : 0x3a4149, unlocked ? 0.85 : 0.6);
      const index = this.add
        .text(50 + CARD_ACCENT_W + 10, y, String(i + 1).padStart(2, "0"), { fontFamily: "monospace", fontSize: "10px", color: unlocked ? TEXT_ACCENT : TEXT_DIM })
        .setOrigin(0, 0.5);
      const title = this.add.text(140, y - 20, mission.displayName, { fontFamily: "monospace", fontSize: "17px", color: unlocked ? TEXT_MAIN : TEXT_DIM, letterSpacing: 0.5 });
      // Locked cards swap the briefing line for the lock reason itself —
      // stating a mission's real briefing text right under a card you
      // can't yet open reads as a spoiler for nothing gained; the lock
      // reason is the actually-useful line in that state instead. Demo
      // lock is checked first: a demo-locked card explains itself the same
      // way regardless of what progression would otherwise say.
      const briefText = unlocked
        ? mission.briefing
        : demoLocked
          ? DEMO_LOCK_MESSAGE
          : `LOCKED — win "${requiredMission?.displayName ?? ""}" first.`;
      const brief = this.add.text(140, y + 6, briefText, { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM, wordWrap: { width: 700 } });
      const cardTip = unlocked
        ? [mission.displayName, "", ...wrapTipText("Opens the squad review (BEAM DOWN) screen for this mission — not straight into combat.", 42)]
        : demoLocked
          ? [mission.displayName, "", ...wrapTipText(DEMO_LOCK_MESSAGE, 42)]
          : [mission.displayName, "", ...wrapTipText(`Locked — win "${requiredMission?.displayName ?? ""}" first. Once it's won, this card unlocks on its own.`, 42)];
      card.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (unlocked) {
          card.setFillStyle(0x1f2b36, 1);
          card.setStrokeStyle(1, PANEL_ACCENT);
        }
        this.hoverTip.show(cardTip, pointer.x, pointer.y);
      });
      card.on("pointermove", (pointer: Phaser.Input.Pointer) => this.hoverTip.show(cardTip, pointer.x, pointer.y));
      card.on("pointerout", () => {
        if (unlocked) {
          card.setFillStyle(0x1a2028, 1);
          card.setStrokeStyle(1, PANEL_CARD_BORDER);
        }
        this.hoverTip.hide();
      });
      if (unlocked) card.on("pointerdown", () => this.scene.start("TransporterPad", { missionId: mission.id }));
      this.missionListLayer.add([card, accent, index, title, brief]);
    });
  }
}
