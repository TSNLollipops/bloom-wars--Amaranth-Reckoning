import { describe, it, expect } from "vitest";
import { campaignTabLabel } from "../campaignTabLabel";
import { CAMPAIGNS } from "../allCampaigns";

describe("campaignTabLabel (E5)", () => {
  it("drops the series prefix", () => {
    expect(campaignTabLabel("The Amaranth Reckoning — Act I: The Fallow Line")).toBe("Act I: The Fallow Line");
  });
  it("leaves a name with no dash alone", () => {
    expect(campaignTabLabel("Skirmish")).toBe("Skirmish");
  });
  it("every shipped tab label fits two lines at six tabs (17 chars a line)", () => {
    for (const c of CAMPAIGNS) {
      expect(campaignTabLabel(c.name).length).toBeLessThanOrEqual(34);
    }
  });
});
