// src/data/npcSeedHouseAmaranth.ts
// House Amaranth's own personalized-line data — see design/
// Bloom_Wars_House_Amaranth_Personalized_Line_Plan_v1.md (31 Aug 2026) for
// the full reasoning behind every catalyst/bond pick below.
//
// Deliberately a SEPARATE file from data/npcSeed.ts's own NPC_SEED/
// NPC_BOND_SEED, not more rows appended to those two constants. Those two
// aren't purely generic data — scenes/Hub.ts's buildNpcs() specifically
// walks NPC_SEED to seed the three hand-placed Rec Room regulars' live Hub
// POSITIONS (see that function's own `namedSeed`/`positions` lookup), so
// merging House Amaranth pilots into that same array would bleed into
// Warden's own live Hub scene for no reason. This file carries: catalyst
// picks (consumed by data/npcSeed.ts's own catalystForPilot, extended to
// check this file too), NPC-to-NPC bonds (consumed by data/npcBonds.ts's
// clique/rivalry math and engine/campaignState.ts's ensureNpcSocialState,
// both pure functions that take a bonds Record as an argument rather than
// reading a hardcoded global), and — since 6 Sep 2026, when the House
// Amaranth Hub scene arrived (scenes/Hub.ts running engine/
// facilityHouseAmaranth.ts's profile) — the three Longhouse regulars' own
// starting favorability/stress/morale, HOUSE_AMARANTH_REGULARS below. Those
// three values were deliberately left out of this file until a scene
// existed to display them; it exists now. Hub.ts never reads this file
// directly: the facility profile maps these rows into its own `regulars`
// and `bondSeed`, which is what closes the position-bleed problem above for
// good (Build Plan §3, "NPC_SEED positions bleed").
import type { Catalyst } from "./ambientLines";
import { pairKey } from "./npcBonds";

// Marrow IS in this list, unlike Rourke in Warden's own NPC_SEED —
// npcSeed.ts's own catalystForPilot comment flags Rourke's missing
// catalyst as "a real, previously-unflagged GAP," not a deliberate design
// choice to exclude the MC. No reason to reproduce a known gap here when
// the plan doc already reasoned through a real pick for her (dog —
// loyalty is her whole arc, campaign plan §4). House Amaranth's MC gets a
// hand-picked catalyst from day one; closing Rourke's own equivalent gap
// is a separate, un-asked-for task, not done here.
export const HOUSE_AMARANTH_NPC_SEED: { pilotId: string; catalyst: Catalyst }[] = [
  { pilotId: "pilot_marrow", catalyst: "dog" },
  { pilotId: "pilot_vondra", catalyst: "raven" },
  { pilotId: "pilot_meir", catalyst: "wolf" },
  { pilotId: "pilot_bray", catalyst: "bear" },
  { pilotId: "pilot_orin", catalyst: "rabbit" },
];

// Six pairs across four pilots — one real clique (Vondra/Meir, mentor and
// mentee, mirrors Warden's own Bosk/Anand 40), one real friction pair
// (Meir/Bray, mirrors Anand/Iyari's -25), the rest mild-to-warm. See the
// plan doc for the per-pair reasoning.
export const HOUSE_AMARANTH_NPC_BOND_SEED: Record<string, number> = {
  [pairKey("pilot_vondra", "pilot_meir")]: 35,
  [pairKey("pilot_meir", "pilot_orin")]: 20,
  [pairKey("pilot_vondra", "pilot_orin")]: 15,
  [pairKey("pilot_bray", "pilot_orin")]: 10,
  [pairKey("pilot_vondra", "pilot_bray")]: 10,
  [pairKey("pilot_meir", "pilot_bray")]: -20,
};

// The three Longhouse regulars — seated at the game table on a fresh Hub
// load, the way Bosk/Anand/Iyari are in Warden's Rec Room (npcSeed.ts's
// NPC_SEED). Seat order matters: it indexes the facility's recroomSeats
// ring. Vondra, Meir and Bray sit; Orin roams (the mockup's own call —
// the youngest, the one who can't sit still). The starting values are
// PLACEHOLDERS, same "not a locked content decision" footing NPC_SEED's
// own carry, shaped to the bonds above: Vondra steady and warm toward the
// new Colonel, Meir carrying real stress under the mentorship, Bray the
// friction pair reading cool. Catalysts repeat HOUSE_AMARANTH_NPC_SEED's
// so catalystForPilot and the seated row can never disagree.
export const HOUSE_AMARANTH_REGULARS: { pilotId: string; catalyst: Catalyst; favorability: number; stress: number; morale: number }[] = [
  { pilotId: "pilot_vondra", catalyst: "raven", favorability: 30, stress: 25, morale: 78 },
  { pilotId: "pilot_meir", catalyst: "wolf", favorability: 10, stress: 55, morale: 65 },
  { pilotId: "pilot_bray", catalyst: "bear", favorability: -5, stress: 45, morale: 60 },
];
