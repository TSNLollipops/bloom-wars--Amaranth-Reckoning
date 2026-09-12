// src/engine/calendarClock.ts
// Calendar economy, 2 Sep 2026 —
// claude/Bloom_Wars_Calendar_Economy_Build_Proposal_v2_RealTimeClock.md.
//
// Maxime's own model, quoted rather than paraphrased because it overturns
// what was previously locked: "time spent in the hub and time spent on
// mission run on the same ckock. depend on time player spend in each. like a
// inevitable day night cycle in wow. the calandar run when you play. no
// matter what you do. some event take some times some less."
//
// This replaces the discrete per-action pricing model that
// claude/Bloom_Wars_Calendar_System_v1.md originally locked (which specified
// advancement "independent of real play speed" — exactly backwards from
// this). The itemized per-verb ordering that
// claude/Bloom_Wars_Walkable_Hub_Build_Plan_v1.md §4 locked SURVIVES, but
// demoted: it's an accent layer on top of a real-time base, no longer the
// thing that moves the calendar. Both of those docs need a correction pass —
// flagged in the v2 proposal's own §2 rather than left to rot.
//
// Everything tunable about the calendar lives in THIS file, on purpose.
// Every number below is a placeholder in the same sense as the Antfarm bay
// costs and the Insult-ladder tiers: picked with reasoning, not yet
// playtested, and expected to move at least once. There is no
// combat_sim.py-equivalent for pacing numbers, so these want real play, not
// a sim script — which is exactly why they're collected in one file instead
// of scattered across the scenes that spend them.
import type { CampaignState } from "./campaignState";
import type { VerbId } from "../data/verbs";

/**
 * Real milliseconds per in-fiction campaign day. 6 real minutes.
 *
 * The reasoning, so this is a decision and not a magic number: ~10 days per
 * real hour, so a 30-hour campaign lands near Day 300 — which puts
 * Bloom_Wars_Calendar_System_v1.md's own example landmark ("Day 212 — The
 * Reckoning") in late-campaign territory, exactly where a name like that
 * reads like it belongs. This one constant is the entire pacing dial.
 */
export const MS_PER_CALENDAR_DAY = 360_000;

/**
 * Day 1 = campaign start (first Hub load on a new save), NOT first mission
 * completed. See createCampaignState's own comment.
 */
export const CALENDAR_EPOCH_DAY = 1;

/**
 * Largest single frame delta the clock will honor, in ms.
 *
 * Phaser's update delta is normally ~16ms, but it can spike arbitrarily on a
 * GC pause, a debugger break, or a background tab that throttles before the
 * page-visibility pause actually lands. Those spikes are the loop stalling,
 * not the player playing, and crediting them would silently hand out days
 * for time nobody spent in the world. Anything above this is treated as a
 * stall and skipped entirely rather than clamped-and-credited — a stall is
 * an absence of play, so the honest amount to credit is none of it.
 */
export const MAX_TICK_DELTA_MS = 1_000;

/**
 * Flat days added once per mission completion, on TOP of the real time the
 * Battle scene already ticked. This is the transit, prep and return that
 * never get played out on screen.
 *
 * A 20-minute mission therefore lands around 5-6 total days.
 */
export const MISSION_COMPLETION_DAY_COST = 2;

/**
 * The accent layer — per-verb day costs on top of the running clock.
 *
 * Maxime's own steer on the spread was "narrow the gap": the background
 * clock should do the real work, and no single action should feel like a
 * bill. So conversation is free and even the priciest activity is half a
 * day.
 *
 * Worth being honest about what these numbers ARE, so nobody later reads
 * this table as an attempt to simulate duration: a poker session already
 * ticks ~1.7 days of real clock while the player actually sits and plays it.
 * The +0.5 on top is a deliberate thumb on the scale marking "that was a
 * real activity, not just standing in the room" — not a claim about how long
 * Hold'em takes.
 *
 * Three tiers, preserving the Walkable Hub §4 ordering (conversation < Rec
 * Room < romance-tier):
 *
 *  - 0     — conversation. The running clock already covers the minute it
 *            took to say it. Also 0 for the three SYSTEM-TRIGGERED verbs
 *            (angerBlowup/breakdown/spar), for a different reason: Hub.ts
 *            fires those off Stress/Morale/boredom thresholds, never off a
 *            player choice, and this economy prices player decisions rather
 *            than narrating elapsed time in general. Maxime confirmed that
 *            call directly.
 *  - 0.25  — a real but short sit-down activity.
 *  - 0.5   — the longer end. askOut sits here rather than with the Rec Room
 *            trio specifically to keep §4's locked "Rec Room < romance"
 *            ordering intact; a real Berths romance scene, once one exists
 *            (still parked per Spitball Ideas), should cost MORE than this,
 *            not the same.
 *
 * sendOff is 0 for its own third reason: it's bound to the mission-departure
 * moment, and MISSION_COMPLETION_DAY_COST already covers that whole sortie's
 * elapsed time. Charging it separately would double-bill the same stretch of
 * in-fiction time.
 *
 * A full Record rather than a Partial, deliberately: adding a new VerbId
 * should be a TYPE ERROR here until someone decides what it costs, instead
 * of silently defaulting to free and being noticed months later.
 */
export const VERB_DAY_COST: Record<VerbId, number> = {
  talk: 0,
  gift: 0,
  praise: 0,
  // flirt, 12 Sep 2026 — same shape as praise (a flat, no-risk compliment,
  // no room, no activity), and the whole point of splitting it out of
  // askOut was to NOT carry that verb's weight, calendar cost included.
  flirt: 0,
  insult: 0,
  apology: 0,
  congratulate: 0,
  sendOff: 0,
  angerBlowup: 0,
  breakdown: 0,
  spar: 0,
  shareADrink: 0.25,
  pegBoard: 0.25,
  fletchers: 0.25,
  poker: 0.5,
  askOut: 0.5,
};

/**
 * The raw float. Owns the "a save with no field means day 1" default in one
 * place so no caller has to remember `?? 1` — and guards NaN/negative the
 * same way loadCampaignState's backfill does, since this value is
 * arithmetic-accumulated every frame and one corrupt write would otherwise
 * poison every later tick with no way back.
 */
export function rawCalendarDay(state: CampaignState): number {
  const d = state.calendarDay;
  if (typeof d !== "number" || !Number.isFinite(d) || d < CALENDAR_EPOCH_DAY) return CALENDAR_EPOCH_DAY;
  return d;
}

/** The displayed day. Every piece of UI floors — the fraction is mechanism, not information the player wants. */
export function currentDay(state: CampaignState): number {
  return Math.floor(rawCalendarDay(state));
}

/**
 * Named pacing landmarks for specific calendar days — the writing task
 * Calendar_System_v1.md flagged as still open when the display shape itself
 * was confirmed and locked, 25 Aug 2026: "not a bare running total... an
 * in-fiction date-stamp, doubling as a pacing landmark for major beats: 'Day
 * 47 — Muster,' 'Day 212 — The Reckoning.'" Maxime's own reaction to that
 * shape: "yeah that would be cool. indeed."
 *
 * Seeded here with exactly those two examples — nothing invented beyond
 * what was already on record and already signed off — because deciding
 * which day numbers earn a real name tied to an actual campaign beat is
 * content work for Maxime, not something to guess at wholesale in a build
 * pass. This is the mechanism plus its two seed entries; a fuller, deliberate
 * set of landmarks is still owed as separate writing work. Add more by
 * adding more keys — nothing else needs to change.
 */
export const CALENDAR_LANDMARKS: Record<number, string> = {
  47: "Muster",
  212: "The Reckoning",
};

/** A day's landmark name, if this specific day has one. Undefined for most days — most days aren't named, by design. */
export function landmarkForDay(day: number): string | undefined {
  return CALENDAR_LANDMARKS[day];
}

/**
 * "Day 52", or "Day 47 — Muster" on a day with a landmark. One formatter so
 * the Hub readout and the Debrief stamp can never drift apart, and so a new
 * landmark added to CALENDAR_LANDMARKS shows up everywhere the day already
 * renders without any call site needing to change.
 */
export function formatDayLabel(state: CampaignState): string {
  const day = currentDay(state);
  const landmark = landmarkForDay(day);
  return landmark ? `Day ${day} — ${landmark}` : `Day ${day}`;
}

/**
 * Measure one frame's worth of real elapsed time, for a caller holding the
 * previous frame's `Date.now()` stamp. Returns the delta and the new stamp.
 *
 * WHY THIS EXISTS INSTEAD OF JUST USING PHASER'S `delta` — found by live
 * browser testing (tools/verify/checkCalendarClock.mjs), not by reasoning:
 * Phaser's update delta is smoothed and clamped, so on a heavy frame it
 * reports LESS time than actually passed. Measured in a real browser, the
 * Hub credited ~41% of real elapsed time on normal frames while crediting
 * ~100% with the chat overlay open (where Hub.update returns early and
 * frames are cheap). Every unit test passed throughout, because they all
 * feed tickCalendar a delta by hand.
 *
 * That gap isn't cosmetic. It would make the calendar run at a speed set by
 * the player's frame rate — a weak laptop would see meaningfully fewer days
 * for the same hours played than a fast desktop. Maxime's model is an
 * INEVITABLE clock ("the calandar run when you play. no matter what you
 * do"), and a machine-dependent one isn't that.
 *
 * Wall-clock is also the right thing to stall-guard: a hidden tab pauses
 * Phaser entirely, so the first frame back reports a huge real delta, which
 * MAX_TICK_DELTA_MS then drops. That's correct — nobody was playing.
 */
export function measureRealDelta(lastAt: number, now: number): { deltaMs: number; at: number } {
  // lastAt 0 means "first frame since this scene started measuring" — there
  // is no previous stamp to diff against, so credit nothing and start the
  // clock from here rather than crediting time since the epoch.
  if (!lastAt) return { deltaMs: 0, at: now };
  return { deltaMs: now - lastAt, at: now };
}

/**
 * Advance the clock by one frame's worth of real time. Called from Hub.ts's
 * and Battle.ts's update loops — those two scenes ONLY, matching the two
 * contexts Maxime named ("time spent in the hub and time spent on mission").
 * MapSelect, Debrief, the shop panel and menu overlays deliberately do NOT
 * tick: that's UI time, not world time, and burning in-fiction days while a
 * player reads a shop list would charge them for deliberating rather than
 * for living in the world.
 *
 * Returns true if the DISPLAYED (floored) day changed, so a caller can
 * repaint its readout on the one frame in ~360,000ms where that's actually
 * needed instead of rebuilding a text object every frame.
 */
export function tickCalendar(state: CampaignState, deltaMs: number): boolean {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs > MAX_TICK_DELTA_MS) return false;
  const before = currentDay(state);
  state.calendarDay = rawCalendarDay(state) + deltaMs / MS_PER_CALENDAR_DAY;
  return currentDay(state) !== before;
}

/**
 * Guarded per-frame accumulation for a scene that can't cheaply reach a live
 * CampaignState every frame.
 *
 * Battle.ts is the case this exists for: unlike Hub.ts it holds no persistent
 * campaign-state field, it loads and saves around specific events instead, so
 * a per-frame tickCalendar there would mean a localStorage round trip 60
 * times a second. Battle accumulates into a plain number with this, and
 * flushes once with creditRealMs below when the scene ends.
 *
 * Same stall rule as tickCalendar, deliberately — a frozen loop shouldn't be
 * credited just because it happened during a mission instead of in the Hub.
 */
export function accrueRealMs(accumulatedMs: number, deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs > MAX_TICK_DELTA_MS) return accumulatedMs;
  return accumulatedMs + deltaMs;
}

/**
 * Credit a block of real play time accumulated outside the per-frame path.
 *
 * Note this takes accumulated PLAY time, not `Date.now() - startedAt`. The
 * distinction is load-bearing rather than pedantic: a mission attempt can sit
 * open for up to the 12-hour real-time limit (campaignState.ts §9), and 12
 * hours of wall clock is 120 calendar days at the current rate. Crediting
 * elapsed time would hand a player who left the tab open over lunch a third
 * of a campaign's worth of days for a mission they weren't in the room for.
 * Maxime's model is "time player spend," and time spent is frames rendered.
 */
export function creditRealMs(state: CampaignState, ms: number): boolean {
  if (!Number.isFinite(ms) || ms <= 0) return false;
  const before = currentDay(state);
  state.calendarDay = rawCalendarDay(state) + ms / MS_PER_CALENDAR_DAY;
  return currentDay(state) !== before;
}

/**
 * Add a verb's accent cost. Returns true if the displayed day changed, same
 * contract as tickCalendar — a Share a Drink that happens to tip the counter
 * past a day boundary should refresh the readout immediately rather than
 * waiting for the next frame's tick to notice.
 */
export function applyVerbDayCost(state: CampaignState, verb: VerbId): boolean {
  const cost = VERB_DAY_COST[verb];
  if (!cost) return false;
  const before = currentDay(state);
  state.calendarDay = rawCalendarDay(state) + cost;
  return currentDay(state) !== before;
}

/**
 * Add the flat mission-completion cost. Returns both ends so Debrief can
 * show the real transition ("Day 47 → Day 52") rather than only the
 * destination — the elapsed span is the interesting half, and recomputing it
 * at the call site would mean two places knowing the cost.
 */
export function applyMissionCompletionDayCost(state: CampaignState): { before: number; after: number } {
  const before = currentDay(state);
  state.calendarDay = rawCalendarDay(state) + MISSION_COMPLETION_DAY_COST;
  return { before, after: currentDay(state) };
}
