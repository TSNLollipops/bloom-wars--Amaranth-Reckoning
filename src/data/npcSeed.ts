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
import { HOUSE_AMARANTH_NPC_SEED } from "./npcSeedHouseAmaranth";
import { deriveCatalyst } from "./background";
import type { PilotBackground } from "./types";

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
  // 13 Sep 2026: brought down from 78 (Maxime's call — the Emotional Brain
  // build gave Stress real mechanical teeth on 12 Sep, and 78 sat 8 points
  // past STRESS_PANIC_THRESHOLD with no Check-In feature yet built to give a
  // player any way to bring him back down; the 10-seed brain-sim harness
  // showed him pinned at 100 by mission 2 in 7 of 10 runs. 58 keeps him the
  // clearly most-stressed of the three regulars (Iyari's next at 40) and
  // close enough to the line that a rough mission or two still tips him
  // over it, without shipping a pilot nothing the player does can help.
  { pilotId: "pilot_anand", catalyst: "wolf", stress: 58, morale: 60, drunk: false, favorability: 10 },
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

// catalystForPilot — added 28 Aug 2026, Grief Catalyst live port
// (claude_Bloom_Wars_Grief_Catalyst_Port_Spec_v1.pdf). A real, previously-
// unflagged gap surfaced while building that port: NPC_SEED above only
// covers three named pilots, plus scenes/Hub.ts hardcodes the CO's own
// catalyst ("bear") separately. Every other roster pilot — Rourke, Lask,
// every Second/Third Lance pilot, every generated recruit — has no
// catalyst assigned anywhere, which is a hard requirement for
// pickSoloEcho/pickAmbientLine (ambientLines.ts). Grief Catalyst needs a
// catalyst for WHOEVER was on the deployed squad, not just the three
// pilots this file happens to name, so leaving the gap unclosed would mean
// most mourners simply couldn't get a line.
//
// Not re-asked about — this is a small, mechanical extension of an
// existing lookup (give every pilot a catalyst, the way every pilot
// already has a Stage), not a new system or a content decision worth
// blocking on. Flagged plainly in the delivery note instead: named-pilot
// catalysts stay hand-picked (NPC_SEED, above) exactly where they already
// are; anyone not in that list gets a stable, deterministic pick derived
// from their own pilotId, so the same pilot always reads the same
// catalyst across a save (no re-roll on reload) without hand-authoring a
// row for every recruit that will ever exist. Placeholder assignments,
// same caveat as NPC_SEED's own catalyst picks above — worth a real pass
// once catalysts for the wider roster get decided for real.
const ALL_CATALYSTS: Catalyst[] = ["wolf", "dog", "cat", "crow", "raven", "bear", "fox", "rabbit", "shark"];

// BACKGROUND_CATALYST_ASSIGNMENTS — added 1 Sep 2026, wiring in
// claude_Bloom_Wars_NPC_Catalyst_Formula_Closing_And_Roster_Assignments_v1.md.
// That document closes the gap this file's own header left open above:
// background (Sector/Planet/Birthplace Texture/Academy, resolved through
// Background_Zones_v1 §6's Zone × Pressure → Planet-12 table) now DRIVES
// catalyst for every named pilot and Mek, rather than the two being
// independent picks. This map is that document's full §4 roster table
// (49 entries, minus the CO — his catalyst is hardcoded directly at his
// own HubNpc push in Hub.ts, not looked up through catalystForPilot, so he
// isn't listed here).
//
// Two different kinds of entry, on purpose, both kept rather than trimmed
// to only what's "live," so this map is the single complete record the
// roster doc's table maps to:
//
// - FRESH entries (§4.1 Warden pilots, §4.2 House Amaranth pilots, §4.6
//   House Amaranth Meks — 26 total) are real, previously-unassigned picks.
//   These change live behavior: before this map existed, every one of
//   these ids fell through to the deterministic hash fallback below.
// - REVERSE-FIT entries (§4.4's 7 pilots, §4.5's 15 Warden Meks — 22
//   total) are inert here. The 7 pilots are already caught by NPC_SEED or
//   HOUSE_AMARANTH_NPC_SEED above, both checked before this map. The 15
//   Warden Meks are already hardcoded at their own call sites in Hub.ts
//   (mekSeeds' seed.catalyst, and MEK_CATALYST_OVERRIDES), which take
//   precedence over calling catalystForPilot() at all for those five, or
//   are checked ahead of it for the other ten. Every value below matches
//   what's already live — see the roster doc's own §3 for why reverse-fit
//   existed in the first place (protecting catalysts real shipped dialogue
//   already depends on).
export const BACKGROUND_CATALYST_ASSIGNMENTS: Record<string, Catalyst> = {
  // --- Warden Company pilots — fresh backgrounds, roster doc §4.1 (11) ---
  pilot_lask: "wolf",
  pilot_okafor: "bear",
  pilot_solheim: "shark",
  pilot_tarrant: "fox",
  pilot_vashti: "crow",
  pilot_reyes: "cat",
  pilot_kova: "bear",
  pilot_ness: "wolf",
  pilot_onwuka: "shark",
  pilot_delgado: "raven",
  pilot_yeun: "rabbit",

  // --- House Amaranth pilots — fresh backgrounds, roster doc §4.2 (5) ---
  pilot_kessler: "wolf",
  pilot_vantana: "raven",
  pilot_reyken: "cat",
  pilot_solano: "bear",
  pilot_marrin: "crow",

  // --- House Amaranth Meks — fresh backgrounds, roster doc §4.6 (10) ---
  mek_marrow: "shark",
  mek_vondra: "fox",
  mek_meir: "crow",
  mek_bray: "dog",
  mek_orin: "wolf",
  mek_kessler: "fox",
  mek_vantana: "bear",
  mek_reyken: "rabbit",
  mek_solano: "cat",
  mek_marrin: "dog",

  // --- Reverse-fit pilots, roster doc §4.4 (7) — inert, see header above ---
  pilot_bosk: "raven",
  pilot_anand: "wolf",
  pilot_iyari: "crow",
  pilot_vondra: "raven",
  pilot_meir: "wolf",
  pilot_bray: "bear",
  pilot_orin: "rabbit",

  // --- Reverse-fit Warden Meks, roster doc §4.5 (15) — inert, see header above ---
  mek_rourke: "raven",
  mek_bosk: "bear",
  mek_iyari: "fox",
  mek_anand: "dog",
  mek_lask: "rabbit",
  mek_okafor: "bear",
  mek_solheim: "dog",
  mek_tarrant: "crow",
  mek_vashti: "rabbit",
  mek_reyes: "cat",
  mek_kova: "wolf",
  mek_ness: "bear",
  mek_onwuka: "crow",
  mek_delgado: "fox",
  mek_yeun: "rabbit",

  // --- House Amaranth Third Lance, Catalyst_Gauntlet_v2 §4.1/§4.2 (10) ---
  // Added 9 Sep 2026. The Gauntlet doc (7 Sep) derived these ten from
  // real backgrounds and data/__tests__/background.test.ts has re-derived
  // them ever since — but the ids were never added HERE, so on a live save
  // all ten fell through to the hash below (mek_thorne read "cat" on the
  // Workshop floor while his pilot's Archive file says Wolf). Caught by
  // the Mek dossier's own consistency test the day Meks got a file of
  // their own; the values are the doc's, not new picks.
  pilot_thorne: "crow",
  pilot_amsel: "crow",
  pilot_kastan: "shark",
  pilot_osei: "fox",
  pilot_dunmore: "shark",
  mek_thorne: "wolf",
  mek_amsel: "rabbit",
  mek_kastan: "raven",
  mek_osei: "shark",
  mek_dunmore: "crow",
};

export function catalystForPilot(pilotId: string, background?: PilotBackground): Catalyst {
  const seeded = NPC_SEED.find((s) => s.pilotId === pilotId);
  if (seeded) return seeded.catalyst;
  // House Amaranth's own hand-picked cast (data/npcSeedHouseAmaranth.ts) —
  // a second, separate seed list, not merged into NPC_SEED itself (see
  // that file's own header for why: NPC_SEED is also Hub.ts's live Rec
  // Room NPC *position* seed, which House Amaranth has no Hub scene to
  // populate yet).
  const houseAmaranthSeeded = HOUSE_AMARANTH_NPC_SEED.find((s) => s.pilotId === pilotId);
  if (houseAmaranthSeeded) return houseAmaranthSeeded.catalyst;
  // Background→catalyst formula, 1 Sep 2026 (see BACKGROUND_CATALYST_ASSIGNMENTS'
  // own header just above) — checked after both hand-seeded lists (which
  // stay authoritative for the three-plus-four named pilots they already
  // cover) and before the hash fallback, so every other named pilot/Mek
  // this map lists now gets their real, background-derived catalyst
  // instead of an arbitrary stable pick.
  const backgroundAssigned = BACKGROUND_CATALYST_ASSIGNMENTS[pilotId];
  if (backgroundAssigned) return backgroundAssigned;
  // Recruit generator, 9 Sep 2026 (Catalyst_Gauntlet_v2_ThirdLance_
  // Verinis_Recruits.md §5 item 4: "catalystForPilot gains one step
  // between BACKGROUND_CATALYST_ASSIGNMENTS and the hash: if the record
  // carries a background, derive"). `background` is optional and comes
  // from the caller's own PilotRecord/MekArchetype — every call site with
  // one in scope now passes it (engine/campaignState.ts's generatePilot is
  // the only thing that sets one today), so a generated recruit's live
  // ambient dialogue, grief lines, standings row, and Codex dossier all
  // derive and show the exact same catalyst instead of silently
  // disagreeing with each other.
  if (background) return deriveCatalyst(background);
  // Simple deterministic string hash (djb2-ish) — not cryptographic, just
  // stable and spread out enough that adjacent recruit ids (pilot_recruit_1,
  // pilot_recruit_2, ...) don't all land on the same catalyst. Still the
  // fallback for anyone not in any of the three lists above AND with no
  // background passed in — a future lance, or a generated pilot/Mek whose
  // caller didn't have a background handy to pass (an old save predating
  // 9 Sep 2026, say).
  let hash = 5381;
  for (let i = 0; i < pilotId.length; i++) {
    hash = (hash * 33 + pilotId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % ALL_CATALYSTS.length;
  return ALL_CATALYSTS[index];
}
