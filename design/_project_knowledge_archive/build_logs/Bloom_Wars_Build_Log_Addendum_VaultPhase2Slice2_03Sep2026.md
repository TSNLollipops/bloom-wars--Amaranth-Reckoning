---
title: Build Log Addendum — Vault Phase 2, Slice 2 (The Shelf — Field/Unfield + Ability Rank Shop)
date: 3 Sep 2026
status: shipped, committed to device
---

# What this addendum covers

Vault Phase 2 ("the shelf") was the one piece of the Vault's four-job model still unbuilt going into this session — Phases 1 (the counter — recruit), 3 (the wall — holdings/grievance display), and 4 (the dedication — Mission 12 scene) all shipped 2 Sep 2026. Phase 2's original blocker was blunt: "the ~30 Heirloom combat abilities don't fire in combat yet, so a rank-up shop for them would be lying to the player." That blocker went half-stale the same day Phase 2 was scoped — Vault Phase 2 Slice 1 (also 2 Sep 2026) wired exactly 5 of those abilities into real combat effects. This slice is the shop UI that was withheld until that happened: field/unfield the company's one active Heirloom, and rank up abilities — but honestly, only the 5 that are real.

# What shipped

**`src/data/heirlooms.ts`** — one new exported constant, `HEIRLOOM_ABILITIES_LIVE_IN_COMBAT` (a `ReadonlySet<string>` of the same 5 ids Slice 1 wired: `oath_iron_word`, `lastword_field_triage`, `farsight_signature`, `salt_root_salt`, `ledger_overextended`). This is the single source of truth the Vault shelf reads to decide whether "rank this up" is honest to offer — it does not duplicate or re-derive the list `engine/mission.ts`'s own `canX()` gates already encode; those stay the real, load-bearing gate on whether an ability fires. The constant exists purely so a shop screen doesn't have to hand-copy a second list that can silently drift out of sync as more abilities get wired in future slices.

**`src/scenes/Hub.ts`** — `renderVault()`'s "HOLDINGS & HOUSE STANDING" section (renamed "HOLDINGS & THE SHELF") now renders, per held Heirloom:

- A `[FIELDED]` tag next to the title when it's the company's one currently-fielded Heirloom (`HEIRLOOM_FIELD_LIMIT = 1`, unchanged), plus a `[ field ]` / `[ unfield ]` toggle button — shown only when the holder is an active pilot (a Heirloom whose holder is dead or MIA can't be fielded or unfielded from here, matching `fieldHeirloom`'s own refusal).
- Every one of that Heirloom's 3 abilities, each showing its current rank and next-rank cost — or, for the 23 abilities not in `HEIRLOOM_ABILITIES_LIVE_IN_COMBAT`, "(not implemented in combat yet)" in dimmed text with no buy button at all. A `[ rank up ]` button appears only for a live ability, below max rank (5), with an active holder who can afford the next rank's cost from their own PERSONAL points.

Three new handler methods (`fieldFromVault`, `unfieldFromVault`, `rankUpFromVault`) call straight through to the already-tested `engine/heirlooms.ts` functions (`fieldHeirloom`, `unfieldHeirloom`, `purchaseAbilityRank`), save state, and re-render — same `{ ok, reason }` refusal pattern every other Hub shop screen in this codebase already uses, so a refusal shows the engine's own sentence verbatim rather than a second hand-written error string.

# Verification

`Hub.ts` has no dedicated unit test suite (Phaser-dependent code can't run outside a browser), so this codebase's established bar for a Hub.ts change is the full chain plus a live-browser check:

- `npx tsc --noEmit` — clean
- `npx eslint .` — clean
- `npx vitest run` — **1758/1758 passing** (74 files), zero regressions
- `npm run build` — clean (prebuild's spoiler-lock and cast-collision lints both clean too)
- **Live-browser Playwright check** (new script, `tools/verify/checkVaultShelf.mjs`, paired with `tools/verify/genVaultSave.ts`): booted the real dev server, seeded a save with "iron_oath" (Vindex) recruited but deliberately left unfielded, its holder funded with exactly enough personal points for one rank-up. Opened the real Vault overlay via the scene's own `openVault()`, then read the *actual* rendered Phaser Text objects out of `window.__bwGame` to find the real on-screen `[ field ]` and `[ rank up ]` buttons and clicked them with real mouse events at their real screen coordinates — not by calling the handler methods directly, so a missing `setInteractive()` or a wrong depth/scrollFactor would have shown up as a failed click, not a false pass. Confirmed, in order: the field button actually fields Vindex (state + the `[FIELDED]` tag reappearing after re-render); the rank-up button advances `oath_iron_word` from rank 1 to rank 2 and debits exactly 250 personal points; the button relabels to `[ unfield ]` and clicking it clears fielded; and — reloading `localStorage` fresh rather than trusting the live scene's in-memory state — both the rank and the unfielded state actually persisted through `saveCampaignState()`. Zero console/page errors across the whole run.

One cosmetic thing noticed, not a bug and not touched: the House Offers panel above the Shelf prints "House House Amaranth" / "House House Solenne" / "House House Rethwick" — a doubled "House" prefix, pre-existing in that display string, unrelated to this slice. Flagging it since it showed up in the verification screenshot; small fix whenever it's worth a minute.

# Interpretation calls

- **Rank-up cost and afford-check use the holder's own PERSONAL points**, not company points — matching Decision 2 in `Bloom_Wars_Vault_Build_Plan_v1.md` (the aristocrat signing pool / Option B). If a different pilot ends up holding the Heirloom later, that pilot's own personal points balance is what the shop checks, not whoever ranked it up originally.
- **Ranks earned on an ability persist even while it's holstered** (not fielded, or the Heirloom currently benched) — ranking up only requires the holder to be an *active* pilot, not that the Heirloom itself be fielded. This matches the existing `purchaseAbilityRank` engine function as written; flagging because "can you only invest in the one you're currently running" is a real alternative design this doesn't do.
- **The 23 not-yet-wired abilities are shown, not hidden.** Deliberately: it lets the player see the full shape of what a Heirloom will eventually do, at the cost of a visible "not implemented" tag that's an honest admission the game isn't finished yet. The alternative (hide them entirely, show only the 5 abilities' worth of live content) would look more "complete" but would misrepresent an ability list that's actually there in the data — same refusal-is-honest discipline the recruit and combat-refusal UI already commit to.

# Still open / not touched this pass

- The other 23 Heirloom abilities' rank-up stays honestly disabled until future slices wire them into combat, same pattern Slice 1 established.
- The doubled "House House X" string noted above.
- `Bloom_Wars_Vault_Build_Plan_v1.md`'s own status section — updating next to mark Phase 2 shipped in full (Slice 1 + Slice 2).
- Separately from the Vault: the "BACK TO HANGAR" button naming-clarity question and the 7-item Playwright verification backlog are both still open from earlier this session, untouched by this slice.

# Verification summary

- `tsc --noEmit`: clean
- `eslint .`: clean
- `npx vitest run`: 1758/1758 passing (74 files), zero regressions
- `npm run build`: clean
- Live-browser Playwright check (`checkVaultShelf.mjs`): all assertions passed, zero console errors, state changes confirmed to persist through `localStorage`
- 2 files committed to device (`src/scenes/Hub.ts`, `src/data/heirlooms.ts`), zero commit rejections, `expectedMtimeMs` guard checked fresh against the device immediately before commit
