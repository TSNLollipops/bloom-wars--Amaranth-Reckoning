# Sync Note — 7 Sep 2026, afternoon session: Codex rework (sandbox) + Sensor Array / Generator gate (built)

*Why this exists: this session had no shell on Maxime's machine and neither `Bloom_Wars_History.md` nor `Bloom_Wars_Now_And_Next.md` has a copy on his device to stage, so the only way to update either from here was to retype 40–80 KB from memory through `project_write` — the exact silent-drift risk Foundation's working rules exist to prevent. Not done. This note carries the entries ready to fold in with exact-match edits by the next session that has the files on disk. The Master Index calls the sync-note habit a fossil risk; it is, so this one is short and pointer-shaped, and the two addenda it points at are the authority either way.*

## For `Bloom_Wars_History.md` — one new entry, append after "Player-Talk Conversation Lock — 7 September 2026"

> ## Sensor Array wired, Generator gate extended — 7 September 2026
>
> Surfaced by the codex rework itself: writing the Systems shelf's "The Sensor Array" entry meant checking what the bay actually does, and the answer was nothing — `sensorArray` existed in the engine only as the two facility profiles' bay markers, buildable for company points since 28 Aug and read by no fog, no mission, no scene. Maxime: *"ah. better fix those two buildable room. do that while I check the codex."* Built: the Long-Range Sensor Array's 23 Aug design (every standing hostile on the board once built; burrowed and concealed still hidden) as an optional `{ sensorArray }` argument on `engine/ai.ts`'s `unitsVisibleToSide`, applied through one new `Mission.playerVisibleHostileIds()` that `Battle.ts`'s fog, both Deadfall pools, Ledgerhall Static, and the sim bot's honest-vision profiles now all route through. The Generator gate moved out of `Hub.ts` into a tested pure rule in `engine/campaignEconomy.ts` (`GENERATOR_DEPENDENT_BAYS`, `bayNeedsGeneratorFirst`) and grew to cover Weapons Bay and Sensor Array; the Fabricator — the first bay ever named Generator-dependent — stays ungated, flagged. Construction-time only; no save loses a bay. **101 files / 2524 tests** (+14, `sensorArray.test.ts`), `tsc`/eslint/`vite build` clean, all run in a sandbox mirror staged from all 236 device files whose untouched baseline matched the last gate exactly. Eight files committed, zero rejections. Full account: `claude/Bloom_Wars_Build_Log_Addendum_SensorArrayAndGeneratorGate_07Sep2026.md`.
>
> **Genuinely still open:** nobody has built the array on Maxime's own screen and watched a far hostile appear; `npm run lint` on his machine for the real spoiler pass (no new player-facing strings, so nothing expected); the Fabricator's gate, one line, waiting on his word.

## For `Bloom_Wars_Now_And_Next.md`

**Top-of-file pass note to add (eleventh pass, 7 Sep 2026, afternoon):** the Codex rework moved from complaint to sandbox in one session — `Bloom_Wars_Codex_Rework_Plan_v1.md` is the plan, the artifact "Bloom Wars Archive Sandbox" (v1.6, 80 entries, 33 drafts) is the mockup, four structural decisions are answered (below), the content is in Maxime's hands for veto, and nothing is built in the game. The Sensor Array / Generator gate build (above) fell out of it.

**"Where the game is" → the "Systems live and playable" paragraph:** the phrase "a save-aware Codex across six lore categories" is still true and stays; add after "Beacon Control mid-mission revives with the Restock Room economy": *"the Long-Range Sensor Array (built 7 Sep — every standing hostile on the board once it and the Generator stand; burrowers and cloaks still hidden), and a Generator gate that now covers Weapons Bay and Sensor Array as well as Beacon/Restock."*

**"Verification gate at last commit"** → replace the parenthetical with "(Sensor Array / Generator gate, 7 Sep, ~17:10 UTC): 101 test files / **2524 tests, all passing**, `tsc` 0 errors, `eslint` clean on every touched file, **`vite build` clean**." Keep the rest of that paragraph as-is.

**"On the table to build" → add one bullet under "Content and systems with a decided shape":**
- **The Codex rework — planned, mocked up, decided, not built.** `Bloom_Wars_Codex_Rework_Plan_v1.md`. Access: a console in Warden's CIC and House Amaranth's Records room (no new Warden room). Shape: a full-canvas scene, five shelves / thirteen sections, a scrolling reader, provenance-stamped documents with a three-step reliability mark (the mechanism that lets research papers be wrong in-fiction). `src/data/codex.ts` survives and gets `kind`/`section`/`provenance`; `scenes/Codex.ts` is replaced; Main Menu and pause-menu CODEX buttons go, the Field Manual stays on the pause menu as HOW TO PLAY; launch-and-pause so the Hub is untouched on return. Four decisions answered by popup 7 Sep (official Coalition primer available from day one; species culture in full, no COE political history, preserves' existence and official framing allowed; manual-only mid-mission; launch-and-pause). 33 draft entries on the sandbox shelves await Maxime's veto — nothing is canon until he says so, and the build waits on "go."

**"Needs Maxime's call" → add:**
- **The Fabricator's Generator gate.** The first bay ever named Generator-dependent (23 Aug), now the only one of five not enforced in code. One line in `GENERATOR_DEPENDENT_BAYS`. Yes or leave it.
- **"Warden Holdings"** as the name of the parent holding that was eaten by Bloom overgrowth, and **"fallow" as a deliberate firebreak** — both Claude's inventions in the codex drafts, both need a yes.

**"Yours specifically" → add under the docx list, since these are now canon-wrong shipped text:** `src/data/codex.ts`'s `co` Personnel entry (the CO is one of the last gladiator hulls, in command since the war began — not an Understrand arcology kid), its `system_heirloom` Systems entry (describes Gjallar's charge mechanic as the whole Heirloom system), and its "The Requiem system" glossary line (names the Mission 12 transfer from the first Hub visit). All three rewritten as drafts in the sandbox; they land in code with the rework, or as a small data-only fix sooner if wanted. The source docs — `Personnel_Codex_Entries_v1`, `Systems_Codex_Entries_v1`, `Glossary_Codex_Entries_v1`, and the CO's row in `NPC_Catalyst_Formula_Closing_And_Roster_Assignments_v1` §4 — are stale the same way.

**"Needs verifying" → add:**
- **The Sensor Array on Maxime's own screen.** Build Generator, build Sensor Array, deploy, watch a hostile outside every pilot's vision appear — and a burrowed Undertow not.
- **The Mission 12 Gjallar transfer if Bosk is still alive.** The sandbox's Requiem System entry has a revision after 12 written neutral because nobody checked what the Vault transfer does when Bosk survives. Read `resolveRequiemEarlyEquip`/the Mission 12 dedication path before the codex build.

**Stale lines to delete or correct in that file:** none of its existing bullets claim the Sensor Array works, so nothing false is in there — but the Beacon Control entry's "the other three are a separate, pre-existing gap, not retrofitted this pass" framing (History, 4 Sep) is now two-thirds closed.

## For `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §11.2 and `Bloom_Wars_Weapons_Bay_And_Fabricator_Delivery_v1.md`

Sensor Array row: "**Built, 7 Sep 2026** — see `..._SensorArrayAndGeneratorGate_07Sep2026.md`." Weapons Bay row's Generator note: "enforced 7 Sep 2026." Delivery note's "Open, for you" #1 (Generator-independent — no longer, for Weapons Bay) and #3 (wire the other four — Sensor Array done; Generator is a gate; Beacon/Restock done 4 Sep) are answered. Same fold-in-on-next-pass convention those docs already use.

## Docs made stale by the codex sandbox's canon corrections (recorded in `Bloom_Wars_Codex_Rework_Plan_v1.md` §4 and §6, listed here once so the next History pass sees them)

`Bloom_Wars_Coalition_Lore_Codex_Entry_Plan_v1.md` §1/§7 (the formal name now appears in an official primer from day one); `Bloom_Wars_Combat_Encounter_Line_Content_Brief_v1.md` §4 (Warden's origin: the holding was overrun, not distracted); `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §1 ("the Antfarm" is not an in-fiction name any more — Maxime: no reference in lore text); `Bloom_Wars_Qiraki_Crossover_Decision_v1.md` "still open" (structure on the page, political history never; preserves' existence and official framing allowed).
