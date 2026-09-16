// src/data/demoCap.ts
// Browser-demo mission cap — Business Plan v1 (Bloom_Wars_Business_Plan_v1_11Sep2026.md)
// §2b/§13, decision 1, 11 Sep 2026: the free itch.io browser build shows
// Act I (Warden Company, missions 1-12) plus the Hub; House Amaranth and
// the rest of Warden are "full campaign is on the paid download" instead
// of a playable card. The paid Electron download, and every other build
// (`npm run build`, `npm run dev`, `npm test`), stay fully uncapped.
//
// Read from VITE_DEMO_MISSION_CAP, a Vite-native build-time env var (see
// .env.demo and package.json's "build:demo" script) rather than a
// hardcoded flag or a second copy of the game — the SAME source produces
// either build, capped only by what got baked in at build time via
// `vite build --mode demo`. Vite only loads .env.demo for that specific
// mode, so the ordinary "build"/"electron:build" scripts (mode
// "production", no --mode flag) never see this var at all — that's the
// entire mechanism behind "unset for the Electron build," no extra code
// needed to enforce it.
//
// Pure logic, no Phaser import — same split as engine/audioSettings.ts vs
// scenes/audio/AudioManager.ts. scenes/MapSelect.ts is the only caller of
// the two non-underscored exports below; everything else here exists so
// data/__tests__/demoCap.test.ts can exercise the real decision logic with
// plain arguments instead of stubbing import.meta.env.
import type { CampaignMission } from "./types";

/**
 * Turns the raw env-var string into a cap, or null for "not a demo build."
 * Zero, negative, and unparseable values all fall back to null rather than
 * capping at 0 — a malformed VITE_DEMO_MISSION_CAP should never silently
 * lock every mission in the game, it should just build normally.
 */
export function parseDemoCap(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Undefined in every build except `npm run build:demo` (.env.demo sets it to "12"). */
const RAW_CAP: string | undefined = import.meta.env.VITE_DEMO_MISSION_CAP;

/** null in a normal (uncapped) build; the parsed cap in a demo build. */
export const DEMO_MISSION_CAP: number | null = parseDemoCap(RAW_CAP);

export function isDemoBuild(): boolean {
  return DEMO_MISSION_CAP !== null;
}

/**
 * The demo only ever covers Warden Company (Business Plan §2b never
 * discusses capping House Amaranth — it's simply out of scope). Both
 * sides' CampaignDef ids are the source of truth here rather than a
 * hand-maintained list, per data/allCampaigns.ts's own "amaranth_act*" /
 * "house_amaranth_act*" naming.
 */
function isWardenCampaign(campaignId: string): boolean {
  return campaignId.startsWith("amaranth_act");
}

/** The line shown in place of a mission's briefing when it's demo-locked — see scenes/MapSelect.ts. */
export const DEMO_LOCK_MESSAGE = "Full campaign is on the paid download — this free demo covers Act I.";

/**
 * The cap-aware half of isMissionDemoLocked, parameterized on `cap` so
 * tests can exercise every branch without touching import.meta.env.
 * `chain` is whichever of WARDEN_MISSION_CHAIN / HOUSE_AMARANTH_MISSION_CHAIN
 * data/allCampaigns.ts's own campaign.id-based lookup already picked for
 * this campaign — same chain scenes/MapSelect.ts's progression lock
 * (isMissionUnlocked) checks position against, so "Act I is exactly
 * missions 1-12" and "a cap of 12" line up without MapSelect needing to
 * know anything about chain shape itself.
 */
export function isMissionDemoLockedWithCap(
  cap: number | null,
  campaignId: string,
  chain: readonly CampaignMission[],
  missionId: string
): boolean {
  if (cap === null) return false;
  if (!isWardenCampaign(campaignId)) return true; // House Amaranth: locked outright, regardless of chain position
  const index = chain.findIndex((m) => m.id === missionId);
  if (index < 0) return false; // not this chain's mission — fail open, same convention isMissionUnlocked itself uses for an id it can't place
  return index + 1 > cap;
}

/**
 * Whether a mission's card should be locked for demo reasons — checked
 * ALONGSIDE, not instead of, scenes/MapSelect.ts's own progression lock.
 * A save carried over from the paid build (via the save export/import
 * build, Business Plan §12 decision 5) could otherwise show progression
 * past the cap; the demo cap is a hard content boundary, not a suggestion
 * progression can outrun.
 */
export function isMissionDemoLocked(campaignId: string, chain: readonly CampaignMission[], missionId: string): boolean {
  return isMissionDemoLockedWithCap(DEMO_MISSION_CAP, campaignId, chain, missionId);
}

/**
 * The line shown in the tease panel a locked Act tab opens instead of its
 * mission list — see scenes/MapSelect.ts. Distinct from DEMO_LOCK_MESSAGE
 * above (which explains one already-visible, individually-locked mission
 * card): this is the tab-level tease, Build Brief
 * claude_Bloom_Wars_Build_Brief_TeaseTooltipsStressBar_13Sep2026.md item 1,
 * copy locked by Maxime, transcribed verbatim, not Claude's wording.
 */
/**
 * Ship audit, 16 Sep 2026 — where the tease panel's GET THE FULL GAME
 * button sends a demo player. Empty string = no button (the panel shows
 * text only), so an unset URL never ships a dead link. Fill in once the
 * paid itch.io page has its final address.
 */
export const DEMO_STORE_URL = "";

export const DEMO_TAB_LOCK_MESSAGE = "The war doesn't end at Mission 12. The rest of Warden Company's story is waiting on itch.io.";

/**
 * Whole-tab demo lock — true only when EVERY mission in this campaign/act
 * is demo-locked. Reuses isMissionDemoLockedWithCap per mission rather than
 * a cap-position shortcut (e.g. "cap < this act's first mission index"), so
 * a future uneven or hand-edited cap that split an act's own mission list
 * fails closed (reads as "not tab-locked," falling through to the normal
 * per-mission-card lock every mission already carries on its own) instead
 * of silently mis-teasing a partially-playable act.
 */
export function isCampaignDemoLockedWithCap(
  cap: number | null,
  campaignId: string,
  chain: readonly CampaignMission[],
  missionIds: readonly string[]
): boolean {
  return missionIds.length > 0 && missionIds.every((id) => isMissionDemoLockedWithCap(cap, campaignId, chain, id));
}

/** Real, import.meta.env-backed version of isCampaignDemoLockedWithCap — see that function and DEMO_MISSION_CAP above. */
export function isCampaignDemoLocked(campaignId: string, chain: readonly CampaignMission[], missionIds: readonly string[]): boolean {
  return isCampaignDemoLockedWithCap(DEMO_MISSION_CAP, campaignId, chain, missionIds);
}
