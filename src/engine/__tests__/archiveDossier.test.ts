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

  it("reads a real background into the intake line when one exists — Catalyst_Gauntlet_v2 §5 item 5, 9 Sep 2026", () => {
    const s = warden();
    const e = entryOf(s, "pilot_bosk");
    const recruit: CampaignPilotEntry = {
      ...e,
      pilot: {
        ...e.pilot,
        id: "pilot_recruit_y",
        displayName: "Pvt. Somebody",
        background: { sector: "The Understrand", planet: "Cistgate", texture: "Arcology Stack", academy: "Line-trained" },
      },
    };
    s.pilots["pilot_recruit_y"] = recruit;
    const d = buildArchiveDossier(s, recruit);
    expect(d.entry).toBeUndefined();
    // Matches Catalyst_Gauntlet_v2 §5 item 5's own worked example exactly,
    // modulo the academy (that example used Line-trained too, so this
    // background was picked to match it precisely).
    expect(d.intake).toBe("Intake: the Understrand, Cistgate. Arcology stack. Line-trained.");
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
    // D3 Archive punctuation sweep (9 Sep 2026) split the old em-dash
    // sentence into two, capitalizing "Discharged." on its own — this
    // assertion was never updated to match and has been silently red
    // since that sweep landed. Case matters here: the pilot record's own
    // status field (line above) is still lowercase "discharged" by design,
    // only the rendered dossier text changed.
    expect(d.status).toContain("Discharged");
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

// ---------------------------------------------------------------------
// The Mek's own file — 9 Sep 2026, Codex Rework Plan §9b ("the full
// dossier, not the cheap line"), Mek NPC plan §10 ("Attached synker").
// ---------------------------------------------------------------------
import {
  buildMekDossier,
  mekBioFor,
  mekCatalystOf,
  mekRelationsFor,
  mekStatusText,
  pilotOfMek,
  resolveMekIds,
} from "../archiveDossier";
import { ARCHIVE_ENTRIES } from "../../data/archive";
import { WARDEN_FACILITY } from "../facilityWarden";
import { recruitDiscretionary, DISCRETIONARY_RECRUIT_COST } from "../campaignState";
import { MEK_GIVEN_NAMES } from "../../data/names";
import { SECOND_LANCE_MEKS, THIRD_LANCE_MEKS } from "../../data/campaignAmaranth";
import { HOUSE_AMARANTH_SECOND_LANCE_MEKS, HOUSE_AMARANTH_THIRD_LANCE_MEKS } from "../../data/campaignHouseAmaranth";

describe("the Mek dossier", () => {
  it("opens on who the Mek is attached to, in the paperwork's own word", () => {
    const s = warden();
    const d = buildMekDossier(s, "mek_rourke")!;
    expect(d).not.toBeNull();
    expect(d.pilotId).toBe("pilot_rourke");
    expect(d.lines[0].label).toBe("Attached synker");
    expect(d.lines[0].value).toContain("Rourke");
  });

  it("names the synker with their live rank, the same way their own dossier does", () => {
    const s = warden();
    s.rourkeRank = "maj";
    const d = buildMekDossier(s, "mek_rourke")!;
    expect(d.lines[0].value).toContain("Maj.");
    expect(d.lines[0].value).not.toContain("2nd Lt.");
  });

  it("reads the catalyst off the same rule the Workshop floor uses — the hand-placed seed wins", () => {
    const s = warden();
    for (const seed of WARDEN_FACILITY.mekSeeds) {
      expect(mekCatalystOf(s, seed.mekId)).toBe(seed.catalyst);
      const d = buildMekDossier(s, seed.mekId)!;
      expect(d.lines.find((l) => l.label === "Catalyst")?.value.toLowerCase()).toBe(seed.catalyst);
    }
  });

  it("agrees with every authored MEK tail about the catalyst — the file and the floor say the same word", () => {
    // Every hand-authored pilot's dossier closes with "MEK — <id>, catalyst
    // <Word>". If this ever fails, the authored text and the live rule have
    // drifted apart, and that is a real finding, not a test to loosen.
    // Bench Meks arrive with recruits, so a fresh save holds only the five
    // Act I Meks — add every authored Mek record to the map so all thirty
    // tails are checked, not ten.
    const wardenState = warden();
    Object.assign(wardenState.meks, SECOND_LANCE_MEKS, THIRD_LANCE_MEKS);
    const houseState = createHouseAmaranthCampaignState(0);
    Object.assign(houseState.meks, HOUSE_AMARANTH_SECOND_LANCE_MEKS, HOUSE_AMARANTH_THIRD_LANCE_MEKS);
    let checked = 0;
    for (const e of ARCHIVE_ENTRIES) {
      const m = /^MEK — (mek_[a-z_]+), catalyst ([A-Za-z]+)$/.exec(e.tail?.heading ?? "");
      if (!m) continue;
      const [, mekId, word] = m;
      const state = wardenState.meks[mekId] ? wardenState : houseState.meks[mekId] ? houseState : null;
      if (!state) continue; // a Mek whose pilot is only ever a recruit-pool candidate isn't on a fresh save
      expect(mekCatalystOf(state, mekId), mekId).toBe(word.toLowerCase());
      checked++;
    }
    expect(checked).toBe(30);
  });

  it("lifts the Mek's own paragraph from their pilot's authored dossier, so there is one text to keep true", () => {
    const s = warden();
    const d = buildMekDossier(s, "mek_bosk")!;
    expect(d.bio).toBeDefined();
    expect(d.bio).toContain("Tallowmere");
    expect(d.intake).toBeUndefined();
    expect(mekBioFor("mek_bosk", "pilot_bosk")).toBe(d.bio);
    // Never someone else's paragraph.
    expect(mekBioFor("mek_bosk", "pilot_rourke")).toBeUndefined();
  });

  it("reads stress, morale and standing off the Mek's own persisted state, as words and numbers", () => {
    const s = warden();
    const st = social(s, "mek_iyari"); // lands in npcSocialStates — Meks are not roster entries
    st.stress = 55;
    st.morale = 80;
    st.favorability = 12;
    const d = buildMekDossier(s, "mek_iyari")!;
    expect(d.lines.find((l) => l.label === "Stress")?.value).toBe("strained 55");
    expect(d.lines.find((l) => l.label === "Morale")?.value).toBe("high 80");
    expect(d.lines.find((l) => l.label === "Standing")?.value).toBe("12");
  });

  it("shows no mood at all when the save holds none, rather than inventing one", () => {
    const s = warden();
    const d = buildMekDossier(s, "mek_lask")!;
    expect(d.lines.find((l) => l.label === "Stress")).toBeUndefined();
    expect(d.lines.find((l) => l.label === "Catalyst")).toBeDefined();
  });

  it("names the track in plain words, second track included", () => {
    const s = warden();
    s.meks["mek_rourke"].secondary = "quartermaster";
    const d = buildMekDossier(s, "mek_rourke")!;
    expect(d.lines.find((l) => l.label === "Track")?.value).toBe("Runemaster, second in Quartermaster");
  });

  it("retires when their synker is lost, and drops the mood lines like a struck pilot", () => {
    const s = warden();
    social(s, "mek_anand").stress = 90;
    const anand = entryOf(s, "pilot_anand");
    anand.status = "permanently_lost";
    const d = buildMekDossier(s, "mek_anand")!;
    expect(d.status).toContain("Retired to civilian life");
    expect(d.status).toContain("Anand");
    expect(d.status).not.toContain("child");
    expect(d.lines.find((l) => l.label === "Stress")).toBeUndefined();
    expect(d.lines.find((l) => l.label === "Attached synker")).toBeDefined();
  });

  it("takes the child with them when the bond flag is set — Mek NPC plan §4", () => {
    const s = warden();
    const anand = entryOf(s, "pilot_anand");
    anand.status = "permanently_lost";
    anand.hasChildWithMek = true;
    expect(mekStatusText(s, anand, "warden")).toContain("Their child went with them.");
  });

  it("follows their synker off the ship on a discharge or reassignment", () => {
    const s = warden();
    const iyari = entryOf(s, "pilot_iyari");
    iyari.status = "discharged";
    expect(mekStatusText(s, iyari, "warden")).toContain("on discharge");
    iyari.status = "reassigned";
    expect(mekStatusText(s, iyari, "warden")).toContain("on reassignment");
  });

  it("gives a generated recruit's Mek a real given name, an intake line from their rolled background, and their synker's name", () => {
    const s = createWardenCampaignState(DISCRETIONARY_RECRUIT_COST);
    const pilot = recruitDiscretionary(s, "tank").pilot!;
    const d = buildMekDossier(s, pilot.mekId)!;
    expect(MEK_GIVEN_NAMES).toContain(d.displayName);
    expect(d.displayName).not.toContain("'s Mek");
    expect(d.bio).toBeUndefined();
    expect(d.intake).toMatch(/^Intake: /);
    expect(d.lines[0].value).toBe(pilot.displayName);
  });

  it("returns null for a Mek nobody on the roster is matched to", () => {
    const s = warden();
    expect(buildMekDossier(s, "mek_nobody")).toBeNull();
    expect(pilotOfMek(s, "mek_nobody")).toBeUndefined();
  });

  it("swaps a raw Mek id in authored text for the Mek's live name", () => {
    const s = warden();
    expect(resolveMekIds(s, "MEK — mek_rourke, catalyst Raven")).toBe(`MEK — ${s.meks["mek_rourke"].displayName}, catalyst Raven`);
    expect(resolveMekIds(s, "MEK — mek_unknown, catalyst Raven")).toBe("MEK — mek_unknown, catalyst Raven");
  });

  it("leaves the Matchset bond with their own synker off the relations lines — it is already the first line", () => {
    const s = warden();
    const npc = ensureNpcSocialState(s, {});
    npc.bonds[pairKey("mek_bosk", "pilot_bosk")] = 75;
    expect(mekRelationsFor(s, "mek_bosk", "pilot_bosk")).toEqual([]);
    npc.bonds[pairKey("mek_bosk", "pilot_lask")] = 40;
    npc.bonds[pairKey("mek_bosk", "mek_iyari")] = -40;
    const lines = mekRelationsFor(s, "mek_bosk", "pilot_bosk");
    expect(lines.find((l) => l.label === "Closest aboard")?.value).toContain("Lask");
    expect(lines.find((l) => l.label === "Friction with")?.value).toBe(s.meks["mek_iyari"].displayName);
  });
});

// ---------------------------------------------------------------------
// The CO's own file — 9 Sep 2026, Codex Rework Plan §9a ("decided: the
// CO's dossier gains two live lines, and still nothing about his own
// Stress/Morale/Standing"). Applies to both COs (§9a, confirmed 8 Sep):
// Warden's Arangement ("co") and House Amaranth's Verinis ("co_amaranth").
// ---------------------------------------------------------------------
import { buildCoDossier } from "../archiveDossier";

describe("the CO's own dossier", () => {
  it("is not on the roster — he never deploys and archiveRosterGroups never lists him", () => {
    const s = warden();
    expect(archiveRosterGroups(s).some((g) => g.entries.some((e) => e.pilot.id === "co"))).toBe(false);
  });

  it("opens on Warden's own authored CO entry", () => {
    const s = warden();
    const d = buildCoDossier(s, 5);
    expect(d.displayName).toBe("the CO — the ship's Commanding Officer");
    expect(d.entry?.id).toBe("co");
    // D3 Archive punctuation sweep (9 Sep 2026) replaced this line's em
    // dash with a period + capital "There" in archiveDossier.ts's own
    // CO_STATUS_TEXT constant — this assertion was never updated to match.
    expect(d.status).toBe("Command staff, not a deployed roster slot. There is no mission outcome to report here.");
  });

  it("opens on Verinis's own entry on a House Amaranth save, not Warden's", () => {
    const s = createHouseAmaranthCampaignState(0);
    const d = buildCoDossier(s, 3);
    expect(d.displayName).toBe("Brig. Verinis Amaranth — field commander");
    expect(d.entry?.id).toBe("co_amaranth");
  });

  it("says nothing about a relationship when he isn't seeing anyone", () => {
    const s = warden();
    const d = buildCoDossier(s, 0);
    expect(d.lines.find((l) => l.label === "Registered partner")).toBeUndefined();
  });

  it("reads his relationship status off his own npcSocialStates entry, named by title never 'you' — same shape a pilot's own dossier uses", () => {
    const s = warden();
    const st = social(s, "npc_co");
    st.inRelationship = true;
    st.favorability = 75;
    const d = buildCoDossier(s, 0);
    const partner = d.lines.find((l) => l.label === "Registered partner");
    expect(partner?.value).toBe("the Commander (dating)");
  });

  it("names the player 'the Colonel' on the House Amaranth save, same as a pilot's own dossier would", () => {
    const s = createHouseAmaranthCampaignState(0);
    const st = social(s, "npc_co");
    st.inRelationship = true;
    st.favorability = 40;
    const d = buildCoDossier(s, 0);
    expect(d.lines.find((l) => l.label === "Registered partner")?.value).toContain("the Colonel");
  });

  it("reads a real command record: missions resolved and pilots lost, singular/plural handled", () => {
    const s = warden();
    let d = buildCoDossier(s, 1);
    expect(d.lines.find((l) => l.label === "Command record")?.value).toBe("1 mission resolved · 0 pilots lost");
    entryOf(s, "pilot_iyari").status = "permanently_lost";
    d = buildCoDossier(s, 12);
    const rec = d.lines.find((l) => l.label === "Command record");
    expect(rec?.value).toBe("12 missions resolved · 1 pilot lost");
    expect(rec?.tone).toBe("warn");
  });

  it("never floors below zero missions resolved even if the caller passes a negative index", () => {
    const s = warden();
    expect(buildCoDossier(s, -1).lines.find((l) => l.label === "Command record")?.value).toBe("0 missions resolved · 0 pilots lost");
  });

  it("never shows Stress, Morale or Standing — his own mood stays unreadable, decided 8 Sep 2026", () => {
    const s = warden();
    const st = social(s, "npc_co");
    st.stress = 90;
    st.morale = 5;
    st.favorability = 80;
    const d = buildCoDossier(s, 4);
    expect(d.lines.find((l) => l.label === "Stress")).toBeUndefined();
    expect(d.lines.find((l) => l.label === "Morale")).toBeUndefined();
    expect(d.lines.find((l) => l.label === "Standing")).toBeUndefined();
  });
});
