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
// to drop them there, or another pilot's card to trade places.
//
// Real drag-and-drop, 11 Sep 2026 — click-to-carry replaced, not patched.
// Maxime playtested it and it didn't click twice in a row ("switching a
// pilot from lance to lance is nit intuitive... I havent found out how to
// do it and youve explained it to me as you built the thi g"), so this is
// the option that lost the 9 Sep call, now built for real — with an added
// reason: it's meant to double as groundwork for Gladiator's "massive
// army" management later, per Maxime's own call when he picked it.
// (Gladiator is currently planned as its OWN separate project/codebase,
// not a mode inside this game — see Bloom_Wars_Gladiator_Fleet_Battle_
// Concept_v1.md's "the gladiator thing is the next project" — so nothing
// here gets literally imported there. What carries over is the pattern
// and the lesson, which is why this stayed a RosterPanel-local build
// rather than a speculative generic drag-drop framework nobody's asked
// for yet. Flagged to Maxime directly, not a silent call.)
//
// Every pilot card (drawPilotAvatar + name + stats) is now a real Phaser
// draggable: mousedown-and-move past the threshold fires dragstart, the
// card itself goes invisible (alpha 0, NOT setVisible(false) — Phaser
// keeps feeding drag events to the object that started the drag regardless
// of tab switches mid-drag, and alpha is a rendering property that input
// hit-testing never looks at, so this is the safe way to "hide" it without
// risking the drag silently dying) and a small floating ghost (avatar +
// name, Codex/ShopPanel palette) follows the pointer instead. Hovering a
// DIFFERENT lance's tab while still holding the pointer down live-switches
// which lance's cards are on screen — the same "peek into the other bag
// tab while still holding the item" motion WoW and EVE both already use,
// which is exactly why it was picked over a louder click-to-carry retry.
// Dropping on a tab moves them (or, if that lance is already at
// MAX_LANCE_SIZE, leaves them "held" the same way the old flow did — see
// movePilot's failure branch); dropping on another pilot's card trades
// the two. All engine-facing logic is UNCHANGED from the click-to-carry
// build: movePilot/pickForSwap/swapFrom are still exactly what actually
// calls assignPilotToLance/swapPilotLances underneath, and are still the
// same public API tools/verify/checkRosterPanel.mjs drives headlessly
// (it calls them directly, never through a pointer event) — this redesign
// only changes what the PLAYER touches and what appears on screen, not the
// state machine or its tests. Drag geometry (tabRects/cardRects) is
// recomputed every render() and hit-tested manually in code rather than
// via Phaser's own drop-zone system, on purpose: this build has no way to
// visually playtest itself, so keeping hit-testing as plain, readable
// coordinate math (rather than Phaser's own zone/overlap machinery) is
// what's actually checkable by reading it. Maxime's own manual playtest
// (and, ideally, a real mouse-drag pass through checkRosterPanel.mjs or
// its drag companion — see tools/verify/checkRosterPanelDrag.mjs) is what
// actually proves this works, the same honesty this project runs on
// everywhere else.
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
import { wrapTipText } from "../../engine/hoverTipLayout";

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
  // Tooltip pass, 12 Sep 2026 (standing rule — see
  // claude/Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md).
  // This panel draws straight into Hub's own scene (it's constructed with
  // Hub's `this`, not a scene of its own), and Hub already has a
  // competing scene-wide hover system (see Hub.ts's own overlayHoverActive/
  // wireHoverTip — a raw new HoverTip() here would get stomped by that
  // handler on the very next pixel of mouse movement, same bug Hub.ts's
  // own tooltip pass already found and fixed for its Workshop/Vault
  // panels). So this panel takes Hub's wireHoverTip as a callback instead
  // of owning a HoverTip itself — same fix, applied across the file
  // boundary. Optional so a future, simpler host isn't forced to supply
  // one — every tooltip call below is a no-op without it.
  private readonly showTooltip?: (obj: Phaser.GameObjects.GameObject, lines: string[]) => void;

  // Real drag-and-drop, 11 Sep 2026. dragPilotId/dragOriginTab track the
  // live gesture; dragObjs are the three GameObjects (card background,
  // avatar, text) of the card actually being dragged, pulled OUT of
  // rowObjs the moment a drag starts so a mid-drag render() (see
  // onDragMove's tab-hover-switch) rebuilds every other card without
  // destroying the one Phaser is still feeding drag events to. dragGhost
  // is the small floating card that follows the pointer instead.
  // tabRects/cardRects are rebuilt every render() and hit-tested by hand
  // in onDragMove/endDrag — see this file's header comment for why manual
  // coordinate math was picked over Phaser's own drop-zone system here.
  private dragPilotId: string | null = null;
  private dragOriginTab: LanceId | null = null;
  private dragGhost: Phaser.GameObjects.Container | null = null;
  private dragObjs: Phaser.GameObjects.GameObject[] = [];
  private tabRects: { id: LanceId; x: number; y: number; w: number; h: number }[] = [];
  private cardRects: { pilotId: string; x: number; y: number; w: number; h: number }[] = [];

  /**
   * `onChanged` fires after any assignment that actually moved someone, so
   * Hub can persist the save and re-seed the affected Mek/berth NPCs — a
   * reassignment is supposed to be visible in the ship, not just on paper.
   */
  constructor(
    scene: Phaser.Scene,
    bounds: RosterPanelBounds,
    onClose: () => void,
    onChanged: () => void,
    showTooltip?: (obj: Phaser.GameObjects.GameObject, lines: string[]) => void
  ) {
    this.bounds = bounds;
    this.onChanged = onChanged;
    this.showTooltip = showTooltip;
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
      this.showTooltip?.(t, [
        lanceDisplayName(id),
        "",
        ...wrapTipText("Click to view this lance's roster. Drag a pilot's card here to move them into it.", 42),
      ]);
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
    this.showTooltip?.(closeBtn, ["Close", "", ...wrapTipText("Closes Crew Records. Nothing here needs a separate save — every move already applied.", 42)]);
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
      // caller (onTabClick, or endDrag on a failed drag-drop) has already
      // switched this.tab to `to`, so the player is looking straight at
      // the lance they need to trade into. Still says "holding" on
      // purpose (checked live by tools/verify/checkRosterPanel.mjs) — it's
      // accurate either way a player got here: a plain click on a
      // different tab still runs this exact branch and still leaves
      // swapFrom set for a follow-up click (onTabClick), same as a failed
      // drag-drop leaves it set for a follow-up drag (beginDrag resets it
      // first, so a fresh drag never picks up this stale hold by mistake).
      const name = this.state.pilots[pilotId]?.pilot.displayName ?? "them";
      this.notice = `${result.reason} Still holding ${name} — drag them onto a pilot below to trade places, click another tab to send them there instead, or click this tab again to cancel.`;
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

  /**
   * Fires on the card's own dragstart — see this file's header comment for
   * the full design. Detaches this pilot's three row objects from rowObjs
   * (so a mid-drag render() rebuilds everyone else without destroying the
   * object Phaser is still feeding drag events to), hides them via alpha
   * (never setVisible — see header comment on why), and spawns the ghost
   * that actually follows the pointer.
   */
  private beginDrag(
    pilotId: string,
    cardBg: Phaser.GameObjects.Rectangle,
    avatarContainer: Phaser.GameObjects.Container,
    cardText: Phaser.GameObjects.Text,
    pathColor: number,
    displayName: string,
    pointer: Phaser.Input.Pointer
  ): void {
    // A stale swapFrom left over from a previous failed drag-drop (see
    // movePilot's failure branch) must never bleed into a fresh drag —
    // pickForSwap's own pick-up/trade toggle only makes sense starting
    // from null, and a leftover value here would silently trade the WRONG
    // two pilots the moment this new drag lands on a card (see endDrag).
    this.swapFrom = null;
    this.notice = "";
    this.dragPilotId = pilotId;
    this.dragOriginTab = this.tab;
    this.dragObjs = [cardBg, avatarContainer, cardText];
    this.rowObjs = this.rowObjs.filter((o) => !this.dragObjs.includes(o));
    cardBg.setAlpha(0);
    avatarContainer.setAlpha(0);
    cardText.setAlpha(0);

    const scene = this.container.scene;
    const ghost = scene.add.container(pointer.x + 14, pointer.y + 10).setScrollFactor(0);
    const ghostBg = scene.add
      .rectangle(0, 0, 210, 34, CARRY_BG, 0.95)
      .setStrokeStyle(1, CARRY_BORDER)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    const ghostAvatar = drawPilotAvatar(scene, 16, 0, 12, pilotId, displayName, pathColor);
    ghostAvatar.container.setScrollFactor(0);
    const ghostText = scene.add
      .text(34, 0, displayName, { fontFamily: "monospace", fontSize: "11px", color: "#ffffff" })
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    ghost.add([ghostBg, ghostAvatar.container, ghostText]);
    this.container.add(ghost);
    this.dragGhost = ghost;

    this.noticeText.setText("Drop on a lance tab to move them, or on another pilot's card to trade places.");
  }

  /** Fires on every pointer move while a card is being dragged. */
  private onDragMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragGhost) return;
    this.dragGhost.setPosition(pointer.x + 14, pointer.y + 10);

    // Hovering a different lance's tab while still holding the pointer
    // down live-switches the visible roster to it — see header comment.
    const hovered = this.tabRects.find((r) => pointer.x >= r.x && pointer.x <= r.x + r.w && pointer.y >= r.y && pointer.y <= r.y + r.h);
    if (hovered && hovered.id !== this.tab) {
      this.tab = hovered.id;
      this.render();
    }
  }

  /** Fires on pointer release. Hit-tests by hand against this render's own tabRects/cardRects — see header comment on why. */
  private endDrag(pointer: Phaser.Input.Pointer): void {
    const pilotId = this.dragPilotId;
    const originTab = this.dragOriginTab;
    this.destroyDragVisuals();
    if (!pilotId) return;

    const overCard = this.cardRects.find(
      (r) => r.pilotId !== pilotId && pointer.x >= r.x && pointer.x <= r.x + r.w && pointer.y >= r.y && pointer.y <= r.y + r.h
    );
    if (overCard) {
      // Both ids are already known synchronously, but this still goes
      // through pickForSwap (called twice) rather than swapPilotLances
      // directly — reusing the exact pick-up/trade path
      // checkRosterPanel.mjs already drives headlessly, instead of a
      // second, parallel way to reach the same engine call.
      this.pickForSwap(pilotId);
      this.pickForSwap(overCard.pilotId);
      return;
    }

    const overTab = this.tabRects.find((r) => pointer.x >= r.x && pointer.x <= r.x + r.w && pointer.y >= r.y && pointer.y <= r.y + r.h);
    if (overTab) {
      if (overTab.id === originTab) {
        // Dropped back where they started — "changed my mind," same read
        // as clicking the carried pilot's own card again under the old flow.
        this.notice = "";
        this.render();
        return;
      }
      this.movePilot(pilotId, overTab.id);
      return;
    }

    // Released over neither a card nor a tab — cancelled, nothing moves.
    this.notice = "";
    this.render();
  }

  /** Phaser's rare dragcancel (e.g. losing pointer capture mid-drag) — clean up, apply nothing. */
  private cancelDrag(): void {
    this.destroyDragVisuals();
    this.notice = "";
    this.render();
  }

  /** Shared teardown for both endDrag and cancelDrag — destroys the ghost and the detached original card, then clears drag state. */
  private destroyDragVisuals(): void {
    for (const o of this.dragObjs) o.destroy();
    this.dragObjs = [];
    if (this.dragGhost) this.dragGhost.destroy();
    this.dragGhost = null;
    this.dragPilotId = null;
    this.dragOriginTab = null;
  }

  private render(): void {
    const scene = this.container.scene;
    const active = activeLanceIds(this.state);
    // A lance the carrier doesn't have yet is not a tab you can click.
    if (!active.includes(this.tab)) this.tab = active[0];

    for (const o of this.rowObjs) o.destroy();
    this.rowObjs = [];
    this.tabRects = [];
    this.cardRects = [];

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
      const tabW = t.width;
      // A generous, padded hit box — not the bare text glyphs — since a
      // real drag drop is far less precise than a click. Recomputed every
      // render because tabX/tabW shift with the "n/5" text each time.
      this.tabRects.push({ id, x: tabX - 8, y: this.bounds.top + 46 - 14, w: tabW + 16, h: 28 });
      tabX += tabW + 12;
      // The selected tab is bright; dragging a pilot tints every OTHER tab
      // as a live drop target — accent for "drop here to just move them",
      // warn for "this lance is already full, you'll need to trade" (the
      // same color a fielding problem already uses, reused on purpose so
      // "full" always reads as the same color everywhere in this panel).
      // An unfieldable lance is flagged in the tab strip itself either
      // way, so a problem in a lance you're not looking at is still
      // visible without switching to it.
      const isCurrent = id === this.tab;
      const isFull = count >= MAX_LANCE_SIZE;
      const isDropTarget = this.dragPilotId !== null && !isCurrent;
      t.setColor(isCurrent ? TEXT_MAIN : isDropTarget ? (isFull ? TEXT_WARN : TEXT_ACCENT) : fit.fieldable ? TEXT_DIM : TEXT_WARN);
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

      // Nobody is "carried" by a click any more (see beginDrag) — swapFrom
      // now only ever gets set by a FAILED drag-drop (movePilot's failure
      // branch) or by the headless verify script calling pickForSwap
      // directly, neither of which is this card being actively dragged
      // right now, so isCarried keeps meaning exactly what its name says.
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
      this.cardRects.push({ pilotId: p.id, x: cardL, y, w: cardW, h: cardH });

      const restBg = isCarried ? CARRY_BG : CARD_BG;
      const restBorder = isCarried ? CARRY_BORDER : CARD_BORDER;
      const cardBg = scene.add
        .rectangle(cardCx, cardCy, cardW, cardH, restBg, 1)
        .setStrokeStyle(1, restBorder)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);
      cardBg.on("pointerover", () => cardBg.setFillStyle(isCarried ? CARRY_BG : CARD_HOVER_BG, 1));
      cardBg.on("pointerout", () => cardBg.setFillStyle(restBg, 1));
      this.showTooltip?.(cardBg, [
        p.displayName,
        "",
        ...wrapTipText("Drag onto a lance tab to move them there, or onto another pilot's card to trade places.", 42),
      ]);

      // Resolved once, reused for both this card's avatar and the ghost's
      // (beginDrag takes the resolved color, not `path` itself — path's
      // type is narrow enough for PATH_COLORS right here but widening it
      // to a method parameter isn't worth relitigating, so the color is
      // what crosses that boundary instead).
      const pathColor = path ? PATH_COLORS[path] : 0x555555;
      const avatar = drawPilotAvatar(scene, cardL + CARD_PAD_X + PORTRAIT_R, cardCy, PORTRAIT_R, p.id, p.displayName, pathColor);
      avatar.container.setScrollFactor(0);

      // Real drag-and-drop, 11 Sep 2026 — see this file's header comment.
      // setDraggable is what turns a plain interactive rectangle into
      // something Phaser will actually fire dragstart/drag/dragend on.
      scene.input.setDraggable(cardBg);
      cardBg.on("dragstart", (pointer: Phaser.Input.Pointer) => this.beginDrag(p.id, cardBg, avatar.container, cardText, pathColor, p.displayName, pointer));
      cardBg.on("drag", (pointer: Phaser.Input.Pointer) => this.onDragMove(pointer));
      cardBg.on("dragend", (pointer: Phaser.Input.Pointer) => this.endDrag(pointer));
      cardBg.on("dragcancel", () => this.cancelDrag());

      // Background first so the avatar and text paint on top of it.
      this.container.add(cardBg);
      this.container.add(avatar.container);
      this.container.add(cardText);
      this.rowObjs.push(cardBg, avatar.container, cardText);

      y += cardH + CARD_GAP;
    }

    this.noticeText.setText(
      this.notice || "Drag a pilot's card onto a lance tab to move them, or onto another pilot's card to trade places."
    );
    // A mid-drag render() (onDragMove's tab-hover-switch) adds every new
    // card AFTER the ghost in this.container's child list, which would
    // otherwise bury the ghost under them — keep it on top regardless.
    if (this.dragGhost) this.container.bringToTop(this.dragGhost);
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
