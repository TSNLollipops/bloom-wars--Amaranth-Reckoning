# Build Log Addendum — the UI audit's viewport blind spot, and a verify script that was grading the wrong button (3–4 Sep 2026)

Two fixes to `tools/verify/`, both to checks that were reporting green while
being unable to see the thing they existed to see. Neither is game code.

---

## 1. OFFSCREEN measured the canvas, not the viewport

`Bloom_Wars_Build_Log_Addendum_HangarShopDockClip_04Sep2026.md` flagged this
itself and left it: *"its OFFSCREEN check compares against the 1074×640
canvas, not a scene's own (possibly narrower) main-camera viewport... Worth
fixing that blind spot in the audit tool at some point; not done today."*

Done now. Hub's **main camera is 838 wide** — the OVERHEARD dock owns
everything past `DOCK_SPLIT_X` on a second camera — so a pinned label at
x=900 is drawn nowhere at all, and the old rule called it fine because 900
is comfortably inside 1074. `auditUiText.mjs` now measures each pinned label
against the viewport of the camera that actually renders it, and dock-space
objects against the dock camera's own viewport (their coordinates are
dock-local; comparing them to the main viewport is the same category error
the existing space/dockSet machinery already exists to prevent).

**A self-test case now pins exactly the behaviour that changed.** Worth
being precise about, because the existing step 5 does *not* prove the fix:
it injects a label at x=1020 that runs past 1074 as well, so the old canvas
rule would have caught that one too. The new step 5b injects at x=900 —
inside the canvas, outside the viewport — which can only be caught by
measuring the right rectangle. It fails on the old rule and passes on the
new one.

**Honest limit, stated rather than glossed:** I could not get the original
4 Sep Hangar-Shop clipping to reproduce from the sweep's own save even with
the `fitWidth` fix removed, so this closes the *rule*, and it is not proven
that the 28-screen sweep would now catch that exact screen. What is proven
is that the rule now measures the correct rectangle and that a label in the
dead zone is caught.

## 2. The sweep's save had every pilot at 0 points

The other half of the same blind spot, also named in that addendum: *"The
sweep's own save file has every pilot at 0 personal points too, so even a
longer test string never got exercised."* A layout audit run against
uniformly short labels is an audit of a screen nobody plays.

`genSave.ts` now seeds a realistic midgame spread (1,234 / 480 / 96 / 2,750
/ 610) plus one deliberately extreme 999,999 balance, so both the ordinary
case and the widest string the UI can ever be asked to render are on screen
together.

## 3. `checkVaultShelf.mjs` was clicking one button and grading another

This one failed loudly during tonight's verification pass, which is how it
was found. **It fails identically on the pristine code currently on the
device**, checked by running it against an untouched copy of the repo — so
it is not a regression from tonight, and it has been doing this since the
shelf shipped.

What it did: took `rows.find(text === "[ rank up ]")` — the *first* rank-up
button on the shelf — clicked it, then asserted that `oath_iron_word` had
advanced to rank 2. Vindex (`oath_oathkeeper`) is listed above Iron Word and
is **also** in `HEIRLOOM_ABILITIES_LIVE_IN_COMBAT`, so it has its own rank-up
button, and that is the one the click was landing on.

The failure looked alarming — 250 personal points spent, rank still 1, i.e.
*"the player pays and gets nothing."* Dumping the whole `abilityRanks` map
settled it: `{ 'iron_oath:oath_oathkeeper': 2 }`. **The game was never
wrong. Nobody was ever charged for nothing.** The purchase worked perfectly
every time, which is exactly why the points assertion passed while the rank
assertion failed.

Fixed by picking the `[ rank up ]` on the same row as the Iron Word label,
with a guard that throws if the nearest one is more than 12px away — so if
the shelf's rows ever stop lining up, the check says so instead of silently
grading the wrong button again.

**The lesson is the one this project already wrote down about its own
audits:** a green run of a check that cannot fail for the right reason is
telling nobody anything. That assertion had been passing on a technicality
for as long as it existed.

## 4. One tiny lint fix

`checkHangarShopFitsDock.mjs` shipped on 4 Sep with a comma expression that
`eslint` rejects (`no-unused-expressions`), so `npx eslint .` was red on the
repo as it stood. Rewritten as a block. The 4 Sep addendum's "eslint clean"
line predates that file's final edit.

---

## A note on the sweep's determinism

During this pass the 28-screen sweep reported one OVERRUN finding on one run
and zero on the next, with no code change in between: Hub NPCs roam, so a
label's position — and therefore which interactive rectangle it pairs with —
differs run to run. **A single clean sweep is not proof.** Worth knowing
before treating a green report as a gate.
