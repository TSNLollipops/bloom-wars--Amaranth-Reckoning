// src/scenes/TransporterPad.ts
// Sits between mission-select and the battle itself — the squad-review-
// and-launch screen (the XCOM "choose your squad, board the dropship"
// beat, reimagined for this game's own fiction: Warden Company doesn't
// board anything, pilots step onto a transporter pad and get beamed to
// the mission site). This is explicitly the Tier-0, unbranded version of
// that room per claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md's own build-
// cost plan (§9) — that doc's Hangar Deck gets a name, a location (the
// Antfarm/Providence), and crew banter starting Act II. None of that
// exists yet and none of it belongs here: no Providence references, no
// crew banter, no narrative dressing. Purely functional.
//
// Placeholder portraits per GDD §12.2 ("no artist for Sunrider-style
// hand-painted portraits... a coloured circle with two initials. Real
// portraits are a later drop-in against the same field.") — this is the
// first scene in the codebase to actually draw that convention. Nothing
// under engine/ or scenes/ had built it yet (the Carrier Hub doc's own
// §7 just cites the rule, doesn't implement it), so PATH_COLORS and
// pilotInitials() below are new, not a copy of an existing helper — kept
// in the same muted blue-grey palette family as the rest of the game
// (MapSelect's card colours) rather than inventing a new one.
import Phaser from "phaser";
import type { CampaignMission, MekArchetype, Path, PilotRecord } from "../data/types";
import { ALL_MISSIONS_BY_ID as MISSIONS_BY_ID } from "../data/allCampaigns";
import { UNIT_ARCHETYPES } from "../data/units";
import { findPilot, findMek } from "../data/pilotRegistry";
import { canLaunchMission, createWardenCampaignState, loadCampaignState, type CampaignState } from "../engine/campaignState";

// One muted, distinct hue per Path so a squad row scans quickly — new to
// this file (see header comment: no portrait colour scheme existed
// anywhere yet), chosen from the same blue-grey family as MapSelect's
// card palette rather than Battle's board colours, which encode side
// (player/hostile), not class.
const PATH_COLORS: Record<Path, number> = {
  meeps: 0x4a7a9a,
  tank: 0x8a7a5f,
  reeps: 0x5c8a5a,
  munti: 0x3a8a8a,
};

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * "A coloured circle with two initials" (GDD §12.2) — derives a two-
 * letter monogram from a PilotRecord.displayName. Named Warden pilots
 * follow the "<rank> <First> <Last> — "<Callsign>"" shape (see
 * data/campaignAmaranth.ts): split off the callsign after the em dash,
 * drop rank tokens (anything containing a digit or a period — "2nd",
 * "Lt.", "M.Sgt." all fall out that way), and take the first letter of
 * the first and last remaining word ("2nd Lt. Dessa Rourke" -> "DR").
 * Falls back gracefully for anything that doesn't fit that shape (a
 * generated recruit's `Recruit "Callsign"`, or a single bare word).
 */
function pilotInitials(displayName: string): string {
  const namePart = displayName.split("—")[0].trim();
  const words = namePart
    .split(/\s+/)
    .map((w) => w.replace(/["“”]/g, ""))
    .filter((w) => /^[A-Za-z']+$/.test(w));
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export class TransporterPad extends Phaser.Scene {
  private missionId!: string;
  private missionDef!: CampaignMission;

  constructor() {
    super("TransporterPad");
  }

  init(data: { missionId: string }) {
    this.missionId = data.missionId;
    this.missionDef = MISSIONS_BY_ID[data.missionId] ?? Object.values(MISSIONS_BY_ID)[0];
  }

  create() {
    this.cameras.main.setBackgroundColor("#0c0f12");

    this.add.text(480, 44, "TRANSPORTER PAD — WARDEN COMPANY", { fontFamily: "monospace", fontSize: "30px", color: "#e8e2d4" }).setOrigin(0.5);
    this.add
      .text(480, 78, `deploying to: ${this.missionDef.displayName}`, { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);

    this.add
      .rectangle(835, 20, 200, 26, 0x1a2028)
      .setStrokeStyle(1, 0x3a4552)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MapSelect"));
    this.add.text(835, 20, "< mission select", { fontFamily: "monospace", fontSize: "11px", color: "#8a97a6" }).setOrigin(0.5);

    // ---- Deploying squad --------------------------------------------
    // No selection UI yet — Act I's deploy count equals its full 5-pilot
    // roster exactly (Corin Lask, the one Munti, always included), so
    // there is nothing to choose from. Read straight off the mission's
    // own playerPilotIds, the same array Mission itself uses to spawn
    // player units (engine/mission.ts), rather than hardcoding five card
    // slots. Act II's composition-choice screen (5-8 deploy of a
    // 10-pilot roster, campaign doc §10) plugs in right here: swap this
    // one line for a real selected-subset array and the render loop
    // below needs no changes.
    const deployingPilotIds = this.missionDef.playerPilotIds;

    // Prefer the live, campaign-persistent copy of each pilot/mek (gear
    // tier purchases, mek secondary specializations) when a save exists;
    // fall back to a fresh Warden state (and, per-pilot, to the static
    // roster row) otherwise. Same fallback shape engine/campaignState.ts
    // documents for its own CampaignPilotEntry.
    const state: CampaignState = loadCampaignState() ?? createWardenCampaignState();

    const gfx = this.add.graphics();
    const listTop = 118;
    const listBottom = 552;
    const pitch = Math.min(92, Math.floor((listBottom - listTop) / deployingPilotIds.length));
    const cardH = Math.min(74, pitch - 14);
    const cardW = 860;
    const cardLeft = 480 - cardW / 2;
    const padCenterX = cardLeft + 60;

    deployingPilotIds.forEach((pilotId, i) => {
      const entry = state.pilots[pilotId];
      const pilot: PilotRecord | undefined = entry?.pilot ?? findPilot(pilotId);
      if (!pilot) return; // defensive — shouldn't happen for a well-formed mission roster
      const mek: MekArchetype | undefined = state.meks[pilot.mekId] ?? findMek(pilot.mekId);
      const path = UNIT_ARCHETYPES[pilot.archetypeId]?.path;
      const y = listTop + pitch * i + pitch / 2;

      this.add.rectangle(480, y, cardW, cardH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552);

      // Pad glyph: a stroked ring with four short tick marks (a landing
      // platform, not a chair) plus the placeholder portrait standing on
      // it — everything here is Phaser Graphics primitives, no image
      // assets (GDD §12.2).
      const ringR = Math.min(30, cardH / 2 - 4);
      gfx.lineStyle(2, 0x3a4552, 1);
      gfx.strokeCircle(padCenterX, y, ringR);
      gfx.lineStyle(1, 0x2e5c7a, 0.8);
      gfx.lineBetween(padCenterX, y - ringR - 2, padCenterX, y - ringR - 7);
      gfx.lineBetween(padCenterX, y + ringR + 2, padCenterX, y + ringR + 7);
      gfx.lineBetween(padCenterX - ringR - 2, y, padCenterX - ringR - 7, y);
      gfx.lineBetween(padCenterX + ringR + 2, y, padCenterX + ringR + 7, y);

      const portraitR = ringR * 0.62;
      gfx.fillStyle(path ? PATH_COLORS[path] : 0x555555, 1);
      gfx.fillCircle(padCenterX, y, portraitR);
      gfx.lineStyle(1.5, 0xffffff, 0.9);
      gfx.strokeCircle(padCenterX, y, portraitR);
      this.add
        .text(padCenterX, y, pilotInitials(pilot.displayName), { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" })
        .setOrigin(0.5);

      const textX = padCenterX + ringR + 30;
      this.add.text(textX, y - cardH / 2 + 8, `PAD ${String(i + 1).padStart(2, "0")} — ${pilot.displayName}`, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#e8e2d4",
      });
      const pathLabel = path ? capitalize(path) : "Unknown";
      this.add.text(textX, y - 2, `${pathLabel} · Tier ${pilot.tier}${mek ? ` · ${mek.displayName}` : ""}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8a97a6",
      });
      if (mek) {
        const trackLine = mek.secondary
          ? `Primary: ${capitalize(mek.primary)}  ·  Secondary: ${capitalize(mek.secondary)}`
          : `Primary: ${capitalize(mek.primary)}`;
        this.add.text(textX, y + cardH / 2 - 18, trackLine, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" });
      }
    });

    // ---- The Munti deploy gate, wired in for real -----------------------
    // canLaunchMission always returns ok today: Act I's deploy count
    // equals its full roster count (5 of 5), and Corin Lask, Warden
    // Company's one Munti, is always in that roster by construction — see
    // canLaunchMission's own doc comment in engine/campaignState.ts. That
    // makes this check currently unreachable-but-correct, not a bug to
    // route around: Act II's composition choice (5-8 deploy out of a
    // 10-pilot roster, campaign doc §10) makes it reachable without this
    // screen needing a rebuild, so the real failing-path UI below (a
    // greyed-out, non-interactive button plus the reason text) is built
    // now, even though nothing can trigger it yet.
    const launchCheck = canLaunchMission(deployingPilotIds, state);

    const btnY = 590;
    const btn = this.add
      .rectangle(480, btnY, 260, 44, launchCheck.ok ? 0x2e5c7a : 0x1a2028, 1)
      .setStrokeStyle(1, launchCheck.ok ? 0x4a7a9a : 0x3a4552);
    this.add
      .text(480, btnY, "BEAM DOWN", { fontFamily: "monospace", fontSize: "15px", color: launchCheck.ok ? "#ffffff" : "#5a6472" })
      .setOrigin(0.5);

    if (launchCheck.ok) {
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setFillStyle(0x3a6f92, 1));
      btn.on("pointerout", () => btn.setFillStyle(0x2e5c7a, 1));
      btn.on("pointerdown", () => this.scene.start("Battle", { missionId: this.missionId }));
    }

    this.add
      .text(480, btnY + 32, launchCheck.ok ? "squad cleared for deployment" : (launchCheck.reason ?? "deploy blocked"), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: launchCheck.ok ? "#6b7a8a" : "#ef4444",
        align: "center",
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5, 0);
  }
}
