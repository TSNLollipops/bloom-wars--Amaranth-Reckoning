# Build Log Addendum — Mirror Deployment + Missions 20/22/23 (30 Aug 2026)

Source: Maxime's live playtest batch, same session as the mission-select
Act-tab click-through fix (see that addendum). Three of the eight items in
that batch — Mission 20's mirror deployment, Mission 22's flyers/Undertow,
Mission 23's bigger/varied enemy lance — are covered here together since
they share one new engine mechanic and one real near-miss worth being
honest about.

## New engine mechanic: `EnemyWave.mirrorPlayerSquad` / `mirrorScale`

`EnemyWave.mirrorPlayerSquad?: boolean` (`data/types.ts`) turns a wave's
`count` from a literal number into a WEIGHT, shared with every other
`mirrorPlayerSquad` wave at the same `atTurn`. `Mission.resolveMirrorCounts`
(`engine/mission.ts`) splits `deployedPilotIds.length` across those weighted
waves using largest-remainder rounding, so the resolved total always comes
out exactly right, never off by a rounding error. A non-mirrored wave at the
same turn (a named boss anchor, say) is completely unaffected.

`EnemyWave.mirrorScale?: number` (added the same day, see below) multiplies
the target — `round(deployedPilotIds.length * mirrorScale)` — before that
split. Defaults to 1 (today's original behavior) when omitted.

Full test coverage: `src/engine/__tests__/mirrorDeployment.test.ts` (10
tests) — even split, uneven weights, largest-remainder rounding staying
exact, a non-mirrored wave at the same turn left untouched, independent
resolution at different turns, a lone mirror wave, and `mirrorScale`'s own
four cases (omitted = unchanged, fractional scale, multi-wave scale, and
rounding on a non-whole target).

## Mission 20 — Marrow's Line: the near-miss

Maxime, live: *"mission 20 could do with a full miror deployement on the
enemy side instead of a preplanned spawn. they were less numerous than I."*

This mission's own comment (from a 26 Aug 2026 investigation) said it simmed
at a clean, deterministic 0/20 regardless of squad size or enemy timing —
root-caused to a player-test-AI blind spot (Rourke's high moveRange has her
arrive alone into a Tank-beats-Meeps matchup the test AI has no
class-triangle awareness to avoid), explicitly **not** an enemy-count
problem. The mirror-deployment change was drafted against that premise —
literal 1:1 mirror (all four escort archetypes equal-weight, `mirrorScale`
not yet invented), documented as "not sim-verifiable the normal way, verify
by trace + Maxime's own play" — and was very nearly shipped that way.

Before shipping, a fresh baseline re-check (required anyway, since the
mission hadn't been touched yet this pass) found the "deterministic 0/20"
premise had gone **stale**: this same session's earlier roam-fallback fix
(`engine/ai.ts`'s `reflexiveDecision`/`packDecision`, shipped before this
work started) had already fixed the ground that 26 Aug bug was standing on.
Mission 20 was actually sitting at a healthy **100% (n=150)** with its
original, unmirrored 4-escort count — nobody had re-verified after the roam
fix landed, so the "sim can't validate this mission" comment just kept
getting carried forward.

With real sim verification possible again, the literal 1:1 mirror was
tested for real — and turned out to be exactly the kind of cliff Mission
22/23 hit too (see below): **100% → 1%** (n=150), `COMMANDER_DOWN=149/150`.
Three Tanks in the mix instead of one reproduces the exact same
class-triangle blind spot the 26 Aug investigation found, just with far
more surface area to bite on.

**Fix, not a revert:** built `mirrorScale` (above) rather than dropping the
mirror-deployment idea — landed on `0.6` (`round(10 × 0.6) = 6` escorts,
split across the same tank/meeps/meeps/reeps composition, plus Marrow
herself = 7 total, up from the original 5). Sims at **62% (n=300)** — a
real, felt difficulty increase over the old always-exactly-4 undershoot,
without the guaranteed-loss cliff. Still scales with squad size the way
Maxime actually asked for (a smaller deploy gets a proportionally smaller
escort), just no longer an exact headcount match.

**Why flag this so plainly:** this is precisely the kind of stale-comment
trap the project's own "verify against the actual current file, don't trust
memory" discipline exists to catch, and it nearly caught this pass out too —
a change was drafted, commented, and almost shipped on outdated information
that a five-minute fresh baseline check would have (and did) correct. Worth
remembering for any future mission whose own comments say "can't be
sim-verified" — that claim has an expiry date the moment anything upstream
of it changes.

## Mission 22 — Ash on the Water: flyers added, Undertow investigated and NOT added

Maxime, live: *"we can def add waves of flyier to mission 22. and some
undertow to spread panik behind line."*

**Flyer wave (shipped):** `bloom_sirenmaw` ignores `sump` tile move-cost
entirely (`data/tiles.ts` — `Infinity` for bipedal/centauroid, `1` for
`flight_membrane`), so it can cross straight from a far-shore spawn to the
dock, bypassing both causeway chokepoints this mission's whole design leans
on. Confirmed that's a real cliff, not a gradient: one Sirenmaw alone barely
moved the needle (150/150 still); two arriving simultaneously was a
deterministic 0/150 — a synchronized pair reaches the ship faster than the
squad can peel off and intercept, every run. Splitting them across two
turns (turn 3, turn 6 — never arriving as a pair) is what actually reads as
"waves": **252/300 (84%)**, a real step down from the ground-only 100%
baseline without being a coin flip.

**Undertow (investigated, not added):** tried three placements — inside the
dock/`defendZone` itself, just outside it on the flanking plain tiles, and a
single Undertow alone on one flank — every variant came back a
deterministic **0/150**. Root cause: this mission's own comment already
documents the exact failure mode ("one or two orphaned campers is enough to
burn through `assetMaxHp`... well inside `turnLimit`"), and this session's
earlier `packDecision`/`reflexiveDecision` fix means any hostile that can't
see a target now walks toward and camps the map's `defendZone` instead of
freezing. An Undertow spawned behind the line has nothing to see back
there, so it beelines for the dock and starts ticking
`PROTECT_ASSET_TICK_DAMAGE` immediately — the orphaned-camper case,
triggered on purpose by the spawn placement instead of by AI drift. That's
a structural conflict, not a number to retune down — left out of this
mission's `enemyWaves`, flagged here rather than shipped as a guaranteed
loss or silently dropped.

## Mission 23 — The Amaranth Accord: more mechs + the first Munti hostile

Maxime, live: *"mission 23 can have more mech spawn as enemy, again a
mirored lance would be fine. but honestly leave it open for random lance
formation, as long as they also have munties of their own."*

Added `hostile_mech_amaranth_05` (`data/units.ts`) — the first Munti-path
hostile archetype in the game, same shape as the existing four
(`AMARANTH_HOSTILE_MECHS`).

Tried literal `mirrorPlayerSquad` (all five archetypes equal-weight, target
= 10) first — same catastrophic collapse as Mission 20's own near-miss:
**72% → 5%**, `COMMANDER_DOWN=141/150`. `extract_unit` (this mission's
objective) is this session's own established fragile pattern (missions 17,
26, 11 all broke under added pressure earlier this session too), and more
than doubling the enemy count broke it the same way.

Reverted the mirror flag — this mission doesn't have the map space or turn
budget for a full squad-sized force while also shepherding Anand to the
exit. Landed on a flat, moderate bump instead: all five archetypes present
(tank/meeps/meeps/reeps/munti), Munti at count 2, everything else at 1 (6
total, up from 4). Sims at **219/300 (73%)**, essentially the original 72%
baseline — a visibly bigger, more varied lance (a real answer to "more mech
spawn... munties of their own") landing back near the mission's own
established difficulty rather than breaking it.

"Leave it open for random lance formation" is read here as "don't force a
strict mirror of my own squad, keep the composition flexible" rather than a
literal request for true per-playthrough randomization — the engine doesn't
have a mechanism for a different lineup each attempt anywhere today; that
would be new scope, not a data change, if it's actually wanted later.

## Verification

- `npm run typecheck` / `npm run lint` / `npm test` all clean throughout
  (1174/1174 tests passing at the end of this pass).
- Each mission change verified at n=150–300 via `npm run sim:batch`, in
  isolation before combining (flyer alone, then Undertow alone, for
  Mission 22; literal mirror before the scaled-down version, for both
  Mission 20 and 23).
- A full 40-mission sweep (n=40) confirmed no collateral regression on any
  mission this pass didn't touch — aggregate win rate matched the
  pre-Phase-2 baseline within ordinary sample noise.
- Not verified: actual visual/click playtesting of Mission 22's flyer
  arrival or Mission 23's bigger lance in the real Battle scene — this
  sandbox has no Playwright/browser testing available, same standing gap
  every Hub.ts/Battle.ts pass this session has flagged.
