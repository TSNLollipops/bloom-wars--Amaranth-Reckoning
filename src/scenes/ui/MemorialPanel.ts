// src/scenes/ui/MemorialPanel.ts
// B3, the memorial (First Game Dev Feature Gap Report §B3: "Every
// permanently lost pilot, name, mission, turn, cause... XCOM's memorial wall
// is one of the most-cited features of that game and it's a list").
//
// Why this is its own panel rather than a section inside the Vault, which is
// where the gap report originally pointed: it was built that way first, on
// 5 Sep 2026, and measured. The Vault overlay renders its tallest text at
// y=550 against a ROOM_BOUNDS.bottom of 552 in an ordinary mid-game save —
// two pixels of headroom — and it neither clips nor scrolls, every section
// stacking on a running `y`. A three-row memorial pushed HOLDINGS & THE
// SHELF completely off the bottom of a panel with no way to reach it. So
// the inline version was reverted and this exists instead. Maxime's call
// between the two options.
//
// Why a standalone class rather than a tenth overlay method on Hub.ts:
// exactly the reasoning in StandingsPanel.ts's own header, which this file
// follows structurally — Hub constructs one, calls open/close, and owns
// nothing about how it draws. Bloom_Wars_UI_Improvement_Plan_v1.md's Track 3
// flags the overlay sprawl in Hub.ts as a real structural concern; adding
// this here rather than there is the small version of the answer.
//
// Every fact on screen comes from engine/statsStore.ts's memorial(), which
// is Phaser-free and derives from the recorded mission summaries. Nothing in
// here decides who died or when.
//
// One field the gap report asked for and this deliberately does NOT show:
// cause of death. PilotServiceRecord records WHERE and WHEN a pilot was lost,
// not what killed them. Inventing a cause string would be fiction dressed as
// a record, on the one screen in the game that should be nothing but record.

import Phaser from "phaser";
import { memorial, type PilotServiceRecord } from "../../engine/statsStore";
import { ABILITIES } from "../../data/abilities";
// B4 (portrait wiring), 5 Sep 2026 — same reasoning as RosterPanel.ts's own
// note: this panel never had a placeholder circle either, so a portrait per
// row is new, not a swap. PilotServiceRecord.pilotId is a real pilot id
// (pilot_rourke, pilot_recruit_7, ...) the same drawPilotAvatar/portraits.ts
// lookup everywhere else uses — a lost recruit keeps the exact portrait they
// had while alive, since that assignment is keyed to the id, not liveness.
import { drawPilotAvatar } from "../TransporterPad";

const PANEL_BG = 0x1a2028;
const PANEL_BORDER = 0x3a4552;
const TEXT_MAIN = "#e8e2d4";
const TEXT_DIM = "#8a97a6";
const TEXT_ACCENT = "#c17a6a"; // the same muted red the Vault's own loss-flavored text uses

const ROW_H = 34; // two lines per entry: the name, then the record under it
const LIST_TOP_OFFSET = 74; // below the title and the count line
const LIST_BOTTOM_PAD = 34; // room for the pager line
// B4, 5 Sep 2026 — portrait gutter, same convention as RosterPanel.ts's own
// PORTRAIT_R/PORTRAIT_GUTTER pair, just smaller: this panel's ROW_H (34) is
// tighter than RosterPanel's (46).
const PORTRAIT_R = 12;
const PORTRAIT_GUTTER = 32;

export interface MemorialPanelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class MemorialPanel {
  private container: Phaser.GameObjects.Container;
  private titleText: Phaser.GameObjects.Text;
  private countText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private pagerText: Phaser.GameObjects.Text;
  private prevBtn: Phaser.GameObjects.Text;
  private nextBtn: Phaser.GameObjects.Text;
  // B4, 5 Sep 2026 — one per visible row, rebuilt every render() the same
  // way RosterPanel.ts's own avatarObjs is.
  private avatarObjs: Phaser.GameObjects.Container[] = [];
  private readonly scene: Phaser.Scene;

  private entries: PilotServiceRecord[] = [];
  private page = 0;
  private readonly rowsPerPage: number;
  private readonly listLeft: number;
  private readonly listTop: number;

  constructor(scene: Phaser.Scene, bounds: MemorialPanelBounds, onClose: () => void) {
    this.scene = scene;
    this.listLeft = bounds.left + 26;
    const cx = (bounds.left + bounds.right) / 2;
    const listTop = bounds.top + LIST_TOP_OFFSET;
    this.listTop = listTop;
    // Computed from the real bounds rather than guessed, so this panel can
    // never do to itself what the inline version did to the Vault.
    this.rowsPerPage = Math.max(1, Math.floor((bounds.bottom - LIST_BOTTOM_PAD - listTop) / ROW_H));

    // Depth 61: one above the Vault's own 60, so this draws over it and the
    // Vault stays open underneath rather than being torn down and rebuilt.
    this.container = scene.add.container(0, 0).setDepth(61).setVisible(false).setScrollFactor(0);

    // Fully opaque, unlike StandingsPanel's own 0.96 — that panel has bare
    // room behind it, this one is drawn ON TOP of the open Vault. At 0.98 the
    // Vault's headings and rows ghost through clearly enough to read as a
    // rendering fault rather than a translucency effect. Caught by screenshot,
    // 5 Sep 2026.
    const bg = scene.add
      .rectangle(cx, (bounds.top + bounds.bottom) / 2, bounds.right - bounds.left, bounds.bottom - bounds.top, PANEL_BG, 1)
      .setStrokeStyle(1, PANEL_BORDER)
      .setScrollFactor(0);
    this.container.add(bg);

    this.titleText = scene.add
      .text(cx, bounds.top + 22, "THE ROLL — PILOTS LOST", { fontFamily: "monospace", fontSize: "13px", color: TEXT_ACCENT })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    this.container.add(this.titleText);

    this.countText = scene.add
      .text(cx, bounds.top + 44, "", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    this.container.add(this.countText);

    // B4, 5 Sep 2026 — x shifted right by PORTRAIT_GUTTER to leave room for
    // the per-row portrait render() now draws in that gutter (this.listLeft
    // is the original, un-shifted margin those portraits are centered in).
    this.bodyText = scene.add
      .text(bounds.left + 26 + PORTRAIT_GUTTER, listTop, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: TEXT_MAIN,
        align: "left",
        lineSpacing: 4,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.container.add(this.bodyText);

    // Every interactive child gets its OWN setScrollFactor(0) even though
    // the container already has one — Phaser renders children with the
    // container's scroll factor but hit-tests them with each child's, so an
    // interactive child without it draws correctly and takes clicks
    // somewhere else entirely. See StandingsPanel.ts's own note and
    // tools/verify/checkHubInteractionAfterScroll.mjs.
    this.prevBtn = scene.add
      .text(bounds.left + 26, bounds.bottom - 22, "[ prev ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    this.prevBtn.on("pointerdown", () => this.turnPage(-1));
    this.container.add(this.prevBtn);

    this.pagerText = scene.add
      .text(cx, bounds.bottom - 22, "", { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);
    this.container.add(this.pagerText);

    this.nextBtn = scene.add
      .text(bounds.right - 120, bounds.bottom - 22, "[ next ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    this.nextBtn.on("pointerdown", () => this.turnPage(1));
    this.container.add(this.nextBtn);

    const closeBtn = scene.add
      .text(bounds.right - 20, bounds.top + 20, "[ close — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    closeBtn.on("pointerdown", onClose);
    this.container.add(closeBtn);
  }

  open(campaignId: string | undefined): void {
    this.entries = memorial(campaignId);
    this.page = 0;
    this.container.setVisible(true);
    this.render();
  }

  close(): void {
    this.container.setVisible(false);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  /** Exposed for the headless verify script, which pages without clicking. */
  turnPage(delta: number): void {
    const pages = this.pageCount();
    if (pages <= 1) return;
    this.page = (this.page + delta + pages) % pages;
    this.render();
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.entries.length / this.rowsPerPage));
  }

  private render(): void {
    // Cleared unconditionally, before either branch below — Container.
    // destroy() destroys its children too (Container.exclusive defaults to
    // true, unchanged here), so this alone cleans up each avatar's portrait
    // Image/hitCircle along with it. Same pattern as RosterPanel.ts.
    for (const a of this.avatarObjs) a.destroy();
    this.avatarObjs = [];

    const total = this.entries.length;
    if (total === 0) {
      // The empty state is not a failure state. A campaign where nobody has
      // been lost yet is the good outcome, and the panel should read that
      // way rather than looking broken or unfinished.
      this.countText.setText("");
      this.bodyText.setText("Nobody yet.\n\nEvery pilot who has flown for this company has come back.");
      this.pagerText.setText("");
      this.prevBtn.setVisible(false);
      this.nextBtn.setVisible(false);
      return;
    }

    this.countText.setText(total === 1 ? "one pilot has not come back" : `${total} pilots have not come back`);

    const pages = this.pageCount();
    const start = this.page * this.rowsPerPage;
    const shown = this.entries.slice(start, start + this.rowsPerPage);

    const lines: string[] = [];
    shown.forEach((rec, i) => {
      // B4, 5 Sep 2026 — real portrait when one exists (pilotId is a real
      // pilot id — see this file's own import comment on why a lost
      // recruit keeps the exact portrait they had while alive), the same
      // filled-circle+initials placeholder every other scene falls back to
      // otherwise. TEXT_ACCENT (this panel's own muted loss-red) rather
      // than a path color: PilotServiceRecord doesn't carry archetype/path,
      // and a uniform tone reads better on a memorial than branded colors.
      const avatar = drawPilotAvatar(
        this.scene,
        this.listLeft + PORTRAIT_R,
        this.listTop + i * ROW_H + ROW_H / 2,
        PORTRAIT_R,
        rec.pilotId,
        rec.displayName,
        0xc17a6a
      );
      avatar.container.setScrollFactor(0);
      this.container.add(avatar.container);
      this.avatarObjs.push(avatar.container);

      const lost = rec.permanentlyLost!;
      lines.push(rec.displayName);
      // Career totals earn their place here: a name and a date is a
      // tombstone, but "14 missions, 9 kills" is the reason the player
      // remembers this one. timesDowned includes the mission they didn't
      // get up from, which is why it reads "downed" and not "downed before".
      const bits = [
        `lost on ${lost.missionName}, turn ${lost.turn}`,
        `${rec.missionsFlown} mission${rec.missionsFlown === 1 ? "" : "s"}`,
        `${rec.kills} kill${rec.kills === 1 ? "" : "s"}`,
        `downed ${rec.timesDowned}×`,
      ];
      const fav = rec.favoriteAbility ? ABILITIES[rec.favoriteAbility]?.displayName : undefined;
      if (fav) bits.push(`most-used: ${fav}`);
      lines.push(`    ${bits.join("  ·  ")}`);
    });
    this.bodyText.setText(lines.join("\n"));

    const multi = pages > 1;
    this.prevBtn.setVisible(multi);
    this.nextBtn.setVisible(multi);
    this.pagerText.setText(multi ? `page ${this.page + 1} / ${pages}` : "");
  }
}
