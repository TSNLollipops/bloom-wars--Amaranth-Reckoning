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
// Carrier Scale-Up Plan v1, Phase 1, 3 Sep 2026 — output path switched from
// a hardcoded absolute path (tied to one specific prior session's own
// sandbox layout, e.g. /mnt/user-data/uploads/bloom-wars/bloom-wars/...)
// to one resolved relative to this file. Whichever cloud sandbox actually
// runs this next almost certainly has a different working directory —
// this always writes save.json next to genSave.ts itself, regardless.
writeFileSync(new URL("./save.json", import.meta.url), JSON.stringify(state));
console.log("pilots:", Object.keys(state.pilots).length);
