// src/scenes/ui/MissionBriefingPanel.ts
// Codex Rebuild & Live Briefing Plan v1, Part B — the CO's "brief" chat
// command now opens a real, live, per-mission briefing instead of the old
// hardcoded placeholder line (Hub.ts's former handleBriefRequest: "No
// formal briefing drawn up yet — check the mission board for what's on
// offer."). Maxime's own confirmed shape (AskUserQuestion, 4 Sep 2026): a
// Freespace-style full panel, opened by asking the CO for a brief — not a
// chat bubble, not a separate always-visible pre-deployment screen.
// "Accepting the brief" IS asking the CO for one; there's no separate
// accept step in here, and the real deploy path (Hub -> walk to BAY ->
// MapSelect -> TransporterPad -> Battle) is completely unchanged by this
// panel — it's read-only mission intel, the same way a Freespace briefing
// room is something you walk out of before ever reaching your fighter.
//
// Same standalone-class-owned-by-Hub shape as StandingsPanel.ts (see that
// file's own header for why this isn't just another method on Hub.ts: it's
// 500KB+, and every panel pulled out of it is one that doesn't make the
// next one harder to add) — one container at depth 60, hidden until
// open(), every interactive child gets its OWN setScrollFactor(0) even
// though the container already has one (Phaser renders a container's
// children using the container's scroll factor but hit-tests them using
// each child's own — see StandingsPanel's comment for the full mechanism
// and tools/verify/checkHubInteractionAfterScroll.mjs for the regression it
// guards against), same shared palette, same "[ close — Esc ]" control.
//
// All three content blocks (the mission's own narrative briefing, a
// plain-English objective line, and the composition/count-only passive
// scan) come from data/missionBriefing.ts's pure functions — this class
// only lays them out, it doesn't compute any of them itself.
import Phaser from "phaser";
import type { CampaignMission } from "../../data/types";
import { describeObjective, passiveScan } from "../../data/missionBriefing";

const PANEL_BG = 0x1a2028;
const PANEL_BORDER = 0x3a4552;
const TEXT_MAIN = "#e8e2d4";
const TEXT_DIM = "#8a97a6";
const TEXT_ACCENT = "#c8b273";

export interface MissionBriefingPanelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class MissionBriefingPanel {
  private container: Phaser.GameObjects.Container;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, bounds: MissionBriefingPanelBounds, onClose: () => void) {
    const cx = (bounds.left + bounds.right) / 2;
    this.container = scene.add.container(0, 0).setDepth(60).setVisible(false).setScrollFactor(0);

    const bg = scene.add
      .rectangle(cx, (bounds.top + bounds.bottom) / 2, bounds.right - bounds.left, bounds.bottom - bounds.top, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER)
      .setScrollFactor(0);
    this.container.add(bg);

    this.titleText = scene.add
      .text(bounds.left + 18, bounds.top + 22, "", { fontFamily: "monospace", fontSize: "15px", color: TEXT_ACCENT })
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    this.container.add(this.titleText);

    const rule = scene.add.rectangle(cx, bounds.top + 40, bounds.right - bounds.left - 24, 1, PANEL_BORDER, 0.8).setScrollFactor(0);
    this.container.add(rule);

    const bodyWidth = bounds.right - bounds.left - 36;
    this.bodyText = scene.add
      .text(bounds.left + 18, bounds.top + 54, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: TEXT_MAIN,
        align: "left",
        lineSpacing: 6,
        wordWrap: { width: bodyWidth },
      })
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.container.add(this.bodyText);

    const closeBtn = scene.add
      .text(bounds.right - 20, bounds.top + 22, "[ close — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    closeBtn.on("pointerdown", onClose);
    this.container.add(closeBtn);
  }

  open(mission: CampaignMission): void {
    this.titleText.setText(`MISSION BRIEFING — ${mission.displayName}`);
    this.bodyText.setText(this.lines(mission).join("\n"));
    this.container.setVisible(true);
  }

  close(): void {
    this.container.setVisible(false);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  /**
   * The panel body, as text. Split out from open() so the shape of the
   * briefing is one readable block rather than several setText calls, and
   * so a verify script can read the rendered string back and assert on it
   * — same convention as StandingsPanel.lines().
   */
  private lines(mission: CampaignMission): string[] {
    const out: string[] = [];
    out.push(mission.briefing);
    out.push("");
    out.push("OBJECTIVE");
    out.push(describeObjective(mission));
    out.push("");
    out.push("SCAN");
    out.push(passiveScan(mission));
    return out;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
