// src/scenes/Debrief.ts
// The screen a player reaches after a mission ends (win or loss) —
// Tier 0, unbranded, per claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md's own
// build-cost plan (§9): this is where mission earnings actually land and
// where points actually get spent. No Providence, no room fiction, no crew
// banter — same discipline scenes/TransporterPad.ts's own header documents
// for itself, extended to this screen. The Antfarm doc's Carrier Upgrade
// Modules (Auxiliary Berths, Forward Battery, etc.) are Tier 2 and don't
// exist in code yet — out of scope here, deliberately not stubbed.
//
// Wiring (22 Aug 2026): scenes/Battle.ts used to just sit on its win/loss
// overlay forever, with a "back to mission select" button that skipped the
// entire meta layer. That overlay is kept — the MISSION COMPLETE/FAILED
// beat is a real, legible moment and rushing past it the instant outcome
// flips would bury it — but its button now reads "continue to debrief" and
// starts this scene instead, carrying the actual `Mission` instance through
// Phaser's scene data (not serialized — same JS heap, same session — so
// there's no need to reconstruct it from raw ids). computeMissionEarnings /
// computeMissionCompletionBonus / computeCoBonus (engine/campaignEconomy.ts)
// all take a live Mission directly, which is exactly what this buys.
import Phaser from "phaser";
import type { PilotRecord } from "../data/types";
import type { Mission } from "../engine/mission";
import {
  createWardenCampaignState,
  loadCampaignState,
  saveCampaignState,
  checkMuntiGuarantee,
  generateRandomRescuedPilot,
  integrateSecondLance,
  integrateThirdLance,
  integrateHouseAmaranthSecondLance,
  baseSceneKeyFor,
  applyMissionLosses,
  type CampaignState,
} from "../engine/campaignState";
import { computeMissionEarnings, applyMissionEarnings, applyCompanyEarnings, applyBonusObjectivePoints, type CompanyEarningsResult } from "../engine/campaignEconomy";
// Calendar economy, 2 Sep 2026 — the flat per-mission day cost lands here,
// where every other mission consequence already does. formatDayLabel is the
// same formatter the Hub HUD readout uses, imported here for the campaign-
// finale callout (drawCampaignFinaleCallout, below) — the "final day count
// at the finale as a shareable stat" the v2 proposal's own §7 named.
import { applyMissionCompletionDayCost, formatDayLabel } from "../engine/calendarClock";
import { runGriefCatalyst, type GriefCatalystResult } from "../engine/griefCatalyst";
import { recordHumanMissionSummary, activeRosterSize } from "../engine/telemetry";
import { summaryMvp, type MissionSummary } from "../engine/missionSummary";
import { ShopPanel, makeShopButton, showSaveAsOverlay } from "./shop/ShopPanel";
import { addMenuOverlayButton } from "./MenuOverlay";

const CARD_W = 900;
const CARD_L = 480 - CARD_W / 2;
const CARD_R = 480 + CARD_W / 2;

// Campaign-finale detection, 2 Sep 2026 (Calendar Economy v2 proposal §7's
// "final day count at the finale as a shareable stat"). Hardcoded ids,
// matching this file's own existing style for the Mission 12/24 story
// gates just below rather than deriving them generically from
// data/allCampaigns.ts's CAMPAIGNS array — there are exactly two finales
// today (Warden Company's Mission 36, House Amaranth's own Mission 36) and
// this file already hardcodes mission ids for gates of this shape.
const CAMPAIGN_FINALE_MISSION_IDS = new Set(["mission_amaranth_36", "mission_house_amaranth_36"]);

export class Debrief extends Phaser.Scene {
  private mission!: Mission;
  private state!: CampaignState;
  private earnings: Record<string, number> = {};
  private companyResult!: CompanyEarningsResult;
  private muntiFired = false;
  private muntiPilot?: PilotRecord;
  private secondLancePilots?: PilotRecord[];
  private thirdLancePilots?: PilotRecord[];
  private rescuedPilot?: PilotRecord;
  // CO Check-In Gate Plan v1, 28 Aug 2026 — built 1 Sep 2026. Set once in
  // create(), before lastMissionEcho gets overwritten below — see that
  // assignment's own comment for why "was lastMissionEcho undefined before
  // this debrief" is this save's first-ever debrief, without needing a
  // separate counter.
  private coCheckinNudgeDue = false;
  // Campaign-finale callout (2 Sep 2026) — true only on a WIN of one of
  // CAMPAIGN_FINALE_MISSION_IDS above. Set once in create(), same pattern
  // as coCheckinNudgeDue just above.
  private isCampaignFinale = false;
  // Grief Catalyst, live port 28 Aug 2026 — one entry per this mission's
  // permanentLosses (see the step 1b/1d comments below for why it's an
  // array, not a single result). Empty on a mission with no true losses.
  private griefResults: GriefCatalystResult[] = [];
  // Generalized bonus-objective pass (24 Aug 2026) — the company-pool
  // points from whichever bonusObjective kind this mission carried (0 for
  // a mission with none, or one that didn't resolve to "succeeded"). See
  // engine/campaignEconomy.ts's computeBonusObjectivePoints for exactly
  // what this reads.
  private bonusObjectivePoints = 0;
  // Telemetry pass (1 Sep 2026) — this mission's stored record, built in
  // create() step 3d once every roster/points change above it has landed.
  // Null only if the stats layer failed (it's best-effort); the earnings
  // panel then just shows points, as it did before this pass.
  private summary: MissionSummary | null = null;
  // Calendar economy, 2 Sep 2026 — the day the campaign sat on when this
  // debrief opened, and the day it sits on after the mission's flat cost.
  // Set in create() step 2b.
  private calendarSpan: { before: number; after: number } = { before: 1, after: 1 };

  private viewportTop = 0;
  private viewportBottom = 0;
  private shop!: ShopPanel;
  private footerLayer!: Phaser.GameObjects.Container;

  constructor() {
    super("Debrief");
  }

  init(data: { mission: Mission }) {
    this.mission = data.mission;
  }

  create() {
    this.cameras.main.setBackgroundColor("#0c0f12");

    // ---- 1. Load campaign state ------------------------------------------
    this.state = loadCampaignState() ?? createWardenCampaignState();
    // Telemetry pass (1 Sep 2026): the "before" numbers the mission record
    // wants, captured before anything below changes them — points before
    // earnings, roster before losses/recruits, and the BEAM DOWN timestamp
    // before step 1a clears it.
    const pointsBefore = this.state.points;
    const rosterSizeBefore = activeRosterSize(this.state);
    const startedAt = this.state.activeMissionAttempt?.startedAt;

    // ---- 1a. Mission real-time clock (25 Aug 2026) — clear the attempt --
    // Reaching this screen at all means the mission actually resolved for
    // real, win or loss, before any 12-hour timeout could fire — clear it
    // unconditionally so scenes/Boot.ts's own timeout check never fires
    // against a mission that already finished the honest way. See
    // engine/campaignState.ts's "9. Mission real-time clock" section for
    // the full mechanism; scenes/TransporterPad.ts is the matching
    // set-it-on-launch half.
    this.state.activeMissionAttempt = undefined;

    // ---- 1b. Apply this mission's permanent losses to the roster --------
    // Mission.permanentLosses (engine/mission.ts) was already computed
    // LIVE, at the exact instant of each downing this mission — that
    // file's own header names this exact moment ("a future debrief
    // screen") as where it gets applied to the persistent CampaignState.
    // Deliberately NOT re-run through evaluatePermadeathCheck/
    // applyPermadeathCheck here: those take a live BattleUnit + the
    // mission's current side roster and would re-evaluate against
    // end-of-mission state, which is wrong for anyone downed earlier while
    // a Munti was still alive (campaignState.ts's own "evaluated live...
    // not deferred to mission end" rule) — this mirrors just the mutation
    // half of applyPermadeathCheck (status flip + personalPoints zeroed),
    // applied to the answer Mission already got right the first time.
    // Order relative to applyMissionEarnings below doesn't matter — both
    // are written to behave correctly either way (see each function's own
    // comment) — but doing it first keeps a lost pilot's balance at 0
    // rather than transiently nonzero.
    // Status flip, points discarded, and the loss context stamped — all
    // three in engine/campaignState.ts's applyMissionLosses, which is
    // where the rule lives and where a test can reach it. This screen's
    // job is only to supply the two facts Mission itself cannot know at
    // the moment of a downing: which mission it was, and how it ended.
    applyMissionLosses(
      this.state,
      this.mission.permanentLosses,
      this.mission.mission.id,
      this.mission.outcome === "win" ? "win" : "loss",
    );

    // ---- 1b-ii. Grief Catalyst (Grief Catalyst Port Spec v1, 28 Aug 2026) --
    // Deliberately a second loop over permanentLosses, run only AFTER every
    // status flip above has already happened: runGriefCatalyst filters
    // mourners down to pilots still reading status === "active", so with
    // more than one true loss this mission, the second loss's grief round
    // correctly excludes the first loss's pilot from mourning too (they're
    // already gone) rather than needing this function to know about losses
    // that haven't been applied yet.
    for (const loss of this.mission.permanentLosses) {
      this.griefResults.push(runGriefCatalyst(this.state, this.mission.deployedPilotIds, loss.pilotId));
    }

    // ---- 1c. Debrief-side echo, 27 Aug 2026 (Social Sim Roadmap #9) ------
    // Records this mission's outcome for the Hub to react to on the
    // player's next visit — see campaignState.ts's own
    // CampaignState.lastMissionEcho comment for the full design.
    // commander_down folds into "loss" here: this mechanism is about the
    // ordinary win/loss axis the Hub's ambient content leans on, not a
    // distinct commander_down beat (which already has its own dedicated
    // handling elsewhere — see commanderDown.test.ts), so it isn't given
    // separate flavor content by this pass. Always overwrites whatever was
    // here before, `announced` reset to false — only the most recent
    // mission is ever echoed.
    //
    // CO Check-In Gate Plan v1, 28 Aug 2026 — built 1 Sep 2026. Read BEFORE
    // the overwrite below: lastMissionEcho is undefined only on this save's
    // very first debrief, so capturing that here is exactly "is this the
    // first debrief" (the plan's own trigger condition) with no new
    // counter needed. See canLaunchMission's own comment (campaignState.ts)
    // for the matching half of this gate.
    this.coCheckinNudgeDue = this.state.lastMissionEcho === undefined && !this.state.hasCheckedInWithCo;
    this.state.lastMissionEcho = {
      missionId: this.mission.mission.id,
      outcome: this.mission.outcome === "win" ? "win" : "loss",
      announced: false,
    };

    // ---- 2. Apply this mission's earnings --------------------------------
    this.earnings = computeMissionEarnings(this.mission);
    applyMissionEarnings(this.state, this.earnings);
    this.companyResult = applyCompanyEarnings(this.state, this.mission);
    // Generalized bonus-objective pass (24 Aug 2026) — a separate call,
    // deliberately not folded into applyCompanyEarnings above; see that
    // function's own doc comment in engine/campaignEconomy.ts for why.
    this.bonusObjectivePoints = applyBonusObjectivePoints(this.state, this.mission);

    // ---- 2b. Calendar: the flat mission-completion cost -------------------
    // Calendar economy, 2 Sep 2026. This is ONLY the flat cost — the transit,
    // prep and return that never get played out on screen. The real time the
    // player actually spent in the battle was already credited by Battle.ts's
    // own shutdown flush, so adding it again here would double-count it.
    //
    // Stored rather than rendered inline because the interesting half is the
    // transition ("Day 47 → Day 52"), and the earnings panel that shows it is
    // built further down in create().
    this.calendarSpan = applyMissionCompletionDayCost(this.state);

    // ---- 3. The Munti guarantee, run once on entry -----------------------
    const muntiResult = checkMuntiGuarantee(this.state);
    this.muntiFired = muntiResult.recruited;
    this.muntiPilot = muntiResult.pilot;

    // ---- 3a. Bonus objective reveal (generalized 24 Aug 2026 — see
    // data/types.ts's BonusObjective) — run once on entry, same shape as
    // the Munti guarantee just above. Distinct panel/color from it
    // deliberately (drawBonusObjectiveCallout below): the Munti guarantee
    // is "we had to do this or the campaign would be stuck," this is "you
    // earned this." Rescue keeps its own free-recruit reward on top of
    // bonusObjectivePoints (Maxime, 24 Aug 2026: "Points on top of the
    // recruit"); clear_bloom_patch has no reward beyond the points
    // themselves, so it needs nothing resolved here.
    this.rescuedPilot = this.mission.rescueOutcome === "succeeded" ? generateRandomRescuedPilot(this.state) : undefined;

    // ---- 3b. Second Lance integration (Act II opening, 25 Aug 2026) ------
    // See engine/campaignState.ts's integrateSecondLance for the full
    // reasoning on why this specific beat (Mission 12 won, Act I's own
    // finale) rather than any point in Act II proper. Run-once-on-entry,
    // same shape as the Munti guarantee just above; a loss on Mission 12
    // does not integrate the lance — the campaign doc frames Act II as
    // opening on that win specifically ("Warden Company forms around
    // Rourke's survivors AND a second lance" reads as one beat, not two).
    const win = this.mission.outcome === "win";
    // Campaign-finale callout, 2 Sep 2026 — see CAMPAIGN_FINALE_MISSION_IDS'
    // own comment above. A loss on the finale mission is not campaign
    // completion (the war isn't won), same "only a win counts" reading the
    // Second/Third Lance gates just below already use for their own beats.
    this.isCampaignFinale = win && CAMPAIGN_FINALE_MISSION_IDS.has(this.mission.mission.id);
    if (this.mission.mission.id === "mission_amaranth_12" && win) {
      const result = integrateSecondLance(this.state);
      this.secondLancePilots = result.integrated ? result.pilots : undefined;
    }
    // House Amaranth's own Second Lance (1 Sep 2026) — same beat, one
    // mission id over. Mutually exclusive with the Warden gate above (a
    // save is only ever one side's mission ids), so sharing
    // this.secondLancePilots/drawSecondLanceCallout is safe — at most one
    // of these two blocks ever fires for a given Debrief screen.
    if (this.mission.mission.id === "mission_house_amaranth_12" && win) {
      const result = integrateHouseAmaranthSecondLance(this.state);
      this.secondLancePilots = result.integrated ? result.pilots : undefined;
    }

    // ---- 3c. Third Lance integration (Act III opening, 25 Aug 2026 —
    // same-day correction) — mirrors 3b exactly, one mission later: see
    // engine/campaignState.ts's integrateThirdLance for the full
    // reasoning on why Mission 24 (Act II's own finale, Rourke's
    // promotion to Major) is the trigger.
    if (this.mission.mission.id === "mission_amaranth_24" && win) {
      const result = integrateThirdLance(this.state);
      this.thirdLancePilots = result.integrated ? result.pilots : undefined;
    }

    // ---- 3d. Telemetry record (1 Sep 2026, Player Telemetry Plan §2) ----
    // Written once, here, after every roster and points change above so
    // the "after" numbers are final. engine/telemetry.ts is the single
    // funnel both this screen and Battle's COMMAND DOWN path use.
    this.summary = recordHumanMissionSummary(this.mission, this.state, {
      startedAt,
      pointsBefore,
      pointsAfter: this.state.points,
      rosterSizeBefore,
      rosterSizeAfter: activeRosterSize(this.state),
    });

    this.add.text(480, 16, "DEBRIEF", { fontFamily: "monospace", fontSize: "22px", color: "#e8e2d4" }).setOrigin(0.5);

    // Shared MENU corner control (Main Menu / Save / Ironman UI Plan v1 §2).
    addMenuOverlayButton(this, 890, 16, 100, 22, () => this.state);
    this.add
      .text(480, 40, `${this.mission.mission.displayName} — ${win ? "MISSION COMPLETE" : "MISSION FAILED"}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: win ? "#4ade80" : "#ef4444",
      })
      .setOrigin(0.5);

    // Calendar economy, 2 Sep 2026 — the dateline. Left-aligned on the card's
    // own left edge at the header's y, which is free: DEBRIEF is centered at
    // x=480 and the MENU control sits at x=890.
    //
    // Shows the transition rather than just the destination, because the span
    // is the part that carries meaning — "Day 47 → Day 52" says the sortie
    // cost five days, where a bare "Day 52" says nothing about what just
    // happened. This is the pacing landmark Calendar_System_v1.md asked for.
    this.add.text(CARD_L, 20, `Day ${this.calendarSpan.before} → Day ${this.calendarSpan.after}`, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#6b7a8a",
    });

    let cursorY = this.drawEarningsPanel(58);
    cursorY = this.drawGriefCallout(cursorY + 8);
    cursorY = this.drawMuntiCallout(cursorY + 8);
    cursorY = this.drawBonusObjectiveCallout(cursorY + 8);
    cursorY = this.drawSecondLanceCallout(cursorY + 8);
    cursorY = this.drawThirdLanceCallout(cursorY + 8);
    cursorY = this.drawCoCheckinNudge(cursorY + 8);
    cursorY = this.drawCampaignFinaleCallout(cursorY + 8);

    this.add
      .text(480, cursorY + 10, "CAMPAIGN SHOP", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);

    this.viewportTop = cursorY + 30;
    this.viewportBottom = 566;

    this.footerLayer = this.add.container(0, 0);
    // ShopPanel (25 Aug 2026) — this used to be ~270 lines of shop-drawing
    // code living directly on this class; now shared with scenes/Hangar.ts.
    // See that file's own header for why. onRender redraws just the footer
    // (company points can change on every purchase/recruit click) without
    // this scene needing to know anything about the panel's internals.
    this.shop = new ShopPanel(this, this.state, this.viewportTop, this.viewportBottom, () => this.renderFooter());
    this.shop.render();
  }

  // ---- Footer: live company balance + Return to Base ---------------------
  private renderFooter(): void {
    this.footerLayer.removeAll(true);
    this.footerLayer.add(
      this.add
        .text(CARD_L + 16, 604, `Company Points: ${this.state.points}`, { fontFamily: "monospace", fontSize: "12px", color: "#facc15" })
        .setOrigin(0, 0.5)
    );
    if (this.state.ironman === false) {
      makeShopButton(this, this.footerLayer, CARD_L + 280, 604, 140, 30, "SAVE AS...", true, () => {
        showSaveAsOverlay(this, this.state, (slot) => this.flashSavedMessage(slot));
      });
    }
    // Routing fix, 28 Aug 2026 (Maxime: "dont forget to debried at
    // arrangement of content"). Used to land straight back on MapSelect's
    // flat list — this.state.lastMissionEcho (set earlier in this scene's
    // own economic pass, see its header) was already being written to disk
    // right here, but nothing ever read it back: Hub.ts's checkMissionEcho()
    // — built the same day as lastMissionEcho itself, one-shot, exactly for
    // this — only fires from Hub's own create(), and the old routing meant
    // a player could go an entire session without CONTINUE or RETURN TO
    // BASE ever actually passing through Hub. Sending RETURN TO BASE to Hub
    // instead is what makes that existing pipeline actually fire: next NPC
    // talked to (Arrangement of Content included — he's an ordinary
    // hot-topic-eligible NPC like any other, see checkMissionEcho's own
    // comment) can surface a missionWin/missionLoss reaction. Not a new
    // interaction pattern — Debrief's own earnings/roster/Grief Catalyst
    // logic above is untouched, this only changes where the screen sends
    // the player once that's done.
    makeShopButton(this, this.footerLayer, CARD_R - 110, 604, 220, 34, "RETURN TO BASE", true, () => {
      saveCampaignState(this.state);
      // 1 Sep 2026 — see baseSceneKeyFor's own doc comment (engine/
      // campaignState.ts): a House Amaranth save has no Hub to send it to.
      this.scene.start(baseSceneKeyFor(this.state));
    });
  }

  private flashSavedMessage(slot: number): void {
    const msg = this.add.text(480, 630, `Saved to Slot ${slot + 1}.`, { fontFamily: "monospace", fontSize: "11px", color: "#4ade80" }).setOrigin(0.5);
    this.time.delayedCall(2200, () => msg.destroy());
  }

  // ---- The one-time earnings readout, before any spending happens -------
  private drawEarningsPanel(top: number): number {
    const deployedIds = this.mission.deployedPilotIds;
    const lineH = 15;
    const headerH = 18;
    // Telemetry pass (1 Sep 2026): one extra line for the after-action
    // summary (turns, hostiles down, downed, lost) when a record exists.
    const summaryLines = this.summary ? 1 : 0;
    const companyLines = 2;
    const padding = 14;
    const height = headerH + deployedIds.length * lineH + summaryLines * lineH + companyLines * lineH + padding;

    this.add.rectangle(480, top + height / 2, CARD_W, height, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552);
    this.add
      .text(CARD_L + 16, top + 8, this.summary ? "AFTER ACTION — EARNINGS THIS MISSION" : "EARNINGS THIS MISSION", { fontFamily: "monospace", fontSize: "11px", color: "#8a97a6" });
    if (this.summary) {
      // Column header for the stat block, right-aligned over the numbers.
      this.add
        .text(CARD_R - 90, top + 8, "dealt  taken  kills  asst", { fontFamily: "monospace", fontSize: "9px", color: "#6b7a8a" })
        .setOrigin(1, 0);
    }

    let y = top + 8 + headerH;
    const mvp = this.summary ? summaryMvp(this.summary) : undefined;
    for (const pilotId of deployedIds) {
      const entry = this.state.pilots[pilotId];
      const name = entry?.pilot.displayName ?? pilotId;
      const amount = this.earnings[pilotId] ?? 0;
      const row = this.summary?.squad.find((p) => p.pilotId === pilotId);
      // Feature-gap report B1: the story of the fight, not just the points —
      // MVP star, per-pilot dealt/taken/kills/assists, and the two tags
      // that matter under permadeath: DOWNED (restocked) and LOST (gone).
      const tag = row?.permanentlyLost ? "  LOST" : row?.downed ? "  DOWNED" : "";
      const star = mvp && row && mvp.pilotId === pilotId && mvp.damageDealt > 0 ? "★ " : "  ";
      const nameColor = row?.permanentlyLost ? "#ef4444" : row?.downed ? "#fbbf24" : "#e8e2d4";
      this.add.text(CARD_L + 16, y, `${star}${name}${tag}`, { fontFamily: "monospace", fontSize: "11px", color: nameColor });
      if (row) {
        const cols = `${String(row.damageDealt).padStart(5)}  ${String(row.damageTaken).padStart(5)}  ${String(row.kills).padStart(5)}  ${row.assists.toFixed(1).padStart(4)}`;
        this.add.text(CARD_R - 90, y, cols, { fontFamily: "monospace", fontSize: "11px", color: "#8fb3c9" }).setOrigin(1, 0);
      }
      this.add
        .text(CARD_R - 16, y, `+${amount} pts`, { fontFamily: "monospace", fontSize: "11px", color: "#facc15" })
        .setOrigin(1, 0);
      y += lineH;
    }
    if (this.summary) {
      const sm = this.summary;
      const hostilesDown = Object.values(sm.hostilesKilledByArchetype).reduce((a, b) => a + b, 0);
      const downed = sm.squad.filter((p) => p.downed).length;
      const lost = sm.squad.filter((p) => p.permanentlyLost).length;
      const clean = downed === 0 && sm.outcome === "win" ? "  ·  CLEAN SWEEP" : "";
      const turns = sm.turnLimit ? `${sm.turns} turns of ${sm.turnLimit}` : `${sm.turns} turns`;
      const attempt = sm.attemptNumber > 1 ? `  ·  attempt ${sm.attemptNumber}` : "";
      this.add.text(CARD_L + 16, y, `${turns}  ·  ${hostilesDown} hostile${hostilesDown === 1 ? "" : "s"} down  ·  ${downed} downed  ·  ${lost} lost${clean}${attempt}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8a97a6",
      });
      y += lineH;
    }

    y += 2;
    this.add
      .text(CARD_L + 16, y, `Company pool: +${this.companyResult.totalAdded + this.bonusObjectivePoints} pts`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#facc15",
      });
    y += lineH;
    this.add.text(CARD_L + 16, y, this.companyEarningsBreakdown(), { fontFamily: "monospace", fontSize: "9px", color: "#6b7a8a" });

    return top + height;
  }

  /**
   * Small print under the company-pool total: where those points actually
   * came from — the completion+performance formula's own terms
   * (computeMissionCompletionBonus, engine/campaignEconomy.ts), the Rourke
   * CO bonus, and (generalized bonus-objective pass, 24 Aug 2026) whatever
   * bonusObjectivePoints this mission earned, if any.
   */
  private companyEarningsBreakdown(): string {
    const cb = this.companyResult.completionBonus;
    const coBonus = this.companyResult.coBonus;
    const parts: string[] = [];
    if (cb.total !== 0 || coBonus !== 0) {
      parts.push(
        `completion ${cb.base}, turns ${cb.turnsUnderLimitBonus}, no-downed ${cb.noPilotDownedBonus}, no-parts ${cb.noSparePartsSpentBonus}, no-severance ${cb.noSeveranceBonus}, CO bonus +${coBonus}`
      );
    }
    if (this.bonusObjectivePoints > 0) parts.push(`bonus objective +${this.bonusObjectivePoints}`);
    if (!parts.length) return "(no completion bonus — mission was not a win)";
    return `(${parts.join("; ")})`;
  }

  /**
   * Grief Catalyst reveal (live port, 28 Aug 2026) — one block per true
   * loss this mission (see the 1b-ii comment in create() for why
   * griefResults is an array). No-op when nothing was lost this mission.
   * Deliberately rendered as visible dialogue, not a silent bond-number
   * shift — the spec's own call ("yes, it says something") — but kept
   * understated: a muted panel and small print, not the green/amber
   * fanfare color the bonus/Munti callouts get.
   */
  private drawGriefCallout(top: number): number {
    if (!this.griefResults.length) return top;
    const lineH = 14;
    const headerH = 18;
    let y = top;
    for (const result of this.griefResults) {
      if (!result.mourners.length) continue; // a true loss with nobody left on the deployed squad to mourn — nothing to draw
      const lostName = this.state.pilots[result.lostPilotId]?.pilot.displayName ?? result.lostPilotId;
      const height = headerH + result.mourners.length * lineH + result.bondShifts.length * lineH + 10;

      this.add.rectangle(480, y + height / 2, CARD_W, height, 0x1b1922, 1).setStrokeStyle(1, 0x4a4258);
      this.add.text(CARD_L + 16, y + 8, `GRIEF — HOW THEY'RE TAKING IT (${lostName})`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#a99bc4",
      });

      let rowY = y + 8 + headerH;
      for (const mourner of result.mourners) {
        this.add.text(CARD_L + 16, rowY, `${mourner.displayName}: ${mourner.line}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#c8bfd6",
        });
        rowY += lineH;
      }
      for (const shift of result.bondShifts) {
        const nameA = this.state.pilots[shift.pilotIdA]?.pilot.displayName ?? shift.pilotIdA;
        const nameB = this.state.pilots[shift.pilotIdB]?.pilot.displayName ?? shift.pilotIdB;
        const sign = shift.delta >= 0 ? "+" : "";
        this.add.text(CARD_L + 16, rowY, `${nameA} and ${nameB}: Bond ${sign}${shift.delta}`, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#6b7a8a",
        });
        rowY += lineH;
      }

      y += height + 8;
    }
    // Matches every other draw* method's own "top + height, no trailing
    // gap" contract — the cursorY chain in create() adds its own +8
    // between calls, so the running +8 this loop uses between multiple
    // loss-blocks needs stripping off the very last one before returning.
    return y === top ? top : y - 8;
  }

  /**
   * CO Check-In Gate Plan v1, 28 Aug 2026 — built 1 Sep 2026. Only ever
   * true on a save's first-ever debrief, and only while hasCheckedInWithCo
   * is still false (see coCheckinNudgeDue's own assignment above) — a
   * once-only heavy nudge, not a repeated per-mission line. Blue/
   * informational rather than amber (Munti) or green (bonus): this isn't
   * an emergency or a reward, just direction. Same panel shape as every
   * other callout on this screen.
   */
  private drawCoCheckinNudge(top: number): number {
    if (!this.coCheckinNudgeDue) return top;
    const height = 40;
    this.add.rectangle(480, top + height / 2, CARD_W, height, 0x14202a, 1).setStrokeStyle(1, 0x4a7a9a);
    this.add
      .text(480, top + height / 2, "Report to the CO in the grotto before your next deployment.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#7ec8e3",
      })
      .setOrigin(0.5);
    return top + height;
  }

  /**
   * Campaign-finale callout, 2 Sep 2026 — Calendar Economy v2 proposal §7's
   * "final day count at the finale as a shareable stat, no leaderboard."
   * Fires exactly once, on the same win that satisfies
   * CAMPAIGN_FINALE_MISSION_IDS above. Two-row layout mirroring
   * drawSecondLanceCallout/drawThirdLanceCallout's own shape (this is
   * bigger news than a single-line callout), gold/celebratory rather than
   * green (reward) or blue (info) — this isn't a mission reward, it's the
   * whole campaign closing out. Deliberately doesn't name which campaign
   * ("Warden Company" vs. the in-code CAMPAIGNS array's still-unrenamed
   * "The Amaranth Reckoning" — see the Master Index's own naming note on
   * that drift) — reusing formatDayLabel means this also picks up a named
   * landmark for free if the finale ever happens to land on one.
   */
  private drawCampaignFinaleCallout(top: number): number {
    if (!this.isCampaignFinale) return top;
    const height = 56;
    this.add.rectangle(480, top + height / 2, CARD_W, height, 0x241c0a, 1).setStrokeStyle(1, 0xfacc15);
    this.add
      .text(480, top + 16, "CAMPAIGN COMPLETE", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#facc15",
      })
      .setOrigin(0.5);
    this.add
      .text(480, top + 38, `Your run: ${formatDayLabel(this.state)}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#c9b98a",
      })
      .setOrigin(0.5);
    return top + height;
  }

  private drawMuntiCallout(top: number): number {
    if (!this.muntiFired || !this.muntiPilot) return top;
    const height = 40;
    this.add.rectangle(480, top + height / 2, CARD_W, height, 0x2a1f14, 1).setStrokeStyle(1, 0xb8860b);
    this.add
      .text(
        480,
        top + height / 2,
        `EMERGENCY REPLACEMENT — ${this.muntiPilot.displayName} assigned, Munti-class, G-tier`,
        { fontFamily: "monospace", fontSize: "12px", color: "#facc15" }
      )
      .setOrigin(0.5);
    return top + height;
  }

  /**
   * Bonus-objective reveal, generalized 24 Aug 2026 (replaces the old
   * rescue-only drawRescueCallout — same shape, mirrors drawMuntiCallout's
   * own panel, green/positive rather than amber/emergency) — one line for
   * whichever kind this mission's bonusObjective actually was, or a no-op
   * if it never resolved to "succeeded" (including a mission with no
   * bonusObjective at all). Rescue keeps its own distinct wording (the
   * recruit is the headline; points are "on top of" it, per Maxime's own
   * framing); clear_bloom_patch has nothing but the points to report.
   */
  private drawBonusObjectiveCallout(top: number): number {
    const bonus = this.mission.mission.bonusObjective;
    if (!bonus) return top;
    let text: string | null = null;
    if (bonus.kind === "rescue_pilot" && this.rescuedPilot) {
      text = `RESCUE SUCCESSFUL — ${this.rescuedPilot.displayName} recovered, added to the bench (+${this.bonusObjectivePoints} pts)`;
    } else if (bonus.kind === "clear_bloom_patch" && this.mission.clearBloomPatchOutcome === "succeeded") {
      text = `BONUS OBJECTIVE COMPLETE — patch cleared (+${this.bonusObjectivePoints} pts)`;
    }
    if (!text) return top;
    const height = 40;
    this.add.rectangle(480, top + height / 2, CARD_W, height, 0x14261c, 1).setStrokeStyle(1, 0x4ade80);
    this.add.text(480, top + height / 2, text, { fontFamily: "monospace", fontSize: "12px", color: "#4ade80" }).setOrigin(0.5);
    return top + height;
  }

  /**
   * Second Lance integration reveal (25 Aug 2026) — fires exactly once,
   * on the same Mission 12 win that triggers integrateSecondLance itself.
   * Two lines rather than one: the panel is wider news than a single
   * recruit (five pilots, a roster-doubling story beat), so it gets its
   * own two-row layout instead of squeezing into the Munti/bonus
   * callouts' single-line shape.
   */
  private drawSecondLanceCallout(top: number): number {
    if (!this.secondLancePilots) return top;
    const height = 56;
    this.add.rectangle(480, top + height / 2, CARD_W, height, 0x14201f, 1).setStrokeStyle(1, 0x4ade80);
    this.add
      .text(480, top + 16, "THE SECOND LANCE HAS ARRIVED — 5 pilots added to the roster", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#4ade80",
      })
      .setOrigin(0.5);
    this.add
      .text(480, top + 36, this.secondLancePilots.map((p) => p.displayName.split("—")[1]?.trim() ?? p.displayName).join("   "), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8a97a6",
      })
      .setOrigin(0.5);
    return top + height;
  }

  /**
   * Third Lance integration reveal (25 Aug 2026, same-day correction) —
   * mirrors drawSecondLanceCallout exactly, fires once on the same
   * Mission 24 win that triggers integrateThirdLance itself.
   */
  private drawThirdLanceCallout(top: number): number {
    if (!this.thirdLancePilots) return top;
    const height = 56;
    this.add.rectangle(480, top + height / 2, CARD_W, height, 0x14201f, 1).setStrokeStyle(1, 0x4ade80);
    this.add
      .text(480, top + 16, "THE THIRD LANCE HAS ARRIVED — 5 pilots added to the roster", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#4ade80",
      })
      .setOrigin(0.5);
    this.add
      .text(480, top + 36, this.thirdLancePilots.map((p) => p.displayName.split("—")[1]?.trim() ?? p.displayName).join("   "), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8a97a6",
      })
      .setOrigin(0.5);
    return top + height;
  }
}
