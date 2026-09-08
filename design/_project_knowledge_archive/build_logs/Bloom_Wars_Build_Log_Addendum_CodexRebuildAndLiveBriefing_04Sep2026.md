# Build Log Addendum — Codex Rebuild & Live Briefing (Part A + Part B)
**4 Sep 2026**

Ships `claude/Bloom_Wars_Codex_Rebuild_And_Live_Briefing_Plan_v1.md` end to end. That plan doc had three open forks in its §4; all three got resolved via a direct question to Maxime before anything was built:

1. **Sequencing** — build both workstreams in this pass, not one now/one later. ("both of them. you got time")
2. **Passive-scan depth** (Part B) — composition & count only, no per-unit stat readout.
3. **Briefing panel placement** (Part B) — Freespace-style: a real full-panel briefing opens the moment you accept the brief from the CO, not an inline chat reply.

Everything below shipped and is committed to the real repo (`F:\The Bloom wars. Code project\bloom-wars\bloom-wars`).

## Part B — the live briefing panel

**What it replaces:** talking to the CO and asking for the brief used to return one hardcoded placeholder line, regardless of which mission you were actually on.

**What it does now:** the same chat action opens a real full-screen panel (new file `src/scenes/MissionBriefingPanel.ts`, same standalone-panel pattern `StandingsPanel.ts` already established) showing:
- the real mission name for whatever comes next in the Warden campaign order,
- real narrative briefing text pulled from the mission's own source material,
- a plain-English objective line,
- a **composition & count only** passive intel scan — how many of what unit types you're about to face, no stat readout, per Maxime's call above.

**New data-layer code** (`src/data/missionBriefing.ts`): `WARDEN_MISSION_ORDER` (the 36-mission campaign sequence as data, not scattered logic), `nextWardenMission`, `describeObjective`, `passiveScan`, plus two small additions made in this pass for Part A to reuse — `wardenMissionIndex(missionId)` and `highestWardenMissionIndexReached(lastMissionEcho)`. That second one is the "how far has this save actually gotten" query both parts needed, so it lives once in the mission-order module rather than twice.

**Tests:** `src/data/__tests__/missionBriefing.test.ts`, 29 passing (was 24 before this pass — 5 new cases covering the two added functions, including the "unrecognized mission id" and "nothing resolved yet" edge cases).

**Live-verified:** real chat interaction in a running browser (Playwright against the actual built game, not a mock) — asked the CO for a brief, confirmed the panel opens with the correct mission name/text/objective/scan for a save sitting at a known point in the campaign.

## Part A — the Codex goes live

**What it replaces:** the in-game Codex (`src/scenes/Codex.ts`) was a static 9-section manual — same text no matter who was playing or how far they'd gotten. Fine for rules reference, but the six lore categories (Personnel, Bloom Bestiary, World/Coalition, Systems, Ranks & Command, Glossary) that already existed as fully-written source docs were never actually wired into the game at all.

**What it does now:** those six categories are real, playable Codex tabs (10 through 15), each reading live off the player's actual save:

- **Personnel** — real bios for Rourke, Bosk, Iyari, Anand, Lask, and the CO, each with a live-computed status line. Rourke's line never changes regardless of save state (per her write-up — always framed as "still in the field, win or lose"). The other four read the save's real pilot status: active, reassigned, or permanently lost — and if lost, which mission, which turn, straight off the same `CampaignPilotEntry` data the Debrief screen itself already tracks. No hardcoded "pilot X dies in mission Y" branch anywhere — if you don't lose Bosk, the Codex never claims you did.
- **Bloom Bestiary** — 9 entries, each locked until the save has resolved (won or lost, doesn't matter) the mission that first fields that enemy type. Locked entries show a real "not yet encountered" stub, not a blank or an error.
- **World** — 4 entries (Coalition, Amaranth Reach, House Amaranth, Meridian), each with multiple revisions that unlock as the campaign advances — you're reading the SAME entry differently at mission 5 vs mission 25 as the political situation actually changes, not a new entry appearing.
- **Systems, Ranks & Command, Glossary** — no gating at all, browsable from a completely fresh install with no save. These are reference material, not spoilers.

**New data module:** `src/data/codex.ts` — this is deliberately a pure data file with no engine imports (the project's own eslint rule blocks `src/data/**` from importing `../engine`, `../scenes`, etc., so gating logic here works off plain passed-in values, never live engine types directly).

**Three judgment calls made explicit in code comments, flagging them here too since they're interpretive, not spec:**

1. *Personnel "unlock" timing.* The source doc says entries unlock "Mission 1, roster join" — but all 5 named pilots are already on the roster the moment a campaign is created, before Mission 1 is even flown. Built it as: Personnel is visible whenever ANY save exists at all. That's mechanically identical to "unlocked at roster join" for every real save, just without a fake gate that would never actually block anyone.
2. *Bestiary "first encounter."* There's no tracking anywhere in the save of which enemy types you've actually SEEN. Rather than add that (real new save-state, real scope growth I didn't think was worth it for a Codex gate), each entry unlocks once the save has resolved the mission that first fields it — win or lose. Flagged in the code as "under-unlocks rather than guesses": worst case you see a bestiary entry one mission "early" relative to a hypothetical retreat-before-contact edge case, never a spoiler.
3. *Systems/Ranks/Glossary gating.* The individual source docs each have their own "(unlocks — proposed: Mission X)" notes, but every one is marked "proposed," never confirmed, and the master plan doc's own §2 already settled this at the category level: these three stay fully browsable with no save. Followed the plan doc's resolved call over the docs' own unconfirmed per-entry notes.

**Wiring:** both places that open the Codex — the Main Menu's own CODEX button (`src/scenes/MainMenu.ts`) and the shared in-play pause-menu CODEX button (`src/scenes/MenuOverlay.ts`, used by Hub/Hangar/MapSelect/Debrief) — now pass the live `CampaignState` through instead of nothing. `Codex.ts` gates Personnel/Bestiary/World on whether that state has a Warden pilot roster at all (a House Amaranth save, or no save, gets an honest "no record" placeholder instead of an error).

**Tests:** new `src/data/__tests__/codex.test.ts`, 23 passing — covers entry ordering, every gating boundary (locked/unlocked edges, the multi-revision World walk-forward logic including "nothing unlocked yet"), and confirms Systems/Ranks/Glossary carry no gate fields to accidentally gate on.

**A real bug this pass's own live verification caught, not code review:** the category list on the left side of the Codex screen used a fixed 50px row spacing that fit the old 9 categories fine. Adding 6 more (15 total) pushed rows 11 through 14 off the bottom of the game's 640px-tall canvas — genuinely unclickable in the shipped game, not just visually cramped. This wasn't caught by `tsc` or eslint (nothing type-unsafe about it) — it surfaced because the verification script's own clicks on Systems/Ranks/Glossary kept landing on stale content. Fixed by making the row spacing size itself to however many categories actually exist, capped at the original 50px so the list looks unchanged with fewer categories. Screenshot-confirmed all 15 rows fit and are clickable.

**Live-verified end to end**, three scenarios against the actual running game in a real browser (`tools/verify/checkCodex.mjs`, cloud-sandbox-only script, not shipped):
1. Main Menu, no save at all — Personnel/Bestiary/World show the honest placeholder, Systems/Ranks/Glossary show full content anyway.
2. Main Menu, a save loaded that hasn't resolved a single mission yet — Personnel shows all 6 real bios, Bestiary shows everything locked, World shows only its ungated opening revisions.
3. In-play pause menu (Hub), a save advanced through Mission 20, plus a live mutation of the save (marking Bosk permanently lost) made moments before opening the Codex — proving the status line is a live read of the actual save object, not baked-in text. Bestiary correctly unlocked through Sirenmaw (Mission 12) and kept Wellroot/Unnamed locked; World's Coalition and House Amaranth entries both advanced to their correct revision for that point in the campaign.

Zero console errors across all three scenarios once the script itself was debugged (see below).

**Script bugs along the way (all in the verification script, not the game):** a leftover `addInitScript` clearing localStorage before the first page load was silently wiping out the save set up for scenario 2 the instant scenario 2's own page reload fired — removed, since a fresh browser context already starts empty. A case-sensitive string check missed real prose ("too regular" vs "Too regular"). Two checks assumed an entry would be visible on whatever page was currently open without paging forward to it. All fixed; final run is clean.

## Full verification gate (both parts, combined)

- `tsc --noEmit` — clean
- `eslint` — clean
- `tools/lint-cast-collision.mjs` — clean
- `tools/lint-spoiler.mjs` — clean (no-op in this sandbox, `BW_RESERVED_TERM` unset, as always)
- `vitest` — 2058 tests passing (up from before this pass — 29 in missionBriefing.test.ts, 23 new in codex.test.ts)
- `vite build` — clean

All changes committed to the real device repo (`F:\The Bloom wars. Code project\bloom-wars\bloom-wars`), staged and committed through the device bridge with a fresh mtime-drift check immediately before each commit. Nothing was hand-edited on generated files; `combat_sim.py`/`maps.py` weren't touched by this pass at all (no balance or map changes here).

## What's still open (not built in this pass, not blocking)

- **House Amaranth's own Codex content.** Personnel/Bestiary/World are scoped to the Warden campaign only (per the plan doc). A House Amaranth save gets the honest "no record" placeholder for those three tabs, same as no save at all — there's no House Amaranth-side Personnel/Bestiary/World material written yet to wire in.
- **The CO's display name.** His in-code `displayName` is still a placeholder string. Codex.ts hardcodes a safe stand-in for now so the Personnel tab doesn't show something obviously wrong — needs Maxime to actually pick the CO's name at some point.
- **Rourke's "empty bio" flavor idea.** The Personnel source doc floats an idea for how Rourke's own entry might read differently depending on save state; not implemented — her bio is static text, only her status line is live. Worth a look later, not scoped into this pass.
- **Personnel card visual polish.** Functional, unlike-to-overflow, but no pass was made on internal card spacing/typography beyond what the existing Codex chrome already provides.

## Docs touched by this pass

- This addendum (new).
- `claude/Bloom_Wars_Codex_Rebuild_And_Live_Briefing_Plan_v1.md` §8 — status updated to shipped, pointing here.
- `claude/Bloom_Wars_Master_Index.md` — new dated pointer section added.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
