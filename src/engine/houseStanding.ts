// The houses' verdict on a lost aristocrat — 2 Sep 2026.
//
// A recruited Heirloom is a loan from a family, made through that family's
// own child (engine/heirlooms.ts, "the houses take their property back").
// When the child doesn't come back, neither does the weapon. This module
// answers the question that sits one step past that: what does the family
// think of the company afterward.
//
// The honest constraint this design had to be rebuilt around, and it is
// worth stating at the top because it is the thing that makes the rest make
// sense: THERE IS ONLY ONE WAY TO DIE IN THIS GAME. evaluatePermadeathCheck
// (engine/campaignState.ts) has exactly one branch returning a permanent
// loss, "no living Munti remains on this side," and every other downing is
// a restock. Maxime, stating the rule when an earlier draft of this system
// imagined three different causes of death to key off: "die only count if
// there no restock." So cause of death is a constant and carries no
// information at all.
//
// What varies is the arrangement the company had in place when it happened
// — how thin they launched, what they got for it, how long their child was
// out there with nobody left to reach them, and whether the company had
// made that child the lifeline itself. Those are decisions, not dice, which
// is exactly why a family could hold someone to account for them.
//
// Pure: reads a PilotLossContext, returns a verdict. No campaign state, no
// randomness, no side effects. The campaign-wide reading of these verdicts
// lives in engine/heirlooms.ts, next to the recruit ladder it actually
// bites — kept there rather than here specifically to avoid an import cycle
// between the two files.

import type { PilotLossContext } from "./campaignState";
import {
  HOUSE_AGGRIEVED_AT,
  HOUSE_CHARGE_WEIGHTS,
  HOUSE_ESTRANGED_AT,
  HOUSE_LEFT_ALONE_SEVERE_TURNS,
  type HouseCharge,
  type HouseVerdict,
} from "../data/heirlooms";

export interface HouseGrievance {
  verdict: HouseVerdict;
  /** Total weight of every charge that stuck. 0 means the family has no complaint. */
  score: number;
  /** Ordered heaviest first, so a UI or a line of dialogue can lead with the worst of it. */
  charges: HouseCharge[];
}

/**
 * Which charges this loss actually supports.
 *
 * Every one of these is checked against something the company chose, never
 * against how the fight went. A squad that brought two Muntis, won, and lost
 * their aristocrat in the same volley that took the last medic has no
 * charges against it at all — that is a real, reachable outcome, and it
 * should be, or "the family had no complaint" would be a line nobody ever
 * sees.
 */
export function houseCharges(ctx: PilotLossContext): HouseCharge[] {
  const charges: HouseCharge[] = [];

  // canLaunchMission enforces a floor of exactly one Munti, so 1 is a legal
  // squad — and it is also the thinnest bet the rules permit. A house can
  // read a deployment manifest.
  const thin = ctx.muntisDeployed <= 1;
  if (thin) charges.push("thin_manifest");

  // Only charged on top of a thin manifest, deliberately. An aristocrat
  // Munti in a squad with a second Munti who dies as the last one standing
  // is a bad turn; an aristocrat Munti who was the ONLY Munti was made the
  // company's whole lifeline by the company, before anyone fired a shot.
  if (thin && ctx.wasLastMunti) charges.push("sole_lifeline");

  if (ctx.outcome === "loss") charges.push("nothing_gained");

  if (ctx.turnsWithoutMunti >= 1) charges.push("left_alone");

  return charges.sort((a, b) => chargeWeight(b, ctx) - chargeWeight(a, ctx));
}

/**
 * What one charge is worth against this particular loss.
 *
 * Only left_alone is context-sensitive: one turn without a lifeline is the
 * shape of a fight going wrong, several is the shape of a company that kept
 * pushing and left someone out there.
 */
export function chargeWeight(charge: HouseCharge, ctx: PilotLossContext): number {
  const base = HOUSE_CHARGE_WEIGHTS[charge];
  if (charge === "left_alone" && ctx.turnsWithoutMunti >= HOUSE_LEFT_ALONE_SEVERE_TURNS) return base * 2;
  return base;
}

/** Total grievance weight. */
export function grievanceScore(ctx: PilotLossContext): number {
  return houseCharges(ctx).reduce((sum, c) => sum + chargeWeight(c, ctx), 0);
}

/** The whole reading of one loss: verdict, score, and the charges behind it. */
export function houseGrievance(ctx: PilotLossContext): HouseGrievance {
  const charges = houseCharges(ctx);
  const score = charges.reduce((sum, c) => sum + chargeWeight(c, ctx), 0);
  const verdict: HouseVerdict =
    score >= HOUSE_ESTRANGED_AT ? "estranged" : score >= HOUSE_AGGRIEVED_AT ? "aggrieved" : "honoured";
  return { verdict, score, charges };
}
