# Build Log Addendum — the Archive console is playable (7 Sep 2026)

**Status: shipped to `F:\The Bloom wars. Code project`. Walk to the tactical table in the CIC, press E.**

Step 2 of the codex rework. The data layer from this afternoon now has a screen and a way in.

## The way in — Maxime's call

> *"make the table in the cic the place to toggle it."*

Warden's console is the **CIC's tactical table**, `tacticalTable(805, 268)`, which has stood there since the floor-plan pass. `CIC_TABLE_POINT = { x: 880, y: 306 }` is that slab's centre.

House Amaranth's is the **reading table in Records** — also existing furniture. That room's own layout comment has read *"decor-only (Q5): the future home of a records terminal"* since it was built. It is now that terminal. `GH_ARCHIVE_TABLE_POINT = { x: 1310, y: 790 }` is the centre of the `readingTable` already there; the call was repointed at the constant rather than a second table being added.

**No new furniture in either building.** Both consoles are tables that were already in the room with nothing to open.

## Files

| File | Change |
|---|---|
| `src/scenes/Archive.ts` | **new** — the three-pane reader scene |
| `src/engine/facility.ts` | `FacilityPoints.archiveTable` + `FacilityProfile.archiveRoom` |
| `src/engine/hubLayout.ts` | `CIC_TABLE_POINT` |
| `src/engine/hubLayoutHouseAmaranth.ts` | `GH_ARCHIVE_TABLE_POINT`, reading table repointed at it |
| `src/engine/facilityWarden.ts` | wires the point, `archiveRoom: "cic"` |
| `src/engine/facilityHouseAmaranth.ts` | wires the point, `archiveRoom: "records"` |
| `src/scenes/Hub.ts` | `ARCHIVE_TABLE_RADIUS`, `isAtArchiveTable()`, prompt, both E paths, marker, `openArchive()` |
| `src/main.ts` | registers the scene |
| `src/engine/__tests__/archiveConsole.test.ts` | **new** — 7 placement tests |

## Launch-and-pause, and the bug hiding inside it

Q4 decided the Hub stays exactly as you left it. So `openArchive()` **launches** the Archive and **pauses** the Hub rather than starting a new scene. First screen in the game to work that way.

That is also where the one real bug of the pass lived. **A paused Phaser scene still renders** — `pause()` stops `update()`, not drawing — and scenes draw in the order `main.ts` lists them, where `Hub` comes after `Archive`. The first version launched the Archive, made it active, gave it input focus, and drew it *underneath the Hub*. Every assertion passed. The screenshot showed the Rec Room.

Fixed with an explicit `this.scene.bringToTop("Archive")` at the launch site, with a comment saying why, because the next person to write a launch-and-pause screen will hit exactly this.

## Three more caught by looking at the screen

1. **The rail counted furniture as documents.** Personnel's rows include the lance and struck-group headers, so the Warden roster read "6" beside five pilots. Now counts pilots and unlocked entries only.
2. **"NO CAMPAIGN LOADED" on a loaded campaign.** The header keyed off `resolved > 0`, which is false at mission 0 of a perfectly real save. Now keys off whether there is a save at all.
3. **Rourke was a 2nd Lt. in the list and a Major in her own file, on the same screen.** The list read `pilot.displayName` raw while the reader used `archiveDisplayName`. Fixed, and pinned by a test that asserts the two panes name her identically.

A fourth was a message rather than a bug: an all-locked shelf said *"Nothing on this shelf yet."* A bestiary with ten sealed creatures in it is not empty, it is ahead of you. It now says how many documents are there and that they unlock as the campaign reaches them.

## Gate

**Typecheck clean · eslint clean · cast-collision lint clean · 103 files / 2553 tests passing · `vite build` succeeds.**

Headless Playwright run against the dev server, on a save 14 missions in:

- pressing E at the table opens the Archive and pauses the Hub
- all thirteen sections render, each picks a first entry
- gates move with the campaign — Bestiary 0 → 7 and Research 0 → 5 between mission 0 and mission 14
- the live block reads the save: Bosk showing `STRESS carrying it 30`, `MORALE high 75`, `STANDING 35`, `CLOSEST ABOARD Cpl. Priya Anand — "Farsight"`
- promoting Rourke mid-session relabels her in both panes
- ESC returns to the Hub, unpaused, where the player was standing
- zero console errors other than missing portrait assets, which are absent from this sandbox's copy of `public/` and load fine on the real machine

**`lint-spoiler.mjs` still skips here** — `BW_RESERVED_TERM` lives in a git-ignored `.env.local` that never leaves Maxime's machine. Run `npm run lint` locally before shipping.

## Still to do

- `campaignState.ts` `npcSocialStates` side table, so the CO's and the Meks' social state survives a reload (Q8)
- Field Manual data edits — `ABILITIES` / `OBJECTIVES` / `ROSTER` / `MISSIONS` and the `SECTIONS` deks in `scenes/Codex.ts`
- `facilityHouseAmaranth.ts` Verinis catalyst, shark → cat
- Retire `scenes/Codex.ts` down to the manual alone: pause-menu CODEX button becomes HOW TO PLAY (Q3)
