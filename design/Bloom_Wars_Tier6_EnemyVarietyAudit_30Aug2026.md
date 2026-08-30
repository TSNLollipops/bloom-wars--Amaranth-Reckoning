# Tier 6 — Enemy Variety Audit (audit only, no spawn-list edits)

Consolidated Build Plan (29 Aug 2026), Tier 6: "audit first, then edit." Per `Bloom_Wars_Enemy_Variety_Reuse_Principle_Note_29Aug2026.md`'s own four-step plan — read all 36 individual mission build-log files directly, build one real per-archetype appearance table, cross-check House Amaranth's Bloom-free missions separately, bring the table back before any spawn-list edits — this pass is step 1-3 only. **No code was touched in this pass.** Step 4 (actual spawn-list edits) waits on Maxime's read of the table below, exactly as the plan itself specifies.

Source: all 36 individual `design/build_log/act{1,2,3}/mission##_*.md` files, read directly, plus the three act overview tables for cross-checking — not just the overview tables alone, which is exactly the gap the plan flagged in the original tally ("some build-log entries just say '5-wave siege' without naming archetypes... this is the best answer available from what's actually been surfaced, not a guaranteed-complete audit").

## The real per-archetype appearance table

✓ = confirmed present by name in that mission's own build-log file. A blank cell is a confirmed absence (the mission's enemy composition IS fully named, and this archetype isn't in it) — not a gap. "?" marks a mission whose own build-log file does not name its Bloom archetypes at all (see the Data gaps section below); those are NOT counted as confirmed absences anywhere in this audit.

| # | Mission | Crawlmass | Splitfang | Undertow | Sporethrower | Gallcyst | Sirenmaw | Boss | Amaranth (human) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Muster | ✓ (12) | | | | | | | |
| 2 | Wire and Mud | | ✓ (12, staged) | | | | | | |
| 3 | The Low Ground | ✓ (8) | ✓ (2) | | | | | | |
| 4 | Tunnel Rats | ✓ (4) | | ✓ (3, burrowed) **debut** | | | | | |
| 5 | Foraging Party | ✓ (6) | ✓ (2) | | | | | | |
| 6 | House Colors | — | — | — | — | — | — | | ✓ (4 Line Troopers) — **no Bloom** |
| 7 | Sporewatch Ridge | ✓ (2) | | | ✓ (3) **debut** | | | | |
| 8 | The Choir Sings | ✓ (4) | | | | | | ✓ Choir ×4 **debut** [mid-boss] | |
| 9 | Cut Off | ✓ (10) | | | | ✓ (2, fixed) **debut** | | | |
| 10 | The Amaranth Betrayal | ✓ (6) | ✓ (4) | | | | | | |
| 11 | The Long Walk Back | ✓ | ✓ | | | | | | (staged 2+2+3, exact split not named) |
| 12 | The Fallow Line | ✓ (6) | ✓ (4) | | | | ✓ (2) **only confirmed appearance** | ✓ Choir ×3 [Act I finale] | |
| 13 | New Colors, Old Wounds | ✓ (12) | ✓ (3) | | | | | | |
| 14 | Steel Rain | ✓ (8) | ✓ (3) | | | ✓ (2, fixed) | | | |
| 15 | Landfall | ✓ (14) | ✓ (6) | | | | | | |
| 16 | Collaborators | — | — | — | — | — | — | | ✓ (5 Conscripts) — **no Bloom** |
| 17 | The Wellroot Uncovered | ✓ (6) | ✓ (1) | | ✓ (1) **first reuse since M7** | | | | |
| 18 | Breakout at Draven's Cut | ✓ (6) | ✓ (3) | | | | | | ✓ (4 Line Troopers, opposite front — mixed mission, not Amaranth-only) |
| 19 | The Silent Ward | ✓ (5) | | ✓ (3, burrowed) **first reuse since M4** | | | | | |
| 20 | Marrow's Line | — | — | — | — | — | — | Marrow (named rival mech) | ✓ (4 Line Troopers) — **no Bloom** |
| 21 | Cut the Root | | | ✓ (2, burrowed, reinforcements) | | | | ✓ Heartwood ×1 **debut** [boss] | |
| 22 | Ash on the Water | ✓ (7 final) | ✓ (2 final) | | | | | | |
| 23 | The Amaranth Accord | — | — | — | — | — | — | | ✓ (4 Line Troopers) — **no Bloom** |
| 24 | Two Fires | ? | ? | ? | ? | ? | ? | | ✓ (Amaranth, south front) — **mixed; Bloom side present but not named — see gaps** |
| 25 | The Reckoning | ✓ (13) | ✓ (6) | | ✓ (4) | | | | |
| 26 | The Unnamed Beneath | | | ✓ (2, burrowed) | | | | | |
| 27 | Falling Back to Meridian | ? | ? | ? | ? | ? | ? | | — (see gaps) |
| 28 | Marrow's Reckoning | — | — | — | — | — | — | Marrow (closes arc) | ✓ (7→10 troopers) — **no Bloom** |
| 29 | The Outer Ring Falls | ? | ? | ? | ? | ? | ? | | — (see gaps) |
| 30 | Ashes of the Second Ring | ✓ | ✓ | | ✓ | ✓ (2, fixed) | | | (mobile-pressure exact split not named) |
| 31 | The Last Convoy | ? | ? | ? | ? | ? | ? | | — (see gaps) |
| 32 | Hold at the Spire | ? | ? | ? | ? | ? | ? | | — (see gaps) |
| 33 | The Innermost Ring | ? | ? | ? | ? | ? | ? | | — (see gaps) |
| 34 | No Word from the Fleet | ? | ? | ? | ? | ? | ? | | — (see gaps) |
| 35 | The Last Ring | | | | | | | ✓ The Unnamed ×1 **debut** [final boss] | |
| 36 | Until Relief | ? | ? | ? | ? | ? | ? | | — (see gaps) |

**Confirmed appearance counts (missions where the archetype is named, out of 36):**

- Crawlmass — 19 missions (1,3,4,5,7,8,9,10,11,12,13,14,15,17,18,19,22,25,30). The workhorse, present almost everywhere by design — not a variety concern.
- Splitfang — 15 missions (2,3,5,10,11,12,13,14,15,17,18,22,25,30, and Mission 11's unsplit pairing). Also broadly reused, not a gap.
- **Undertow — 4 missions (4 debut, 19, 21, 26).** Reused, but thin: absent from every Act I mission between its Mission 4 debut and Mission 12, and from every Act II mission before Mission 19 — the exact "Missions 5-9" gap Maxime's own original ask named.
- **Sporethrower — 4 missions (7 debut, 17, 25, 30).** Thinnest of the regularly-reused archetypes — one Act I appearance, then nothing until Mission 17 (Act II), same "shown once, forgotten" pattern Undertow had before its own Batch 3 correction.
- **Gallcyst — 3 missions (9, 14, 30), always the identical "fixed strongpoint" role.** Reused in count, but genuinely one-note as the plan itself already suspected — never appears as a mobile threat.
- **Sirenmaw — 1 confirmed appearance, Mission 12 only.** Exactly what the original tally found, now confirmed against the full 36-mission read rather than a partial search: no second appearance anywhere in Act II or Act III. The Choir (Mission 8) is Sirenmaw-descended and shares its `flight_membrane` movement type, but is its own named mid-boss, not the same design category.

**Named bosses (own category, per the plan's own instruction — not mixed into the six regular archetypes above):**

| Boss | Missions | Notes |
|---|---|---|
| Choir | 8 (debut, ×4), 12 (×3, Act I finale) | Reused once, inside the same act — reads as a real mid-boss arc, not a one-off. |
| Heartwood | 21 (debut, ×1) | One-time boss encounter by design — no second appearance, and none expected; bosses are climactic set-pieces, not reusable trash (see below). |
| The Unnamed | 35 (debut, ×1) | Campaign's true final boss — one-time by design, same reasoning as Heartwood. |

**A correction to the plan's own preliminary boss list, worth flagging plainly.** `Bloom_Wars_Enemy_Variety_Reuse_Principle_Note_29Aug2026.md`'s step 2 named five bosses to track separately: "Choir/Heartwood/Wellroot/Unnamed/Cradle." Reading all 36 mission files directly, only three of those are actual spawned Bloom boss archetypes — **Choir, Heartwood, and The Unnamed**. "Wellroot" and "Cradle" are not boss units anywhere in the 36 missions: "Wellroot" is Mission 17's own location name (*The Wellroot Uncovered* — a place, not a monster; that mission's actual enemies are Crawlmass/Splitfang/Sporethrower, no Wellroot creature). "Cradle" was Mission 26's original title before its 26 Aug rename (the leftover stub file, `mission26_the_cradle_beneath.md`, says so directly) — Mission 26's actual enemy is Undertow only, no boss at all. Mission 35's own build log separately mentions "The Cradle archetype" as a pre-rename working-name reference tangled up in its own build history, before that boss was renamed to its current name, The Unnamed. Both "Wellroot" and "Cradle" are naming-history artifacts, not a fourth and fifth boss the roster still needs auditing for.

## House Amaranth (human) missions — confirmed no-Bloom, cross-checked

Missions **6, 16, 20, 23, 28** are confirmed genuinely Bloom-free — House Amaranth troopers/conscripts/Marrow only, by design, correctly excluded from every gap count above. This matches five of the six missions the plan's own preliminary list named ("6, 16, 20, 23, 24, 28, and others once confirmed") — **with one real correction**: **Mission 24 is NOT Bloom-free.** Its own build-log file states the enemy is "Bloom (north) + House Amaranth (south)" — a genuine two-front mixed mission, not an Amaranth-only one. Mission 24's Bloom-side composition just isn't named by archetype in its own file (folded into the gap list below, not the no-Bloom list). Missions 18 and 28 also mix Amaranth troopers alongside Bloom on the same or an opposite front (18 has both; 28 is Amaranth/Marrow-only) — both handled correctly above rather than lumped into one bucket.

## Data gaps — missions whose own build-log files don't name Bloom archetypes at all

Eight missions, all Act II/III: **24, 27, 29, 31, 32, 33, 34, 36.** Every one of these confirms exactly what the original tally already suspected rather than resolving it — the individual mission files (not just the act-overview tables) genuinely stop at wave counts ("5-wave siege," "staggered ambush waves," "3 trench-line waves") without naming which of the six regular archetypes fill those waves. This was checked, not assumed: both the individual file AND that mission's row in its act overview table were read for all eight, and neither source names archetypes for any of them. A real answer for these eight would need either a fresh source (the actual `data/mapsAmaranth.ts`/`data/campaignAmaranth.ts` spawn tables, which this pass didn't open — reading them would settle this definitively and is the natural next step if Maxime wants the table completed rather than left with open cells) or asking whoever wrote the original build-log entries to fill in what shipped. Reporting the gap honestly rather than guessing archetype names to fill the table in.

## What this means for Maxime's own principle ("any bloom shown should be reused")

Of the six regular archetypes, three are genuinely thin exactly where the original tally guessed: **Sirenmaw** (1 appearance, confirmed, no second one anywhere), **Sporethrower** (4, clustered early with a long post-Mission-17 silence not yet checked past the 8-mission data-gap wall), and **Undertow** (4, same shape). **Gallcyst** is reused three times but always in the identical sessile-turret role — a repetition-of-sameness problem rather than an absence problem, worth naming as its own, different kind of gap. Crawlmass and Splitfang are both healthy and not a variety concern. The eight data-gap missions (all in the campaign's back half, Act II/III) are exactly where a real edit pass is most likely to find more gaps once their actual spawn tables are read — this audit cannot rule those eight in or out yet.

## Next step, per the plan's own instruction

Bring this table back to Maxime before any spawn-list edits happen — this pass stops here. Two follow-ups worth raising when he's ready to decide: (1) whether to read `data/mapsAmaranth.ts` directly to resolve the eight data-gap missions before editing anything, so the edit pass works from a complete picture instead of 28-of-36; (2) what the actual edit lever should be for the three thin archetypes — more Sirenmaw/Sporethrower/Undertow appearances specifically in the identified gap windows (Missions 5-9 for Undertow, matching Maxime's own original scoping), versus a broader pass across the whole back half once the data gaps are closed.
