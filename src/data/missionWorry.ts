// src/data/missionWorry.ts
// Worry with real texture — Social Sim Roadmap #8, first slice, 27 Aug
// 2026, built at Maxime's own direction while he's out for the day
// ("keep building the hub"). The roadmap doc's own framing: Mission Worry
// "is currently a flat boolean — every crew member reads equally worried
// about a missing pilot regardless of how close they actually are, and it
// snaps on all at once at a fixed timer rather than building."
//
// Honest scope adaptation, worth recording plainly rather than quietly
// building something narrower and calling it the same idea (same
// discipline the Highlights reel's own header used once already): the
// pitch's exact wording was "scale by bond with the MISSING pilot." That
// specific pilot's identity isn't tracked anywhere — CampaignState's own
// ActiveMissionAttempt (engine/campaignState.ts) records only
// { missionId, startedAt }, no roster, and Hub.ts's seeded NPCs
// (NPC_SEED) are a fixed cast independent of whoever's actually deployed
// on any given mission attempt (build_log's own squad_and_deploy_
// structure.md: Act I currently deploys the FULL roster, no bench, so
// there's no clean "who's left behind" set to read even in principle).
// The pilot who IS always away on every mission, unambiguously, is
// Rourke herself — the player character, the one commanding_down.md's
// own name for the whole mechanic is built around. So "closeness to the
// missing pilot" here reads as closeness to HER specifically:
// HubNpc.favorability, a number every seeded NPC already tracks and that
// already IS "how close is this pilot to Rourke." Reusing it costs zero
// new persisted state, same "derive from what already exists" pattern
// hot topics/relationship stages/friction all used today.
//
// The second half — ramping instead of snapping — is a genuine, real
// texture change: intensity climbs linearly from 0 right at
// WORRY_ONSET_MS to 1.0 at WORRY_ONSET_MS + WORRY_RAMP_MS, instead of a
// single instant flip. Hub.ts multiplies that ramped intensity by this
// file's own closeness multiplier to get a per-NPC, per-check
// PROBABILITY of the worried echo actually firing this check — not a
// hard override the way the flat boolean used to be. Every number below
// is a placeholder, same "not tuned" caveat every timing/threshold
// constant in this scene already carries.
export const WORRY_RAMP_MS = 4 * 60_000; // 4 real minutes from onset to full intensity
export const WORRY_CLOSENESS_CEILING = 80; // favorability at/above which closeness stops adding more
export const WORRY_CLOSENESS_FLOOR = 0.3; // even a distant pilot still worries SOME, just visibly less

// elapsedSinceOnsetMs <= 0 means "hasn't even reached the onset gate yet"
// (isMissionWorrySignal's own job in Hub.ts) — 0 intensity, not clamped
// negative. Linear ramp, capped at 1 once WORRY_RAMP_MS has passed.
export function worryIntensity(elapsedSinceOnsetMs: number): number {
  if (elapsedSinceOnsetMs <= 0) return 0;
  return Math.min(1, elapsedSinceOnsetMs / WORRY_RAMP_MS);
}

// Normalizes a favorability value (any real range — can go negative) into
// a [FLOOR, 1] multiplier. A pilot at or above the ceiling gets the full
// multiplier; a pilot at 0 or negative favorability still gets the floor,
// never zero — "Bosk should worry MORE about someone he's close to," not
// "a stranger shouldn't worry at all."
export function worryClosenessMultiplier(favorability: number): number {
  const normalized = Math.max(0, Math.min(1, favorability / WORRY_CLOSENESS_CEILING));
  return WORRY_CLOSENESS_FLOOR + normalized * (1 - WORRY_CLOSENESS_FLOOR);
}

// The actual per-check probability Hub.ts rolls against. Pure
// multiplication of the two factors above — deliberately simple, easy to
// reason about (double either factor, double the chance, up to the 1.0
// ceiling implied by intensity maxing at 1 and the multiplier maxing at 1).
export function worryTriggerChance(elapsedSinceOnsetMs: number, favorability: number): number {
  return worryIntensity(elapsedSinceOnsetMs) * worryClosenessMultiplier(favorability);
}
