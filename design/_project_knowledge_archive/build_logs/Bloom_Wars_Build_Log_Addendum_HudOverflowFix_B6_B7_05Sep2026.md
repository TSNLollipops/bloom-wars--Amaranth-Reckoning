# Build Log Addendum — HUD overflow fix, B6, B7, B3, and what measuring the Vault turned up

**5 Sep 2026.** Claude (Cowork session). Shipped to the repo on `lorian-pc`, verification gate green at each landing.

---

## What shipped

### 1. The Battle HUD overflow bug (found by screenshot, fixed, verified)

`Battle.ts`'s `fitLines()` decided how much HUD text fits between `HUD_TOP` (40) and `LOG_TOP` (336) using a flat estimate: `Math.ceil(line.length / charsPerLine)`. That assumes every wrapped line is packed to its last character. Real word-wrap breaks at word boundaries and routinely leaves several characters unused per line, so the estimate **under-counted** the true height of long prose — worst case the mission briefing, which runs several hundred characters.

`fitLines` therefore let more content through than actually fit. `hudText` has no mask and no bottom clip, so the real (correctly wrapped) text just kept growing past `LOG_TOP` and drew straight over `logText`'s own content. On screen: the HUD's `Objective:` line rendered on top of turn 1's own `(dialogue) …` log entry, interlaced and unreadable.

Trigger condition was a long briefing **plus** an extra objective-status line (`hold_zone`, or `extract_unit` with `civilianSpawns`). Confirmed on The Last Ring and The Last Convoy; The Reckoning stayed clean because its objective type adds no extra status line.

**Fix:** a new `wrappedLineCount()` helper does a real greedy word-wrap simulation (break on spaces, respect existing `\n`). Both `hudText` and `logText` are monospace, so character-count wrapping is equivalent to Phaser's real pixel-width wrapping for this font.

**Second-order effect, then fixed too:** with accurate counting, the `Hold Zone (teal tiles): …` status line — real gameplay information — no longer fit at all on the two longest-briefing hold_zone missions, and was silently trimmed. Better than garbled, still not good. Per Maxime's call ("option 1"), the two briefings were shortened rather than changing the panel's font or geometry, since only 2 of ~72 missions were affected:

- **Amaranth III.27, Falling Back to Meridian** — 284 → 175 chars
- **Amaranth III.35, The Last Ring** — 341 → 214 chars

Both now render objective + full status line + dialogue with a full line of margin even in the worst-case status string (`CONTESTED — a hostile is on the zone`). Original text is preserved verbatim in a comment above each briefing in `campaignAmaranth.ts`.

Maxime's note on the trims: *"player will get freespace style briefing"* — briefings are treated as flexible, not locked prose. Flagged honestly at the time: the Last Ring trim lost "heartbeat signature", "under House Amaranth's terraces", and "not staying under Meridian anymore", the last of which was doing real narrative work. Open to restoring that beat by finding room another way.

### 2. B6 — name your company

`CampaignState.companyName`, set from a text field on the New Campaign screen.

- **Engine:** `companyNameOf(state)` is the single read path; `backfillCompanyName()` runs in `loadCampaignState` alongside the existing backfills. Old saves get the name that side was always displayed under, side-decided by `baseSceneKeyFor`'s own `pilot_rourke` rule — a House Amaranth save does not come back calling itself Warden Company. `COMPANY_NAME_MAX_LENGTH = 24`, derived from what actually fits the Transporter Pad header at 30px without hitting the "< mission select" button.
- **UI:** DOM `<input>` following `Hub.ts`'s chat-box idiom. Pre-filled with the side's default, so a player who doesn't care gets exactly today's behavior. An untouched field follows the side selection; once edited, side changes leave it alone.
- **Payoff:** the Transporter Pad header. This also fixes a real pre-existing bug — that header was the hardcoded literal `"TRANSPORTER PAD — WARDEN COMPANY"`, so **House Amaranth campaigns have always been shown the wrong company name.**
- **Deliberately NOT built:** the gap report's B6 entry mentions feeding a `{COMPANY}` slot in ambient lines. **No such slot exists.** `data/ambientLines.ts` is ~96KB of literal strings with zero template placeholders of any kind. Honoring that line means designing and threading a substitution layer through the whole ambient system — a system, not a field. Flagged for Maxime rather than quietly built.

8 unit tests + `tools/verify/checkCompanyName.mjs` (11 live checks, including typing with real key events, which is what catches a field that unit-tests fine but can't actually be typed into).

**Also fixed in passing:** the side-select hint text on that screen has always overlapped the bottom of the WARDEN/HOUSE AMARANTH buttons by ~5px (94 chars, just past the 560px wrap, so it silently renders as two lines). Nudged from y=168 to y=178. Pre-existing, found by screenshot.

### 3. B7 — copy the mission log

`COPY MISSION LOG` on the Debrief footer. Copies a self-identifying header (mission, company, outcome and turn, version, timestamp) plus the engine's full turn-by-turn `log`.

The panel body was extracted to **`src/scenes/ui/CopyTextPanel.ts`** and Options' `COPY STATS + BUG REPORT` now uses it too, rather than B7 becoming a second copy of ~50 lines. The one non-obvious thing that logic knows is preserved and documented: the textarea is **not** a fallback shown only on failure — it is always shown, because `navigator.clipboard.writeText` can be silently refused inside an embed (itch.io's iframe) in a way that resolves without throwing and without copying. A player trusting a "Copied!" message there would paste nothing.

`tools/verify/checkCopyMissionLog.mjs` — 15 live checks, including that Options' existing export panel still works after the refactor, since that's tester-facing functionality that got edited to serve a new feature.

---

## 4. B3 — the memorial: built inline, measured, reverted, rebuilt as its own panel

### The measurement that changed the design

First built as an inline roll under the Vault's existing `THE FALLOW LINE — IN MEMORIAM` dedication, capped at 5 rows, using `engine/statsStore.ts`'s existing `memorial()` query. Then measured against the live panel:

| Vault state | tallest rendered text | `ROOM_BOUNDS.bottom` |
|---|---|---|
| baseline, zero losses | y = 550 | 552 |
| with the 3-row inline memorial | **y = 610** | 552 |

The inline version pushed `HOLDINGS & THE SHELF` completely off a panel that neither clips nor scrolls. The row cap existed specifically to prevent exactly that, and was still far too generous, because it assumed slack that isn't there. Reverted to byte-identical, then rebuilt per Maxime's call: **its own panel.**

### Sharper finding: the Vault doesn't have 2px of headroom, it already overflows

Repeated runs of `tools/verify/checkMemorial.mjs` measured the Vault's own tallest text at **537, 550 and 563 across consecutive runs** — its content height varies with campaign state, and **563 is already past the 552 bound.** The earlier "two pixels of headroom" framing was too kind. In some states the Vault is *already* drawing content below its own bottom edge, before B3 ever existed. Visible in `promo_memorial.png`: "Nothing in the company's keeping yet." rendering at y≈556, under the panel edge.

Pre-existing and independent of B3 — the new button lives in `buildVaultOverlay`'s fixed header row and adds zero height to `renderVault`'s stack. **Still unfixed, still worth fixing:** giving that overlay scrolling or clipping would close a latent bug that any future Vault addition can trip.

Because of that variance, `checkMemorial.mjs` deliberately does **not** assert the Vault stays inside its bound — that assertion would fail for a reason the script isn't testing, and a flaky check is worse than no check. It reports the number and asserts the real invariant instead: the Vault's bottom section is still present.

### What shipped

**`src/scenes/ui/MemorialPanel.ts`** — a standalone panel, structurally following `StandingsPanel.ts`, whose own header already argues this case (Hub.ts is 8,000+ lines and every panel added inline makes the next one harder). Opened from a `[ the roll — pilots lost ]` button in the Vault's fixed header row, opposite the close button.

- Depth 61, one above the Vault's 60, so the Vault stays open underneath and Esc returns the player there rather than dumping them on the deck from two clicks deep.
- Background fully opaque, unlike StandingsPanel's 0.96 — at 0.98 the Vault's headings ghosted through clearly enough to read as a rendering fault. Caught by screenshot.
- Rows per page computed from the real bounds, not guessed, so this panel can never do to itself what the inline version did to the Vault. 9 rows/page; a 14-loss roll pages cleanly as 9 + 5.
- Each entry: the name in full, then `lost on <mission>, turn N · X missions · Y kills · downed N× · most-used: <ability>`. Career totals earn their place — a name and a date is a tombstone; "14 missions, 9 kills" is why the player remembers this one.
- Empty state reads as the good outcome, not an error: *"Nobody yet. Every pilot who has flown for this company has come back."*
- **Cause of death deliberately absent.** `PilotServiceRecord` records where and when a pilot was lost, not what killed them. Inventing a cause string would be fiction on the one screen that should be nothing but record. The gap report asks for it; the engine can't answer it.

`tools/verify/checkMemorial.mjs` — 20 live checks across four states (nobody lost, three lost, Esc behavior, fourteen lost with paging), stable across three consecutive runs.

---

### B2 — pilot service records: not started, and deliberately

`engine/statsStore.ts`'s `pilotServiceRecords()` already returns everything needed. But `Bloom_Wars_Hangar_Roster_Stats_Panel_Plan_v1.md` is B2's design doc and it ends with **open questions explicitly marked "confirm before it's built"** — including whether the ambient label keeps relationship tags, and whether a permanently-lost pilot gets a memorial entry on their lance page. That last one now has a natural answer available (the roll exists and is reachable), but it's still Maxime's call, not an assumption to build on.

---

## Doc-touch flags

- `Bloom_Wars_UI_Improvement_Plan_v1.md` — Track 2's still-open list: **B6, B7 and B3 are now done.** B2 remains open. Track 3's overlay-sprawl concern is real and was answered in the small: the memorial went into `scenes/ui/` as a standalone class following StandingsPanel, rather than becoming a tenth inline overlay method on Hub.ts. Track 1's screenshot-pass rationale is thoroughly vindicated — it found the HUD overlap bug, a pre-existing 5px button overlap, the Vault's overflow, and a ghosting panel background, none of which any unit test could see.
- `Bloom_Wars_First_Game_Dev_Feature_Gap_Report_1Sep2026.md` — B6's `{COMPANY}` claim is wrong; no such slot exists. B3's "cause" field is also unavailable — the engine records where and when a pilot was lost, not what killed them.
- `Bloom_Wars_Now_And_Next.md` — B6, B7 and B3 shipped. **New open item: the Vault overlay's own overflow** (measured at 563 against a 552 bound in some states, varies with campaign state, nothing clips or scrolls). Not caused by B3 and not fixed by it.

---

## Three process notes worth keeping

**A near-miss with concurrent sessions.** This session's sandbox held a *copy* of the repo staged on 4 Sep at 21:24Z. The Maser Lance session wrote `Battle.ts`, `mission.ts`, `units.ts`, `weaponBranches.ts`, `abilities.ts`, `combatTables.ts` and 5 test files at 00:34Z on 5 Sep — **three hours after that copy was taken, and into the same file the HUD fix lives in.** Nothing warns about this. It was caught only by comparing device mtimes before writing. Committing the stale copy would have deleted the entire Maser Lance feature.

The merge was clean (Maser Lance is purely additive and never touches `fitLines`), and the fix was re-applied on top of their work. The general rule: **with two sessions on this repo, re-check mtimes before every commit, not just at session start.** Everything in this pass was landed incrementally rather than held to the end, for exactly this reason. Every commit used an `expectedMtimeMs` guard; none were rejected.

**Screenshots keep finding what tests can't.** Four separate defects this session were invisible to `tsc`, `eslint` and all 2163 unit tests, and visible immediately in a rendered frame: the HUD text overlap, the 5px button overlap on New Campaign, the Vault's overflow, and the memorial panel ghosting the Vault through its background. Scenes can't be unit-tested here (importing Phaser at module scope throws outside a browser), so the Playwright scripts in `tools/verify/` are not a nice-to-have — they are the only automated thing that sees the actual game.

**`package.json` version is still `0.0.1`.** `__APP_VERSION__` is baked from it, so the dev build stamp, Options' bug report, and now B7's mission log all report `v0.0.1` — the npm scaffold default. Every tester report between now and the 26 Oct EA date will say that. Version numbering is a product call, so: flagged, not changed.
