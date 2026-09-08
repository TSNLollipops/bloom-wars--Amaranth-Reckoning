# Build Log Addendum — Battle action-bar paging + a label-collision fix, 3 Sep 2026 (evening)

Session opened with "there tons to do, so pick plans and build them up." What
follows is what got picked, why, and — more usefully — two places where the
project's own docs turned out to be wrong and one live bug that no test in the
suite could have found.

## 0. What actually shipped

- **`src/engine/actionBarPaging.ts`** (new) — Phaser-free page math for the
  Battle action bar.
- **`src/engine/__tests__/actionBarPaging.test.ts`** (new, 13 tests) — page
  invariants, plus a data-driven guard that reads `Battle.ts`'s own source.
- **`src/scenes/Battle.ts`** — paging wired in; the silent overflow drop
  removed; the hotkey-digit/label collision fixed.
- **`tools/verify/checkActionBarPaging.mjs`** + **`genActionBarSave.ts`** (new)
  — the harness's first live Battle-scene check.
- **`tools/verify/README.md`** — documents both, including the coordinate-space
  trap below.

**Verification:** `tsc`, `eslint`, `lint-cast-collision` and `vite build` all
clean. **84 test files / 1966 tests**, up 13. Live Playwright check passes with
zero console errors. All six files committed to the device.

> One caveat, stated plainly: `lint-spoiler.mjs` **could not run** in the cloud
> sandbox — it needs `BW_RESERVED_TERM` from the git-ignored `.env.local`, which
> only exists on your machine. It skips itself with a warning rather than
> failing, so `npm run lint` reported clean without actually running the naming
> lock. Nothing in this pass invents a proper noun, but **run `npm run lint`
> locally once** before you consider this signed off. Worth knowing generally:
> any work done from the sandbox has that one gate missing.

## 1. Two corrections to the Forgotten Plans Audit

**a) `abil_missile` is not unreachable any more.** The 1 Sep audit says the
Missiles branch "grants an ability that `Battle.ts` never offers in its action
bar — no human can fire it," and repeats it as "still true." It isn't.
`Battle.ts` has offered a `MISSILE ×N` button since 1 Sep 2026 (its own comment
cites feature-gap report A8). Confirmed by grep, then by reading the code, then
by watching the button render in a live browser. That audit line should be
struck.

**b) The overflow I went looking for next was real, but a third the size I
first reported.** Chasing (a) turned up something worse-looking: `Battle.ts`
had six action slots and ended `availableActions()` with a `console.warn` plus
`out.slice(0, 6)`. Any seventh verb was dropped on the floor with nothing on
screen saying so.

My first measurement multiplied every archetype by every Heirloom and reported
**15 of 240 pairings overflowing, peaking at 8 buttons** — including "a Munti
Vibrissal carrying Migawari loses LAST RITES."

**That was wrong, and the way it was wrong is the interesting part.** An
Heirloom's abilities only ever reach its *own* wielder (`resolveDeployRoster`
sets `heirloomAbilityRanks` on exactly one roster entry), and that wielder's
archetype is minted as `arch_<path>_<chassis>` with the chassis fixed by the
Heirloom def — bipedal for nine of ten, one centauroid, **never vibrissal**.
Vibrissal is the only chassis carrying a third archetype verb
(`abil_sensor_sweep`), so the case I named cannot happen. The cross product
counted builds no player can assemble.

Re-derived from the live data the way the game derives it, the **real** worst
case today is:

| Build | Buttons |
| --- | --- |
| Migawari (`last_word`) as `arch_munti_bipedal` | **6** |
| Surtr (`cinder_line`) as `arch_munti_bipedal` | **6** |
| everything else | ≤ 5 |

**Six of six. Nothing overflows today. Zero headroom.**

## 2. So why build it anyway

Because six-of-six isn't "fine," it's one button from a failure the player
cannot see. Every direction that margin can move is a direction this project is
actively moving: ~30 Heirloom abilities are typed in `data/heirlooms.ts` and
roughly half are wired into combat, with more landing most sessions. A fourth
active on any existing kit, an Heirloom given a vibrissal chassis, a new
archetype verb, or a second ability-granting weapon branch each takes the worst
build to seven — and the seventh button just wouldn't appear. No error, no gap,
no warning a player would ever see. A verb bought and ranked up in the Vault,
silently absent.

That exact failure has already happened twice in this codebase: a Munti losing
FIRE (23 Aug), and the Missiles branch granting a button that was never offered
(A8, 1 Sep). Both took a person noticing.

**Paging costs nothing today.** At six verbs or fewer the bar is byte-for-byte
what it was — no MORE button, nothing new to learn. It only appears at seven.

### Why paging rather than a third row of buttons

A third row moves the wall without removing it: whatever slot count gets picked
today is a number some future kit exceeds, silently, again. Paging is correct
for any count. The cost is one slot spent on MORE, paid only when needed.

### How it behaves

- ≤ 6 verbs: unchanged, six actions, no MORE.
- \> 6 verbs: slots 1–5 hold actions, slot 6 becomes `MORE 1/2`. Hotkey `6`
  works on it like any other slot.
- MORE wraps back to page 1 from the last page — never a dead button.
- Selecting a different pilot resets to page 1.
- `availableActions()` now returns the *whole* kit. The slice and the
  `console.warn` are gone; "does it fit" belongs entirely to the drawing side.

### The test that keeps it honest

`actionBarPaging.test.ts` reads `Battle.ts`'s **own source**, extracts every
`unit.abilities.includes("…")` inside `availableActions()`, and derives the
reachable builds the way `mintAristocrat` does. A hand-copied ability list
would go stale on the first new ability — which is precisely the failure being
guarded against. It then asserts **the worst real build is exactly 6**.

That assertion is *expected to fail one day*. When it does, whoever reads the
failure learns the MORE button just went live in real play — which is the
announcement that used to be a silently missing button. **Raise the number,
don't delete the test.**

## 3. The bug none of that would have caught

Looking at a screenshot of the real bar while verifying something else:

```
1OVERWATCH   2 SCREEN    3 CLEAR
4 TRIAGE     5MIGAWARI   6LAST RITES
```

The hotkey digit (2 Sep) was pinned to the button's left edge; the label was
centred. For any label of roughly eight characters or more they collided.
`6LAST RITES` fused the digit into the L and scanned as **"BAST RITES"**.

This was **live, shipping, and on the heaviest and most-invested build in the
game** — the bar a player sees after spending a third of the campaign's
Heirloom budget. `tsc`, `eslint` and 1965 unit tests were clean through every
frame of it.

Fixed by giving the digit its own gutter and left-aligning the label after it,
plus a one-point size drop at 10+ characters — removing the overlap by
construction rather than tuning a font size until it happens to fit. The live
check now **measures** the real Phaser `Text` objects (`label.x`,
`label.width` against the button bounds and the digit's right edge) and fails
if any label overruns or touches the digit.

**The general lesson, since it will recur:** a whole class of bug in this game
is only visible in a picture. Worth taking a screenshot in any pass that
touches drawing code, not only when something looks wrong.

## 4. New live-harness capability

`checkActionBarPaging.mjs` is the harness's **first Battle-scene script** — it
boots a mission with `scene.start("Battle", {…})`, the same call
`TransporterPad.ts` makes on BEAM DOWN. That path now exists for anyone
verifying combat UI.

**One trap, written into the README so nobody loses an hour to it twice:** the
game's logical coordinate space is **1074x640** (`src/main.ts`), not 960x600.
Scaling a scene coordinate by `box.width / 960` puts a click ~110px off target,
and because a miss on the canvas is a *legal board click* rather than an error,
the script fails with a confusing "the button did nothing." That is exactly how
the first run failed.

## 5. Docs this changes

- **`Bloom_Wars_Forgotten_Plans_Audit_1Sep2026.md`** — the `abil_missile`
  action-bar line is stale and should be struck (§1a above).
- **No GDD / Data Pack / Build Brief change.** Nothing here alters a rule, a
  number, or a system's design — the bar shows the same verbs it always did,
  and the paging is invisible until a kit exceeds six.

## 6. Not built, deliberately

The four remaining weapon branches (Riot Drum, Maser Lance, Suppression
Autocannon, Combat Medic) were the other candidate and were **not** started:
each needs a mechanic decision and a real number, and this project's own rule
is that a number only counts once it's run through `combat_sim.py` and that the
call is Maxime's. Raised in chat as options rather than guessed at.
