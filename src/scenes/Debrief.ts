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
  type CampaignState,
} from "../engine/campaignState";
import { computeMissionEarnings, applyMissionEarnings, applyCompanyEarnings, applyBonusObjectivePoints, type CompanyEarningsResult } from "../engine/campaignEconomy";
import { ShopPanel, makeShopButton } from "./shop/ShopPanel";

const CARD_W = 900;
const CARD_L = 480 - CARD_W / 2;
const CARD_R = 480 + CARD_W / 2;

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
  // Generalized bonus-objective pass (24 Aug 2026) — the company-pool
  // points from whichever bonusObjective kind this mission carried (0 for
  // a mission with none, or one that didn't resolve to "succeeded"). See
  // engine/campaignEconomy.ts's computeBonusObjectivePoints for exactly
  // what this reads.
  private bonusObjectivePoints = 0;

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

    // ---- 1a. Apply this mission's permanent losses to the roster --------
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
    for (const loss of this.mission.permanentLosses) {
      const entry = this.state.pilots[loss.pilotId];
      if (entry) {
        entry.status = "permanently_lost";
        entry.personalPoints = 0;
      }
    }

    // ---- 2. Apply this mission's earnings --------------------------------
    this.earnings = computeMissionEarnings(this.mission);
    applyMissionEarnings(this.state, this.earnings);
    this.companyResult = applyCompanyEarnings(this.state, this.mission);
    // Generalized bonus-objective pass (24 Aug 2026) — a separate call,
    // deliberately not folded into applyCompanyEarnings above; see that
    // function's own doc comment in engine/campaignEconomy.ts for why.
    this.bonusObjectivePoints = applyBonusObjectivePoints(this.state, this.mission);

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
    if (this.mission.mission.id === "mission_amaranth_12" && win) {
      const result = integrateSecondLance(this.state);
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

    this.add.text(480, 16, "DEBRIEF", { fontFamily: "monospace", fontSize: "22px", color: "#e8e2d4" }).setOrigin(0.5);
    this.add
      .text(480, 40, `${this.mission.mission.displayName} — ${win ? "MISSION COMPLETE" : "MISSION FAILED"}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: win ? "#4ade80" : "#ef4444",
      })
      .setOrigin(0.5);

    let cursorY = this.drawEarningsPanel(58);
    cursorY = this.drawMuntiCallout(cursorY + 8);
    cursorY = this.drawBonusObjectiveCallout(cursorY + 8);
    cursorY = this.drawSecondLanceCallout(cursorY + 8);
    cursorY = this.drawThirdLanceCallout(cursorY + 8);

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
    makeShopButton(this, this.footerLayer, CARD_R - 110, 604, 220, 34, "RETURN TO BASE", true, () => {
      saveCampaignState(this.state);
      this.scene.start("MapSelect");
    });
  }

  // ---- The one-time earnings readout, before any spending happens -------
  private drawEarningsPanel(top: number): number {
    const deployedIds = this.mission.deployedPilotIds;
    const lineH = 15;
    const headerH = 18;
    const companyLines = 2;
    const padding = 14;
    const height = headerH + deployedIds.length * lineH + companyLines * lineH + padding;

    this.add.rectangle(480, top + height / 2, CARD_W, height, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552);
    this.add
      .text(CARD_L + 16, top + 8, "EARNINGS THIS MISSION", { fontFamily: "monospace", fontSize: "11px", color: "#8a97a6" });

    let y = top + 8 + headerH;
    for (const pilotId of deployedIds) {
      const entry = this.state.pilots[pilotId];
      const name = entry?.pilot.displayName ?? pilotId;
      const amount = this.earnings[pilotId] ?? 0;
      this.add.text(CARD_L + 16, y, name, { fontFamily: "monospace", fontSize: "11px", color: "#e8e2d4" });
      this.add
        .text(CARD_R - 16, y, `+${amount} pts`, { fontFamily: "monospace", fontSize: "11px", color: "#facc15" })
        .setOrigin(1, 0);
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
