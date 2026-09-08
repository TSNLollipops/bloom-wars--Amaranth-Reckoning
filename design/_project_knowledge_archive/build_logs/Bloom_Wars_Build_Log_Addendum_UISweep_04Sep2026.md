# Build Log Addendum — the whole-game UI sweep, 3–4 Sep 2026

Follow-on to `Bloom_Wars_Build_Log_Addendum_ActionBarPaging_03Sep2026.md`.
That pass ended with a screenshot showing the Battle action bar rendering
`6LAST RITES` as **"BAST RITES"** — live, on the game's most invested build,
with 1966 unit tests passing. Asked what to do next, Maxime picked the
option that generalised it: go looking for the rest.

**Four more shipped bugs found. All four fixed and committed.**

## 0. What shipped

**Fixes (`src/`):**

- `scenes/Hub.ts` — six invisible HUD readouts raised above the deck floors
  (`HUB_HUD_DEPTH`); the DECK indicator moved off the grotto's room label;
  the doubled `House House` prefix removed from two renderers.
- `scenes/TransporterPad.ts` — the deploy list now paginates instead of
  crushing itself, and its three text lines are anchored one way instead of
  three (`PAD_MIN_PITCH`, `PAD_PAGER_ROW_H`).
- `scenes/Hangar.ts` — WALKABLE HUB moved out from under the shop's pager.
- `data/__tests__/heirloomHouseNames.test.ts` (new) — pins the house-name
  convention at the data end.

**Harness (`tools/verify/`):** `auditUiText.mjs`, `sweepUi.mjs`,
`checkUiAuditSelfTest.mjs` (all new), plus the README.

**Verification:** `tsc`, `eslint`, `lint-cast-collision`, `vite build` clean;
**85 files / 1968 tests**; the sweep visits **28 screens, 0 skipped, 0
findings, 0 console errors**; the audit self-test passes.

> **Two caveats, both real.** `lint-spoiler.mjs` still cannot run in the
> sandbox (it needs `BW_RESERVED_TERM` from your git-ignored `.env.local`),
> so **run `npm run lint` locally once**. And the sweep is a text-geometry
> lint — it says nothing about colour, contrast, wording or whether a screen
> is *good*. It only proves no text is squashed, buried, or off the edge.

**No dependency changes.** `package.json` and `package-lock.json` are byte-
identical to what was on the device. An earlier version of this pass added
`pngjs` for screenshot diffing; that was reverted after noticing that
running `npm ci` in a Linux sandbox rewrites 25 platform-specific optional
entries (rollup's linux builds, lightningcss's) in the lockfile, and
committing that back to a Windows machine is a good way to break `npm
install` on your own box. The PNG decoding is now forty lines over Node's
built-in zlib.

## 1. The Hub's HUD was invisible — six readouts, one of them the whole calendar economy

The Hub draws six pinned readouts along the top: the room title, the
controls line, `THREAT`, Rourke's rank, `Day N`, and the `DECK` indicator.
**Every one of them was created, positioned, live-updated, and never once
seen by a player.**

All six were created at the default depth 0. Later in the same `create()`,
`drawDeckLayout()` drew the deck floors — also at depth 0. Same depth means
display-list order decides, and the floors are added afterwards.

**It broke on 3 Sep.** Before the carrier scale-up the floors were small
enough to leave the top strip bare, so depth never mattered. That pass
correctly pinned every HUD element with `setScrollFactor(0)` — which fixes
*where* a thing draws and says nothing about *whether anything draws on top
of it*. Position was solved; z-order was not; nothing failed.

What it cost:

- **`Day N` is the calendar economy's only on-screen output.** It shipped
  1 Sep and was invisible from 2 Sep.
- **The controls line is the only place the game tells a new player how to
  move.** For Early Access that is not cosmetic.

And the part worth sitting with: **`checkHubCameraScroll.mjs` had been
asserting some of those same labels' screen positions this whole time, and
passing.** A Text object's `x`/`y` is correct whether or not anything ever
painted it. The test was true and useless.

Fixed with `HUB_HUD_DEPTH = 20` — above the world (0), below every modal
overlay (60, ShopPanel 61), so an open Vault still covers the HUD as before.

Raising them then revealed a second, smaller collision: the DECK indicator
at `(16, 80)` landed on the grotto's own room label. Its original comment
explained that y=80 was chosen to duck under the instructions block — sound
reasoning that stayed sound right up until the row stopped being empty. It
now shares the top row with the rank line at `(190, 20)`, in real clear
space between that line's right edge and the centred title.

## 2. The Transporter Pad is unreadable at a full roster

The worst of the four, because of *when* it appears.

The deploy list spaced its cards at `available height ÷ roster size` with no
floor, and set each card's height to `pitch - 14`.

| roster | pitch | card height | result |
| --- | --- | --- | --- |
| 5 (Act I) | 86 | 72 | fine |
| **16 (three lances)** | **27** | **13** | three lines of 17px, 14px and 13px type stacked inside 13 pixels |

The lines drew through each other *and* through the cards above and below.
Not tight — unreadable. This is the screen the player passes through
**before every single mission**.

**Nothing failed.** The arithmetic is right, the types are right, every test
passes, no console error. A fresh save is five pilots, so anyone opening
this screen to check a change sees it looking perfectly fine. **It only
breaks after the player has earned two more lances** — the worst possible
time to find out.

Two fixes, because there were two problems:

1. **A floor, and paging past it.** `PAD_MIN_PITCH` is the smallest spacing
   that fits the three lines. Past that the list pages rather than shrinking.
   A roster that fits takes exactly the old path — a five-pilot Act I screen
   is unchanged, pager absent (there is a check for this).
2. **One anchor instead of three.** The three lines were anchored from the
   card's top, its centre, and its bottom respectively. At 72px that happens
   to look fine; it means the gaps *change size* as the card height changes,
   closing and then crossing. They are now one block, fixed height, centred.

**Flagging a design call rather than assuming it:** paging over scrolling.
Paging matches the shop panel's existing pager, needs no scrollbar, wheel
handling or mask, and is what the player has already met. Scrolling would
show all sixteen at once and is the better answer if paging feels cramped
in play. Cheap to switch — say the word.

## 3. `< PREV` / `NEXT >` drawn over the WALKABLE HUB button

In the Campaign Shop, `ShopPanel`'s pager sits at `viewportBottom + 8` = 574.
Hangar's WALKABLE HUB button sat at y=572, 260px wide, centred at 480. They
overlapped completely, leaving the label clipped to the gibberish
**`BLE HUB (PROTO`** between the two pager buttons.

Same shape as the Transporter Pad bug: the pager only renders when the shop
has more than one page, so a fresh five-pilot save never draws it. Invisible
until mid-campaign.

That button's own comment says it was given its own row *because* sharing
the footer row would overlap the Company Points label. It dodged one
collision and walked into another. Moved to x=525 on the 604 row, in the
real gap between SAVE AS... (240–380) and BACK TO MISSION SELECT (670–930).

## 4. "House House Dunmoor"

Every `HeirloomDef.pilot.house` in `data/heirlooms.ts` already spells the
word — `"House Dunmoor"`, `"House Rethwick"`. Two renderers in `Hub.ts`
wrote `House ${...house}` on top of it, so the Heirloom shortlist read
**"House House Dunmoor"** and the returned-home verdict line read "House
House Voss." Both plainly visible; nobody had read them. They surfaced in
the sweep's own report text.

Pinned by a test at the data end rather than by asserting anything about
`Hub.ts`'s source: the rule that matters is *the value is already a full
house name*, and any renderer respecting it is correct however it is written.

## 5. The harness, and why its self-test is not ceremony

`sweepUi.mjs` walks 28 screens — every menu, the Codex, Map Select, the
Hangar, the Transporter Pad, Battle (deployed / unit selected / end-turn
prompt), all four Hub decks and all twelve Hub overlays — screenshots each,
and runs four checks against the live Phaser display list:

| check | question | how |
| --- | --- | --- |
| `OVERRUN` | is a label wider than its button? | geometry |
| `COLLIDE` | do two sibling labels overlap? | geometry |
| `OFFSCREEN` | is pinned text outside the canvas? | geometry |
| `PAINTEDOVER` | did this label's pixels ever reach the screen? | **pixels** |

`PAINTEDOVER` is the one that earns the file, and the one that found §1: it
screenshots, hides every candidate label, screenshots again, and diffs each
label's own box. Geometry cannot see a buried label. Only pixels can.

**The sweep runs against a mid-campaign save**, not a fresh one. Two of the
four bugs above only exist at sixteen pilots. A fresh save hides exactly the
bugs a player hits after twenty hours.

### The audit reported all-clear three times while broken

Worth recording plainly, because it is the real lesson of this session:

1. It compared **world coordinates against screen pixels** — reported 1,611
   perfectly visible labels as invisible.
2. It grouped siblings by a key that **wasn't unique**, so nothing was ever
   actually compared — 2,400 findings, none real.
3. It **paused the scenes before enumerating them.** `getScenes(true)` means
   *active* scenes, and a paused scene isn't active, so it examined **zero
   labels and reported zero problems.**

The third is the dangerous one. It looked exactly like success: a clean run,
a green report, nothing to do. `checkUiAuditSelfTest.mjs` now breaks the
game on purpose — covers a readout, over-widens a button label, overlaps two
siblings, pushes a label off-canvas — and fails if the audit doesn't notice,
then confirms the real game is clean afterwards. **A green sweep with a red
self-test means nothing.** Run it whenever the audit changes.

The harness also created two of its own bugs before it was trustworthy: it
left overlays stacked between stops (118 findings buried by the harness, not
the game), and it treated the Hub's dock-local coordinates as screen
coordinates. Both are written up in the README as traps for the next script.

### For the next Battle or Hub script

- The game's coordinate space is **1074x640**, not 960x600. Scaling by 960
  puts a click ~110px off, and a miss on the canvas is a *legal board click*
  rather than an error — so it fails as "the button did nothing."
- The Hub's OVERHEARD dock renders through a **second camera**; its objects'
  bounds are **dock-local**. What gets pushed to `uiCameraObjects` is usually
  the *container*, so the space must be inherited by its children.
- The Hub **re-asserts `.visible` every frame**; anything hiding an object to
  measure it must pause the scene — *after* enumerating, not before.
- There is no `setDeck()`: the deck comes from `currentRoomId`.

## 6. Docs this changes

- **`Bloom_Wars_EA_Launch_Plan_31Aug2026.md`** — Week 1's outstanding
  "single pass that runs the full checklist together as one system" is now
  **partly** discharged: the text-legibility slice of it is automated,
  repeatable, and currently clean across 28 screens. The rest of that
  checklist (flow, balance, actually playing it) is untouched.
- **No GDD / Data Pack / Build Brief change.** Every fix restores what those
  docs already describe. The one thing that is arguably a design decision —
  paging the deploy list rather than scrolling it — is flagged in §2 as
  Maxime's call, not recorded as settled.

## 7. Still open, deliberately

The four remaining weapon branches (Riot Drum, Maser Lance, Suppression
Autocannon, Combat Medic) remain unstarted. Each needs a mechanic decision
and a `combat_sim.py`-validated number, and both are Maxime's call.
