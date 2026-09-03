// One-off, cloud-sandbox-only helper (3 Sep 2026) for verifying Vault
// Phase 2 Slice 2 (the field/unfield toggle + live-ability rank shop in
// Hub.ts's renderVault()). Builds on genSave.ts's own midgame roster, then
// recruits "iron_oath" (Vindex / Dame Perrine Castellan) — one of the 5
// Heirlooms with a HEIRLOOM_ABILITIES_LIVE_IN_COMBAT ability
// (oath_iron_word) — funds its holder with enough personal points to
// afford one rank-up, and leaves it UNFIELDED so the live browser check
// can exercise the real field button, not just the unfield one.
import { createWardenCampaignState, integrateSecondLance, integrateThirdLance, ensureNpcSocialState } from "../../src/engine/campaignState";
import { recruitHeirloom } from "../../src/engine/heirlooms";
import { HEIRLOOM_ABILITY_RANK_COST } from "../../src/data/heirlooms";
import { writeFileSync } from "fs";

const state = createWardenCampaignState(500);
integrateSecondLance(state);
integrateThirdLance(state);
state.npcSocial = ensureNpcSocialState(state);

const result = recruitHeirloom(state, "iron_oath");
if (!result.ok || !result.pilot) {
  throw new Error("recruitHeirloom(iron_oath) failed: " + result.reason);
}
const holderId = result.pilot.id;
// Enough for rank 2 (cost 250) with room to spare, so the rank-up button's
// affordability check (`personalPoints >= nextCost`) is genuinely satisfied
// rather than boundary-exact.
state.pilots[holderId].personalPoints = HEIRLOOM_ABILITY_RANK_COST[2]! + 100;

console.log("holder:", holderId, result.pilot.displayName, "personalPoints:", state.pilots[holderId].personalPoints);
console.log("recruited cost:", result.cost, "remaining company points:", state.points);

writeFileSync(new URL("./vault_save.json", import.meta.url), JSON.stringify(state));
