# Act II — Two Fires (Missions 13–24)

Built in three batches (13-16, 17-20, 21-24), all landing 25 Aug 2026. Opens with the two genuinely new systems the Independent Campaign doc's §3 scoping called out for Act II: a squad composition choice and ship fire support. Closes with the campaign's first sessile boss (Heartwood, Mission 21) and the first `protect_asset` mission (Ash on the Water, Mission 22).

## Roster — the Second Lance integrates

`SECOND_LANCE_PILOTS`/`SECOND_LANCE_MEKS` (Okafor, Solheim, Vashti) merge into the roster on Mission 12's win via `integrateSecondLance()`. `ACT2_DEFAULT_SQUAD` — the 8-pilot working default used for sim-tuning — is the 5 Wardens plus all 3. `ACT2_DEPLOY_CAP = 8`.

## Systems introduced this act

Squad composition choice (mechanically real once the roster exceeds 5, via `deployCapForMission`); Fire Support / Meridian's Oath (`abil_fire_support`, arm-then-click-a-tile targeting — the first two-click ability in the game); the `contested_landing` objective type (Mission 15); the `protect_asset` objective type (Mission 22, and its later defendZone-fallback AI fix — see `engine_systems/ability_depth_and_targeting_ai.md`). See `engine_systems/squad_and_deploy_structure.md` and `engine_systems/taunt_and_fire_support.md`.

## Mission table

| # | Name | Objective | Enemy | Bonus | Final sim result |
| --- | --- | --- | --- | --- | --- |
| 13 | New Colors, Old Wounds | eliminate_all | 12 Crawlmass + 3 Splitfang | — | 14/14 |
| 14 | Steel Rain | eliminate_all | 8 Crawlmass + 3 Splitfang + 2 fixed Gallcyst | — | 14/14 |
| 15 | Landfall | contested_landing | 10+6 Crawlmass/Splitfang t1, +4 Crawlmass t3 | — | ~93% |
| 16 | Collaborators | eliminate_all | 5 House Amaranth Conscripts (2+1+1+1) | rescue_pilot (reused) | 10/16 (~63%), deliberately swingy |
| 17 | The Wellroot Uncovered | extract_unit (Solheim) | 6 Crawlmass + 1 Splitfang + 1 Sporethrower | clear_bloom_patch | 12/12 after major retuning |
| 18 | Breakout at Draven's Cut | eliminate_all | 4 Line Troopers (west) + 6 Crawlmass + 3 Splitfang (east) | — | 14/14 |
| 19 | The Silent Ward | eliminate_all | 3 burrowed Undertow + 5 Crawlmass | — | 8/8 |
| 20 | Marrow's Line | eliminate_all | Col. Marrow (tier C rival) + 4 Line Troopers | — | 14/14, dramatic |
| 21 | Cut the Root | eliminate_all [boss] | Bloom Heartwood + Undertow reinforcements | — | ~60-70% (mitigated, not fixed) |
| 22 | Ash on the Water | protect_asset | 14+6 t1, 8 t5 (original); 5/2/2 (post-AI-fix) | — | 35/40 (~87.5%) post-fix |
| 23 | The Amaranth Accord | extract_unit (Anand, turn 17) | 4 House Amaranth Line Troopers | — | 12/14 (~86%) |
| 24 | Two Fires | eliminate_all [finale, two-front] | Bloom N + House Amaranth S, 4+4+4+4 | — | 8/8, real losses. Third Lance integrates on win. |

Full per-mission detail: `mission13_new_colors_old_wounds.md` through `mission24_two_fires.md`.
