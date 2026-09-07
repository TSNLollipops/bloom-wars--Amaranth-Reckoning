// House Amaranth counterpart to genSave.ts — 6 Sep 2026, House Amaranth Hub
// build, step 5. genSave.ts is Warden-only (the audit gap log's own
// finding); checkHubHouseAmaranth.mjs needs a save that baseSceneKeyFor
// routes to "HubHouseAmaranth", i.e. one with pilot_marrow in it. Same
// midgame shape as genSave.ts (both later lances integrated so the estate's
// second and third Barracks / Cultivar Works have a reason to exist, a
// spread of personal points so the long shop strings are on screen).
// Writes save_house_amaranth.json next to this file; not committed.
import {
  createHouseAmaranthCampaignState,
  integrateHouseAmaranthSecondLance,
  integrateHouseAmaranthThirdLance,
  ensureNpcSocialState,
} from "../../src/engine/campaignState";
import { HOUSE_AMARANTH_NPC_BOND_SEED } from "../../src/data/npcSeedHouseAmaranth";
import { writeFileSync } from "fs";

const state = createHouseAmaranthCampaignState(500);
integrateHouseAmaranthSecondLance(state);
integrateHouseAmaranthThirdLance(state);
state.npcSocial = ensureNpcSocialState(state, HOUSE_AMARANTH_NPC_BOND_SEED);
const pilotIds = Object.keys(state.pilots);
pilotIds.forEach((id, i) => {
  state.pilots[id].personalPoints = [1234, 480, 96, 2750, 610][i % 5];
});
if (pilotIds.length) state.pilots[pilotIds[0]].personalPoints = 999999;

writeFileSync(new URL("./save_house_amaranth.json", import.meta.url), JSON.stringify(state));
console.log("House Amaranth pilots:", pilotIds.length, "| MC:", state.pilots["pilot_marrow"] ? "pilot_marrow present" : "MISSING");
