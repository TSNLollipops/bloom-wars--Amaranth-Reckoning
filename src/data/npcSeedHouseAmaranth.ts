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
// Warden's own live Hub scene for no reason — there's no HubHouseAmaranth.ts
// yet for these five pilots to walk around in (campaign plan §3c, still
// open). This file only carries what's genuinely generic and safe to wire
// today: catalyst picks (consumed by data/npcSeed.ts's own catalystForPilot,
// extended below to check this file too) and NPC-to-NPC bonds (consumed by
// data/npcBonds.ts's clique/rivalry math and engine/campaignState.ts's
// ensureNpcSocialState, both pure functions that take a bonds Record as an
// argument rather than reading a hardcoded global). Neither array below
// carries stress/morale/drunk/favorability — those are live Hub-UI seed
// values with no meaning until a House Amaranth Hub scene actually exists
// to display them.
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
