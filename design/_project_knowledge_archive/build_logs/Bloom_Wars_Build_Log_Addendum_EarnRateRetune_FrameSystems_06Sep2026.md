# Personal-points earn-rate retune, round 2 — 6 September 2026

Direct follow-up to the same day's `Bloom_Wars_Build_Log_Addendum_FrameSystemsEconomySimHarness_06Sep2026.md`, which built `npm run sim:economy` but deliberately left one question open: the harness found the placeholder Frame Systems numbers push the "anchor" pilot's full-max timing later than the 5 Sep retune's own target, and lock "bench" pilots out of a second mount almost entirely. That addendum's own closing line — "worth deciding once, not per number" — was put to Maxime directly: accept the shape, or fix the earn rate first. He picked **fix the earn rate first.**

## The numbers that triggered this

From the harness's own 25-company pass, unchanged since this morning:

- **Anchor** (heaviest-deployed archetype, ~95% of missions): fully maxes out (tier A + all branches + Mek secondary + Refit) only **48%** of the time, averaging **mission 34 of 36** when it does. The 5 Sep retune's own target was "well inside one campaign... mission 25-30" — Frame Systems' new Refit (a placeholder 350 points) and open-ended systems economy pushed that later than the retune it was measured against.
- **Bench** (lightest-deployed, ~25% of missions): **94-100% never reach tier C** (the second mount) at all — the exact "a player who can never afford a second mount" failure mode `Bloom_Wars_Frame_Systems_Layer_v1.md` §12 names by name.

## What changed

`src/engine/campaignEconomy.ts` — the three live earn-rate constants, up from the 5 Sep values:

| Constant | Old (5 Sep) | New (6 Sep) |
| --- | --- | --- |
| `KILL_BONUS` | 15 | **18** |
| `SURVIVAL_BONUS` | 15 | **26** |
| `OBJECTIVE_BONUS` | 30 | **46** |

These are the real, live constants `computeMissionEarnings()` uses for every pilot's personal-points earnings on every mission — this is not a Frame-Systems-scoped number, it's the whole game's earn rate, same as the 5 Sep retune before it.

Also touched: a stale doc-comment in `src/data/heirlooms.ts` above `ARISTOCRAT_SIGNING_POOL`, which cited the old 15/15/30 figures and derived point ranges ("roughly 75-120 points on a good mission," "1800-2850," "450-720") as supporting arithmetic for why that pool's flat 650-point value is still necessary. `ARISTOCRAT_SIGNING_POOL` itself is untouched — the comment says explicitly its value was "never derived from the earn rate, only explained alongside it" — but the cited numbers were now wrong, so they're updated to the new constants' equivalents (roughly 108-162 / 2600-3900 / 650-970) rather than left silently stale. Caught by checking what else in the staged tree referenced these constants before calling the change done, per this project's own standing "check what's sitting immediately around an edit" discipline — not by an exhaustive repo-wide search (see Verification below for the real limit on that).

## Why these specific numbers, not a different triple

Picked by iterating against the harness itself, not by formula — the same discipline the harness exists to enforce. Tried roughly a dozen combinations at `--runs=150` to `--runs=300` before landing here; two representative rejected points, to show the shape of the trade-off:

- **20/20/40** (a flat 1.33x scale of the old values): fixed anchor cleanly (100% maxed, avg mission 27.7, only 8% early) but left bench at 58% never reaching tier C — still a majority failing.
- **18/28/48** (push further): got bench to 59% reaching C, but pushed anchor's "maxed before Act III" rate to 47% — trading one failure mode for edging toward the other, since a flat per-mission bonus raises a 95%-deployed pilot's total far more than a 25%-deployed one's at the same rate.

**18/26/46** is the point where, at `--runs=300` across two seeds (42 and 999), *neither* of the harness's own two named failure modes fires:

| Band | Reaches tier C | Fully maxed | Maxed before Act III |
| --- | --- | --- | --- |
| Anchor | 100% (was 100%) | **100%** (was 48%), avg mission **25.8** (was 34.0) | 25-27% (was 0%) |
| Focus | 100% | 86-87% (was 0%) | 0% |
| Core | 100% (was 95%) | 0% (by design — core was never expected to fully max) | 0% |
| Bench | **52-54%** (was 6%) | 0% (by design) | 0% |

Read honestly: bench pilots now reach a second mount slightly more often than not, up from "almost never" — a real improvement, not a solved problem. A flat per-mission bonus structurally can't equalize a 95%-deployed pilot and a 25%-deployed one; closing that gap further would need either a much larger across-the-board raise (which starts pushing anchor into "maxes out before Act III" territory, the sim's other named failure mode) or a deployment-independent income source for benched pilots, which is a new mechanic, not a constant tune, and out of scope for "fix the earn rate first."

## Verification

Same staged-sandbox process as the harness build this morning (no `device_bash` on this device this session):

- Staged `src/data/*.ts` (44 files), `src/engine/*.ts` + `cardTable/*.ts` (33 files), `src/sim/*.ts`, `src/buildInfo.d.ts`, and configs into a cloud sandbox; `npm ci` clean (148 packages).
- `npx tsc --noEmit` — clean.
- `npx eslint` on both changed files plus the sim files — clean.
- `npx vitest run src/engine/__tests__/campaignEconomy.test.ts` — **75/75 passing**, unchanged by the retune because the test file itself imports and asserts against the live `KILL_BONUS`/`SURVIVAL_BONUS`/`OBJECTIVE_BONUS` constants symbolically rather than hardcoding 15/15/30 — confirmed by reading the file before assuming that, not by hoping.
- `npm run sim:economy -- --runs=25/150/300` at several seeds (1, 3, 7, 42, 999) — the table above is the stable read.

**Not run, and worth naming plainly:** the full test suite (2247 tests) and `vite build` — `scenes/` was never staged, same standing gap the harness addendum itself flagged this morning, and this change has a materially bigger blast radius than that one (this touches the live earning formula every pilot uses, not a standalone CLI tool). I checked what else in the staged tree references these three constants directly (`grep` across the ~81 staged files) and found exactly one other consumer — the now-fixed `heirlooms.ts` comment, prose only, no runtime read. I did **not** check `scenes/` (ShopPanel, Debrief, and similar UI files) for a hardcoded 15/30/etc. literal anywhere outside these constants — everywhere I could see, the UI calls `computeMissionEarnings()`/`applyMissionEarnings()` rather than reading the constants directly, which is the expected shape for this codebase's own data/engine-owns-values, scenes-composes split, but that's an argument from convention, not a confirmed grep. `lint-spoiler.mjs` still needs Maxime's own `.env.local`, same standing gap every recent build carries. Nothing new here reads as a naming-lock risk — the only new vocabulary is numbers, no new strings.

**Nobody has watched this play out on Maxime's own machine or in a real mission** — same honest gap the harness itself carried this morning, now inherited by the number that actually feeds the live game.

## Genuinely still open

- **Tier 1 itself is still not built.** This was a pure economy-input change to unblock it, not the data model/shop UI/equip screen — that's still the next real ask.
- **The bench-pilot deployment/earnings gap is improved, not closed.** ~46-48% of bench pilots still never reach a second mount under this policy. Whether that's acceptable (permadeath already accepts uneven pilot outcomes) or wants a real structural fix (a deployment-independent trickle, a different milestone curve) is a further call, not resolved by this pass.
- **Every Frame Systems number in `frameSystemsEconomyParams.ts` is still exactly what it was this morning** — named placeholders, unaffected by this retune (the two files don't reference each other's tuning, only the shared engine constants).
- **This is the second earn-rate retune in two days** (5 Sep: 5/5/10 → 15/15/30; 6 Sep: 15/15/30 → 18/26/46). Both are recorded, dated, and reasoned in `campaignEconomy.ts`'s own comment trail so a third pass — Tier 1 itself will be the real stress test — has the full history rather than finding a bare number.
