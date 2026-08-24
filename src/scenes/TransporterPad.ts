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
//
// Deploy-cap / squad-selection pass (22 Aug 2026): this scene used to
// always deploy the mission's full static pilot list with no picker,
// because Act I's roster size and deploy count were both exactly 5 — there
// was never anything to choose between. That assumption broke the moment
// engine/campaignState.ts's recruit-phase system (recruitDiscretionary /
// the emergency Munti replacement, same day) let campaign roster size grow
// past 5 even during Act I. ACT1_DEPLOY_CAP and the toggleable-pad picker
// below are what makes a real bench actually mean something: below the
// cap, nothing changes (see the branch comment in create()); above it, the
// player picks.
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

/**
 * Act I's fixed deploy cap — a placeholder, not a tuned balance number.
 * The campaign doc's own §10 squad-scaling table lists "typical deploy: 5"
 * for Act I specifically; Act II moves to a real 5-8 variable range tied
 * to roster size (same table) — not built this pass, explicitly out of
 * scope here. Hardcoded rather than derived from anything else so the two
 * concepts stay distinct: this is Act I's whole-act constant, independent
 * of any one mission's own playerPilotIds length, which today happens to
 * equal it (roster == deploy count, so no mission has ever needed a
 * picker) but stops being the same number the moment a recruit joins the
 * bench.
 */
export const ACT1_DEPLOY_CAP = 5;

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
  private state!: CampaignState;

  // Squad-selection state. When showPicker is false, rosterIds/selected
  // both just mirror the campaign's own active roster (see the 25 Aug 2026
  // fix note below on why that's activePilotIds and not the mission's
  // static playerPilotIds) — so currentDeployIds() always returns the
  // right thing without any caller needing to branch on showPicker itself.
  private rosterIds: string[] = [];
  private selected: Set<string> = new Set();
  private showPicker = false;
  private capWarning = false;

  private squadLayer!: Phaser.GameObjects.Container;
  private launchLayer!: Phaser.GameObjects.Container;

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

    // Prefer the live, campaign-persistent copy of each pilot/mek (gear
    // tier purchases, mek secondary specializations, recruit-phase
    // additions) when a save exists; fall back to a fresh Warden state
    // otherwise. Same fallback shape engine/campaignState.ts documents for
    // its own CampaignPilotEntry.
    this.state = loadCampaignState() ?? createWardenCampaignState();

    const activePilotIds = Object.entries(this.state.pilots)
      .filter(([, entry]) => entry.status === "active")
      .map(([id]) => id);

    // ---- The actual behavior fork this whole pass is about -------------
    // At or under the cap: nothing to CHOOSE (no picker UI), but this is
    // still the campaign's own active roster, not the mission's static
    // playerPilotIds — those are two different lists the instant a named
    // pilot is permanently lost or a recruit joins, even while the total
    // count stays at or under the cap.
    //
    // Fix, 25 Aug 2026 (Maxime: "I need a new munties, mine died and I got
    // no replacement" — photographed the actual bug: Lask's pad still
    // showing, full brightness, after she was permanently lost, with BEAM
    // DOWN blocked and no sign of the free replacement Munti the Debrief
    // screen's own Munti guarantee had already generated). Root cause: this
    // branch used to read `this.missionDef.playerPilotIds` — every Act I
    // mission's hardcoded five-Warden list, which never changes no matter
    // what happens to the campaign roster. So a lost pilot always kept
    // showing up here (this loop draws whatever pilot id it's handed,
    // never checking CampaignPilotEntry.status), and any replacement
    // recruit was invisible — not deployable, not even on screen — unless
    // the active roster happened to climb OVER the cap and force picker
    // mode on, which is not something a player can infer from anything
    // this screen shows them. Fixed by using `activePilotIds` here too:
    // in the untouched common case (no losses, no recruits) it's the exact
    // same five ids in the exact same order as WARDEN_ROSTER_IDS (both
    // ultimately derive from WARDEN_PILOTS' own array order), so nothing
    // changes for a player who's never lost anyone — this only changes
    // behavior once the roster composition actually has, which is exactly
    // the case it was silently getting wrong before.
    this.showPicker = activePilotIds.length > ACT1_DEPLOY_CAP;

    if (this.showPicker) {
      this.rosterIds = activePilotIds;
      // Default selection: the first ACT1_DEPLOY_CAP active pilots in
      // roster order. For the one campaign this repo ships, that's the
      // original five Wardens (Munti included), so the gate starts
      // cleared and a player who never touches the picker still deploys
      // exactly the squad they always did. Bench slots (recruits beyond
      // the cap) start excluded, not auto-included — swapping a proven
      // pilot for a fresh G-tier recruit is the player's call to make, not
      // a default this screen makes for them.
      this.selected = new Set(activePilotIds.slice(0, ACT1_DEPLOY_CAP));
      this.add
        .text(
          480,
          100,
          `select up to ${ACT1_DEPLOY_CAP} — click a pad to toggle. bench pilots earn no personal points while sitting out.`,
          { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" }
        )
        .setOrigin(0.5);
    } else {
      this.rosterIds = activePilotIds;
      this.selected = new Set(this.rosterIds);
    }

    this.squadLayer = this.add.container(0, 0);
    this.launchLayer = this.add.container(0, 0);

    this.redrawSquadList();
    this.redrawLaunchSection();
  }

  /** The ids that would actually beam down right now. */
  private currentDeployIds(): string[] {
    return this.showPicker ? this.rosterIds.filter((id) => this.selected.has(id)) : this.rosterIds;
  }

  private toggle(pilotId: string) {
    if (this.selected.has(pilotId)) {
      this.selected.delete(pilotId);
      this.capWarning = false;
    } else if (this.selected.size >= ACT1_DEPLOY_CAP) {
      // Over the cap is blocked, not silently ignored — redrawLaunchSection
      // below surfaces this as the reason line until the next successful
      // toggle clears it.
      this.capWarning = true;
    } else {
      this.selected.add(pilotId);
      this.capWarning = false;
    }
    this.redrawSquadList();
    this.redrawLaunchSection();
  }

  // ---- Deploying squad --------------------------------------------------
  private redrawSquadList() {
    this.squadLayer.removeAll(true);

    const listTop = 118;
    const listBottom = 552;
    const pitch = Math.min(92, Math.floor((listBottom - listTop) / this.rosterIds.length));
    const cardH = Math.min(74, pitch - 14);
    const cardW = 860;
    const cardLeft = 480 - cardW / 2;
    const padCenterX = cardLeft + 60;

    this.rosterIds.forEach((pilotId, i) => {
      const entry = this.state.pilots[pilotId];
      const pilot: PilotRecord | undefined = entry?.pilot ?? findPilot(pilotId);
      if (!pilot) return; // defensive — shouldn't happen for a well-formed roster
      const mek: MekArchetype | undefined = this.state.meks[pilot.mekId] ?? findMek(pilot.mekId);
      const path = UNIT_ARCHETYPES[pilot.archetypeId]?.path;
      const y = listTop + pitch * i + pitch / 2;

      // Only meaningful when showPicker — otherwise everyone's "in," same
      // as before this pass, and dimming/toggling never applies.
      const isIn = !this.showPicker || this.selected.has(pilotId);
      const rowAlpha = isIn ? 1 : 0.55;
      const ringColor = this.showPicker && !isIn ? 0x3a4552 : 0x4a7a9a;

      const card = this.add
        .rectangle(480, y, cardW, cardH, 0x1a2028, 1)
        .setStrokeStyle(1, isIn ? 0x3a4552 : 0x2a323c)
        .setAlpha(rowAlpha);
      this.squadLayer.add(card);
      if (this.showPicker) {
        card.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.toggle(pilotId));
      }

      // Pad glyph: a stroked ring with four short tick marks (a landing
      // platform, not a chair) plus the placeholder portrait standing on
      // it — everything here is Phaser Graphics primitives, no image
      // assets (GDD §12.2). One Graphics object per row (not shared across
      // the whole list) so it can be individually alpha-dimmed for a
      // toggled-off pilot without touching every other row's ring.
      const gfx = this.add.graphics().setAlpha(rowAlpha);
      this.squadLayer.add(gfx);
      const ringR = Math.min(30, cardH / 2 - 4);
      gfx.lineStyle(2, ringColor, 1);
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

      const initials = this.add
        .text(padCenterX, y, pilotInitials(pilot.displayName), { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" })
        .setOrigin(0.5)
        .setAlpha(rowAlpha);
      this.squadLayer.add(initials);

      const textX = padCenterX + ringR + 30;
      // [X]/[ ] prefix carries the same "in the deploying squad" signal as
      // the ring color, but as text — never color-only — so it reads in a
      // screenshot or for anyone not distinguishing the two blues at a
      // glance. Blank prefix (unchanged layout) when there's no picker.
      const tag = this.showPicker ? (isIn ? "[X] " : "[ ] ") : "";
      const nameText = this.add
        .text(textX, y - cardH / 2 + 8, `${tag}PAD ${String(i + 1).padStart(2, "0")} — ${pilot.displayName}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#e8e2d4",
        })
        .setAlpha(rowAlpha);
      this.squadLayer.add(nameText);

      const pathLabel = path ? capitalize(path) : "Unknown";
      const infoText = this.add
        .text(textX, y - 2, `${pathLabel} · Tier ${pilot.tier}${mek ? ` · ${mek.displayName}` : ""}`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#8a97a6",
        })
        .setAlpha(rowAlpha);
      this.squadLayer.add(infoText);

      if (mek) {
        const trackLine = mek.secondary
          ? `Primary: ${capitalize(mek.primary)}  ·  Secondary: ${capitalize(mek.secondary)}`
          : `Primary: ${capitalize(mek.primary)}`;
        const trackText = this.add
          .text(textX, y + cardH / 2 - 18, trackLine, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
          .setAlpha(rowAlpha);
        this.squadLayer.add(trackText);
      }

      // Personal points readout — engine/campaignEconomy.ts's actual
      // payoff for rotation, put right on the card next to the info a
      // player already reads to judge a pilot (path/tier/mek), not tucked
      // behind a debrief/shop screen that doesn't exist yet (out of scope
      // this pass). CampaignPilotEntry.personalPoints
      // (engine/campaignState.ts) — 0 for a pilot with no campaign entry at
      // all (a static-only fallback via findPilot above), same convention
      // as everywhere else personalPoints is read.
      const points = entry?.personalPoints ?? 0;
      const ptsText = this.add
        .text(cardLeft + cardW - 20, y - 8, `${points} pts`, { fontFamily: "monospace", fontSize: "13px", color: "#facc15" })
        .setOrigin(1, 0.5)
        .setAlpha(rowAlpha);
      this.squadLayer.add(ptsText);
      const ptsLabel = this.add
        .text(cardLeft + cardW - 20, y + 10, "PERSONAL", { fontFamily: "monospace", fontSize: "8px", color: "#6b7a8a" })
        .setOrigin(1, 0.5)
        .setAlpha(rowAlpha);
      this.squadLayer.add(ptsLabel);
    });
  }

  // ---- The Munti deploy gate, wired in for real, kept live against the
  // current selection --------------------------------------------------
  //
  // canLaunchMission was only ever "correct but unreachable" before this
  // pass (see its own doc comment in engine/campaignState.ts) because Act
  // I's deploy count always equaled its full roster count. The picker
  // above makes it genuinely reachable: canLaunchMission is re-run against
  // currentDeployIds() every single toggle, so the gate reacts immediately
  // — greying BEAM DOWN out the instant the sole Munti is toggled off, and
  // clearing it the instant one is toggled back in.
  private redrawLaunchSection() {
    this.launchLayer.removeAll(true);

    const deployIds = this.currentDeployIds();
    const launchCheck = canLaunchMission(deployIds, this.state);

    const btnY = 590;
    const btn = this.add
      .rectangle(480, btnY, 260, 44, launchCheck.ok ? 0x2e5c7a : 0x1a2028, 1)
      .setStrokeStyle(1, launchCheck.ok ? 0x4a7a9a : 0x3a4552);
    this.launchLayer.add(btn);
    const label = this.add
      .text(480, btnY, "BEAM DOWN", { fontFamily: "monospace", fontSize: "15px", color: launchCheck.ok ? "#ffffff" : "#5a6472" })
      .setOrigin(0.5);
    this.launchLayer.add(label);

    if (launchCheck.ok) {
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setFillStyle(0x3a6f92, 1));
      btn.on("pointerout", () => btn.setFillStyle(0x2e5c7a, 1));
      // Threads the player's real selection through — see scenes/Battle.ts's
      // resolveDeployRoster() for how selectedPilotIds becomes the actual
      // DeployRosterEntry[] Mission deploys.
      btn.on("pointerdown", () => this.scene.start("Battle", { missionId: this.missionId, selectedPilotIds: deployIds }));
    }

    let reason: string;
    let color: string;
    if (this.capWarning) {
      reason = `deploy cap reached — Act I allows at most ${ACT1_DEPLOY_CAP} at once. Deselect a pilot to add another.`;
      color = "#ef4444";
    } else if (launchCheck.ok) {
      reason = this.showPicker ? `${deployIds.length}/${ACT1_DEPLOY_CAP} selected — squad cleared for deployment` : "squad cleared for deployment";
      color = "#6b7a8a";
    } else {
      reason = launchCheck.reason ?? "deploy blocked";
      color = "#ef4444";
    }

    const reasonText = this.add
      .text(480, btnY + 32, reason, {
        fontFamily: "monospace",
        fontSize: "10px",
        color,
        align: "center",
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5, 0);
    this.launchLayer.add(reasonText);
  }
}
