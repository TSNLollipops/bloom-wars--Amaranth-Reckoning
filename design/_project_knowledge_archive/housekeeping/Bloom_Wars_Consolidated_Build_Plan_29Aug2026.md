# THE BLOOM WARS — Consolidated Build Plan, 29 Aug 2026

**Still a plan, not a build order to execute right now.** Everything below reflects the "tally only" pass from this whole session (28-29 Aug) plus a few items I'm adding myself, flagged clearly as mine. Nothing gets built until Maxime says go — this doc exists so that when he does, there's one place that shows the whole list instead of a dozen scattered notes.

## 0. How this is sequenced, and why

Maxime's own locked call today: **Player AI quality comes before House Amaranth's build starts** (`Bloom_Wars_Decision_PlayerAI_Priority_Before_Amaranth_29Aug2026.md`) — House Amaranth is 36 new missions that all need sim-validating, and doing that against today's weaker bot means redoing it later. Everything else below is ordered by a mix of "how cheap is this" and "how much is it blocking something else," not by when it was mentioned in chat.

## TIER 0 — Player AI quality pass (do this first)

The bot has no class-triangle awareness when targeting (confirmed via the Mission 20 investigation, `build_log/engine_systems/squad_and_deploy_structure.md`), and it's the likely root cause behind several "too easy" reports today (Missions 4, 6, 9) and two already-documented 0%-bot-but-human-wins missions from the original build (3 and 5). This is the highest-leverage single fix on this whole list — it double-duties as balance-testing infrastructure AND, per Maxime's own connection, the actual opponent AI for the already-parked Gladiator/PvP mode (`Bloom_Wars_Player_AI_Quality_Gladiator_Reuse_Note_29Aug2026.md`).

**Scope, once this is picked up for real:** give the bot real class-triangle-aware target selection (Tank beats Meeps, Meeps beats Reeps, Reeps beats Tank) at minimum. **My own addition, not yet discussed:** once this lands, re-run `npm run sim` across all 36 existing Warden Company missions, not just whichever ones prompted this — several of today's numbers (Mission 9's turtle-strategy read, the Mission 3/5 0%-bot results, Mission 20's own known blind-spot workaround) were tuned against the old bot and may shift once it actually plays well. Treat the whole campaign's sim baseline as provisional until it's re-run post-fix.

## TIER 1 — Hub collision & movement fixes (cheap, contained, high player-facing pain)

Full detail: `Bloom_Wars_Playtest_Notes_Running_Tally_29Aug2026.md`.

1. **NPC clustering blocks the player**, worst at doors (screenshot-confirmed) — player gets physically stuck between overlapping NPCs.
2. **Proposed fix (Maxime's own):** keep NPC muster/clique/idle gathering points a minimum distance from door and stair tiles, so a cluster never forms directly on a chokepoint.
3. **Player spawns on top of an NPC when using a door** — likely the same root cause as #1 (each door's return spawn is a fixed point; an NPC parked there via #1 gets landed on). **My own addition:** even after #2 ships, worth a second, independent check — refuse to spawn the player on an already-occupied tile at a door, as a belt-and-suspenders layer rather than relying solely on the clustering fix holding in every case.
4. **Muster call fails to route cross-deck** — NPCs mustering from the top floor don't make it down to the bay (the bay/muster point lives on the lower deck; cross-deck movement is a separate code path from same-deck movement per the existing deck-split work, and this path may never have been built/tested for muster specifically).
5. **Muster incorrectly includes Mek NPCs** — a pilot-only mechanic ("shipping out") is pulling in Meks (machines), most likely because the new Mek NPCs share the same generic movement code as pilot NPCs with no exemption carved out.

**My own addition on verification:** `Hub.ts` has no dedicated unit test suite (confirmed in this project's own prior build notes), so any fix here needs a real Playwright walkthrough of the specific broken scenarios (standing at a clustered door, forcing a muster call from the top floor, checking a Mek doesn't respond to it) — not just tsc/lint/build passing clean, the same discipline the original door-build pass already used for its own 52-check Playwright suite.

## TIER 2 — Minigame room gating (small, needs a check before it needs a fix)

"Minigames should only be playable in the Rec Room" — not confirmed whether this is already true or needs an actual gate added. **My own addition, connecting two things not previously linked:** an earlier Hub polish pass already flagged `VerbDef.room` generalization as open/unfinished (`Bloom_Wars_Build_Log_Addendum_HubPolish_26Aug2026.md`'s own gap list) — worth checking whether that's the same underlying mechanism this gate would need, rather than building a separate one-off check.

## TIER 3 — Hub population driven by the real roster (foundational, cheaper than it looks)

`Bloom_Wars_Hub_Population_Living_Colony_Vision_Note_29Aug2026.md`: `Hub.ts` populates walkable NPCs from `NPC_SEED`, a tiny static hand-authored list, completely disconnected from `CampaignState.pilots`, the Second/Third Lance integrations, Berths recruitment, or any player-created pilot. Recruiting someone today does nothing for who's walkable in the ship. **My own sequencing note:** this is worth doing before the bigger scrollable/big-Hub vision below, since it's a real, scoped, independently valuable fix (recruit someone → see them in the ship) that doesn't require the map itself to grow first.

**Bigger vision, explicitly not scoped yet:** Maxime wants the Hub scrollable and big enough to feel like "a village in space" as the population grows — this connects to the already-parked `Bloom_Wars_Antfarm_Grid_v1.md` player-placement vision and the Spitball Ideas "ant-base hub" entry. Real, large, not close to buildable yet — TIER 3's roster-driven population is the buildable first step toward it, not the whole thing.

## TIER 4 — Hangar Deck: hide ambient Favorability, build the roster/stats panel

Full plan already written: `Bloom_Wars_Hangar_Roster_Stats_Panel_Plan_v1.md`. Short version: stop showing the live numeric Favorability readout while walking the Hub; the number instead lives in a new panel opened from the Hangar Deck room (currently a stub), organized as lance tabs (recommended: derived from the three static roster-arrival batches, not a new player-reassignable lance system) with a stats card per pilot. That doc has its own open questions with recommended defaults already attached — still needs a yes/no pass, not re-litigated here.

## TIER 5 — Ambush → real stealth mechanic

Full detail: `Bloom_Wars_Ambush_Stealth_Redesign_Note_29Aug2026.md`. Today's Ambush is functionally Overwatch with invisibility bolted on — stationary, one round. Proposed: a real ~3-turn mobile cloak (XCOM 2 Concealment-style), which also gives Sensor Sweep a real reason to matter later in PvP (detection vs. concealment). Real mechanic redesign, not a tweak — needs its own design decisions (exact duration, what breaks it, Meeps-exclusive or not) before it's buildable, not just a balance number.

## TIER 6 — Enemy variety pass (audit first, then edit)

Full detail and the actual audit plan: `Bloom_Wars_Enemy_Variety_Reuse_Principle_Note_29Aug2026.md`. Undertow, Sporethrower, and especially Sirenmaw (confirmed appearing exactly once, Mission 12) all show the same "strong debut, then nearly vanish" pattern. The plan already on record: read all 36 individual mission files directly (not just the act-overview tables), build one real per-archetype appearance table, exclude House Amaranth's Bloom-free missions from the "gap" count, then decide actual spawn-list edits — audit before edits, not simultaneous with them.

## WATCH ITEMS — not build tasks, context to carry forward

- **Late-game power creep** (Heirloom weapons, ship fire support) will compound the difficulty question — `Bloom_Wars_LateGame_PowerCreep_Difficulty_Note_29Aug2026.md`. Maxime's own plan: playtest late-game missions once the Hub's rooms are fully built, decide from real data, not now.
- **Kill-bonus economy tuning** — "gotta make killing Bloom more lucrative, maybe" — explicitly left open pending the same late-game playtest.
- **Design principle to protect, not touch:** combat is legitimately optional in every mission (survival + objective bonus alone is a real win path); kills add real bonus on top. Already built and working — don't let a future rebalance accidentally make the non-combat path feel like a trap. Worth a line in `house_rules.md` eventually.
- **Mission 2** resolves before the enemy reaches the player — flagged, not diagnosed. Needs a look at its objective type/turn pacing against `combat_sim.py` whenever mission tuning gets picked up generally (natural to fold into Tier 0's post-fix sim re-baseline).

## HOUSE AMARANTH TRACK — sequenced last, still has open items

Per today's priority decision, this starts only after Tier 0 (Player AI) is done. When it's picked back up:

1. **Surrender/parley mechanic — decisions already made this session:** either side (player or enemy commander) can initiate the call, not a simultaneous-check or single-prompt-both-outcomes shape. Build target: prove it first on an existing Warden mission (Mission 16, Collaborators, already fakes a surrender via a reused `rescue_pilot` objective — the obvious first real target), then extend into House Amaranth's own missions as those get built.
2. **House Amaranth's own §9 sign-off list** (`Bloom_Wars_House_Amaranth_Mission_Plan_v1.md`) still needs Maxime's decisions before scaffolding starts: estate room-set naming, the steward/seneschal's identity, Hub v1 content-volume target, save/progress architecture, Marrow's combat path (Tank vs. Meeps), the Bramble's name/lineage, Marrow's Mission 28 resolution, the supporting cast, and the act/campaign titles. Sequencing answer already given: sign-off list first, before any of the ten build-order steps in that doc's §8.
3. Naming-lock vigilance carries forward automatically — House Amaranth's political/human-conflict content is exactly where a reserved book-series term is most likely to slip in again (already happened once this project, caught and fixed).

## What I added that wasn't explicitly discussed today, flagged clearly

- Re-running the full 36-mission sim baseline after the Player AI fix, not just the missions that prompted the fix (Tier 0).
- The belt-and-suspenders "don't spawn on an occupied door tile" check as a second layer under the clustering fix (Tier 1).
- Flagging Hub.ts's lack of unit tests as a reason Tier 1's fixes specifically need a real Playwright verification pass, not just the standard four checks (Tier 1).
- Connecting the minigame-room-gate ask to the already-flagged, unfinished `VerbDef.room` generalization gap, in case they're the same fix (Tier 2).
- Sequencing Tier 3 (roster-driven Hub population) as a cheap win ahead of the much bigger scrollable-map vision, rather than waiting for the big version to do the small one.
