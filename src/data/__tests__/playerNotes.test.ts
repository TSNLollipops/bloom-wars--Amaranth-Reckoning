// Field Notes storage (data/playerNotes.ts) — Workstream 1 of the Mission
// Chat / Player Notes / Battle HUD Relayout plan, 12 Sep 2026. Pure module,
// injectable storage, so every cap and refusal is checked here rather than
// discovered in a browser.
import { describe, it, expect } from "vitest";
import {
  addPlayerNote,
  deletePlayerNote,
  loadPlayerNotes,
  formatNoteContext,
  groupNotesByCampaign,
  MAX_NOTE_CHARS,
  MAX_NOTES,
  MAX_NOTES_BYTES,
  PLAYER_NOTES_KEY,
  type NotesStorage,
  type NoteContext,
} from "../playerNotes";

function fakeStorage(seed: Record<string, string> = {}): NotesStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

const HUB: NoteContext = { scene: "hub", campaignId: "c1", campaignLabel: "Warden Company, Day 3" };
const BATTLE: NoteContext = { scene: "battle", campaignId: "c1", campaignLabel: "Warden Company, Day 3", missionId: "mission_amaranth_1", missionName: "Muster", turn: 4 };

describe("playerNotes — write and read back", () => {
  it("adds a note stamped with its context and reads it back oldest-first", () => {
    const s = fakeStorage();
    const r1 = addPlayerNote("Splitfang burrows on turn 3", BATTLE, s, 1000);
    const r2 = addPlayerNote("  trailing spaces get trimmed  ", HUB, s, 2000);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    const notes = loadPlayerNotes(s);
    expect(notes).toHaveLength(2);
    expect(notes[0].text).toBe("Splitfang burrows on turn 3");
    expect(notes[0].scene).toBe("battle");
    expect(notes[0].missionName).toBe("Muster");
    expect(notes[0].turn).toBe(4);
    expect(notes[0].createdAt).toBe(1000);
    expect(notes[1].text).toBe("trailing spaces get trimmed");
    expect(notes[1].scene).toBe("hub");
    expect(notes[1].turn).toBeUndefined();
  });

  it("mints distinct ids even for two notes written in the same millisecond", () => {
    const s = fakeStorage();
    addPlayerNote("a", HUB, s, 5);
    addPlayerNote("b", HUB, s, 5);
    const [a, b] = loadPlayerNotes(s);
    expect(a.id).not.toBe(b.id);
  });

  it("refuses an empty note with a plain reason", () => {
    const s = fakeStorage();
    const r = addPlayerNote("   ", HUB, s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Nothing to note/);
    expect(loadPlayerNotes(s)).toHaveLength(0);
  });

  it("deletes by id and reports whether anything changed", () => {
    const s = fakeStorage();
    const r = addPlayerNote("keep", HUB, s, 1);
    addPlayerNote("drop", HUB, s, 2);
    if (!r.ok) throw new Error("setup");
    const dropId = loadPlayerNotes(s)[1].id;
    expect(deletePlayerNote(dropId, s)).toBe(true);
    expect(loadPlayerNotes(s).map((n) => n.text)).toEqual(["keep"]);
    expect(deletePlayerNote("nope", s)).toBe(false);
  });

  it("survives unreadable or malformed storage without throwing — and drops entries that aren't notes", () => {
    expect(loadPlayerNotes(fakeStorage({ [PLAYER_NOTES_KEY]: "{not json" }))).toEqual([]);
    expect(loadPlayerNotes(fakeStorage({ [PLAYER_NOTES_KEY]: '{"a":1}' }))).toEqual([]);
    const mixed = JSON.stringify([{ id: "x", text: "real", createdAt: 1, scene: "hub" }, { junk: true }, null, 3]);
    expect(loadPlayerNotes(fakeStorage({ [PLAYER_NOTES_KEY]: mixed })).map((n) => n.text)).toEqual(["real"]);
  });

  it("is empty and refuses writes when no storage exists at all (headless Node, no injected fake)", () => {
    // vitest's environment has no localStorage — the DOM guard is what
    // keeps this from throwing rather than any assumption.
    expect(loadPlayerNotes()).toEqual([]);
    const r = addPlayerNote("x", HUB);
    expect(r.ok).toBe(false);
    expect(deletePlayerNote("x")).toBe(false);
  });
});

describe("playerNotes — caps refuse loudly, never evict silently", () => {
  it("refuses a note over MAX_NOTE_CHARS and names the limit", () => {
    const s = fakeStorage();
    const r = addPlayerNote("x".repeat(MAX_NOTE_CHARS + 1), HUB, s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(String(MAX_NOTE_CHARS));
    expect(addPlayerNote("x".repeat(MAX_NOTE_CHARS), HUB, s).ok).toBe(true);
  });

  it("refuses the (MAX_NOTES + 1)th note and keeps every existing note intact", () => {
    const s = fakeStorage();
    for (let i = 0; i < MAX_NOTES; i++) expect(addPlayerNote(`n${i}`, HUB, s, i).ok).toBe(true);
    const r = addPlayerNote("one too many", HUB, s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Notebook full/);
    const notes = loadPlayerNotes(s);
    expect(notes).toHaveLength(MAX_NOTES);
    expect(notes[0].text).toBe("n0"); // the oldest was NOT evicted
  });

  it("refuses when the serialized notebook would pass MAX_NOTES_BYTES, with the previous notes untouched", () => {
    const s = fakeStorage();
    // Long notes with long labels fill the byte budget well before the
    // count cap: ~280 chars of text plus a fat context per note.
    const fat: NoteContext = { scene: "battle", campaignId: "c".repeat(40), campaignLabel: "L".repeat(200), missionId: "m".repeat(60), missionName: "N".repeat(120), turn: 99 };
    let written = 0;
    let refused: string | null = null;
    for (let i = 0; i < MAX_NOTES; i++) {
      const r = addPlayerNote("t".repeat(MAX_NOTE_CHARS), fat, s, i);
      if (r.ok) written++;
      else {
        refused = r.reason;
        break;
      }
    }
    expect(refused).toMatch(/storage limit/);
    expect(written).toBeGreaterThan(0);
    expect(written).toBeLessThan(MAX_NOTES);
    const stored = s.map.get(PLAYER_NOTES_KEY) ?? "";
    expect(stored.length).toBeLessThanOrEqual(MAX_NOTES_BYTES);
    expect(loadPlayerNotes(s)).toHaveLength(written);
  });

  it("reports a storage write failure as a refusal instead of pretending it saved", () => {
    const s = fakeStorage();
    s.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const r = addPlayerNote("x", HUB, s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/refused the write/);
  });
});

describe("playerNotes — display helpers", () => {
  it("formats a battle note's context as mission and turn, and a hub note's as 'aboard'", () => {
    const s = fakeStorage();
    addPlayerNote("a", BATTLE, s, 1);
    addPlayerNote("b", HUB, s, 2);
    const [battle, hub] = loadPlayerNotes(s);
    expect(formatNoteContext(battle)).toBe("Muster, turn 4");
    expect(formatNoteContext(hub)).toBe("aboard");
  });

  it("groups by campaign, newest note first inside a group, most recently written-to campaign first, untagged notes last", () => {
    const s = fakeStorage();
    addPlayerNote("w1", { scene: "hub", campaignId: "warden", campaignLabel: "Warden Company, Day 1" }, s, 10);
    addPlayerNote("h1", { scene: "hub", campaignId: "house", campaignLabel: "House Amaranth, Day 1" }, s, 20);
    addPlayerNote("w2", { scene: "hub", campaignId: "warden", campaignLabel: "Warden Company, Day 2" }, s, 30);
    addPlayerNote("loose", { scene: "hub" }, s, 5);
    const groups = groupNotesByCampaign(loadPlayerNotes(s));
    expect(groups.map((g) => g.label)).toEqual(["Warden Company", "House Amaranth", "No campaign"]);
    expect(groups[0].notes.map((n) => n.text)).toEqual(["w2", "w1"]);
    expect(groups[1].notes.map((n) => n.text)).toEqual(["h1"]);
    expect(groups[2].notes.map((n) => n.text)).toEqual(["loose"]);
  });
});

describe("playerNotes — paging for the read side", () => {
  it("buildNotesRows interleaves one header per campaign group ahead of its notes", async () => {
    const { buildNotesRows } = await import("../playerNotes");
    const s = fakeStorage();
    addPlayerNote("a", { scene: "hub", campaignId: "w", campaignLabel: "Warden Company, Day 1" }, s, 1);
    addPlayerNote("b", { scene: "hub", campaignId: "w", campaignLabel: "Warden Company, Day 1" }, s, 2);
    addPlayerNote("c", { scene: "hub", campaignId: "h", campaignLabel: "House Amaranth, Day 1" }, s, 3);
    const rows = buildNotesRows(loadPlayerNotes(s));
    expect(rows.map((r) => (r.kind === "header" ? `#${r.label}` : r.note!.text))).toEqual(["#House Amaranth", "c", "#Warden Company", "b", "a"]);
  });

  it("pages NOTES_PER_PAGE notes at a time and repeats a group's header at the top of a continued page", async () => {
    const { buildNotesRows, notesPageCount, notesRowsForPage, NOTES_PER_PAGE } = await import("../playerNotes");
    const s = fakeStorage();
    for (let i = 0; i < NOTES_PER_PAGE + 2; i++) addPlayerNote(`n${i}`, { scene: "hub", campaignId: "w", campaignLabel: "Warden Company, Day 1" }, s, i);
    const rows = buildNotesRows(loadPlayerNotes(s));
    expect(notesPageCount(rows)).toBe(2);
    const p0 = notesRowsForPage(rows, 0);
    const p1 = notesRowsForPage(rows, 1);
    expect(p0[0].kind).toBe("header");
    expect(p0.filter((r) => r.kind === "note")).toHaveLength(NOTES_PER_PAGE);
    expect(p1[0].kind).toBe("header"); // repeated, so no note is ever shown without its campaign
    expect(p1.filter((r) => r.kind === "note")).toHaveLength(2);
    expect(notesPageCount([])).toBe(1);
  });
});
