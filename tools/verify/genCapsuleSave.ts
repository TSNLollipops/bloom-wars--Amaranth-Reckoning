// One-off, sandbox-only (15 Sep 2026, ejection capsules): a fresh Warden
// save for checkEjectionCapsules.mjs. Nothing special in it; the Debrief's
// RECRUIT/RANSOM buttons are checked against its points and roster.
import { createWardenCampaignState, ensureNpcSocialState } from "../../src/engine/campaignState";
import { NPC_BOND_SEED } from "../../src/data/npcSeed";
import { writeFileSync } from "fs";

const state = createWardenCampaignState(200);
ensureNpcSocialState(state, NPC_BOND_SEED);
writeFileSync(new URL("./capsuleSave.json", import.meta.url), JSON.stringify(state));
console.log("wrote capsuleSave.json —", Object.keys(state.pilots).length, "pilots,", state.points, "points");
