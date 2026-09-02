// Calendar economy, 2 Sep 2026 — engine/calendarClock.ts.
// See claude/Bloom_Wars_Calendar_Economy_Build_Proposal_v2_RealTimeClock.md
// for the model these tests are pinning down. The short version, in Maxime's
// own words: "the calandar run when you play. no matter what you do." A
// real-time clock fed by Hub and Battle alike, with small per-verb accents
// on top — NOT the discrete per-action pricing the original
// Calendar_System_v1.md doc had locked.
//
// What's actually worth testing here, given every number in the module is an
// admitted placeholder: not the constants themselves (those are expected to
// move after playtesting, and a test asserting `=== 0.25` would just have to
// be edited alongside every tune). What matters is the MECHANISM and the
// invariants that must survive any retuning — the clock only moves forward,
// stalls never get credited, corrupt state can't poison it permanently, and
// the locked cost ORDERING holds whatever the absolute numbers become.
import { describe, it, expect } from "vitest";
import {
  MS_PER_CALENDAR_DAY,
  MAX_TICK_DELTA_MS,
  MISSION_COMPLETION_DAY_COST,
  VERB_DAY_COST,
  CALENDAR_EPOCH_DAY,
  CALENDAR_LANDMARKS,
  rawCalendarDay,
  currentDay,
  formatDayLabel,
  landmarkForDay,
  tickCalendar,
  applyVerbDayCost,
  applyMissionCompletionDayCost,
  measureRealDelta,
} from "../calendarClock";
import {
  createCampaignState,
  saveCampaignState,
  loadCampaignState,
  type CampaignState,
  type CampaignStorage,
} from "../campaignState";

function memoryStorage(): CampaignStorage {
  const backing = new Map<string, string>();
  return {
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => void backing.set(k, v),
    removeItem: (k) => void backing.delete(k),
  };
}

function freshState(): CampaignState {
  return createCampaignState([], {}, 0);
}

/**
 * Advance the clock the way the game actually does — many small frames.
 *
 * This helper is not convenience sugar, it's load-bearing: a single
 * MS_PER_CALENDAR_DAY-sized delta is 360,000ms, far above MAX_TICK_DELTA_MS,
 * so tickCalendar reads it as a frozen loop and skips it entirely. Any test
 * that tries to fast-forward a day in one call is testing the stall guard,
 * not the clock. (Learned the direct way: the first draft of this file did
 * exactly that and five tests failed for what looked like a clock bug and
 * was actually the guard doing its job.)
 */
function playFor(state: CampaignState, ms: number, frameMs = 16): void {
  let remaining = ms;
  while (remaining > 0) {
    const step = Math.min(frameMs, remaining);
    tickCalendar(state, step);
    remaining -= step;
  }
}

/**
 * A few frames' worth of slack, for assertions that care which side of a day
 * boundary the clock landed on. Accumulating ~22,500 floating-point additions
 * can undershoot an exact boundary by a hair, and a test that flips on the
 * last bit of a float is a test that fails randomly six months from now.
 */
const BOUNDARY_MARGIN_MS = 1_000;

describe("calendar epoch", () => {
  it("a new campaign starts on day 1, not day 0", () => {
    // Not cosmetic pedantry: "Day 47 — Muster" only reads right if real days
    // elapsed before it, which needs a 1-based epoch at campaign start.
    expect(currentDay(freshState())).toBe(CALENDAR_EPOCH_DAY);
    expect(currentDay(freshState())).toBe(1);
  });

  it("formats the displayed day for UI", () => {
    expect(formatDayLabel(freshState())).toBe("Day 1");
  });
});

// Named landmarks, 2 Sep 2026 — Calendar_System_v1.md's own confirmed
// display shape ("Day 47 — Muster," "Day 212 — The Reckoning"), seeded with
// exactly those two already-approved examples. Content, not tuning — no
// reason for this to move when the pacing numbers above do, so it gets its
// own describe block rather than living inside "the real-time clock".
describe("named calendar landmarks", () => {
  it("most days have no landmark", () => {
    expect(landmarkForDay(1)).toBeUndefined();
    expect(landmarkForDay(46)).toBeUndefined();
    expect(landmarkForDay(48)).toBeUndefined();
    expect(landmarkForDay(2026)).toBeUndefined();
  });

  it("the two seeded landmarks resolve by day number", () => {
    expect(landmarkForDay(47)).toBe("Muster");
    expect(landmarkForDay(212)).toBe("The Reckoning");
  });

  it("formatDayLabel appends the landmark name on a named day, and only then", () => {
    const state = freshState();
    state.calendarDay = 47;
    expect(formatDayLabel(state)).toBe("Day 47 — Muster");
    state.calendarDay = 212;
    expect(formatDayLabel(state)).toBe("Day 212 — The Reckoning");
    state.calendarDay = 213;
    expect(formatDayLabel(state)).toBe("Day 213");
  });

  it("CALENDAR_LANDMARKS is exported so a future writing pass can extend it without touching the lookup function", () => {
    expect(CALENDAR_LANDMARKS[47]).toBe("Muster");
    expect(Object.keys(CALENDAR_LANDMARKS).length).toBeGreaterThanOrEqual(2);
  });
});

describe("the real-time clock", () => {
  it("advances exactly one day per MS_PER_CALENDAR_DAY of real play", () => {
    const state = freshState();
    playFor(state, MS_PER_CALENDAR_DAY);
    expect(rawCalendarDay(state)).toBeCloseTo(2, 4);
  });

  it("accumulates fractionally across many small frames", () => {
    // The whole mechanism: a single 16ms frame is worth ~0.00004 days, so an
    // integer field would round every tick to zero and the clock would never
    // move at all. This is the test that would fail if someone later
    // "tidied" calendarDay into an integer.
    const state = freshState();
    const frameMs = 16;
    const frames = Math.round(MS_PER_CALENDAR_DAY / frameMs);
    for (let i = 0; i < frames; i++) tickCalendar(state, frameMs);
    expect(currentDay(state)).toBe(2);
  });

  it("signals a day rollover on exactly one frame, not every frame", () => {
    // This is what lets the Hub readout repaint once per in-fiction day
    // instead of rebuilding a text object 60 times a second.
    const state = freshState();
    let rollovers = 0;
    const frames = Math.round((MS_PER_CALENDAR_DAY + BOUNDARY_MARGIN_MS) / 16);
    for (let i = 0; i < frames; i++) if (tickCalendar(state, 16)) rollovers++;
    expect(rollovers).toBe(1);
    expect(currentDay(state)).toBe(2);
  });

  it("never runs backwards", () => {
    const state = freshState();
    playFor(state, MS_PER_CALENDAR_DAY * 3);
    const after = rawCalendarDay(state);
    tickCalendar(state, -5_000);
    tickCalendar(state, 0);
    expect(rawCalendarDay(state)).toBe(after);
  });
});

describe("stall guards — time the player didn't actually spend", () => {
  it("skips a delta above MAX_TICK_DELTA_MS entirely instead of crediting it", () => {
    // A GC pause, a debugger break, or a throttled background tab can report
    // a huge delta. That's the loop stalling, not the player playing, so the
    // honest credit is none of it — not a clamped portion of it.
    const state = freshState();
    tickCalendar(state, MAX_TICK_DELTA_MS + 1);
    expect(rawCalendarDay(state)).toBe(1);
  });

  it("still credits a delta right at the limit", () => {
    const state = freshState();
    expect(tickCalendar(state, MAX_TICK_DELTA_MS)).toBe(false);
    expect(rawCalendarDay(state)).toBeGreaterThan(1);
  });

  it("ignores NaN rather than poisoning the counter forever", () => {
    // NaN + anything is NaN with no way back, and this value accumulates
    // every single frame — one bad delta would otherwise kill the clock for
    // the rest of the campaign.
    const state = freshState();
    tickCalendar(state, Number.NaN);
    playFor(state, MS_PER_CALENDAR_DAY + BOUNDARY_MARGIN_MS);
    expect(currentDay(state)).toBe(2);
  });

  it("heals a corrupt persisted value instead of propagating it", () => {
    const state = freshState();
    (state as { calendarDay?: number }).calendarDay = Number.NaN;
    expect(rawCalendarDay(state)).toBe(1);
    playFor(state, MS_PER_CALENDAR_DAY + BOUNDARY_MARGIN_MS);
    expect(currentDay(state)).toBe(2);
  });
});

describe("measureRealDelta — wall-clock, not Phaser's smoothed delta", () => {
  // This function exists because of a real defect that live browser testing
  // caught and every unit test here missed: Phaser's update delta is smoothed
  // and clamped, so on a heavy frame it under-reports elapsed time. Measured
  // in a real browser, the Hub credited ~41% of real time on normal frames
  // and ~100% with the chat open (cheap frames). That would have shipped a
  // calendar whose speed depended on the player's frame rate.
  it("credits nothing on the very first frame, and starts the clock there", () => {
    // No previous stamp to diff against — crediting `now - 0` would credit
    // every millisecond since 1970.
    const { deltaMs, at } = measureRealDelta(0, 1_000_000);
    expect(deltaMs).toBe(0);
    expect(at).toBe(1_000_000);
  });

  it("returns true wall-clock elapsed between frames", () => {
    const { deltaMs } = measureRealDelta(1_000_000, 1_000_122);
    expect(deltaMs).toBe(122);
  });

  it("hands back a delta the stall guard rejects when a hidden tab resumes", () => {
    // Phaser pauses on a hidden tab, so the first frame back reports a huge
    // real gap. Dropping it is correct — nobody was playing.
    const state = freshState();
    const { deltaMs } = measureRealDelta(1_000_000, 1_000_000 + 5 * 60_000);
    expect(deltaMs).toBeGreaterThan(MAX_TICK_DELTA_MS);
    expect(tickCalendar(state, deltaMs)).toBe(false);
    expect(rawCalendarDay(state)).toBe(1);
  });

  it("credits a slow frame in full, where a clamped delta would not", () => {
    // The actual regression guard: a 122ms frame is real play time and must
    // be credited as 122ms, not silently reduced to a smoothed ~16ms.
    const state = freshState();
    const { deltaMs } = measureRealDelta(1_000_000, 1_000_122);
    tickCalendar(state, deltaMs);
    expect(rawCalendarDay(state) - 1).toBeCloseTo(122 / MS_PER_CALENDAR_DAY, 10);
  });
});

describe("the accent layer — per-verb costs", () => {
  it("charges nothing for conversation", () => {
    // Talk and the five chat-driven crew-interaction verbs are covered by
    // the running clock already; charging them too would double-bill.
    const state = freshState();
    for (const verb of ["talk", "gift", "praise", "insult", "apology", "congratulate"] as const) {
      applyVerbDayCost(state, verb);
    }
    expect(rawCalendarDay(state)).toBe(1);
  });

  it("charges nothing for system-triggered events the player never chose", () => {
    // Maxime confirmed this directly. Hub.ts fires these off Stress/Morale/
    // boredom thresholds, not off a click — and this economy prices player
    // decisions, not elapsed time in general.
    const state = freshState();
    for (const verb of ["angerBlowup", "breakdown", "spar"] as const) {
      applyVerbDayCost(state, verb);
    }
    expect(rawCalendarDay(state)).toBe(1);
  });

  it("charges nothing for sendOff, which the mission cost already covers", () => {
    const state = freshState();
    applyVerbDayCost(state, "sendOff");
    expect(rawCalendarDay(state)).toBe(1);
  });

  it("charges real activities", () => {
    const state = freshState();
    applyVerbDayCost(state, "shareADrink");
    expect(rawCalendarDay(state)).toBeGreaterThan(1);
  });

  it("preserves the locked Rec Room < romance-tier ordering", () => {
    // Walkable_Hub_Build_Plan_v1.md §4's lock, and the one thing here that
    // must survive any retuning of the absolute numbers.
    expect(VERB_DAY_COST.askOut).toBeGreaterThan(VERB_DAY_COST.pegBoard);
    expect(VERB_DAY_COST.askOut).toBeGreaterThan(VERB_DAY_COST.shareADrink);
    expect(VERB_DAY_COST.askOut).toBeGreaterThan(VERB_DAY_COST.fletchers);
  });

  it("preserves the locked conversation < Rec Room ordering", () => {
    expect(VERB_DAY_COST.talk).toBeLessThan(VERB_DAY_COST.shareADrink);
    expect(VERB_DAY_COST.talk).toBeLessThan(VERB_DAY_COST.poker);
  });

  it("never charges a negative cost for any verb", () => {
    // A negative accent would let a player rewind the calendar by doing
    // things, which breaks the monotonic guarantee everything else assumes.
    for (const cost of Object.values(VERB_DAY_COST)) {
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("mission completion", () => {
  it("adds the flat cost and reports both ends for the Debrief stamp", () => {
    const state = freshState();
    const { before, after } = applyMissionCompletionDayCost(state);
    expect(before).toBe(1);
    expect(after).toBe(1 + MISSION_COMPLETION_DAY_COST);
  });

  it("stacks on top of the real time already ticked during the battle", () => {
    // The point of the model change: mission cost is added to played time,
    // not instead of it.
    const state = freshState();
    playFor(state, MS_PER_CALENDAR_DAY * 3 + BOUNDARY_MARGIN_MS);
    const { after } = applyMissionCompletionDayCost(state);
    expect(after).toBe(4 + MISSION_COMPLETION_DAY_COST);
  });
});

describe("persistence", () => {
  it("survives a save/load round trip without losing the fraction", () => {
    // If the fraction were dropped on save, a player who saves often would
    // have a calendar that barely moves — the bug this pins down is silent.
    const state = freshState();
    playFor(state, MS_PER_CALENDAR_DAY * 1.5);
    const storage = memoryStorage();
    saveCampaignState(state, storage);
    const loaded = loadCampaignState(storage);
    expect(loaded).not.toBeNull();
    expect(rawCalendarDay(loaded!)).toBeCloseTo(rawCalendarDay(state), 6);
  });

  it("backfills a save written before the calendar existed to day 1", () => {
    // The honest answer, not a shortcut: a pre-calendar save recorded no
    // Hub or Battle time anywhere, so there is nothing to reconstruct from.
    // Inventing a plausible number would fabricate campaign history.
    const state = freshState();
    delete (state as { calendarDay?: number }).calendarDay;
    const storage = memoryStorage();
    saveCampaignState(state, storage);
    const loaded = loadCampaignState(storage);
    expect(currentDay(loaded!)).toBe(1);
  });
});
