# Bloom Wars — Build Log Addendum: Codex + Forgotten Plans Pass 1, 1 Sep 2026

Working session against `Bloom_Wars_Forgotten_Plans_Audit_1Sep2026.md` — Maxime: "we are doing them now. pick one, ask me your question, lets knock them all tonight." This addendum covers the first item closed and one audit correction found along the way. Session in progress; more items to follow as separate addenda or a consolidated follow-up.

## Audit correction found (verify-against-the-file pass)

The audit's own "Onboarding Tutorial" entry was accurate (`HOW_TO_PLAY.html` exists, unlinked from the pause menu — confirmed by reading `MenuOverlay.ts`/`MainMenu.ts`, neither referenced it). But the audit's Weapon Branch Expansion Plan entry — "`bloom_wellroot.attackPower` is still 60, the validated `20` candidate never shipped, pending Maxime's own sign-off" — is stale. Checked `src/data/bloom.ts` directly: **`attackPower` is `50`**, not 60. This matches `build_log/README.md` and the Master Index's own "RESOLVED, 28 Aug 2026" entries — that regression was already fixed weeks before this audit was written, shipped at 50 (not the 20 candidate either — see that resolution's own re-sweep of the full range). The audit doc appears to have pulled from an older snapshot of the Weapon Branch Expansion Plan doc rather than the actual current file.

**What's still genuinely open under the Mission 21 umbrella** is a different, later thread: the Weapon Branch Mission Balance Check found that with Impact Lance + Grinder Claw *equipped*, Mission 21 may read too easy (branches never having been tested against Wellroot's shape before). That plan's own recommendation is option 2 (retune Wellroot's Endurance or Undertow cadence) over option 3 (trim the branch numbers globally) — still needs Maxime's call, tracked separately, not touched tonight.

## Shipped tonight — the field-manual Codex

Maxime's own call, mid-conversation: instead of just wiring a pause-menu link to `HOW_TO_PLAY.html`, build a Mass-Effect-style in-game codex — "you got the credit to roll it, [option] 2. we are going full ham plus ultra on the game." Flagged the scope jump before building (link → new UI system) since that's a real category change under this project's own scope-flagging rule; Maxime confirmed knowingly.

**New file:** `src/scenes/Codex.ts` — a two-pane scene (category list left, detail pane right), recreating all 9 sections of `HOW_TO_PLAY.html` (Controls, Reading the Board, Terrain, Health/Shield/Collapse, the Class Triangle, Abilities & House Rules, Objectives, Roster, Mission Briefings) with real Phaser Graphics — terrain color swatches, the four unit-shape icons (geometry pulled directly from `Battle.ts`'s own `drawUnit`, not redrawn from guesswork, so they match the real board exactly), the class-triangle matrix, tag chips. Paged rather than scrolled for the three content-heavy sections (Terrain, Abilities, Missions) — matches `ShopPanel.ts`'s own established convention rather than inventing a scroll idiom.

`HOW_TO_PLAY.html` itself is untouched and still exists standalone — the codex is a second, in-game presentation of the same source content, typed by hand from that file's own sections (not read from it at runtime), so the two can drift if the file's content ever changes without a matching codex update. Worth a note for whoever next edits the manual.

**Wiring:**
- `src/main.ts` — `Codex` added to the scene list (between `Options` and `MapSelect`).
- `src/scenes/MainMenu.ts` — new "CODEX" button on the title screen (after OPTIONS), so a player with no campaign started yet can still reach it.
- `src/scenes/MenuOverlay.ts` — new "CODEX" row in the shared in-play pause menu (after OPTIONS, before RETURN TO MAIN MENU); panel grew 320→380 tall to fit it without crowding CLOSE against the edge.

**Verification done tonight (no `device_bash` on this session, so the real repo's own `npm run typecheck`/`npm run lint` couldn't be run directly):** built an isolated check — real `phaser@^3.90.0` and `typescript@~6.0.2` (matching `package.json` exactly) installed fresh, the project's actual `tsconfig.json` compiler options copied verbatim (including `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`), and `eslint.config.js`'s `typescript-eslint` recommended rules. `Codex.ts` typechecked and linted clean against that setup. The three wiring edits (`main.ts`, `MainMenu.ts`, `MenuOverlay.ts`) were small, pattern-matched insertions (verified by hand against the existing OPTIONS button in each file) rather than run through the same isolated check, since they pull in the real `engine/campaignState.ts` dependency graph. **Recommend an actual `npm run typecheck` (or just `npm run dev` and clicking through it) on your machine before calling this fully verified** — the isolated check is strong evidence, not the same as the project's own real build.

## Still open from tonight's punch list

Stress & Morale trigger decision, the cheap Weapon Branch adds (Field Doctor/Aegis Ward), the Mission-21-with-branches-equipped balance question, an Electron packaging status check, and locating the Pilot Discharge & Roster Pressure doc — all still pending, tracked in this session's own task list, not yet in a doc.
