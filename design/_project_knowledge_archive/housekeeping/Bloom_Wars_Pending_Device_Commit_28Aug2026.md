---
name: Pending_Device_Commit_28Aug2026
description: Groups 1-5 all landed for real on the device as of this session. Groups 3-5 (Anger Blowup, Toxic Pairs, Breakdown, Spar Room) needed a second pass the same night — the first commit didn't match the authoritative spec already on record in this project — see the correction section below before assuming anything about those four groups from an earlier read of this doc.
sources: cowork
---

# Pending device commit — 28 Aug 2026

## Groups 1-2 — done, for real, 28 Aug 2026

`bloom_wellroot.attackPower: 50` and the Munti repair range fix (1→3, plus the `getRepairableFrom`/`support.ts` dead-code bug) are on the device. Full account: `claude/build_log/README.md`'s "Confirmed actually committed to the real repo" paragraph.

## Groups 3-5 — done, for real, on the device, and matching the authoritative spec — 28 Aug 2026 (later the same night, a second pass)

**Short version: these shipped once already this session, in a form that didn't match this project's own recorded spec, and have now shipped again, corrected, verified, and confirmed on the device.**

The device write path (`device_stage_files`/`device_commit_files`) came back working partway through this stretch — the `HTTP 403 session_stale_relogin` error that had blocked every attempt earlier the same night stopped recurring. Anger Blowup, Toxic Pairs, Breakdown, and a new Spar Room (rebuilt from spec earlier the same stretch — see the Master Index's "Batch rebuild from lost sandbox — Groups 3-5" section) were committed to the real device for the first time.

**Then, before writing this up as done, the standing project rule ("verify any specific claim against the actual current file rather than memory or an older plan") got applied to the just-shipped build itself, not just to old docs — and it caught a real mismatch.** `Bloom_Wars_Social_Sim_Roadmap_v1.md` #16 and the Master Index's own "Group 5" account both already carried a more detailed, Maxime-corrected spec than what actually got built and committed:

- **Breakdown's eligibility gate** was built as Morale-based (`isBreakdownEligible(morale)`); the recorded spec is `isBreakdownEligible(stress, worried)` — Stress crossing `STRESS_PANIC_THRESHOLD` AND the live `ambient.worried` boolean together, the same panic cutoff Anger Blowup itself reads, not a second one.
- **Breakdown's resolution flavors** were built as `partner`/`bondmate`/`alone` with per-flavor Morale/bond gains; the recorded spec is `spar`/`intimacy`/`sleep` — physical (Spar Room), a committed partner (player or NPC) at Berths, or an unwitnessed 8-minute timeout — with a flat Stress relief (25, clamped) and a flat Favorability/bond gain (4, unclamped) shared across the first two flavors, no gain on "sleep."
- **Toxic Pairs' stress tick** was built as a flat 2 per tick regardless of how bad the bond is; the recorded spec is a scaling formula, `round(2 + (RIVAL_THRESHOLD - bond) * 0.15)`.
- **Anger Blowup** was built with its socialLog entry only pushed to one side of the pair (should log to both, same as any other detail this project already gets right elsewhere) and a flat 45s cooldown (spec: randomized 90s-3min).
- **The Spar Room's door** was hosted in `berths` instead of `recroom` — the recorded spec is explicit that it connects to the Rec Room specifically.

**All five corrected in a second pass the same night**, re-verified as one batch (`tsc --noEmit`, `eslint .`, `vitest run` — 1129/1129 across 54 suites, `npm run build`, `npm run sim`, `npm run sim:social`, `npm run sim:gate` — the new Tier 1 harness, see below — all clean), and re-committed to the device with a fresh `expectedMtimeMs` guard pulled immediately beforehand. Confirmed via a fresh `device_list_dir` afterward that every file's size and mtime actually changed, not just a tool-reported success.

**Files on the device now, matching the spec:** `src/data/angerBlowup.ts` + its test file (unchanged from the first commit — this one was correct the first time), `src/data/toxicPairs.ts` + test (formula fixed), `src/data/breakdown.ts` + test (rewritten), `src/data/ambientLines.ts` (a since-reverted `PANIC_THRESHOLD` export that was only needed by the wrong first draft of `breakdown.ts`), `src/scenes/Hub.ts` (DOORS entries, cooldown constants, `runAngerBlowup`'s socialLog push, the full Breakdown trigger/resolution/resolve rewrite), and `src/sim/runGateVerification.ts` (the new Tier 1 Gate Verification harness — `npm run sim:gate` — see the Gate Verification spec doc; its own Breakdown lane was rewritten to match the corrected module too).

**Worth naming plainly, since this project's own rules ask for it:** the first commit this session was a real process failure, not just an incomplete one — the authoritative spec was sitting in two docs already read earlier the same session, but its most load-bearing details didn't make it into the actual code. Caught before Maxime saw it as finished, via this project's own standing verification discipline, not because he flagged it.

**Still open, unchanged:** Rourke's own breakdown is deliberately not built (no persisted player-character Stress field to trigger off of). The "hate-sex"/rival-breakdown extension Maxime flagged for later remains logged, not designed. The Spar Room's floor is a plain rectangle, not the grotto's egg-hull ellipse — a cosmetic follow-up, not a functional gap.

## After committing

`claude/Bloom_Wars_Master_Index.md`'s own "Batch rebuild from lost sandbox — Groups 3-5" section is now corrected in place — its closing paragraphs describe the mismatch and the fix directly, matching this doc. (An earlier pass corrected this same stale claim through a separate addendum doc instead; that addendum has since been deleted — a fix nobody reads by clicking through to it isn't a real fix, so the index itself got the edit.)
