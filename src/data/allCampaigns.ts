// src/data/allCampaigns.ts
// The one place both campaigns are known about together — scenes/MapSelect.ts
// reads CAMPAIGNS to render the mission-select list; scenes/Battle.ts reads
// ALL_MISSIONS_BY_ID to resolve whichever mission id it was handed,
// regardless of which campaign it came from. Neither data/campaign.ts nor
// data/campaignAmaranth.ts needs to know the other exists.
// Team One is archived out of CAMPAIGNS (see the comment below) but still
// flows into ALL_MISSIONS_BY_ID, so scenes/Battle.ts and src/sim/run.ts can
// still resolve its mission ids even though mission-select no longer offers
// them.
import type { CampaignMission } from "./types";
import { MISSIONS_BY_ID as TEAM_ONE_MISSIONS_BY_ID } from "./campaign";
import { AMARANTH_ACT1, AMARANTH_ACT2, AMARANTH_ACT3, AMARANTH_MISSIONS_BY_ID } from "./campaignAmaranth";

export interface CampaignDef {
  id: string;
  name: string;
  subtitle: string;
  missions: CampaignMission[];
}

// Team One campaign archived — data kept, not shown in mission-select.
// data/campaign.ts (roster, missions, MISSIONS_BY_ID) is untouched and still
// merged into ALL_MISSIONS_BY_ID below, so the sim harness
// (`npm run sim -- mission_1a`/1b/2/3) and direct mission lookups keep
// working; it's just left out of this array so it no longer surfaces on the
// mission-select screen.
//
// Act I and Act II are two separate CampaignDef entries (25 Aug 2026, batch
// 2 / missions 13-16), not one 16- (soon 36-) mission array under a single
// entry. scenes/MapSelect.ts already has a dormant tab switcher that
// activates the moment CAMPAIGNS.length > 1 (see that file's own comments —
// it was built and defused for exactly this future, not exercised until
// now) — this is the first entry to make that switcher live rather than a
// case this pass had to build UI for. Splitting also sidesteps a real
// problem: that same file's own comment on its scroll pass notes eight
// mission cards already ran past the screen's fixed canvas height before
// scrolling was added; a single list scaling toward 36 would only make
// that worse, where two (eventually three, with Act III) shorter act-scoped
// lists don't.
export const CAMPAIGNS: CampaignDef[] = [
  {
    id: "amaranth_act1",
    name: "The Amaranth Reckoning — Act I: The Fallow Line",
    subtitle: "Warden Company. Independent, non-canon parallel campaign — Act I complete, missions 1-12.",
    missions: AMARANTH_ACT1,
  },
  {
    id: "amaranth_act2",
    name: "The Amaranth Reckoning — Act II: Two Fires",
    // Complete as of this pass (batch 4, missions 21-24, 25 Aug 2026) —
    // all 12 of Act II's missions per the Independent Campaign doc. Second
    // Lance integration (engine/campaignState.ts's integrateSecondLance)
    // fires off a Mission 12 win regardless of which CampaignDef tab a
    // player is looking at, so starting Act II from a fresh save before
    // finishing Act I is possible but will show a 5-pilot roster with no
    // picker until Mission 12 is actually won — not blocked here, since
    // nothing else in this campaign enforces mission order either.
    subtitle: "Warden Company. Two lances, ship fire support — Act II complete, missions 13-24 of 24.",
    missions: AMARANTH_ACT2,
  },
  {
    id: "amaranth_act3",
    name: "The Amaranth Reckoning — Act III: The Last Ring",
    // Underway, not complete — batch 5 (25 Aug 2026) built missions 25-28
    // of 12. Maxime confirmed (25 Aug 2026, in chat) Act III runs the full
    // 25-36 the Independent Campaign doc's own Act III section names,
    // mirroring Act I/II's 12-mission scale — the "is it just 25-28 or
    // does it run to 32+" open question from this batch's build-log
    // addendum is resolved. Missions 29-36 (The Outer Ring Falls, Ashes of
    // the Second Ring, The Last Convoy, Hold at the Spire, The Innermost
    // Ring, No Word from the Fleet, The Last Ring, Until Relief) are not
    // built yet — two of them need real design conversations before they
    // can be (a "scripted strategic loss" mission and a multi-unit
    // extract_unit), not silent scope growth. See chat, 25 Aug 2026.
    subtitle: "Warden Company. Meridian's Oath, the withdrawal, Marrow's closing turn — missions 25-28 built, 12 planned (25-36).",
    missions: AMARANTH_ACT3,
  },
];

export const ALL_MISSIONS_BY_ID: Record<string, CampaignMission> = {
  ...TEAM_ONE_MISSIONS_BY_ID,
  ...AMARANTH_MISSIONS_BY_ID,
};
