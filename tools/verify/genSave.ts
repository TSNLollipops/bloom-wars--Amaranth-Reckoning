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
// Personal points, 3 Sep 2026 — the audit's SECOND blind spot, and the
// other half of why the 28-screen sweep could not have caught the Hangar
// Shop clipping Maxime found in a phone photo on 4 Sep.
//
// Fixing auditUiText.mjs to measure against a scene's real camera viewport
// rather than the canvas was necessary but not sufficient: this save had
// every pilot at 0 personal points, so the shop's own longest strings
// ("CONVERT ALL (1,234 -> 617)", a six-figure balance) never existed on
// screen for the audit to measure. A layout audit run against uniformly
// short labels is an audit of a screen nobody plays.
//
// Varied on purpose rather than a flat number: a realistic midgame spread,
// plus one deliberately extreme balance, so both the ordinary case and the
// widest string the UI can ever be asked to render are on screen at once.
const pilotIds = Object.keys(state.pilots);
pilotIds.forEach((id, i) => {
  state.pilots[id].personalPoints = [1234, 480, 96, 2750, 610][i % 5];
});
if (pilotIds.length) state.pilots[pilotIds[0]].personalPoints = 999999;

writeFileSync(new URL("./save.json", import.meta.url), JSON.stringify(state));
console.log("pilots:", Object.keys(state.pilots).length, "| personalPoints seeded, max:", Math.max(...pilotIds.map((id) => state.pilots[id].personalPoints)));
