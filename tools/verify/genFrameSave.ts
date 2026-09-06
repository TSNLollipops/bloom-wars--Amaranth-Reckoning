// Frame Systems Layer Tier 1 verification (6 Sep 2026) — cloud-sandbox-only
// helper, not part of the shipped game. Builds a save that puts the new
// Frame panel in every state worth looking at: a tier-C Tank with two
// owned branches and points to spend (mounts + BUY + INSTALL), a tier-A
// Meeps ready for a refit, a Wellroot kill already on the books (a salvage
// system unlocked), and everyone else at the thin Act I start.
import { createWardenCampaignState, integrateSecondLance, recordHostileKills } from "../../src/engine/campaignState";
import { writeFileSync } from "fs";

const state = createWardenCampaignState(500);
integrateSecondLance(state);

// Bosk — Tank, tier C: two mounts, Draw 6, owns Grinder Claw + Riot Drum, 2000 pts.
const bosk = state.pilots["pilot_bosk"];
bosk.pilot.tier = "C";
bosk.personalPoints = 2000;
bosk.pilot.ownedWeaponBranches = ["tank_grinder_claw", "tank_riot_drum"];
bosk.pilot.equippedWeaponBranches = ["tank_grinder_claw"];
bosk.pilot.equippedWeaponBranch = "tank_grinder_claw";

// Rourke — Meeps, tier A: refit unlocked, 999 pts, Runemaster loadout (no salvage surcharge).
const rourke = state.pilots["pilot_rourke"];
rourke.pilot.tier = "A";
rourke.personalPoints = 999;

// One Wellroot on the books — Wellroot Filament is buyable, Heartwood Graft stays hidden (never spawns in Warden).
recordHostileKills(state, { bloom_wellroot: 1, bloom_crawlmass: 12 });

writeFileSync(new URL("./frame_save.json", import.meta.url), JSON.stringify(state));
console.log("frame_save.json written —", Object.keys(state.pilots).length, "pilots");
