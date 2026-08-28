// src/engine/griefCatalyst.ts
// Grief Catalyst — live port, 28 Aug 2026. The mechanic itself was already
// built and proven out in the design sandbox (claude/pilot_creator.html) —
// see claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md §13.2 — this is porting a
// working formula into the real TypeScript engine, not designing a new one.
// Source: claude_Bloom_Wars_Grief_Catalyst_Port_Spec_v1.pdf, item 2 of the
// Antfarm Réalisation plan's Phase 1 gate and item #21d of
// Bloom_Wars_Social_Sim_Roadmap_v1.md.
//
// On a true loss (permadeath, no restock available — Mission.permanentLosses,
// applied in scenes/Debrief.ts before this runs), the deployed squad
// mourns. The spec's own literal wording ("mourners = the survivor + every
// pilot with an existing bond to the lost pilot") got widened by Maxime's
// explicit call, 28 Aug 2026, in response to being asked directly: mourners
// are the WHOLE squad that was deployed on the mission, minus anyone this
// same mission already took — not narrowed to just the ones who happened to
// already have a bond on file. A real, deliberate generalization of the
// spec, worth recording here as well as in the delivery note, since it
// changes what the PDF actually said.
//
// The bond-shift half is unchanged from the spec: only a PAIR of mourners
// that already has a real bond gets shifted (lazy-init respected — no bond
// invented from nothing just because two people were on the same mission).
// ECHO_BOND_LEAN's values and the ×4 scale are copied verbatim from the
// spec (§4: "nothing about the ECHO_BOND_LEAN formula/constants should be
// changed — this is a port of a working formula, not a redesign") — do not
// retune these here.
import type { CampaignState } from "./campaignState";
import { ensureHubSocialState, ensureNpcSocialState } from "./campaignState";
import { pairKey } from "../data/npcBonds";
import { pickAmbientLine, stageFromTier, type AmbientPilotState, type Echo } from "../data/ambientLines";
import { catalystForPilot, NPC_BOND_SEED } from "../data/npcSeed";

/** love/sadness lean a bonded pair together; fear/anger lean them apart. Verbatim from the spec — see file header. */
export const ECHO_BOND_LEAN: Record<Echo, number> = {
  love: 2,
  sadness: 1,
  fear: -1,
  anger: -2,
};

/** Applied to the summed per-pair lean (range -4..+4) — roughly -16..+16 per the spec. */
export const ECHO_BOND_SCALE = 4;

export interface GriefMournerLine {
  pilotId: string;
  displayName: string;
  line: string;
  echo: Echo;
}

export interface GriefBondShift {
  pairKey: string;
  pilotIdA: string;
  pilotIdB: string;
  delta: number;
  newValue: number;
}

export interface GriefCatalystResult {
  lostPilotId: string;
  mourners: GriefMournerLine[];
  bondShifts: GriefBondShift[];
}

/**
 * Call once per entry in Mission.permanentLosses, AFTER the roster-status
 * flip (scenes/Debrief.ts step 1b) has already run for every loss this
 * mission — mourner filtering below relies on that: a pilot lost this same
 * mission already reads status !== "active" by the time this runs, so
 * multiple losses in one mission each get their own grief round against the
 * same (correctly shrunk) survivor list, rather than mourning pilots who
 * are themselves already gone.
 *
 * `deployedPilotIds` is Mission.deployedPilotIds — the full mission squad,
 * not filtered by this function's caller.
 */
export function runGriefCatalyst(state: CampaignState, deployedPilotIds: readonly string[], lostPilotId: string): GriefCatalystResult {
  const mourners = deployedPilotIds.filter((id) => {
    if (id === lostPilotId) return false;
    const entry = state.pilots[id];
    return entry?.status === "active";
  });

  const npcSocial = ensureNpcSocialState(state, NPC_BOND_SEED);

  const mournerLines: GriefMournerLine[] = [];
  const echoByPilot: Record<string, Echo> = {};

  for (const pilotId of mourners) {
    const entry = state.pilots[pilotId];
    if (!entry) continue; // defensive only — deployedPilotIds always names real CampaignPilotEntry ids in practice; see ensureHubSocialState's own fail-open for the matching instinct elsewhere in this file.

    const social = ensureHubSocialState(state, pilotId, { favorability: 0, stress: 0, morale: 0 });
    const stillDrunk = !!social.drunkUntil && social.drunkUntil > Date.now(); // same pattern as scenes/Hub.ts's buildNpcs()

    const ambient: AmbientPilotState = {
      catalyst: catalystForPilot(pilotId),
      stage: stageFromTier(entry.pilot.tier),
      stress: social.stress,
      morale: social.morale,
      drunk: stillDrunk,
      // worried is deliberately left unset: isMissionWorrySignal (Hub.ts)
      // means "crew left behind in the Hub worrying about someone out on a
      // mission" — these pilots WERE the mission, not the ones left behind.
    };
    const { line, pick } = pickAmbientLine(ambient);
    echoByPilot[pilotId] = pick.echo;
    mournerLines.push({ pilotId, displayName: entry.pilot.displayName, line, echo: pick.echo });
  }

  const bondShifts: GriefBondShift[] = [];
  for (let i = 0; i < mourners.length; i++) {
    for (let j = i + 1; j < mourners.length; j++) {
      const idA = mourners[i];
      const idB = mourners[j];
      const key = pairKey(idA, idB);
      // Lazy-init respected: only a pair that already has a real bond on
      // file gets shifted — an own-property check, not a `?? 0` read, so
      // two mourners with no prior bond don't get one invented from grief
      // alone.
      if (!Object.prototype.hasOwnProperty.call(npcSocial.bonds, key)) continue;
      const echoA = echoByPilot[idA];
      const echoB = echoByPilot[idB];
      const delta = (ECHO_BOND_LEAN[echoA] + ECHO_BOND_LEAN[echoB]) * ECHO_BOND_SCALE;
      npcSocial.bonds[key] += delta; // unclamped, same as every other bond mutation in the codebase (npcBonds.ts's own header)
      bondShifts.push({ pairKey: key, pilotIdA: idA, pilotIdB: idB, delta, newValue: npcSocial.bonds[key] });
    }
  }

  return { lostPilotId, mourners: mournerLines, bondShifts };
}
