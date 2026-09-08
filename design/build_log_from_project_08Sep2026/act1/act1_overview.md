# Act I — The Fallow Line (Missions 1–12)

Warden Company's own act. Built first, missions 1-4 shipping 22 Aug 2026, the full 12 completing 25 Aug 2026. Per the Independent Campaign doc's own §3 scope note, Act I needed **no new engine systems** for its first 8 missions — every mission used objective types and Bloom archetypes the engine already had. Missions 9-12 introduced the campaign's first genuinely new objective type (`survive_n_turns`, Mission 9) and the Choir mid-boss archetype (Mission 8).

## Roster — Warden Company (`WARDEN_PILOTS` / `WARDEN_MEKS`, `data/campaignAmaranth.ts`)

2nd Lt. Dessa Rourke "Lark" (Meeps/human, exempt from permadeath — see `engine_systems/permadeath_and_commander_down.md`), M.Sgt. Halvard Bosk "Anvil" (Tank/human), Pvt. Tegan Iyari "Foxfire" (Meeps/Hiopi centauroid), Cpl. Priya Anand "Farsight" (Reeps/Osnian vibrissal — first vibrissal pilot in the codebase), Spec. Corin Lask "Patch" (Munti/human). All tier G at deploy, `heirloomCharge: "locked"` throughout the act.

## Deploy cap

`ACT1_DEPLOY_CAP = 5` — the full five-pilot roster, no real composition choice yet (that arrives Act II).

## Systems introduced this act

Fog of war for the player; Overwatch/reaction fire; per-path ability depth (Sensor Sweep, Ambush, Interdict, Screen); `clear_bloom` objective + house rule #7 (bloom regrowth); the `rescue_pilot` bonus objective, then generalized into the full bonus-objective framework alongside `clear_bloom_patch`; hostile-mech Munti-priority targeting; Taunt (Meeps, Mission 8 onward); the full Player AI engine rewrite (`src/sim/playerAi/`, objective-aware, cohesive, terrain-using); the 12-hour mission real-time clock. See `engine_systems/` for each.

## Mission table

| # | Name | Objective | Enemy | Bonus | Final sim result |
| --- | --- | --- | --- | --- | --- |
| 1 | Muster | eliminate_all | 12 Crawlmass (doubled from 6) | — | ~30-40%, noisy |
| 2 | Wire and Mud | hold_zone (turn 6/12) | 6+6 Splitfang, staggered | — | 8/8 (100%), turn 6 |
| 3 | The Low Ground | clear_bloom | 8 Crawlmass + 2 Splitfang | — | 0% bot / human-cleared fine |
| 4 | Tunnel Rats | eliminate_all | 3 burrowed Undertow + 4 Crawlmass | — | playtested positive |
| 5 | Foraging Party | extract_unit (Anand) | 6 Crawlmass + 2 Splitfang | rescue_pilot | 0/16 bot / human win |
| 6 | House Colors | eliminate_all | 4 House Amaranth Line Troopers | — | — |
| 7 | Sporewatch Ridge | hold_zone (turn 6/12) | 3 Sporethrower + 2 Crawlmass | — | 8/8 (100%) |
| 8 | The Choir Sings | eliminate_all [mid-boss] | 4 Choir + 4 Crawlmass | — | Taunt gates here onward |
| 9 | Cut Off | survive_n_turns (10) | 10 Crawlmass + 2 fixed Gallcyst | rescue_pilot | 8/8 (100%) |
| 10 | The Amaranth Betrayal | extract_unit (Iyari) | 6 Crawlmass + 4 Splitfang | clear_bloom_patch | 3/3 |
| 11 | The Long Walk Back | extract_unit (Lask) | staged, river crossing | — | 19/26 (~73%) |
| 12 | The Fallow Line | hold_zone (turn 10/16) [finale] | 4 waves, Crawlmass→Sirenmaw | — | 4/8 (50%) |

Full per-mission detail: `mission01_muster.md` through `mission12_the_fallow_line.md`.
