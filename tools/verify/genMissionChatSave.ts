// One-off, cloud-sandbox-only helper (12 Sep 2026) for checkMissionChat.mjs.
// A full 15-pilot roster — the Act I five plus every authored 2nd/3rd
// Lance candidate recruited through the real recruitIntoLance() — so the
// Battle HUD relayout is screenshotted at the roster size that broke the
// Transporter Pad once already, on the two dimension-extreme maps.
import { createWardenCampaignState, recruitIntoLance, ensureNpcSocialState, ensureHubSocialState, type LanceId } from "../../src/engine/campaignState";
import { WARDEN_FACILITY } from "../../src/engine/facilityWarden";
import { writeFileSync } from "fs";

const state = createWardenCampaignState(500);
for (const lance of ["b", "c"] as LanceId[]) {
  for (let i = 0; i < 5; i++) {
    const r = recruitIntoLance(state, lance);
    if (!r.ok) throw new Error(`recruit into ${lance} failed: ${r.reason}`);
  }
}
state.npcSocial = ensureNpcSocialState(state);
// Prime the three regulars' social state from the facility's own seed, the
// way a first Hub visit would — so the live check can assert favor deltas
// against a real "before" instead of a missing one.
for (const r of WARDEN_FACILITY.regulars) ensureHubSocialState(state, r.pilotId, { favorability: r.favorability, stress: r.stress, morale: r.morale });
writeFileSync(new URL("./missionchat_save.json", import.meta.url), JSON.stringify(state));
console.log("pilots:", Object.keys(state.pilots).length, Object.keys(state.pilots).join(", "));
