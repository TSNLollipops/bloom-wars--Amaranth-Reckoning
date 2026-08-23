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
import { AMARANTH_ACT1, AMARANTH_MISSIONS_BY_ID } from "./campaignAmaranth";

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
export const CAMPAIGNS: CampaignDef[] = [
  {
    id: "amaranth_act1",
    name: "The Amaranth Reckoning — Act I: The Fallow Line",
    subtitle: "Warden Company. Independent, non-canon parallel campaign — missions 1-8 of Act I.",
    missions: AMARANTH_ACT1,
  },
];

export const ALL_MISSIONS_BY_ID: Record<string, CampaignMission> = {
  ...TEAM_ONE_MISSIONS_BY_ID,
  ...AMARANTH_MISSIONS_BY_ID,
};
