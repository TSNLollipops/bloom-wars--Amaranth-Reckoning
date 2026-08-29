// src/scenes/Boot.ts
// No art pipeline for the placeholder pass (GDD §12.2) — everything is
// drawn with Phaser Graphics primitives, so Boot has nothing to load. It
// exists as the named entry point Build Brief §2.1's repo shape expects.
//
// Mission real-time clock (25 Aug 2026) added a real second job: this is
// the one scene guaranteed to run on every game load — a fresh tab, or a
// tab reopened after being closed for however long — so it's the only
// correct place to catch a mission attempt that timed out while nobody
// was looking. See engine/campaignState.ts's "9. Mission real-time clock"
// section for the full mechanism (evaluateMissionTimeout/
// applyMissionTimeout); scenes/TransporterPad.ts starts the clock on BEAM
// DOWN, scenes/Debrief.ts clears it on a real finish. The overwhelmingly
// common case — no active attempt, or one still inside its 12-hour window
// — falls straight through to MainMenu (MapSelect directly, before the
// Main Menu / Save / Ironman UI Plan v1 pass of 28 Aug 2026 added a real
// title screen in front of it).
//
// The recall notice below is the one case that still skips MainMenu on
// purpose: its own "RETURN TO BASE" button starts a scene directly, since
// a timed-out recall is a mid-campaign continuation, not a fresh boot —
// see that method's own comment. Routing fix, 28 Aug 2026: that button now
// starts Hub rather than MapSelect, matching MainMenu.ts's own CONTINUE —
// "return to base" reads as the Hub now that CONTINUE actually goes there,
// not the flat mission list.
import Phaser from "phaser";
import { loadCampaignState, saveCampaignState, evaluateMissionTimeout, applyMissionTimeout } from "../engine/campaignState";
import { ALL_MISSIONS_BY_ID } from "../data/allCampaigns";

export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    const state = loadCampaignState();
    const timeout = state ? evaluateMissionTimeout(state, Date.now()) : { timedOut: false };
    if (state && timeout.timedOut) {
      // Apply first, save immediately — same discipline TransporterPad's
      // own BEAM DOWN write uses for the opposite half of this clock: the
      // recall has to be on disk before the player can do anything else,
      // not deferred to some later save the way an ordinary Debrief-screen
      // purchase is.
      applyMissionTimeout(state, Date.now());
      saveCampaignState(state);
      this.drawRecallNotice(timeout.missionId);
      return;
    }
    this.scene.start("MainMenu");
  }

  /**
   * Maxime, on what a timeout should actually cost: "they are forcefully
   * recalled to ship for a dressing down by the co." Command, not Rourke —
   * she's Warden Company's own CO (engine/campaignState.ts's Rank comment),
   * the one giving orders in every mission briefing this campaign has
   * written so far ("Command wants...") is who'd be doing the recalling.
   * One screen, one beat: state the fact, land the consequence (nothing
   * lost, mission's just available again), no dwelling — same discipline
   * Data Pack §11.1 already holds briefings to, applied to a screen that's
   * allowed a little more voice than a briefing since it isn't one.
   */
  private drawRecallNotice(missionId?: string) {
    this.cameras.main.setBackgroundColor("#0c0f12");
    const missionName = missionId ? (ALL_MISSIONS_BY_ID[missionId]?.displayName ?? missionId) : "the mission";

    this.add.text(480, 140, "RECALLED", { fontFamily: "monospace", fontSize: "26px", color: "#ef4444" }).setOrigin(0.5);
    this.add
      .text(480, 180, `${missionName} — twelve hours on the clock with no word back.`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#8a97a6",
        wordWrap: { width: 600 },
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(
        480,
        260,
        "COMMAND: “Warden Company, this is Command. Whatever kept you, the window's closed and the operation's dead. You're recalled — get your lance squared away and be ready to go again.”",
        { fontFamily: "monospace", fontSize: "13px", color: "#e8e2d4", wordWrap: { width: 620 }, align: "center" }
      )
      .setOrigin(0.5);

    this.add
      .text(480, 360, "No losses. No permadeath roll. The mission's simply available again, clock reset — this one's on the clock, not on the squad.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#5a6472",
        wordWrap: { width: 600 },
        align: "center",
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(480, 460, 260, 44, 0x2e5c7a, 1)
      .setStrokeStyle(1, 0x4a7a9a)
      .setInteractive({ useHandCursor: true });
    this.add.text(480, 460, "RETURN TO BASE", { fontFamily: "monospace", fontSize: "14px", color: "#ffffff" }).setOrigin(0.5);
    btn.on("pointerover", () => btn.setFillStyle(0x3a6f92, 1));
    btn.on("pointerout", () => btn.setFillStyle(0x2e5c7a, 1));
    btn.on("pointerdown", () => this.scene.start("Hub"));
  }
}
