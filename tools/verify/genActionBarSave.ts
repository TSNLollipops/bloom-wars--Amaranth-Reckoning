// One-off, cloud-sandbox-only helper (3 Sep 2026) for verifying the Battle
// action bar's MORE paging (engine/actionBarPaging.ts). Same shape as
// genVaultSave.ts: a midgame roster, then one recruited Heirloom — here
// "last_word" (Migawari / Osric Ferrow, Munti path), whose three-ability
// kit is one of the two that push a Munti past six action-bar buttons.
//
// Unlike genVaultSave.ts this one FIELDS the Heirloom, because an unfielded
// one grants no combat abilities at all and the whole point here is a unit
// whose kit does not fit the bar.
//
// Prints the holder's id, archetype and the abilities that will actually
// reach the bar, so the live check can assert against real numbers rather
// than assumed ones.
import { createWardenCampaignState, integrateSecondLance, integrateThirdLance, ensureNpcSocialState } from "../../src/engine/campaignState";
import { recruitHeirloom, fieldHeirloom } from "../../src/engine/heirlooms";
import { UNIT_ARCHETYPES } from "../../src/data/units";
import { HEIRLOOMS } from "../../src/data/heirlooms";
import { writeFileSync } from "fs";

const state = createWardenCampaignState(2000);
integrateSecondLance(state);
integrateThirdLance(state);
state.npcSocial = ensureNpcSocialState(state);

const result = recruitHeirloom(state, "last_word");
if (!result.ok || !result.pilot) throw new Error("recruitHeirloom(last_word) failed: " + result.reason);
const holderId = result.pilot.id;

const fielded = fieldHeirloom(state, "last_word");
if (!fielded.ok) throw new Error("fieldHeirloom(last_word) failed: " + fielded.reason);

// PilotRecord is nested under the roster entry (`{ pilot, status,
// personalPoints }`), not the entry itself — worth spelling out, because
// reading it as flat is how the first version of this script printed
// "undefined" for every field and still exited 0.
const record = state.pilots[holderId];
const arch = UNIT_ARCHETYPES[record.pilot.archetypeId];
console.log("holder:", holderId, record.pilot.displayName);
console.log("archetype:", record.pilot.archetypeId, "archetype verbs:", (arch?.abilities ?? []).join(", "));
console.log("heirloom kit:", HEIRLOOMS["last_word"].abilities.map((a) => a.id).join(", "));
console.log("fielded:", state.heirlooms?.fielded, "assigned:", JSON.stringify(state.heirlooms?.assignedPilotId));

writeFileSync(new URL("./actionbar_save.json", import.meta.url), JSON.stringify(state));
