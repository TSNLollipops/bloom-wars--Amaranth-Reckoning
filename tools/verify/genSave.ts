// One-off, cloud-sandbox-only helper for this Playwright verification pass.
// NOT part of the shipped game — generates a realistic midgame save (full
// three-lance roster, matching Tier 3's "15-20+ pilots at midgame" note) so
// the Hub scene can be loaded straight into a state that actually stresses
// NPC roaming/door-hop behavior, instead of the thin 5-pilot Act I start.
import { createWardenCampaignState, integrateSecondLance, integrateThirdLance, ensureNpcSocialState } from "../../src/engine/campaignState";
import { writeFileSync } from "fs";

const state = createWardenCampaignState(500);
integrateSecondLance(state);
integrateThirdLance(state);
state.npcSocial = ensureNpcSocialState(state);
writeFileSync("/home/claude/bloomwars/tools/verify/save.json", JSON.stringify(state));
console.log("pilots:", Object.keys(state.pilots).length);
