// src/scenes/ui/RosterPanel.ts
// B2 — the Hangar Deck's crew records: the roster, divided per lance, each
// lance its own subpage, each pilot's stats shown as a static readout you
// check on purpose. Maxime's own ask (29 Aug 2026, Hangar Roster & Stats
// Panel plan doc), built 5 Sep 2026 once its open questions were answered.
//
// Two things it deliberately is NOT:
//
//  - It is not the Campaign Shop. Hub's existing ROSTER & GEAR console
//    already opens ShopPanel for gear/tier/recruit purchases, per Maxime's
//    30 Aug call to reuse that rather than build a thinner second copy of
//    it. This is the other half — who your people ARE, not what you can buy
//    them — and lives on its own walk-up point in the same room so one E
//    press never has to mean two different screens.
//  - It is not a deploy screen. Assignment here is organizational; the
//    Transporter Pad still owns who actually launches, and lance membership
//    only pre-fills its selection.
//
// The rules it enforces, all Maxime's calls, all recorded in
// engine/campaignState.ts's own B2 section rather than duplicated here:
// a hard cap of MAX_LANCE_SIZE per lance, and a missing Munti shown as a
// WARNING rather than a block — because the Warden roster is exactly three
// Muntis for three lances, so a hard requirement would allow one legal
// arrangement and permanently brick a lance the first time one is killed.
// canLaunchMission already refuses a Munti-less squad where it counts.
//
// Permanently lost pilots do not appear here at all. They are recorded once,
// in the Vault's roll (scenes/ui/MemorialPanel.ts) — Maxime's call, so the
// same names never live in two screens.
//
// Click-to-carry redesign, 9 Sep 2026 (Maxime, live-testing this panel the
// night the per-lance [→Lance] buttons shipped: "i cant find the button to
// move my unit around their lance can you build a column ui box I can clic
// and drag? instead of a button? use the same kind of ui setting as the
// codex. it look nice compared to rooster"). Real Phaser drag-and-drop was
// the other option on offer and Maxime picked the lighter one deliberately
// (no ghost sprite, no drop-zone hit-testing, no half-dragged-then-released
// edge cases): click a pilot's card to pick them up, then click a lance tab
// to drop them there, or another pilot's card to trade places. The engine
// calls underneath (assignPilotToLance, swapPilotLances) and the pick-up/
// trade state machine (swapFrom, pickForSwap) are UNCHANGED from the
// button-per-lance version this replaces — only what you click and how a
// row looks changed. Each pilot is now a real card (background + border,
// hover state, a highlighted fill while picked up) styled off the same
// palette Codex.ts and ShopPanel.ts already use, rather than one long Text
// blob with bracket-button overlays.
import Phaser from "phaser";
import {
  assignPilotToLance,
  swapPilotLances,
  lanceDisplayName,
  lanceFieldability,
  lanceOfPilotIn,
  lanceRoster,
  activeLanceIds,
  MAX_LANCE_SIZE,
  type CampaignState,
  type LanceId,
} from "../../engine/campaignState";
import { UNIT_ARCHETYPES } from "../../data/units";
import { pilotServiceRecords, type PilotServiceRecord } from "../../engine/statsStore";
import { ABILITIES } from "../../data/abilities";
// B4 (portrait wiring), 5 Sep 2026 — this panel never had a placeholder
// circle to swap (it was pure text from B2), so this is a genuinely new
// left-gutter portrait per row, not a drop-in replacement. Reuses the same
// drawPilotAvatar every other portrait-bearing scene calls (real portrait
// when one exists, the original filled-circle+initials placeholder
// otherwise) rather than inventing a second convention here.
import { PATH_COLORS, drawPilotAvatar } from "../TransporterPad";

const PANEL_BG = 0x1a2028;
const PANEL_BORDER = 0x3a4552;
const TEXT_MAIN = "#e8e2d4";
const TEXT_DIM = "#8a97a6";
const TEXT_ACCENT = "#c8b273";
const TEXT_WARN = "#c17a6a";
const TEXT_OK = "#7fa88a";

// Card palette — the same hex values Codex.ts's own PAL and ShopPanel.ts's
// button chrome already use (cardBg/cardBorder/playerBlue/hover), reused
// directly rather than reinvented, per Maxime's own "same kind of ui
// setting as the codex" ask.
const CARD_BG = 0x1a2028;
const CARD_BORDER = 0x2a323b;
const CARD_HOVER_BG = 0x22303c;
const CARRY_BG = 0x2e5c7a; // Codex's PAL.playerBlue — the "this one is selected" fill
const CARRY_BORDER = 0x4a7a9a;

// B4, 5 Sep 2026 — portrait gutter. Each card's text starts PORTRAIT_GUTTER
// right of the card's own left padding to make room for the avatar;
// PORTRAIT_R leaves comfortable padding above/below inside the card.
const PORTRAIT_R = 15;
const PORTRAIT_GUTTER = 42;
const CARD_PAD_X = 14;
const CARD_PAD_Y = 8;
const CARD_GAP = 6;

// The full id space, for building tab objects once. What's actually SHOWN is
// activeLanceIds(state) — see the tab loop.
const ALL_TABS: readonly LanceId[] = ["a", "b", "c", "d", "e"];

export interface RosterPanelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class RosterPanel {
  private container: Phaser.GameObjects.Container;
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private warnText: Phaser.GameObjects.Text;
  private emptyText: Phaser.GameObjects.Text;
  // One entry per currently-rendered pilot card: the background rectangle,
  // its text, and (when it has one) its portrait container. Destroyed and
  // rebuilt whole on every render(), same immediate-mode convention the
  // rest of this panel (and ShopPanel/Codex) already follow.
  private rowObjs: Phaser.GameObjects.GameObject[] = [];
  private noticeText: Phaser.GameObjects.Text;

  private state!: CampaignState;
  private tab: LanceId = "a";
  private records: Record<string, PilotServiceRecord> = {};
  private notice = "";
  // B2 swap mode, now doubling as "who's picked up" for the click-to-carry
  // flow. The cap alone deadlocks a full roster (15 pilots, 3 lances of 5 —
  // see swapPilotLances' own header), so a pilot can be picked up here and
  // either dropped on a lance tab (assignPilotToLance) or traded with
  // someone (swapPilotLances). Null = nobody picked up.
  private swapFrom: string | null = null;
  private readonly bounds: RosterPanelBounds;
  private readonly onChanged: () => void;

  /**
   * `onChanged` fires after any assignment that actually moved someone, so
   * Hub can persist the save and re-seed the affected Mek/berth NPCs — a
   * reassignment is supposed to be visible in the ship, not just on paper.
   */
  constructor(scene: Phaser.Scene, bounds: RosterPanelBounds, onClose: () => void, onChanged: () => void) {
    this.bounds = bounds;
    this.onChanged = onChanged;
    const cx = (bounds.left + bounds.right) / 2;
    this.container = scene.add.container(0, 0).setDepth(60).setVisible(false).setScrollFactor(0);

    const bg = scene.add
      .rectangle(cx, (bounds.top + bounds.bottom) / 2, bounds.right - bounds.left, bounds.bottom - bounds.top, PANEL_BG, 1)
      .setStrokeStyle(1, PANEL_BORDER)
      .setScrollFactor(0);
    this.container.add(bg);

    this.container.add(
      scene.add.text(cx, bounds.top + 18, "CREW RECORDS", { fontFamily: "monospace", fontSize: "13px", color: TEXT_ACCENT }).setOrigin(0.5, 0).setScrollFactor(0)
    );

    // Lance tabs. Every interactive child needs its OWN setScrollFactor(0):
    // Phaser renders children with the container's scroll factor but
    // hit-tests them with each child's, so one without it draws correctly
    // and takes clicks somewhere else entirely. See StandingsPanel.ts.
    // One tab object per POSSIBLE lance (LanceId carries five for Gladiator),
    // built once here and shown/hidden per save in render(): activeLanceIds
    // reveals four for this campaign (Recruit Cap Rework, 9 Sep 2026,
    // engine/campaignState.ts), open to recruiting from Mission 1 — the
    // fifth stays Gladiator-only.
    //
    // Click-to-carry, 9 Sep 2026: a tab is now a plain view-switcher when
    // nobody's picked up, and a drop zone the moment someone is — see
    // onTabClick.
    let tx = bounds.left + 20;
    for (const id of ALL_TABS) {
      const t = scene.add
        .text(tx, bounds.top + 46, `[ ${lanceDisplayName(id)} ]`, { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);
      t.on("pointerdown", () => this.onTabClick(id));
      this.container.add(t);
      this.tabTexts.push(t);
      tx += t.width + 10;
    }

    this.warnText = scene.add
      .text(bounds.right - 20, bounds.top + 46, "", { fontFamily: "monospace", fontSize: "10px", color: TEXT_WARN })
      .setOrigin(1, 0.5)
      .setScrollFactor(0);
    this.container.add(this.warnText);

    // Shown only for an empty lance ("Nobody assigned to this lance.") —
    // the pilot roster itself is now a stack of per-pilot cards built fresh
    // in render(), not one shared Text blob (see rowObjs).
    this.emptyText = scene.add
      .text(bounds.left + 22, bounds.top + 68, "", { fontFamily: "monospace", fontSize: "11px", color: TEXT_MAIN })
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.container.add(this.emptyText);

    this.noticeText = scene.add
      .text(cx, bounds.bottom - 20, "", { fontFamily: "monospace", fontSize: "10px", color: TEXT_WARN, align: "center", wordWrap: { width: bounds.right - bounds.left - 40 } })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);
    this.container.add(this.noticeText);

    const closeBtn = scene.add
      .text(bounds.right - 20, bounds.top + 18, "[ close — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    closeBtn.on("pointerdown", onClose);
    this.container.add(closeBtn);
  }

  open(state: CampaignState): void {
    this.state = state;
    this.records = pilotServiceRecords(state.campaignId);
    this.notice = "";
    this.swapFrom = null;
    this.container.setVisible(true);
    this.render();
  }

  close(): void {
    this.container.setVisible(false);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  /** Exposed for the headless verify script, which switches tabs without clicking. */
  setTab(tab: LanceId): void {
    this.tab = tab;
    this.notice = "";
    this.render();
  }

  /**
   * Tab click, routed through carrying state. Idle: an ordinary view
   * switch. Carrying and a DIFFERENT tab: a drop — attempts the move and,
   * win or lose, follows the player's eye onto that lance (a real move
   * lands them there; a full lance lands them there ready to pick a trade
   * partner, same as movePilot's own fallback already offers). Carrying
   * and the SAME tab (the lance already being viewed): reads as "changed
   * my mind," same as clicking the carried pilot's own card again.
   */
  private onTabClick(id: LanceId): void {
    if (this.swapFrom === null) {
      this.setTab(id);
      return;
    }
    if (id === this.tab) {
      this.swapFrom = null;
      this.notice = "";
      this.render();
      return;
    }
    this.tab = id;
    this.movePilot(this.swapFrom, id);
  }

  /** Exposed for the verify script — the same path a lance-tab drop takes. */
  movePilot(pilotId: string, to: LanceId): void {
    const result = assignPilotToLance(this.state, pilotId, to);
    if (result.ok) {
      this.notice = "";
      this.swapFrom = null;
      this.onChanged();
    } else {
      // A full destination is the common case at full roster, and a bare
      // refusal there is a dead end — every other lance is full too. Pick
      // the pilot up instead and tell the player to choose a trade. The
      // caller (onTabClick) has already switched this.tab to `to`, so the
      // player is looking straight at the lance they need to trade into.
      this.notice = `${result.reason} — click someone here to trade places, or click them again to cancel.`;
      this.swapFrom = pilotId;
    }
    this.render();
  }

  /** Pick a pilot up for trading, or complete a trade if one is already held. */
  pickForSwap(pilotId: string): void {
    if (this.swapFrom === null) {
      const name = this.state.pilots[pilotId]?.pilot.displayName ?? "them";
      this.swapFrom = pilotId;
      this.notice = `Carrying ${name} — click a lance tab to move them, another pilot to trade places, or click them again to cancel.`;
      this.render();
      return;
    }
    if (this.swapFrom === pilotId) {
      this.swapFrom = null;
      this.notice = "";
      this.render();
      return;
    }
    const result = swapPilotLances(this.state, this.swapFrom, pilotId);
    this.notice = result.ok ? "" : result.reason;
    this.swapFrom = null;
    if (result.ok) this.onChanged();
    this.render();
  }

  private render(): void {
    const scene = this.container.scene;
    const active = activeLanceIds(this.state);
    // A lance the carrier doesn't have yet is not a tab you can click.
    if (!active.includes(this.tab)) this.tab = active[0];

    for (const o of this.rowObjs) o.destroy();
    this.rowObjs = [];

    // Tabs are laid out HERE, not at construction: their labels gain the
    // "n/5" occupancy at render, which is wider than the bare name they were
    // first measured at, so fixed construction-time x positions made them
    // overlap each other. Caught by screenshot, 5 Sep 2026.
    let tabX = this.bounds.left + 20;
    for (const [i, t] of this.tabTexts.entries()) {
      const id = ALL_TABS[i];
      if (!active.includes(id)) {
        t.setVisible(false);
        continue;
      }
      t.setVisible(true);
      const fit = lanceFieldability(this.state, id);
      const count = lanceRoster(this.state, id).length;
      t.setText(`[ ${lanceDisplayName(id)} ${count}/${MAX_LANCE_SIZE} ]`);
      t.setX(tabX);
      tabX += t.width + 12;
      // The selected tab is bright; carrying a pilot tints every OTHER tab
      // as a live drop target (same accent color the cards use for a
      // clickable affordance); an unfieldable lance is flagged in the tab
      // strip itself either way, so a problem in a lance you're not
      // looking at is still visible without clicking through all of them.
      const isCurrent = id === this.tab;
      const isDropTarget = this.swapFrom !== null && !isCurrent;
      t.setColor(isCurrent ? TEXT_MAIN : isDropTarget ? TEXT_ACCENT : fit.fieldable ? TEXT_DIM : TEXT_WARN);
    }

    const fit = lanceFieldability(this.state, this.tab);
    this.warnText.setText(fit.fieldable ? "" : fit.warning ?? "");
    this.warnText.setColor(fit.fieldable ? TEXT_OK : TEXT_WARN);

    const roster = lanceRoster(this.state, this.tab);
    if (roster.length === 0) {
      this.emptyText.setText("Nobody assigned to this lance.");
      this.noticeText.setText(this.notice);
      return;
    }
    this.emptyText.setText("");

    // Click-to-carry, 9 Sep 2026: each pilot is a real card (background,
    // border, hover state) rather than a shared Text blob with bracket
    // buttons floating over it. The whole card is the click target —
    // pickForSwap handles pick-up/cancel/trade identically to what the old
    // [ trade ] button called, so the engine-facing behavior is unchanged.
    const cardL = this.bounds.left + 14;
    const cardR = this.bounds.right - 14;
    const cardW = cardR - cardL;
    const cardCx = (cardL + cardR) / 2;
    let y = this.bounds.top + 64;

    for (const entry of roster) {
      const p = entry.pilot;
      if (y > this.bounds.bottom - 34) break; // never draw a card past the panel

      const path = UNIT_ARCHETYPES[p.archetypeId]?.path ?? "?";
      const rec = this.records[p.id];
      const social = entry.social;

      const standing = [`${path} · Tier ${p.tier}`, `${entry.personalPoints} pts`];
      if (social) {
        standing.push(`favorability ${social.favorability >= 0 ? "+" : ""}${social.favorability}`);
        if (social.inRelationship) standing.push("♥");
      }
      let serviceLine: string;
      if (rec) {
        const service = [
          `${rec.missionsFlown} mission${rec.missionsFlown === 1 ? "" : "s"} (${rec.wins}W)`,
          `${rec.kills} kills`,
          `downed ${rec.timesDowned}×`,
        ];
        const fav = rec.favoriteAbility ? ABILITIES[rec.favoriteAbility]?.displayName : undefined;
        if (fav) service.push(`most-used: ${fav}`);
        serviceLine = service.join("  ·  ");
      } else {
        serviceLine = "no missions flown yet";
      }

      const isCarried = this.swapFrom === p.id;
      const textLines = [p.displayName, `    ${standing.join("  ·  ")}`, `    ${serviceLine}`].join("\n");
      const cardText = scene.add
        .text(cardL + CARD_PAD_X + PORTRAIT_GUTTER, y + CARD_PAD_Y, textLines, {
          fontFamily: "monospace",
          fontSize: "11px",
          lineSpacing: 3,
          color: isCarried ? "#ffffff" : TEXT_MAIN,
        })
        .setOrigin(0, 0)
        .setScrollFactor(0);
      const cardH = cardText.height + CARD_PAD_Y * 2;
      const cardCy = y + cardH / 2;

      const restBg = isCarried ? CARRY_BG : CARD_BG;
      const restBorder = isCarried ? CARRY_BORDER : CARD_BORDER;
      const cardBg = scene.add
        .rectangle(cardCx, cardCy, cardW, cardH, restBg, 1)
        .setStrokeStyle(1, restBorder)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);
      cardBg.on("pointerover", () => cardBg.setFillStyle(isCarried ? CARRY_BG : CARD_HOVER_BG, 1));
      cardBg.on("pointerout", () => cardBg.setFillStyle(restBg, 1));
      cardBg.on("pointerdown", () => this.pickForSwap(p.id));

      const avatar = drawPilotAvatar(scene, cardL + CARD_PAD_X + PORTRAIT_R, cardCy, PORTRAIT_R, p.id, p.displayName, path ? PATH_COLORS[path] : 0x555555);
      avatar.container.setScrollFactor(0);

      // Background first so the avatar and text paint on top of it.
      this.container.add(cardBg);
      this.container.add(avatar.container);
      this.container.add(cardText);
      this.rowObjs.push(cardBg, avatar.container, cardText);

      y += cardH + CARD_GAP;
    }

    this.noticeText.setText(
      this.notice || "Click a pilot to pick them up, then click a lance tab to move them, or another pilot to trade places."
    );
  }

  /** The pilot ids currently in `lance` — Hub hands these to the Transporter Pad as a deploy pre-selection. */
  static deployPreselection(state: CampaignState, lance: LanceId): string[] {
    return lanceRoster(state, lance).map((e) => e.pilot.id);
  }

  /** Which lance a pilot is in right now — re-exported so callers don't need a second import. */
  static lanceOf(state: CampaignState, pilotId: string): LanceId {
    return lanceOfPilotIn(state, pilotId);
  }
}
