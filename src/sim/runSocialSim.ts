// src/sim/runSocialSim.ts
// Headless background social-sim harness — Maxime's "irl sim to test the
// social engine" request, resolved via AskUserQuestion (26 Aug 2026) into
// the cheap, off-screen version first (this file + engine/socialSim.ts),
// full live-Hub-visual NPC-to-NPC as an acknowledged future goal, kids
// split off into their own future doc entirely. `npm run sim:social` (or
// `npm run sim:social -- 30` for a 30-day run).
//
// Mirrors src/sim/run.ts's own conventions on purpose (see that file's own
// header): a plain Node/tsx script, no Phaser, prints a readable log, exits
// clean. Where run.ts drives one Mission turn-by-turn, this drives N
// simulated Hub days, one encounter each, via engine/socialSim.ts's pure
// simulateDay().
//
// Also exercises the real persistence path end-to-end, not just the pure
// sim logic in isolation: builds a real CampaignState, seeds it through
// ensureNpcSocialState/ensureHubSocialState exactly the way Hub.ts's own
// buildNpcs()/create() do, runs the N days against that live state, then
// saves and reloads it through campaignState.ts's real save/load functions
// (in-memory storage, same technique the vitest suite's own
// campaignState.test.ts uses — no browser localStorage under plain Node)
// to prove a day's worth of bond movement actually survives a save/load
// round-trip, not only that the pure functions compute the right numbers.
import {
  createWardenCampaignState,
  ensureNpcSocialState,
  ensureHubSocialState,
  saveCampaignState,
  loadCampaignState,
  type CampaignStorage,
} from "../engine/campaignState";
import { simulateDay, type SocialSimPilot } from "../engine/socialSim";
import { NPC_SEED, NPC_BOND_SEED } from "../data/npcSeed";
import { findPilot } from "../data/pilotRegistry";
import { stageFromTier } from "../data/ambientLines";

// In-memory Storage stand-in — same shape/reasoning as
// campaignState.ts's own CampaignStorage interface comment: real
// localStorage doesn't exist under plain Node, and this script needs a
// real save/load round-trip, not just a mocked-away no-op.
function memoryStorage(): CampaignStorage {
  const backing = new Map<string, string>();
  return {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => void backing.set(key, value),
    removeItem: (key) => void backing.delete(key),
  };
}

const days = Number(process.argv[2]) || 20;
const storage = memoryStorage();

const state = createWardenCampaignState();

// Seed exactly the way Hub.ts's create()/buildNpcs() do: ensureHubSocialState
// per pilot (so playerCommitted below reflects the real, persisted
// inRelationship flag, not a fresh guess), ensureNpcSocialState once for
// the shared bond store.
const roster: SocialSimPilot[] = NPC_SEED.map((seed) => {
  ensureHubSocialState(state, seed.pilotId, { favorability: seed.favorability, stress: seed.stress, morale: seed.morale });
  const pilot = findPilot(seed.pilotId);
  // Stage, wired 27 Aug 2026 alongside the live Hub — this headless sim
  // never runs any tier-upgrade logic, so the tier (and therefore Stage)
  // stays fixed at the campaign's starting value for the whole run, same
  // as every other static seed value here.
  const stage = pilot ? stageFromTier(pilot.tier) : "green";
  return { pilotId: seed.pilotId, displayName: pilot?.displayName ?? seed.pilotId, catalyst: seed.catalyst, stage };
});
const socialState = ensureNpcSocialState(state, NPC_BOND_SEED);

// Static across this whole run — nothing in this sim ever proposes a
// player/NPC Ask Out (that's the live Hub's own askOut(), unchanged), so
// there's nothing here that could flip an inRelationship flag mid-run.
const playerCommitted = new Set(
  roster.filter((p) => state.pilots[p.pilotId]?.social?.inRelationship).map((p) => p.pilotId)
);

console.log(`=== Background social sim — ${days} simulated day${days === 1 ? "" : "s"} ===`);
console.log(`Roster: ${roster.map((p) => p.displayName).join(", ")}`);
console.log("");

for (let day = 1; day <= days; day++) {
  console.log(simulateDay(roster, socialState, playerCommitted, day));
}

console.log("");
console.log("=== Final bonds ===");
for (const key of Object.keys(socialState.bonds).sort()) {
  const [idA, idB] = key.split("::");
  const nameA = roster.find((p) => p.pilotId === idA)?.displayName ?? idA;
  const nameB = roster.find((p) => p.pilotId === idB)?.displayName ?? idB;
  const together = socialState.relationships.includes(key) ? " (together)" : "";
  console.log(`  ${nameA} <-> ${nameB}: ${socialState.bonds[key]}${together}`);
}

// Real save -> reload round-trip through campaignState.ts's own functions,
// not just asserting the in-memory object still looks right — the whole
// point of section 12 existing is that this survives a save, and a bug in
// how npcSocial gets (de)serialized wouldn't show up any other way.
saveCampaignState(state, storage);
const reloaded = loadCampaignState(storage);
const reloadedBonds = reloaded?.npcSocial?.bonds;
const roundTripOk = reloadedBonds !== undefined && JSON.stringify(reloadedBonds) === JSON.stringify(socialState.bonds);
console.log("");
console.log(`Save/load round-trip: ${roundTripOk ? "OK — bonds survived a save and reload intact" : "MISMATCH — see below"}`);
if (!roundTripOk) {
  console.log("  before:", JSON.stringify(socialState.bonds));
  console.log("  after: ", JSON.stringify(reloadedBonds));
  process.exitCode = 1;
}
