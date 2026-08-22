// src/data/allCampaigns.ts
// The one place both campaigns are known about together — scenes/MapSelect.ts
// reads CAMPAIGNS to render a picker per campaign; scenes/Battle.ts reads
// ALL_MISSIONS_BY_ID to resolve whichever mission id it was handed,
// regardless of which campaign it came from. Neither data/campaign.ts nor
// data/campaignAmaranth.ts needs to know the other exists.
import type { CampaignMission } from "./types";
import { CAMPAIGN, MISSIONS_BY_ID as TEAM_ONE_MISSIONS_BY_ID } from "./campaign";
import { AMARANTH_ACT1, AMARANTH_MISSIONS_BY_ID } from "./campaignAmaranth";

export interface CampaignDef {
  id: string;
  name: string;
  subtitle: string;
  missions: CampaignMission[];
}

export const CAMPAIGNS: CampaignDef[] = [
  {
    id: "team_one",
    name: "Team One — Engine Test Slice",
    subtitle: "The original 4-mission vertical slice used to prove the engine end to end.",
    missions: CAMPAIGN,
  },
  {
    id: "amaranth_act1",
    name: "The Amaranth Reckoning — Act I: The Fallow Line",
    subtitle: "Warden Company. Independent, non-canon parallel campaign — missions 1-4 of Act I.",
    missions: AMARANTH_ACT1,
  },
];

export const ALL_MISSIONS_BY_ID: Record<string, CampaignMission> = {
  ...TEAM_ONE_MISSIONS_BY_ID,
  ...AMARANTH_MISSIONS_BY_ID,
};
