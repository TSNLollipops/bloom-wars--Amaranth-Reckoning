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

// B4, 5 Sep 2026 — portrait gutter. bodyText's own left margin (originally
// a bare `bounds.left + 22`) shifts right by PORTRAIT_GUTTER to make room;
// PORTRAIT_R leaves comfortable padding above/below inside one row's real
// rendered height (see render()'s own rowH comment — a fixed ROW_H constant
// used to live here too, but it didn't match what 4 lines of this panel's
// own text actually render at, so it's gone; rowH is measured live instead).
const PORTRAIT_R = 15;
const PORTRAIT_GUTTER = 42;

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
  private bodyText: Phaser.GameObjects.Text;
  private moveTexts: Phaser.GameObjects.Text[] = [];
  // B4, 5 Sep 2026 — one per visible row, rebuilt every render() the same
  // way moveTexts/swap buttons already are (see that cleanup below).
  private avatarObjs: Phaser.GameObjects.Container[] = [];
  private noticeText: Phaser.GameObjects.Text;

  private state!: CampaignState;
  private tab: LanceId = "a";
  private records: Record<string, PilotServiceRecord> = {};
  private notice = "";
  // B2 swap mode. The cap alone deadlocks a full roster (15 pilots, 3
  // lances of 5 — see swapPilotLances' own header), so a pilot can be
  // picked up here and traded with anyone in another lance. Null = nobody
  // picked up.
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
    // built once here and shown/hidden per save in render(): a carrier gains
    // one lance per act, so this campaign only ever reveals three.
    let tx = bounds.left + 20;
    for (const id of ALL_TABS) {
      const t = scene.add
        .text(tx, bounds.top + 46, `[ ${lanceDisplayName(id)} ]`, { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);
      t.on("pointerdown", () => this.setTab(id));
      this.container.add(t);
      this.tabTexts.push(t);
      tx += t.width + 10;
    }

    this.warnText = scene.add
      .text(bounds.right - 20, bounds.top + 46, "", { fontFamily: "monospace", fontSize: "10px", color: TEXT_WARN })
      .setOrigin(1, 0.5)
      .setScrollFactor(0);
    this.container.add(this.warnText);

    // B4, 5 Sep 2026 — x shifted right by PORTRAIT_GUTTER (was a bare
    // `bounds.left + 22`) to leave room for the per-row portrait render()
    // now draws in that gutter. Each roster entry is still exactly 4 lines
    // (name, stats, service record, blank) — render() measures this Text
    // object's own rendered height per render() rather than assuming a
    // fixed row height, see its own rowH comment for why.
    this.bodyText = scene.add
      .text(bounds.left + 22 + PORTRAIT_GUTTER, bounds.top + 68, "", { fontFamily: "monospace", fontSize: "11px", color: TEXT_MAIN, lineSpacing: 3 })
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.container.add(this.bodyText);

    this.noticeText = scene.add
      .text(cx, bounds.bottom - 20, "", { fontFamily: "monospace", fontSize: "10px", color: TEXT_WARN })
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

  /** Exposed for the verify script — the same path the [→ 2nd Lance] buttons take. */
  movePilot(pilotId: string, to: LanceId): void {
    const result = assignPilotToLance(this.state, pilotId, to);
    if (result.ok) {
      this.notice = "";
      this.swapFrom = null;
      this.onChanged();
    } else {
      // A full destination is the common case at full roster, and a bare
      // refusal there is a dead end — every other lance is full too. Pick
      // the pilot up instead and tell the player to choose a trade.
      this.notice = `${result.reason} — pick someone there to trade with.`;
      this.swapFrom = pilotId;
    }
    this.render();
  }

  /** Pick a pilot up for trading, or complete a trade if one is already held. */
  pickForSwap(pilotId: string): void {
    if (this.swapFrom === null) {
      this.swapFrom = pilotId;
      this.notice = "picked up — click another pilot's [ trade ] to swap places.";
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
    for (const t of this.moveTexts) t.destroy();
    this.moveTexts = [];
    // Container.destroy() destroys its children too (Phaser's own default —
    // Container.exclusive is true unless explicitly turned off, which
    // nothing here does), so this alone is enough to clean up each avatar's
    // portrait Image/hitCircle along with it.
    for (const a of this.avatarObjs) a.destroy();
    this.avatarObjs = [];

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
      // The selected tab is bright; an unfieldable lance is flagged in the
      // tab strip itself, so a problem in a lance you're NOT looking at is
      // still visible without clicking through all three.
      t.setColor(id === this.tab ? TEXT_MAIN : fit.fieldable ? TEXT_DIM : TEXT_WARN);
    }

    const fit = lanceFieldability(this.state, this.tab);
    this.warnText.setText(fit.fieldable ? "" : fit.warning ?? "");
    this.warnText.setColor(fit.fieldable ? TEXT_OK : TEXT_WARN);

    const roster = lanceRoster(this.state, this.tab);
    if (roster.length === 0) {
      this.bodyText.setText("Nobody assigned to this lance.");
      this.noticeText.setText(this.notice);
      return;
    }

    const lines: string[] = [];
    for (const entry of roster) {
      const p = entry.pilot;
      const path = UNIT_ARCHETYPES[p.archetypeId]?.path ?? "?";
      const rec = this.records[p.id];
      const social = entry.social;
      // Line 1 — who they are.
      lines.push(`${p.displayName}`);
      // Line 2 — the standing stats the Hub used to leak ambiently.
      const standing = [`${path} · Tier ${p.tier}`, `${entry.personalPoints} pts`];
      if (social) {
        standing.push(`favorability ${social.favorability >= 0 ? "+" : ""}${social.favorability}`);
        if (social.inRelationship) standing.push("♥");
      }
      lines.push(`    ${standing.join("  ·  ")}`);
      // Line 3 — B2's actual headline: the service record. "absent" rather
      // than zeroes for a pilot who has never flown, so a fresh campaign
      // doesn't read as a squad of people who all went 0-for-0.
      if (rec) {
        const service = [
          `${rec.missionsFlown} mission${rec.missionsFlown === 1 ? "" : "s"} (${rec.wins}W)`,
          `${rec.kills} kills`,
          `downed ${rec.timesDowned}×`,
        ];
        const fav = rec.favoriteAbility ? ABILITIES[rec.favoriteAbility]?.displayName : undefined;
        if (fav) service.push(`most-used: ${fav}`);
        lines.push(`    ${service.join("  ·  ")}`);
      } else {
        lines.push("    no missions flown yet");
      }
      lines.push("");
    }
    this.bodyText.setText(lines.join("\n"));

    // One move button per pilot, cycling to the next lance — laid out
    // against the text block's own MEASURED per-entry height, not the
    // ROW_H constant. B4, 5 Sep 2026: caught by adding a portrait, which
    // made a pre-existing drift impossible to miss — ROW_H (46) was never
    // actually what 4 lines of this Text object render at (real fontSize
    // 11px + lineSpacing 3 comes out closer to 63px/entry), so buttons had
    // been quietly floating further above their own pilot's text with every
    // row down the list. bodyText.height / roster.length is exactly that
    // real per-entry height, however the font ends up rendering — immune to
    // this drift returning if the style ever changes again.
    const rowTop = this.bounds.top + 68;
    const rowH = this.bodyText.height / roster.length;
    for (const [i, entry] of roster.entries()) {
      const y = rowTop + i * rowH + 6;
      if (y > this.bounds.bottom - 40) break; // never draw a control past the panel
      const to = this.nextLance(this.tab);
      const pilotId = entry.pilot.id;
      const held = this.swapFrom === pilotId;

      // B4, 5 Sep 2026 — real portrait when one exists, the same filled-
      // circle+initials placeholder every other scene falls back to
      // otherwise. Centered on the row's own measured rowH band (see this
      // loop's own header comment on why that's rowH and not ROW_H) rather
      // than reusing the button's `y` (which is offset to sit at the text
      // block's own top line, not the row's vertical middle).
      const path = UNIT_ARCHETYPES[entry.pilot.archetypeId]?.path;
      const avatar = drawPilotAvatar(
        scene,
        this.bounds.left + 22 + PORTRAIT_R,
        rowTop + i * rowH + rowH / 2,
        PORTRAIT_R,
        pilotId,
        entry.pilot.displayName,
        path ? PATH_COLORS[path] : 0x555555
      );
      avatar.container.setScrollFactor(0);
      this.container.add(avatar.container);
      this.avatarObjs.push(avatar.container);

      // Move is the SECONDARY action, dimmer of the two: lances arrive full
      // (one per act, 5 pilots, cap 5), so a plain move only succeeds into a
      // slot a casualty opened. Day to day, reorganising means trading.
      const roomThere = lanceRoster(this.state, to).length < MAX_LANCE_SIZE;
      const btn = scene.add
        .text(this.bounds.right - 24, y, `[ → ${lanceDisplayName(to)} ]`, { fontFamily: "monospace", fontSize: "10px", color: roomThere ? TEXT_ACCENT : TEXT_DIM })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);
      btn.on("pointerdown", () => this.movePilot(pilotId, to));
      this.container.add(btn);
      this.moveTexts.push(btn);

      // Swap handle. Always present, not just when a lance is full: trading
      // two specific people is a thing a player wants to do on purpose, not
      // only a workaround for the cap.
      const swapBtn = scene.add
        .text(this.bounds.right - 24, y + 13, held ? "[ holding — pick a partner ]" : "[ trade ]", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: held ? TEXT_WARN : TEXT_ACCENT,
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0);
      swapBtn.on("pointerdown", () => this.pickForSwap(pilotId));
      this.container.add(swapBtn);
      this.moveTexts.push(swapBtn);
    }

    this.noticeText.setText(this.notice);
  }

  /** Cycles only through lances this carrier actually has — never offers a move to one that doesn't exist. */
  private nextLance(from: LanceId): LanceId {
    const active = activeLanceIds(this.state);
    const i = active.indexOf(from);
    return active[(i + 1) % active.length];
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
