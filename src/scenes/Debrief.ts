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
import type { MekTrack, Path, PilotRecord, Tier } from "../data/types";
import { UNIT_ARCHETYPES } from "../data/units";
import type { Mission } from "../engine/mission";
import {
  createWardenCampaignState,
  loadCampaignState,
  saveCampaignState,
  checkMuntiGuarantee,
  recruitDiscretionary,
  generateRandomRescuedPilot,
  DISCRETIONARY_RECRUIT_COST,
  type CampaignState,
} from "../engine/campaignState";
import {
  computeMissionEarnings,
  applyMissionEarnings,
  applyCompanyEarnings,
  applyBonusObjectivePoints,
  purchaseTierUpgrade,
  purchaseMekSecondary,
  purchaseSpareParts,
  fabricatorMaxSpareParts,
  TIER_ORDER,
  TIER_UPGRADE_COST,
  MEK_SECONDARY_COST,
  SPARE_PART_COST,
  type CompanyEarningsResult,
} from "../engine/campaignEconomy";

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

const TRACK_LABELS: Record<MekTrack, string> = {
  fabricator: "Fabr",
  armorer: "Armor",
  runemaster: "Rune",
  fieldwright: "Field",
  quartermaster: "Qtrm",
};
const ALL_TRACKS: MekTrack[] = ["fabricator", "armorer", "runemaster", "fieldwright", "quartermaster"];
const ALL_CLASSES: Path[] = ["meeps", "tank", "reeps", "munti"];

// ---- Shop layout: a flat, height-budgeted list of rows ------------------
// Judgment call (brief left this open — "scrollable list or paged, your
// call"): paged, not scrolled. A roster that grows every debrief (recruits
// bought right here) has no natural upper bound, so the row list is built
// fresh from live CampaignState every render and greedily packed into
// pages by a pixel budget (computePages, below) rather than a fixed
// rows-per-page count — a section header, a pilot card, and the taller
// recruit panel all cost a different amount of vertical space, and this
// keeps every page close to full without ever overflowing the viewport.
type ShopEntry =
  | { type: "sectionHeader"; label: string }
  | { type: "pilot"; pilotId: string }
  | { type: "mek"; pilotId: string }
  | { type: "info"; label: string }
  | { type: "recruit" };

const ROW_H: Record<ShopEntry["type"], number> = {
  sectionHeader: 30,
  pilot: 96,
  mek: 54,
  info: 30,
  recruit: 136,
};

function computePages(entries: ShopEntry[], budget: number): ShopEntry[][] {
  const pages: ShopEntry[][] = [[]];
  let used = 0;
  for (const e of entries) {
    const h = ROW_H[e.type];
    if (used + h > budget && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(e);
    used += h;
  }
  return pages;
}

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
  private rescuedPilot?: PilotRecord;
  // Generalized bonus-objective pass (24 Aug 2026) — the company-pool
  // points from whichever bonusObjective kind this mission carried (0 for
  // a mission with none, or one that didn't resolve to "succeeded"). See
  // engine/campaignEconomy.ts's computeBonusObjectivePoints for exactly
  // what this reads.
  private bonusObjectivePoints = 0;

  private viewportTop = 0;
  private viewportBottom = 0;
  private shopPage = 0;
  private recruitClass: Path = "meeps";
  private recruitMessage = "";
  private recruitMessageColor = "#8a97a6";

  private shopLayer!: Phaser.GameObjects.Container;
  private navLayer!: Phaser.GameObjects.Container;
  private footerLayer!: Phaser.GameObjects.Container;

  constructor() {
    super("Debrief");
  }

  init(data: { mission: Mission }) {
    this.mission = data.mission;
    this.shopPage = 0;
    this.recruitClass = "meeps";
    this.recruitMessage = "";
    this.recruitMessageColor = "#8a97a6";
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

    const win = this.mission.outcome === "win";
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

    this.add
      .text(480, cursorY + 10, "CAMPAIGN SHOP", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" })
      .setOrigin(0.5);

    this.viewportTop = cursorY + 30;
    this.viewportBottom = 566;

    this.shopLayer = this.add.container(0, 0);
    this.navLayer = this.add.container(0, 0);
    this.footerLayer = this.add.container(0, 0);

    this.renderShop();
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

  // ---- Shop: builds the live entry list + pages, then draws one page ----
  private buildEntries(): ShopEntry[] {
    const entries: ShopEntry[] = [];
    const activePilotIds = Object.entries(this.state.pilots)
      .filter(([, e]) => e.status === "active")
      .map(([id]) => id);

    entries.push({ type: "sectionHeader", label: "PILOTS — PERSONAL SHOP" });
    for (const pilotId of activePilotIds) entries.push({ type: "pilot", pilotId });

    entries.push({ type: "sectionHeader", label: "COMPANY — SPARE PARTS" });
    const fabricatorPilotIds = activePilotIds.filter((id) => {
      const mek = this.state.meks[this.state.pilots[id].pilot.mekId];
      return mek && fabricatorMaxSpareParts(mek) > 0;
    });
    if (fabricatorPilotIds.length === 0) {
      entries.push({ type: "info", label: "No mek currently carries a Fabricator track — nowhere to put spare parts yet." });
    } else {
      for (const pilotId of fabricatorPilotIds) entries.push({ type: "mek", pilotId });
    }

    entries.push({ type: "sectionHeader", label: "COMPANY — RECRUIT" });
    entries.push({ type: "recruit" });

    return entries;
  }

  private renderShop(): void {
    const entries = this.buildEntries();
    const budget = this.viewportBottom - this.viewportTop;
    const pages = computePages(entries, budget);
    this.shopPage = Math.min(this.shopPage, Math.max(0, pages.length - 1));

    this.shopLayer.removeAll(true);
    this.navLayer.removeAll(true);
    this.footerLayer.removeAll(true);

    let y = this.viewportTop;
    for (const entry of pages[this.shopPage] ?? []) {
      y = this.drawEntry(entry, y);
    }

    // ---- Page nav (only when it's needed) --------------------------------
    if (pages.length > 1) {
      const navY = this.viewportBottom + 8;
      const prevEnabled = this.shopPage > 0;
      const nextEnabled = this.shopPage < pages.length - 1;
      this.makeButton(this.navLayer, 400, navY, 80, 24, "< PREV", prevEnabled, () => {
        this.shopPage -= 1;
        this.renderShop();
      });
      this.navLayer.add(
        this.add
          .text(480, navY, `page ${this.shopPage + 1}/${pages.length}`, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
          .setOrigin(0.5)
      );
      this.makeButton(this.navLayer, 560, navY, 80, 24, "NEXT >", nextEnabled, () => {
        this.shopPage += 1;
        this.renderShop();
      });
    }

    // ---- Footer: live company balance + Return to Base --------------------
    this.footerLayer.add(
      this.add
        .text(CARD_L + 16, 604, `Company Points: ${this.state.points}`, { fontFamily: "monospace", fontSize: "12px", color: "#facc15" })
        .setOrigin(0, 0.5)
    );
    this.makeButton(this.footerLayer, CARD_R - 110, 604, 220, 34, "RETURN TO BASE", true, () => {
      saveCampaignState(this.state);
      this.scene.start("MapSelect");
    });
  }

  private drawEntry(entry: ShopEntry, top: number): number {
    const h = ROW_H[entry.type];
    switch (entry.type) {
      case "sectionHeader":
        this.shopLayer.add(
          this.add.text(480, top + 6, entry.label, { fontFamily: "monospace", fontSize: "12px", color: "#8a97a6" }).setOrigin(0.5, 0)
        );
        break;
      case "pilot":
        this.drawPilotRow(entry.pilotId, top, h);
        break;
      case "mek":
        this.drawMekRow(entry.pilotId, top, h);
        break;
      case "info":
        this.shopLayer.add(
          this.add.text(CARD_L + 16, top + 8, entry.label, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
        );
        break;
      case "recruit":
        this.drawRecruitRow(top, h);
        break;
    }
    return top + h;
  }

  private drawPilotRow(pilotId: string, top: number, h: number): void {
    const entry = this.state.pilots[pilotId];
    if (!entry) return;
    const pilot = entry.pilot;
    const mek = this.state.meks[pilot.mekId];
    const path = UNIT_ARCHETYPES[pilot.archetypeId]?.path;
    const cardH = h - 6;
    const cy = top + cardH / 2;

    this.shopLayer.add(this.add.rectangle(480, cy, CARD_W, cardH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552));
    this.shopLayer.add(this.add.text(CARD_L + 14, top + 8, pilot.displayName, { fontFamily: "monospace", fontSize: "13px", color: "#e8e2d4" }));
    this.shopLayer.add(
      this.add.text(CARD_L + 14, top + 26, `${path ? capitalize(path) : "Unknown"} · Tier ${pilot.tier} · ${mek?.displayName ?? "no mek"}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8a97a6",
      })
    );
    this.shopLayer.add(
      this.add.text(CARD_R - 14, top + 8, `${entry.personalPoints} pts`, { fontFamily: "monospace", fontSize: "13px", color: "#facc15" }).setOrigin(1, 0)
    );
    this.shopLayer.add(
      this.add.text(CARD_R - 14, top + 24, "PERSONAL", { fontFamily: "monospace", fontSize: "8px", color: "#6b7a8a" }).setOrigin(1, 0)
    );

    // Upgrade Tier
    const idx = TIER_ORDER.indexOf(pilot.tier);
    const atMaxTier = idx === TIER_ORDER.length - 1;
    const tierCost = atMaxTier ? undefined : TIER_UPGRADE_COST[pilot.tier as Exclude<Tier, "A">];
    const tierLabel = atMaxTier ? "TIER MAXED" : `UPGRADE -> ${TIER_ORDER[idx + 1]} (${tierCost})`;
    const tierEnabled = !atMaxTier && tierCost !== undefined && entry.personalPoints >= tierCost;
    this.makeButton(this.shopLayer, CARD_L + 84, top + 62, 148, 24, tierLabel, tierEnabled, () => {
      purchaseTierUpgrade(this.state, pilotId);
      this.renderShop();
    });

    // Mek Secondary
    const secX = CARD_L + 250;
    if (!mek) return;
    if (mek.secondary) {
      this.shopLayer.add(
        this.add.text(secX, top + 58, `Secondary: ${capitalize(mek.secondary)}`, { fontFamily: "monospace", fontSize: "10px", color: "#6b7a8a" })
      );
      return;
    }
    this.shopLayer.add(
      this.add.text(secX, top + 50, `Add secondary (${MEK_SECONDARY_COST}):`, { fontFamily: "monospace", fontSize: "9px", color: "#6b7a8a" })
    );
    let tx = secX;
    for (const track of ALL_TRACKS) {
      const disabled = track === mek.primary || entry.personalPoints < MEK_SECONDARY_COST;
      this.makeButton(this.shopLayer, tx, top + 74, 66, 20, TRACK_LABELS[track], !disabled, () => {
        purchaseMekSecondary(this.state, pilotId, track);
        this.renderShop();
      });
      tx += 72;
    }
  }

  private drawMekRow(pilotId: string, top: number, h: number): void {
    const entry = this.state.pilots[pilotId];
    if (!entry) return;
    const mek = this.state.meks[entry.pilot.mekId];
    if (!mek) return;
    const max = fabricatorMaxSpareParts(mek);
    const cardH = h - 6;
    const cy = top + cardH / 2;

    this.shopLayer.add(this.add.rectangle(480, cy, CARD_W, cardH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552));
    this.shopLayer.add(
      this.add.text(CARD_L + 14, cy, `${mek.displayName} (${entry.pilot.displayName}) — Spare Parts: ${mek.spareParts}/${max}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#e8e2d4",
      }).setOrigin(0, 0.5)
    );
    const atMax = mek.spareParts >= max;
    const enabled = !atMax && this.state.points >= SPARE_PART_COST;
    this.makeButton(this.shopLayer, CARD_R - 90, cy, 160, 26, atMax ? "AT MAX" : `BUY PART (${SPARE_PART_COST})`, enabled, () => {
      purchaseSpareParts(this.state, mek.id);
      this.renderShop();
    });
  }

  private drawRecruitRow(top: number, h: number): void {
    const cardH = h - 6;
    const cy = top + cardH / 2;
    this.shopLayer.add(this.add.rectangle(480, cy, CARD_W, cardH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552));
    this.shopLayer.add(
      this.add.text(CARD_L + 14, top + 8, "RECRUIT A NEW PILOT", { fontFamily: "monospace", fontSize: "12px", color: "#e8e2d4" })
    );
    this.shopLayer.add(
      this.add.text(CARD_L + 14, top + 26, `Company pool: ${this.state.points} pts · cost: ${DISCRETIONARY_RECRUIT_COST} pts`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8a97a6",
      })
    );

    let cx = CARD_L + 14;
    for (const cls of ALL_CLASSES) {
      const selected = this.recruitClass === cls;
      const bg = this.add
        .rectangle(cx + 60, top + 62, 118, 26, selected ? 0x2e5c7a : 0x1a2028, 1)
        .setStrokeStyle(1, selected ? 0x4a7a9a : 0x3a4552)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          this.recruitClass = cls;
          this.recruitMessage = "";
          this.renderShop();
        });
      this.shopLayer.add(bg);
      this.shopLayer.add(
        this.add
          .text(cx + 60, top + 62, capitalize(cls), { fontFamily: "monospace", fontSize: "11px", color: selected ? "#ffffff" : "#8a97a6" })
          .setOrigin(0.5)
      );
      cx += 126;
    }

    const canAfford = this.state.points >= DISCRETIONARY_RECRUIT_COST;
    this.makeButton(this.shopLayer, CARD_L + 84, top + 100, 148, 28, `RECRUIT (${DISCRETIONARY_RECRUIT_COST})`, canAfford, () => {
      const result = recruitDiscretionary(this.state, this.recruitClass);
      if (result.ok && result.pilot) {
        this.recruitMessage = `Recruited ${result.pilot.displayName}.`;
        this.recruitMessageColor = "#4ade80";
      } else {
        this.recruitMessage = result.reason ?? "recruit failed";
        this.recruitMessageColor = "#ef4444";
      }
      this.renderShop();
    });
    if (this.recruitMessage) {
      this.shopLayer.add(
        this.add.text(CARD_L + 250, top + 106, this.recruitMessage, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: this.recruitMessageColor,
          wordWrap: { width: 500 },
        })
      );
    }
  }

  // ---- Shared button helper — same reactive pattern as
  // TransporterPad.redrawLaunchSection: rebuild on every state change
  // rather than mutate in place, so affordability/disabled state is always
  // derived fresh from the live CampaignState.
  private makeButton(
    layer: Phaser.GameObjects.Container,
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    enabled: boolean,
    onClick: () => void
  ): void {
    const bg = this.add
      .rectangle(cx, cy, w, h, enabled ? 0x2e5c7a : 0x1a2028, 1)
      .setStrokeStyle(1, enabled ? 0x4a7a9a : 0x3a4552);
    const txt = this.add
      .text(cx, cy, label, { fontFamily: "monospace", fontSize: "10px", color: enabled ? "#ffffff" : "#5a6472", align: "center", wordWrap: { width: w - 6 } })
      .setOrigin(0.5);
    layer.add([bg, txt]);
    if (!enabled) return;
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => bg.setFillStyle(0x3a6f92, 1));
    bg.on("pointerout", () => bg.setFillStyle(0x2e5c7a, 1));
    bg.on("pointerdown", onClick);
  }
}
