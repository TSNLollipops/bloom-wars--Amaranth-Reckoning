// src/data/playerNotes.ts
//
// Field Notes — the player's own notebook, written from the chat box with
// ":notes <text>" (data/chatIntent.ts's detectCommand) in the Hub or mid-
// mission, read back from the Codex's FIELD NOTES section or the in-scene
// notes panel (scenes/ui/FieldNotesPanel.ts). Mission Chat, Player Notes and
// Battle HUD Relayout Plan v1, Workstream 1 — Maxime's ask, verbatim:
// "Allow player to add to their codex. Takes notes by typing :notes in the
// chat." Built 12 Sep 2026.
//
// Locked decision 3 (4 Sep 2026): notes are GLOBAL, tagged with the save
// they were written in, and survive permadeath and campaign loss — they're
// the player's knowledge, not the commander's. So this is deliberately NOT
// a CampaignState field: its own localStorage key, same tier as
// engine/testerNotes.ts (the free-text scratchpad for feedback to Maxime,
// a different thing — that one is one blob for "I wish my ant could X",
// this one is many tagged entries for "Splitfang burrows on turn 3").
//
// Phaser-free and DOM-guarded, same discipline as engine/displayScale.ts:
// vitest runs in plain Node with no localStorage, and a missing guard fails
// the suite outright rather than being assumed safe. Storage is injectable
// for exactly that reason (tests pass a Map-backed fake, the browser build
// passes nothing and gets localStorage).
//
// Caps, and why they are not optional. This is the first time the game
// stores arbitrary player-authored text, and localStorage is one ~5MB quota
// shared across the whole origin — the three manual save slots live in
// that same budget. A player pasting a wall of text into :notes over and
// over isn't just bloating a notebook, they're eating the space their own
// saves need, and a save that fails to write is a far worse bug than a
// note that fails to write. On any cap: REFUSE the write and say so
// plainly. Never silently evict the oldest note — silent data loss on a
// feature whose entire purpose is remembering things is the worst possible
// behavior here.

export interface PlayerNote {
  id: string; // creation timestamp plus a counter — unique within one browser
  text: string;
  createdAt: number; // epoch ms
  scene: "hub" | "battle";
  campaignId?: string; // which save this was written in (CampaignState.campaignId)
  campaignLabel?: string; // e.g. "Warden Company, Day 14" — human-readable at write time, kept verbatim since the save may be gone later
  missionId?: string;
  missionName?: string;
  turn?: number; // battle only
}

/** The context a note is stamped with at write time — everything but the text itself. */
export type NoteContext = Omit<PlayerNote, "id" | "text" | "createdAt">;

export const MAX_NOTE_CHARS = 280;
export const MAX_NOTES = 200;
/** Total serialized bytes the notebook may occupy — ~1.3% of a 5MB quota, leaving the saves their room. */
export const MAX_NOTES_BYTES = 64 * 1024;

export const PLAYER_NOTES_KEY = "bloomwars_notes_v1";

export interface NotesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function resolveStorage(storage?: NotesStorage): NotesStorage | null {
  if (storage) return storage;
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    // localStorage can throw in a locked-down embed — same guard every
    // other settings module uses. Treat as "no storage": reads are empty,
    // writes are refused with a reason.
    return null;
  }
}

function isNote(v: unknown): v is PlayerNote {
  if (!v || typeof v !== "object") return false;
  const n = v as Record<string, unknown>;
  return typeof n.id === "string" && typeof n.text === "string" && typeof n.createdAt === "number" && (n.scene === "hub" || n.scene === "battle");
}

/** Every saved note, oldest first. Empty on no storage, no key, or unreadable JSON — never throws. */
export function loadPlayerNotes(storage?: NotesStorage): PlayerNote[] {
  const s = resolveStorage(storage);
  if (!s) return [];
  try {
    const raw = s.getItem(PLAYER_NOTES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNote);
  } catch {
    return [];
  }
}

function persist(notes: PlayerNote[], s: NotesStorage): boolean {
  try {
    s.setItem(PLAYER_NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch {
    // QuotaExceededError or a locked-down embed — the caller reports it.
    return false;
  }
}

let noteCounter = 0;

export type AddNoteResult = { ok: true; note: PlayerNote; count: number } | { ok: false; reason: string };

/**
 * Append one note, stamped with `context`. Refuses (with a plain reason the
 * chat box shows verbatim) on empty text, on either count cap, on the
 * byte cap, or when storage itself refuses the write.
 */
export function addPlayerNote(text: string, context: NoteContext, storage?: NotesStorage, now: number = Date.now()): AddNoteResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "Nothing to note — type the note after :notes." };
  if (trimmed.length > MAX_NOTE_CHARS) {
    return { ok: false, reason: `Too long — a field note is ${MAX_NOTE_CHARS} characters at most (that one was ${trimmed.length}).` };
  }
  const s = resolveStorage(storage);
  if (!s) return { ok: false, reason: "Field notes can't be saved here — this browser has no local storage available." };
  const notes = loadPlayerNotes(s);
  if (notes.length >= MAX_NOTES) {
    return { ok: false, reason: `Notebook full — ${MAX_NOTES} notes is the limit. Delete some from the Codex's FIELD NOTES section first.` };
  }
  const note: PlayerNote = {
    id: `${now}-${++noteCounter}`,
    text: trimmed,
    createdAt: now,
    ...context,
  };
  const next = [...notes, note];
  const bytes = JSON.stringify(next).length;
  if (bytes > MAX_NOTES_BYTES) {
    return { ok: false, reason: "Notebook full — it's at its storage limit. Delete some notes from the Codex's FIELD NOTES section first." };
  }
  if (!persist(next, s)) return { ok: false, reason: "Couldn't save that note — this browser's local storage refused the write." };
  return { ok: true, note, count: next.length };
}

/** Remove one note by id. True if something was actually removed and saved. */
export function deletePlayerNote(id: string, storage?: NotesStorage): boolean {
  const s = resolveStorage(storage);
  if (!s) return false;
  const notes = loadPlayerNotes(s);
  const next = notes.filter((n) => n.id !== id);
  if (next.length === notes.length) return false;
  return persist(next, s);
}

/** One line of "where this was written" — what the Codex prints under each note. */
export function formatNoteContext(note: PlayerNote): string {
  const parts: string[] = [];
  if (note.missionName) parts.push(note.missionName);
  if (note.turn !== undefined) parts.push(`turn ${note.turn}`);
  if (parts.length === 0) parts.push(note.scene === "hub" ? "aboard" : "in the field");
  return parts.join(", ");
}

/**
 * Notes grouped by the campaign that wrote them, newest note first within
 * each group and the most recently written-to campaign first — so a Warden
 * save's notes and a House Amaranth save's notes never interleave. Notes
 * with no campaign tag (written from a scene that had no save loaded) fall
 * into one "No campaign" group at the end.
 */
export function groupNotesByCampaign(notes: PlayerNote[]): { key: string; label: string; notes: PlayerNote[] }[] {
  const groups = new Map<string, { key: string; label: string; notes: PlayerNote[]; latest: number }>();
  for (const n of notes) {
    const key = n.campaignId ?? "";
    const label = n.campaignLabel ? n.campaignLabel.split(",")[0].trim() : n.campaignId ? "Unnamed campaign" : "No campaign";
    const g = groups.get(key) ?? { key, label, notes: [], latest: 0 };
    g.notes.push(n);
    g.latest = Math.max(g.latest, n.createdAt);
    // The label follows the most recent note's own campaignLabel, so a
    // company renamed mid-campaign reads by its latest name.
    if (n.campaignLabel && n.createdAt >= g.latest) g.label = label;
    groups.set(key, g);
  }
  const out = [...groups.values()];
  for (const g of out) g.notes.sort((a, b) => b.createdAt - a.createdAt);
  out.sort((a, b) => {
    if (a.key === "" && b.key !== "") return 1;
    if (b.key === "" && a.key !== "") return -1;
    return b.latest - a.latest;
  });
  return out.map(({ key, label, notes: ns }) => ({ key, label, notes: ns }));
}

// ---- Paging for the read side (scenes/ui/FieldNotesPanel.ts, scenes/Codex.ts) — kept here, Phaser-free, so the paging math is unit-testable. ----

/** Rows per page — one note is one row. Conservative for a 280-char note wrapping at the Codex body width (~100 chars/line at 11px → 3 lines + context = 4 text lines ≈ 60px); 6 rows fits a 420px body with group headers. */
export const NOTES_PER_PAGE = 6;

/** A flat, paged view of the grouped notebook: group headers interleaved with notes, in display order. */
export interface NotesPageRow {
  kind: "header" | "note";
  label?: string; // header only
  note?: PlayerNote; // note only
}

/**
 * The full row list (headers + notes) and how many pages it spans. Pure —
 * exported so the Codex can size its page nav before drawing, and so the
 * paging math is testable without a scene.
 */
export function buildNotesRows(notes: PlayerNote[]): NotesPageRow[] {
  const rows: NotesPageRow[] = [];
  for (const g of groupNotesByCampaign(notes)) {
    rows.push({ kind: "header", label: g.label });
    for (const n of g.notes) rows.push({ kind: "note", note: n });
  }
  return rows;
}

export function notesPageCount(rows: NotesPageRow[]): number {
  const noteRows = rows.filter((r) => r.kind === "note").length;
  return Math.max(1, Math.ceil(noteRows / NOTES_PER_PAGE));
}

/**
 * The slice of rows for `page` (0-based): NOTES_PER_PAGE notes, plus the
 * group header a page's first note belongs to (repeated at the top of a
 * continued page so a note is never shown without its campaign).
 */
export function notesRowsForPage(rows: NotesPageRow[], page: number): NotesPageRow[] {
  const start = page * NOTES_PER_PAGE;
  const end = start + NOTES_PER_PAGE;
  const out: NotesPageRow[] = [];
  let noteIndex = 0;
  let currentHeader: NotesPageRow | null = null;
  let headerEmitted = false;
  for (const row of rows) {
    if (row.kind === "header") {
      currentHeader = row;
      headerEmitted = false;
      continue;
    }
    if (noteIndex >= start && noteIndex < end) {
      if (currentHeader && !headerEmitted) {
        out.push(currentHeader);
        headerEmitted = true;
      }
      out.push(row);
    }
    noteIndex++;
    if (noteIndex >= end) break;
  }
  return out;
}

