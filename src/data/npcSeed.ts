// src/data/npcSeed.ts
// Moved out of scenes/Hub.ts, 26 Aug 2026, as part of building the
// background social-sim harness (engine/socialSim.ts, src/sim/runSocialSim.ts).
// Content is unchanged from what Hub.ts seeded locally — only the location
// moved, from a scene-local `const` to a real, pure data/ export.
//
// Why this moved: the sim harness needs the exact same catalyst/roster
// data Hub.ts already seeds its NPCs from, so a bond value seeded here
// matches the one the live Hub scene shows. The sim runs as a headless
// Node script (src/sim/runSocialSim.ts, via tsx — no browser, no DOM), and
// scenes/Hub.ts opens with `import Phaser from "phaser"` and extends
// Phaser.Scene, so importing NPC_SEED/NPC_BOND_SEED directly from that file
// would drag Phaser's browser-oriented setup into a plain Node process —
// not something to risk for two constants. Pulling them out into this
// data/ file (which src/data's own ESLint rule — Build Brief §5.2 — already
// keeps pure and build-time-only) lets scenes/Hub.ts, engine/socialSim.ts,
// and src/sim/runSocialSim.ts all import the same values with zero risk of
// the two ever drifting apart, which was the whole point (see
// engine/socialSim.ts's own header on avoiding "a second, uncoordinated set
// of placeholder numbers").
import { pairKey } from "./npcBonds";
import type { Catalyst } from "./ambientLines";

// Placeholder catalyst/state picks for the three seeded Rec Room NPCs —
// not a locked content decision, just enough to prove the state-driven
// ambient system out with real names instead of the spike's throwaway
// lines. Bosk = raven fits the mentor read already on record for him
// (data/campaignAmaranth.ts's own WARDEN_MEKS comment: "Bosk (the mentor,
// holds the line)"). Anand = wolf leans on "Farsight"/squad's-eyes framing
// — wolf's own line bank is built around watching over the pack. Iyari =
// crow leans on her "young, aggressive" read (same file's own WARDEN_MEKS
// comment) — crow's bank is restless/impulsive, not a callback to her
// "Foxfire" callsign. Flagged as placeholder picks, worth a real pass
// whenever named-pilot catalysts get decided for real (Character Editor
// doc §1: "named pilots stay hand-assigned... still open").
//
// romanceable used to be hand-set true for all three seats here — wrong.
// Iyari (arch_meeps_centauroid) IS Hiopi per units.ts's UNIT_ARCHETYPES,
// caught and fixed 26 Aug 2026 (romance.ts's own header has the full
// story). Not tracked on this seed — Hub.ts's buildNpcs() derives it for
// real from WARDEN_PILOTS' archetype species instead, so this exact bug
// (a hand-set flag silently disagreeing with canon) can't recur. Bosk is
// human (arch_tank_bipedal), Anand is Osnian (arch_reeps_vibrissal) — both
// stay MC-romanceable; Iyari caps at close-friend/bromance.
export const NPC_SEED: { pilotId: string; catalyst: Catalyst; stress: number; morale: number; drunk: boolean; favorability: number }[] = [
  { pilotId: "pilot_bosk", catalyst: "raven", stress: 30, morale: 75, drunk: false, favorability: 35 },
  { pilotId: "pilot_anand", catalyst: "wolf", stress: 78, morale: 60, drunk: false, favorability: 10 },
  { pilotId: "pilot_iyari", catalyst: "crow", stress: 40, morale: 68, drunk: false, favorability: -5 },
];

// Phase 3 piece three — pairwise NPC-to-NPC bonds (npcBonds.ts's own
// header covers why this is a genuinely separate axis from
// HubNpc.favorability, which only ever tracks a pilot's standing with the
// PLAYER). Values picked for real texture, not tuned: Bosk/Anand read as a
// real mentor-and-mentee bond (Bosk's own raven/mentor catalyst read
// already on record, Anand's high seeded Stress giving him real reason to
// lean on someone); Bosk/Iyari is mild and untested; Anand/Iyari is real
// friction — gives an actual clique (Bosk+Anand) and an actual
// held-at-arm's-length pair (Anand/Iyari) to demonstrate, not three
// identical neutral values.
//
// Historically seeded once and held fixed, never evolving from real events
// (npcBonds.ts's own header flagged this as a known gap). As of 26 Aug
// 2026 that's exactly what engine/socialSim.ts + campaignState.ts section
// 12 (NpcSocialState) close: this constant is now only the STARTING value
// for a fresh save — ensureNpcSocialState(state, NPC_BOND_SEED) seeds a
// CampaignState's persistent npcSocial.bonds from this the first time it's
// asked for, and every value moves from there via real simulated/live
// events, same as CampaignPilotEntry.pilot.tier vs. the static PilotRecord
// row it started from (campaignState.ts's own file header).
export const NPC_BOND_SEED: Record<string, number> = {
  [pairKey("pilot_bosk", "pilot_anand")]: 40,
  [pairKey("pilot_bosk", "pilot_iyari")]: 5,
  [pairKey("pilot_anand", "pilot_iyari")]: -25,
};
