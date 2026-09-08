import { describe, it, expect } from "vitest";
import {
  archiveDisplayName,
  archiveRosterGroups,
  archiveStatusText,
  buildArchiveDossier,
  facilityOf,
  relationsFor,
} from "../archiveDossier";
import {
  type CampaignPilotEntry,
  type CampaignState,
  createHouseAmaranthCampaignState,
  createWardenCampaignState,
  ensureHubSocialState,
  ensureNpcSocialState,
} from "../campaignState";
import { pairKey } from "../../data/npcBonds";

const warden = () => createWardenCampaignState(0);
const SEED = { favorability: 0, stress: 0, morale: 50 };
const social = (s: CampaignState, id: string) => ensureHubSocialState(s, id, SEED);
const entryOf = (s: CampaignState, id: string): CampaignPilotEntry => {
  const e = s.pilots[id];
  if (!e) throw new Error(`no pilot ${id} on this save`);
  return e;
};

describe("facilityOf", () => {
  it("tells the two consoles apart from the save itself", () => {
    expect(facilityOf(warden())).toBe("warden");
    expect(facilityOf(createHouseAmaranthCampaignState(0))).toBe("amaranth");
  });
});

describe("archiveDisplayName", () => {
  it("shows Rourke's live rank instead of the one baked into her name", () => {
    const s = warden();
    const rourke = entryOf(s, "pilot_rourke");
    expect(archiveDisplayName(s, rourke)).toContain("2nd Lt.");
    s.rourkeRank = "maj";
    const shown = archiveDisplayName(s, rourke);
    expect(shown).toContain("Maj.");
    expect(shown).not.toContain("2nd Lt.");
  });

  // The list pane and the reader pane both name the same person. They must
  // agree: the Archive scene renders the list from archiveDisplayName for
  // exactly this reason, and read pilot.displayName straight until a
  // screenshot caught her listed as a 2nd Lt. beside her own Major's file.
  it("names her the same way the dossier does", () => {
    const s = warden();
    s.rourkeRank = "capt";
    const e = entryOf(s, "pilot_rourke");
    expect(archiveDisplayName(s, e)).toBe(buildArchiveDossier(s, e).displayName);
  });

  it("leaves everyone else's written rank alone", () => {
    const s = warden();
    const bosk = entryOf(s, "pilot_bosk");
    s.rourkeRank = "maj";
    expect(archiveDisplayName(s, bosk)).toBe(bosk.pilot.displayName);
  });
});

describe("the live block", () => {
  it("reads stress and morale as a word and the number together", () => {
    const s = warden();
    const e = entryOf(s, "pilot_bosk");
    const st = social(s, e.pilot.id);
    st.stress = 72;
    st.morale = 18;
    const d = buildArchiveDossier(s, e);
    const stress = d.lines.find((l) => l.label === "Stress");
    const morale = d.lines.find((l) => l.label === "Morale");
    expect(stress?.value).toBe("near the line 72");
    expect(stress?.tone).toBe("warn");
    expect(morale?.value).toBe("flagging 18");
    expect(morale?.tone).toBe("warn");
  });

  it("gives a pilot who has flown nothing an honest record line", () => {
    const s = warden();
    const d = buildArchiveDossier(s, entryOf(s, "pilot_lask"));
    expect(d.lines.find((l) => l.label === "Record")?.value).toBe("No missions flown.");
  });

  it("carries the authored dossier when there is one", () => {
    const s = warden();
    const d = buildArchiveDossier(s, entryOf(s, "pilot_rourke"));
    expect(d.entry?.id).toBe("pilot_rourke");
    expect(d.intake).toBeUndefined();
  });

  it("gives a pilot with no written file one intake sentence, never a fake bio", () => {
    const s = warden();
    const e = entryOf(s, "pilot_bosk");
    const recruit: CampaignPilotEntry = {
      ...e,
      pilot: { ...e.pilot, id: "pilot_recruit_x", displayName: "Pvt. Nobody" },
    };
    s.pilots["pilot_recruit_x"] = recruit;
    const d = buildArchiveDossier(s, recruit);
    expect(d.entry).toBeUndefined();
    expect(d.intake).toContain("Warden Company");
    expect(d.lines.length).toBeGreaterThan(3);
  });

  it("drops the mood lines for a pilot who has left, and keeps the record", () => {
    const s = warden();
    const e = entryOf(s, "pilot_iyari");
    social(s, e.pilot.id).stress = 90;
    e.status = "discharged";
    const d = buildArchiveDossier(s, e);
    expect(d.lines.find((l) => l.label === "Stress")).toBeUndefined();
    expect(d.lines.find((l) => l.label === "Lance")).toBeUndefined();
    expect(d.lines.find((l) => l.label === "Record")).toBeDefined();
    expect(d.status).toContain("discharged");
  });
});

describe("relations", () => {
  it("names the player by title rather than as you", () => {
    const s = warden();
    const e = entryOf(s, "pilot_anand");
    const st = social(s, e.pilot.id);
    st.inRelationship = true;
    st.favorability = 75;
    const lines = relationsFor(s, e);
    const partner = lines.find((l) => l.label === "Registered partner");
    expect(partner?.value).toBe("the Commander (dating)");
    expect(partner?.value).not.toContain("you");
  });

  it("reports a close bond and a friction using the Hub's own thresholds", () => {
    const s = warden();
    const npc = ensureNpcSocialState(s, {});
    npc.bonds[pairKey("pilot_bosk", "pilot_lask")] = 40;
    npc.bonds[pairKey("pilot_bosk", "pilot_iyari")] = -35;
    const lines = relationsFor(s, entryOf(s, "pilot_bosk"));
    expect(lines.find((l) => l.label === "Closest aboard")).toBeDefined();
    expect(lines.find((l) => l.label === "Friction with")).toBeDefined();
  });

  it("says nothing at all when a bond is merely warm", () => {
    const s = warden();
    ensureNpcSocialState(s, {}).bonds[pairKey("pilot_bosk", "pilot_lask")] = 5;
    expect(relationsFor(s, entryOf(s, "pilot_bosk"))).toEqual([]);
  });
});

describe("the roster list", () => {
  it("groups the living by lance", () => {
    const s = warden();
    const groups = archiveRosterGroups(s);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].id).toBe("a");
    expect(groups.every((g) => g.entries.length > 0)).toBe(true);
  });

  it("puts everyone who left in one struck group at the bottom, however they left", () => {
    const s = warden();
    entryOf(s, "pilot_iyari").status = "permanently_lost";
    entryOf(s, "pilot_lask").status = "reassigned";
    const groups = archiveRosterGroups(s);
    const struck = groups[groups.length - 1];
    expect(struck.id).toBe("struck");
    expect(struck.entries.map((e) => e.pilot.id).sort()).toEqual(["pilot_iyari", "pilot_lask"]);
    for (const g of groups.slice(0, -1)) {
      expect(g.entries.every((e) => e.status === "active")).toBe(true);
    }
  });

  it("uses the House's own company name on a House save", () => {
    const s = createHouseAmaranthCampaignState(0);
    const first = Object.values(s.pilots)[0];
    expect(archiveStatusText(first, "amaranth")).toContain("House Amaranth");
  });
});
