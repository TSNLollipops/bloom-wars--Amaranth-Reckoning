# Master Index Addendum — Off-Duty Needs Counter, 28 Aug 2026

**Status: addendum, not yet folded into `claude_Bloom_Wars_Master_Index.md` itself.** That doc's own running top paragraph and section structure have grown very large — this note exists so the fact doesn't wait on a full rewrite of that document (a real risk of transcription drift at this size, same reasoning `claude/build_log/README.md`'s own "Why split" note already gives for why the build log isn't one file). Same pattern as `Bloom_Wars_Spitball_Ideas_Addendum_NPCNeeds_26Aug2026.md`: standalone now, folded into the Master Index's own top paragraph and a new section the next time that doc gets touched for another reason anyway.

## What shipped

The Off-Duty Needs Counter — per-pilot Hunger/Thirst/Sleep meters, decaying off-duty and restoring passively off room presence (Berths for Sleep, Rec Room for Hunger/Thirst), ticking a real Stress/Morale delta once a meter runs low (the first real writer `HubPilotSocialState.stress`/`.morale` have ever had), surfacing only through a roaming bias and a small flavor-line bank, no bar, no new verb, no new room. Built from Maxime's own zero-code spec PDF under his explicit "you'll make a lot of decisions for me" latitude, resolving all four open questions `Bloom_Wars_Stress_Morale_Trigger_Proposal_v1.md` (26 Aug) had left on the table. Full technical account: `claude/build_log/engine_systems/needs_counter.md` (new file, added to `build_log/README.md`'s cross-cutting engine systems index this same session). `claude/Bloom_Wars_Spitball_Ideas_Addendum_NPCNeeds_26Aug2026.md`'s own "Parked — off-duty needs counter" entry and `Bloom_Wars_Stress_Morale_Trigger_Proposal_v1.md` both got matching resolution notes the same session.

**Verified via the same full local-clone pipeline established earlier this session for the Wellroot/Munti-repair-range device commit:** `tsc --noEmit`, `eslint .`, `npx vitest run` (48 files / 1016 tests, up from 1003 — 13 new), `npm run build`, `npm run sim`, `npm run sim:social` — all clean. Committed to the device: `data/needsCounter.ts` (new), `data/__tests__/needsCounter.test.ts` (new), `scenes/Hub.ts` (modified) — zero conflicts.

**A loose end from earlier the same day is now resolved, not just re-flagged:** `Bloom_Wars_Pending_Device_Commit_28Aug2026.md` had flagged `Hub.ts`'s then-unexplained 02:39:04 UTC mtime as worth Maxime's own eyes before anyone touched that file again. Checked immediately before this commit — the mtime was still exactly 02:39:04 UTC, meaning nothing else wrote to the file in between, so this system's edits are safely layered on the exact state that mystery write left behind. The write itself is still unexplained; the *risk* of silently overwriting unrelated work on top of it is not.

## Where this belongs once the Master Index gets its next full-rewrite pass

- **Top running paragraph:** one more clause, in the established style, dated 28 Aug 2026, noting the Off-Duty Needs Counter shipped and gave Stress/Morale a real driver for the first time.
- **A new section**, likely placed near "Munti repair range raised 1→3..." (same night's device-commit work) or right after the "Batch rebuild from lost sandbox — Groups 3-5" section (the most recently-added section as of this addendum) — whichever reads better once the doc is actually open. Content: essentially this addendum's own "What shipped" paragraph above, condensed to the Master Index's own house style.
- **Priority queue:** does NOT need a new entry — this was proactively built from a complete spec, not a flagged bug or open decision.

## One genuinely open thread, worth Maxime's own answer

The spec PDF's own header names its origin as "item 1 of the Antfarm Réalisation plan's Phase 1 gate" — that plan isn't a doc that exists anywhere in this project (checked via `project_info`'s full doc list and a `project_search` for "Réalisation"/"Antfarm"). Worth asking whether the rest of that plan lives somewhere else that should get folded in, or whether the spec PDF's own §1-§7 is the whole of it.
