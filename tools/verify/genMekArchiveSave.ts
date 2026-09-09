// One-off, sandbox-only (9 Sep 2026): a midgame Warden save with one
// generated recruit (so a generated Mek with a pool name is on the shelf),
// one pilot permanently lost (so a retired Mek is in the struck group),
// and one Mek with a real persisted mood, for the Archive Mek-dossier check.
import { createWardenCampaignState, integrateSecondLance, integrateThirdLance, ensureNpcSocialState, ensureHubSocialState, recruitDiscretionary, DISCRETIONARY_RECRUIT_COST } from "../../src/engine/campaignState";
import { writeFileSync } from "fs";

const state = createWardenCampaignState(DISCRETIONARY_RECRUIT_COST * 2);
integrateSecondLance(state);
integrateThirdLance(state);
state.npcSocial = ensureNpcSocialState(state);
const r = recruitDiscretionary(state, "reeps");
if (!r.ok) throw new Error(r.reason ?? "recruit failed");
state.pilots["pilot_anand"].status = "permanently_lost";
state.pilots["pilot_anand"].hasChildWithMek = true;
const mood = ensureHubSocialState(state, "mek_iyari", { favorability: 0, stress: 10, morale: 70 });
mood.stress = 58; mood.morale = 33; mood.favorability = 21;
state.lastMissionEcho = { missionId: "mission_amaranth_6" } as never;
writeFileSync(new URL("./mekArchiveSave.json", import.meta.url), JSON.stringify(state));
console.log("pilots:", Object.keys(state.pilots).length, "meks:", Object.keys(state.meks).length, "recruit mek:", state.meks[r.pilot!.mekId].displayName);
