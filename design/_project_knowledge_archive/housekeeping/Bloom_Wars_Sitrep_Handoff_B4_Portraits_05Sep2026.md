# SITREP / HANDOFF — current state, and B4 (portrait wiring) scoped

**Written 5 Sep 2026 by Claude (Cowork), for a fresh conversation to pick up B4 cold.** Everything below was verified against the live repo on `lorian-pc` today, not carried over from an older plan. Where a previously-written doc is wrong, that's called out rather than quietly corrected.

---

## 1. How to work on this repo (read first)

**The repo lives at `F:\The Bloom wars. Code project\bloom-wars\bloom-wars`** on the device `lorian-pc`. A Cowork session cannot edit it directly — there's no `device_bash`. The working loop is:

1. `device_stage_files` the files you need into the container.
2. Edit them in the container (`npm ci` once; the whole toolchain works there).
3. `device_commit_files` them back, **with `expectedMtimeMs` guards**.

**The mtime guard is not optional.** On 5 Sep another session shipped Maser Lance into `Battle.ts` three hours after this session took its copy. Committing the stale copy would have deleted that entire feature. It was caught only by comparing device mtimes before writing. **Re-check mtimes before every commit, not once per session**, and land work incrementally rather than holding a big batch.

### The verification gate

Everything must pass before anything ships:

```
npx tsc --noEmit
npx eslint .                     # check the REAL exit code
node tools/lint-cast-collision.mjs
npx vitest run
npx vite build
```

**Current baseline: 92 test files / 2196 tests, all green.** If a fresh clone doesn't reproduce that, something drifted — stop and find out what.

Note: `npx eslint . | tail -5` **hides the exit code** (you get `tail`'s). That masked a real lint error once today. Run it bare.

`tools/lint-spoiler.mjs` needs `BW_RESERVED_TERM` from a git-ignored `.env.local` that doesn't exist in the container — **it must be run once on Maxime's own machine before anything ships.** The naming lock (reserved book-series terms banned from game code, docs, filenames and UI strings) is real and this is how it's enforced.

### Live verification is not optional either

Scenes cannot be unit-tested — importing Phaser at module scope throws outside a browser. So `tools/verify/*.mjs` are Playwright scripts that boot the real game and drive it. **Four separate defects on 5 Sep were invisible to tsc, eslint and all 2196 unit tests, and obvious in a rendered frame:** a HUD text overlap, a 5px button overlap, the Vault overflowing its own bounds, and a panel ghosting another panel through its background.

Pattern (copy `checkRosterPanel.mjs`): launch chromium from `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, viewport **1074×640** (the game's logical size — using 960 once cost an hour), seed `localStorage["bloomwars_campaign_state_v1"]` via `addInitScript`, then drive via `window.__bwGame`.

**Two traps in that harness:**
- `window.__bwGame` and the corner build-stamp are both behind `import.meta.env.DEV`, so **verification only works against the dev server**, never a production build.
- `window.__bwGame.scene.start(...)` is the *game's* SceneManager, which does **not** stop the current scene. Call `scene.stop("Hub")` first or you get two scenes drawn on top of each other.

---

## 2. What shipped 5 Sep (context, not required reading)

Four build-log addenda were written today; the short version:

- **Battle HUD overflow fixed** — `fitLines` estimated wrapped text height by flat character division, under-counted, and the HUD drew over the log panel. Now simulates real word-wrap.
- **B6 name your company**, **B7 copy mission log**, **B3 the memorial** (its own panel in `scenes/ui/`), **B2 assignable lances + crew records**.
- **Recruit-your-own-lance**: lances 2 and 3 now arrive EMPTY; the ten authored 2nd/3rd Lance pilots became the recruit pool; generated recruits get real names and earn callsigns on their first kill.

---

## 3. B4 — portrait wiring. **The gap report is wrong about this being cheap.**

`Bloom_Wars_First_Game_Dev_Feature_Gap_Report_1Sep2026.md` §B4 says: *"the single biggest visual upgrade available for the least work, and it's already paid for."* The first half is true. **"Least work" is not**, and here is why, all verified today.

### What actually exists

`assets/portraits/` holds **15 PNGs**, one per named pilot, `<surname>_portrait.png`:

> anand, bosk, delgado, iyari, kova, lask, ness, okafor, onwuka, reyes, rourke, solheim, tarrant, vashti, yeun

`assets/splash/` holds 4 JPGs: `intro_title_screen`, `loading_screen`, `victory_screen`, `defeat_screen`.

The art is good and on-register — gritty, tired, lived-in, matches the game's tone.

### Three problems the gap report didn't know about

**1. The files are 1024×1024 and ~1.5 MB each.**

| | size |
|---|---|
| one portrait | 1024×1024 PNG, ~1.45 MB |
| all 15 portraits | **~21.7 MB** |
| 4 splash images | ~10 MB |
| **current entire production JS bundle** | **2.0 MB** |

That's a ~12x blowup on a browser game distributed through itch.io. They render at maybe 56–96px in the roster and Transporter Pad — **1024px is roughly 10x larger than anything the game will ever display.** These need downscaling and recompression before they go anywhere near the build. A 192px portrait set would be generous and costs a rounding error.

**2. `assets/` is not served.** Vite serves `public/`, which contains only `favicon.svg` and `icons.svg`. Nothing in `src/`, `vite.config.ts` or `index.html` references `assets/` at all. The portraits are physically in the repo and completely unreachable by the running game.

**3. The game loads zero images today.** There is not one `this.load.image` / `load.spritesheet` / `load.atlas` anywhere in `src/`. Every visual in this game is drawn with Phaser shapes and text. **B4 introduces the image-loading pipeline to this codebase for the first time** — that's a Preloader concern, a cache-key convention, and a fallback path for a missing texture, none of which exist yet.

### So B4 is really four jobs

1. **Asset prep** (probably the biggest, and it's not code): downscale 15 portraits to a sane display size, recompress, decide a target. Should they be cropped square to a face/bust for a small circular frame, or kept full-body? At 96px the current full-body framing will read as a grey smudge.
2. **Make them reachable**: move the prepared set into `public/` (simplest, no bundler involvement), or import them so Vite fingerprints them.
3. **Load them**: a real preload step, plus a decision about what happens for a pilot with no portrait — **generated recruits have no art and never will**, and the roster is now player-recruited, so the fallback is a first-class case, not an edge case.
4. **Swap the placeholders** in the scenes that draw the circle-with-initials convention: `TransporterPad.ts` (`PATH_COLORS` + `pilotInitials`, the original), `Hub.ts` (NPCs), the new `RosterPanel.ts`, `Debrief.ts`, and `MemorialPanel.ts` would want them too.

### Decisions needed before building

- **Target display size** for portraits (96? 128? 192?) — drives the whole asset-prep step.
- **Crop**: face/bust square, or keep the full 1:1 body shot?
- **Fallback for portrait-less pilots** — the existing coloured circle with initials is right there and already works. Recommend keeping it as the fallback rather than inventing something.
- **Splash screens**: in scope for B4 or separate? They're another ~10 MB and touch `MainMenu`/`Boot`/`Debrief` rather than pilot rendering.
- **Do the original 1024px files stay in the repo?** They're ~32 MB of git history that never ships. Worth a `.gitignore` conversation or moving the masters out of the repo entirely.

---

## 4. Open items not related to B4

- **5 dialogue lines** naming Okafor (3) and Solheim (2). They were 2nd Lance and are now recruit candidates, so they may not exist in a given campaign. Anand (25 lines), Rourke (14) and Bosk (6) are 1st Lance and unaffected. **Maxime's prose — deliberately not rewritten.**
- **The Vault overlay overflows its own bounds.** Measured at 537 / 550 / **563** across consecutive runs against a `ROOM_BOUNDS.bottom` of 552 — it varies with campaign state and already draws content below its own edge in some states. Nothing clips or scrolls. Pre-existing, not caused by B3, and the next thing added to that panel will make it worse.
- **`package.json` version is still `0.0.1`**, the npm scaffold default. `__APP_VERSION__` bakes from it, so the dev build stamp, Options' bug report and B7's mission log all report v0.0.1. Every tester report before the 26 Oct EA will say that.
- **`MAX_LANCE_SIZE` (5) vs act deploy caps (10 in Act II, 15 in Act III).** A single lance can't fill a deployment from Act II on; the Transporter Pad lance quick-pick fills 5 of 15. Not a bug — it's what those two numbers mean together — but that constant is the lever if lances should scale.
- **Gladiator lance arithmetic** — 30 mechs is 6 lances of 5 against a 5-lance ceiling. **Explicitly parked by Maxime: "gladiator answer will hsppen when i get to it. its not concrete yet."** Do not chase this.
- Remaining gap-report items after B4: **B5** (briefing room) and **B8** ("last words"), both content-shaped.

---

## 5. Working preferences that matter

- Maxime is new to game dev and wants **vocabulary explained in plain language**, without the design thinking being simplified.
- **No yes-manning.** If a request has a flaw, say so with evidence before building. Two examples from today that were worth it: a hard "Munti required per lance" rule would have permanently bricked a lance the first time one died (the roster is exactly 3 Muntis for 3 lances), and a hard lance cap alone deadlocked a full roster completely.
- **Flag scope growth before building it**, per the project instructions.
- **Say which doc a decision makes stale.**
- Verify claims against the actual current file rather than an older plan — this doc exists because that discipline turned B4 from "wire up some assets" into a four-part job with a 21.7 MB problem in it.
