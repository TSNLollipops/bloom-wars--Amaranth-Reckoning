// ---------------------------------------------------------------------
// THE ARCHIVE — the reworked Codex, as a screen.
//
// Five shelves of thirteen sections in a left rail, the entries on that
// section in the middle, and one entry at a time in a real scrolling reader
// on the right. Replaces the shipped Codex's fifteen flat tabs and its
// fixed-height paged cards.
//
// Reached from the tactical table in the CIC (Warden) and the reading table
// in Records (House Amaranth) — see engine/facility.ts's archiveTable point.
// LAUNCHED, not started: the Hub pauses underneath and is exactly as the
// player left it when they walk away from the table (decided 7 Sep, Q4).
// This is the first scene in the game that returns that way.
//
// Content is data/archive.ts. The live per-pilot block is
// engine/archiveDossier.ts. Nothing is authored in this file.
// ---------------------------------------------------------------------

import Phaser from "phaser";
import {
  ARCHIVE_SHELVES,
  type ArchiveEntry,
  type ArchiveFacility,
  type ArchiveSectionId,
  bodyFor,
  entriesInSection,
  forFacility,
  gateValue,
  isEntryUnlocked,
  revisionCount,
} from "../data/archive";
import { highestMissionIndexReached } from "../data/missionBriefing";
import {
  type ArchiveDossier,
  archiveDisplayName,
  archiveRosterGroups,
  buildArchiveDossier,
  facilityOf,
} from "../engine/archiveDossier";
import { type CampaignPilotEntry, type CampaignState } from "../engine/campaignState";
import { pilotServiceRecords, type PilotServiceRecord } from "../engine/statsStore";

const PAL = {
  bg: 0x0a0d10,
  panel: 0x141a20,
  panelBorder: 0x3a4552,
  card: 0x1a2028,
  cardOn: 0x202833,
  cardBorder: 0x2a323b,
  text: "#e8e2d4",
  muted: "#8a97a6",
  faint: "#5a6472",
  brass: "#e0b23c",
  brassHex: 0xe0b23c,
  rose: "#b04a6a",
  roseHex: 0xb04a6a,
  blueHex: 0x2e5c7a,
  go: "#4ade80",
  danger: "#ef4444",
  info: "#22d3ee",
};

const MONO = "monospace";
const W = 1074;

// Three panes, same proportions the approved sandbox mockup used at this
// exact canvas size, so the layout that was signed off is the one that ships.
const RAIL = { x: 20, y: 70, w: 178, h: 526 };
const LIST = { x: 208, y: 70, w: 248, h: 526 };
const READ = { x: 466, y: 70, w: 588, h: 526 };

interface ArchiveLaunchData {
  state?: CampaignState | null;
  returnScene?: string;
}

/** A row in the middle pane: either a written entry or a live pilot. */
type ListItem =
  | { kind: "entry"; entry: ArchiveEntry }
  | { kind: "group"; label: string; note: string }
  | { kind: "pilot"; pilot: CampaignPilotEntry; struck: boolean };

export class Archive extends Phaser.Scene {
  private state: CampaignState | null = null;
  private returnScene = "Hub";
  private fac: ArchiveFacility = "warden";
  private resolved = -1;
  private records: Record<string, PilotServiceRecord> = {};

  private sectionId: ArchiveSectionId = "personnel";
  private selectedId = "";
  private listScroll = 0;
  private readScroll = 0;

  private railLayer!: Phaser.GameObjects.Container;
  private listLayer!: Phaser.GameObjects.Container;
  private readLayer!: Phaser.GameObjects.Container;
  private listMask!: Phaser.Display.Masks.GeometryMask;
  private readMask!: Phaser.Display.Masks.GeometryMask;
  private listHeight = 0;
  private readHeight = 0;

  constructor() {
    super("Archive");
  }

  init(data: ArchiveLaunchData) {
    this.state = data?.state ?? null;
    this.returnScene = data?.returnScene ?? "Hub";
    this.fac = this.state ? facilityOf(this.state) : "warden";
    // highestMissionIndexReached, not the Warden-only version: a House
    // Amaranth save's mission ids are absent from WARDEN_MISSION_ORDER, so
    // asking that one returns -1 forever and every gate on the House console
    // stays shut. +1 turns a 0-based index into "missions resolved".
    this.resolved = this.state
      ? highestMissionIndexReached(this.fac, this.state.lastMissionEcho) + 1
      : 0;
    this.records = this.state ? pilotServiceRecords(this.state.campaignId) : {};
    this.sectionId = "personnel";
    this.selectedId = "";
    this.listScroll = 0;
    this.readScroll = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor(PAL.bg);
    this.drawChrome();

    this.railLayer = this.add.container(0, 0);
    this.listLayer = this.add.container(0, 0);
    this.readLayer = this.add.container(0, 0);
    this.listMask = this.maskFor(LIST);
    this.readMask = this.maskFor(READ);
    this.listLayer.setMask(this.listMask);
    this.readLayer.setMask(this.readMask);

    this.input.keyboard?.on("keydown-ESC", () => this.leave());
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const px = this.input.activePointer.x;
      if (px >= READ.x) this.scrollRead(dy);
      else if (px >= LIST.x) this.scrollList(dy);
    });

    this.renderRail();
    this.renderList();
    this.renderReader();
  }

  private maskFor(r: { x: number; y: number; w: number; h: number }) {
    const g = this.make.graphics({});
    g.fillRect(r.x, r.y, r.w, r.h);
    return g.createGeometryMask();
  }

  private tint(): string {
    return this.fac === "warden" ? PAL.brass : PAL.rose;
  }

  private facilityTitle(): string {
    return this.fac === "warden" ? "WARDEN CO. — CIC" : "HOUSE AMARANTH — RECORDS";
  }

  // ---- chrome ---------------------------------------------------------
  private drawChrome() {
    this.add.text(W / 2, 18, "THE BLOOM WARS", { fontFamily: MONO, fontSize: "9px", color: PAL.faint }).setOrigin(0.5);
    this.add.text(W / 2, 34, "THE ARCHIVE", { fontFamily: MONO, fontSize: "18px", color: PAL.text }).setOrigin(0.5);
    this.add.text(24, 22, this.facilityTitle(), { fontFamily: MONO, fontSize: "9px", color: this.tint() }).setOrigin(0, 0.5);
    this.add
      .text(W - 24, 22, this.state ? `MISSIONS RESOLVED — ${this.resolved}` : "NO CAMPAIGN LOADED", {
        fontFamily: MONO,
        fontSize: "9px",
        color: PAL.faint,
      })
      .setOrigin(1, 0.5);
    this.add.rectangle(W / 2, 58, W - 40, 1, PAL.cardBorder);

    for (const p of [RAIL, LIST, READ]) {
      this.add.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, PAL.panel, 1).setStrokeStyle(1, PAL.panelBorder);
    }

    const back = this.add
      .text(W / 2, 616, "ESC — LEAVE THE CONSOLE", { fontFamily: MONO, fontSize: "10px", color: PAL.muted })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on("pointerup", () => this.leave());
    back.on("pointerover", () => back.setColor(PAL.text));
    back.on("pointerout", () => back.setColor(PAL.muted));
  }

  private leave() {
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }

  // ---- left rail: shelves and sections --------------------------------
  private renderRail() {
    this.railLayer.destroy();
    this.railLayer = this.add.container(0, 0);
    let y = RAIL.y + 8;
    for (const shelf of ARCHIVE_SHELVES) {
      this.railLayer.add(
        this.add.text(RAIL.x + 10, y, forFacility(shelf.label, this.fac).toUpperCase(), {
          fontFamily: MONO,
          fontSize: "8px",
          color: this.tint(),
        }),
      );
      y += 14;
      for (const sec of shelf.sections) {
        const on = sec.id === this.sectionId;
        // Count documents, not rows. Personnel's rows include the lance and
        // struck-group HEADERS, which are furniture — counting them made the
        // Warden roster read "6" beside five pilots.
        const rows = this.itemsFor(sec.id);
        const unlocked = rows.filter(
          (r) => r.kind === "pilot" || (r.kind === "entry" && isEntryUnlocked(r.entry, this.fac, this.resolved)),
        ).length;
        const bg = this.add
          .rectangle(RAIL.x + RAIL.w / 2, y + 9, RAIL.w - 12, 18, on ? PAL.blueHex : PAL.card, 1)
          .setStrokeStyle(1, PAL.cardBorder)
          .setInteractive({ useHandCursor: true });
        bg.on("pointerup", () => {
          this.sectionId = sec.id;
          this.selectedId = "";
          this.listScroll = 0;
          this.readScroll = 0;
          this.renderRail();
          this.renderList();
          this.renderReader();
        });
        this.railLayer.add(bg);
        this.railLayer.add(
          this.add.text(RAIL.x + 10, y + 3, sec.label.toUpperCase(), {
            fontFamily: MONO,
            fontSize: "9px",
            color: on ? "#ffffff" : PAL.muted,
          }),
        );
        this.railLayer.add(
          this.add
            .text(RAIL.x + RAIL.w - 10, y + 3, `${unlocked}`, { fontFamily: MONO, fontSize: "8px", color: on ? "#cfe3ef" : PAL.faint })
            .setOrigin(1, 0),
        );
        y += 21;
      }
      y += 6;
    }
  }

  // ---- middle: the entry list -----------------------------------------
  /**
   * Personnel is the ROSTER, not a fixed entry table: it reads the save and
   * lists everyone actually on it, recruits included, grouped by lance with
   * the people who left in one struck group at the bottom. Every other
   * section is its written entries.
   */
  private itemsFor(section: ArchiveSectionId): ListItem[] {
    if (section === "personnel" && this.state) {
      const out: ListItem[] = [];
      for (const g of archiveRosterGroups(this.state)) {
        out.push({ kind: "group", label: g.label, note: `${g.entries.length}` });
        for (const e of g.entries) out.push({ kind: "pilot", pilot: e, struck: g.id === "struck" });
      }
      return out;
    }
    return entriesInSection(section, this.fac).map((entry) => ({ kind: "entry", entry }) as ListItem);
  }

  private renderList() {
    this.listLayer.destroy();
    this.listLayer = this.add.container(0, 0);
    this.listLayer.setMask(this.listMask);

    const items = this.itemsFor(this.sectionId);
    if (!this.selectedId) {
      const first = items.find((i) => i.kind === "pilot" || (i.kind === "entry" && isEntryUnlocked(i.entry, this.fac, this.resolved)));
      if (first) this.selectedId = first.kind === "pilot" ? first.pilot.pilot.id : first.kind === "entry" ? first.entry.id : "";
    }

    let y = LIST.y + 6 - this.listScroll;
    for (const item of items) {
      if (item.kind === "group") {
        this.listLayer.add(this.add.text(LIST.x + 10, y + 4, item.label.toUpperCase(), { fontFamily: MONO, fontSize: "8px", color: this.tint() }));
        this.listLayer.add(
          this.add.text(LIST.x + LIST.w - 10, y + 4, item.note, { fontFamily: MONO, fontSize: "8px", color: PAL.faint }).setOrigin(1, 0),
        );
        y += 20;
        continue;
      }

      const id = item.kind === "pilot" ? item.pilot.pilot.id : item.entry.id;
      const unlocked = item.kind === "pilot" || isEntryUnlocked(item.entry, this.fac, this.resolved);
      const on = id === this.selectedId;
      // archiveDisplayName, not pilot.displayName: Rourke's rank is baked
      // into her written name as a string and the save is what actually
      // moves it. Reading the raw field here listed her as a 2nd Lt. while
      // her own dossier one pane over called her a Major.
      const label =
        item.kind === "pilot"
          ? this.state
            ? archiveDisplayName(this.state, item.pilot)
            : item.pilot.pilot.displayName
          : unlocked
            ? item.entry.title
            : "— sealed —";

      const row = this.add
        .rectangle(LIST.x + LIST.w / 2, y + 13, LIST.w - 4, 26, on ? PAL.cardOn : PAL.panel, on ? 1 : 0.001)
        .setInteractive({ useHandCursor: unlocked });
      if (unlocked) {
        row.on("pointerup", () => {
          this.selectedId = id;
          this.readScroll = 0;
          this.renderList();
          this.renderReader();
        });
      }
      this.listLayer.add(row);
      if (on) this.listLayer.add(this.add.rectangle(LIST.x + 2, y + 13, 3, 26, this.fac === "warden" ? PAL.brassHex : PAL.roseHex));

      const color = !unlocked ? PAL.faint : item.kind === "pilot" && item.struck ? PAL.faint : PAL.text;
      this.listLayer.add(
        this.add.text(LIST.x + 12, y + 3, label, { fontFamily: MONO, fontSize: "10px", color, wordWrap: { width: LIST.w - 48 } }),
      );

      if (item.kind === "entry" && unlocked) {
        const rev = revisionCount(item.entry, this.fac, this.resolved);
        if (rev.total > 1) {
          this.listLayer.add(
            this.add
              .text(LIST.x + LIST.w - 10, y + 4, `${rev.shown}/${rev.total}`, { fontFamily: MONO, fontSize: "8px", color: PAL.faint })
              .setOrigin(1, 0),
          );
        }
      }
      if (item.kind === "entry" && !unlocked) {
        const g = gateValue(item.entry.gate, this.fac);
        if (g !== null) {
          this.listLayer.add(
            this.add.text(LIST.x + 12, y + 15, `unlocks after mission ${g}`, { fontFamily: MONO, fontSize: "8px", color: PAL.faint }),
          );
        }
      }
      y += 28;
    }
    this.listHeight = y + this.listScroll - LIST.y;
  }

  private scrollList(dy: number) {
    const max = Math.max(0, this.listHeight - LIST.h + 12);
    const next = Phaser.Math.Clamp(this.listScroll + dy * 0.4, 0, max);
    if (next === this.listScroll) return;
    this.listScroll = next;
    this.renderList();
  }

  private scrollRead(dy: number) {
    const max = Math.max(0, this.readHeight - READ.h + 12);
    const next = Phaser.Math.Clamp(this.readScroll + dy * 0.4, 0, max);
    if (next === this.readScroll) return;
    this.readScroll = next;
    this.renderReader();
  }

  // ---- right: the reader ----------------------------------------------
  private renderReader() {
    this.readLayer.destroy();
    this.readLayer = this.add.container(0, 0);
    this.readLayer.setMask(this.readMask);

    const items = this.itemsFor(this.sectionId);
    const sel = items.find((i) => (i.kind === "pilot" ? i.pilot.pilot.id : i.kind === "entry" ? i.entry.id : "") === this.selectedId);
    let y = READ.y + 14 - this.readScroll;
    const x = READ.x + 22;
    const w = READ.w - 44;

    if (!sel) {
      // "Nothing here" and "everything here is still sealed" are different
      // facts and a player can act on only one of them. A bestiary with ten
      // locked creatures in it is not empty; it is ahead of them.
      const total = items.filter((i) => i.kind !== "group").length;
      const msg = total === 0
        ? "Nothing on this shelf yet."
        : `${total} ${total === 1 ? "document" : "documents"} on this shelf. None of them opened to you yet — they unlock as the campaign reaches them.`;
      this.readLayer.add(this.add.text(x, y, msg, { fontFamily: MONO, fontSize: "11px", color: PAL.faint, wordWrap: { width: w } }));
      this.readHeight = 60;
      return;
    }

    if (sel.kind === "pilot") y = this.renderDossier(sel.pilot, x, y, w);
    else if (sel.kind === "entry") y = this.renderEntry(sel.entry, x, y, w);

    this.readHeight = y + this.readScroll - READ.y;
  }

  private line(x: number, y: number, text: string, size: string, color: string, w?: number): number {
    const t = this.add.text(x, y, text, {
      fontFamily: MONO,
      fontSize: size,
      color,
      wordWrap: w ? { width: w } : undefined,
      lineSpacing: 3,
    });
    this.readLayer.add(t);
    return y + t.height;
  }

  private renderEntry(entry: ArchiveEntry, x: number, y: number, w: number): number {
    y = this.line(x, y, entry.kind.toUpperCase(), "8px", this.tint()) + 2;
    y = this.line(x, y, entry.title, "15px", PAL.text, w) + 8;

    if (entry.prov) {
      const p = entry.prov;
      const rows: [string, string][] = [
        ["SOURCE", forFacility(p.source, this.fac)],
        ["FILED AS", p.filedAs],
        ["READ IT AS", p.note],
      ];
      const boxTop = y;
      let ry = y + 6;
      for (const [k, v] of rows) {
        this.readLayer.add(this.add.text(x + 8, ry, k, { fontFamily: MONO, fontSize: "8px", color: PAL.faint }));
        const t = this.add.text(x + 82, ry - 1, v, { fontFamily: MONO, fontSize: "9px", color: PAL.muted, wordWrap: { width: w - 100 } });
        this.readLayer.add(t);
        ry += Math.max(14, t.height + 3);
      }
      // reliability pips
      for (let i = 0; i < 3; i++) {
        const on = i < p.reliability;
        const c = p.reliability === 3 ? 0x22d3ee : p.reliability === 1 ? 0xef4444 : 0x8a97a6;
        this.readLayer.add(
          this.add.rectangle(x + w - 16 - i * 11, boxTop + 12, 7, 7, on ? c : PAL.panel).setStrokeStyle(1, c),
        );
      }
      const box = this.add.rectangle(x + w / 2, (boxTop + ry) / 2, w, ry - boxTop + 4, PAL.card, 1).setStrokeStyle(1, PAL.cardBorder);
      this.readLayer.add(box);
      this.readLayer.sendToBack(box);
      y = ry + 12;
    }

    for (const para of bodyFor(entry, this.fac, this.resolved)) {
      y = this.line(x, y, para, "11px", PAL.text, w) + 10;
    }

    if (entry.tail) {
      y += 4;
      y = this.line(x, y, entry.tail.heading, "8px", this.tint()) + 3;
      y = this.line(x, y, entry.tail.body, "10px", PAL.muted, w) + 8;
    }
    return y;
  }

  private renderDossier(pilot: CampaignPilotEntry, x: number, y: number, w: number): number {
    if (!this.state) return y;
    const d: ArchiveDossier = buildArchiveDossier(this.state, pilot, this.records);

    y = this.line(x, y, "DOSSIER", "8px", this.tint()) + 2;
    y = this.line(x, y, d.displayName, "15px", PAL.text, w) + 8;

    const boxTop = y;
    let ry = y + 6;
    for (const l of d.lines) {
      this.readLayer.add(this.add.text(x + 8, ry, l.label.toUpperCase(), { fontFamily: MONO, fontSize: "8px", color: PAL.faint }));
      const color = l.tone === "warn" ? PAL.danger : l.tone === "ok" ? PAL.go : l.tone === "muted" ? PAL.muted : PAL.text;
      const t = this.add.text(x + 112, ry - 1, l.value, { fontFamily: MONO, fontSize: "10px", color, wordWrap: { width: w - 130 } });
      this.readLayer.add(t);
      ry += Math.max(14, t.height + 3);
    }
    const box = this.add.rectangle(x + w / 2, (boxTop + ry) / 2, w, ry - boxTop + 4, PAL.card, 1).setStrokeStyle(1, PAL.cardBorder);
    this.readLayer.add(box);
    this.readLayer.sendToBack(box);
    this.readLayer.add(this.add.rectangle(x + 1, (boxTop + ry) / 2, 2, ry - boxTop + 4, this.fac === "warden" ? PAL.brassHex : PAL.roseHex));
    y = ry + 14;

    if (d.entry) {
      for (const para of bodyFor(d.entry, this.fac, this.resolved)) {
        y = this.line(x, y, para, "11px", PAL.text, w) + 10;
      }
      if (d.entry.tail) {
        y += 2;
        y = this.line(x, y, d.entry.tail.heading, "8px", this.tint()) + 3;
        y = this.line(x, y, d.entry.tail.body, "10px", PAL.muted, w) + 8;
      }
    } else if (d.intake) {
      y = this.line(x, y, d.intake, "11px", PAL.muted, w) + 10;
    }

    y = this.line(x, y, "STATUS", "8px", this.tint()) + 3;
    y = this.line(x, y, d.status, "10px", PAL.muted, w) + 8;
    return y;
  }
}
