#!/usr/bin/env python3
"""
Bloom Wars -- maps_house_amaranth.py

WHAT THIS FILE IS (31 Aug 2026 -- scaffolding pass, per
Bloom_Wars_House_Amaranth_Full_Campaign_Plan_v1.md's own Step 2/Step 8
batch order): a third sibling to maps.py / maps_amaranth.py, same
discipline ("a map only counts once it's run through the script and
passed"), for House Amaranth's own 36-mission campaign. Does not import
from either of the other two scripts, and touches neither -- same "locked
tight" reasoning maps_amaranth.py's own header gives for staying separate
from maps.py.

STATUS: 21 of 36 authored -- Act I (1-12) and Act II (13-20) complete, Act
III begun with Mission 21 ("After the Line"). Missions 22-36's grids are
NOT here yet -- see the plan doc's own Act III section (§6) for what each
one needs once map design for them continues. Add a new GRIDS entry the
same shape as "mission_house_amaranth_21" below, one mission at a time,
same incremental validate-as-you-build discipline the plan doc's own Step
3 calls for. (This comment previously said "skeleton, only Mission 1" for
several missions' worth of build passes without being corrected -- worth
actually updating each time, not just at milestones.)

Run: python3 maps_house_amaranth.py
Writes: maps_house_amaranth_generated.ts (paste the const block(s) into
src/data/mapsHouseAmaranth.ts by hand, same workflow as maps_amaranth.py).
"""

import os
import sys
from collections import deque

# =====================================================================
# TILE TABLE -- identical vocabulary and costs to maps.py/maps_amaranth.py's
# own tables (same engine, same tile legend). Duplicated here rather than
# imported, deliberately -- see maps_amaranth.py's own header on why these
# scripts don't depend on each other.
# =====================================================================
IMPASSABLE = None

TILES = {
    ".": ("plain",     "Plain / ferrocrete",  1, 1, 1, 1),
    "=": ("road",      "Road / rail spine",   1, 1, 1, 0),
    ",": ("scrub",     "Open scrub",          1, 1, 1, 0),
    "%": ("rubble",    "Rubble",              2, 3, 1, 2),
    "#": ("structure", "Structure / habblock", 1, 2, 1, 3),
    "~": ("bloom_mat", "Bloom mat",           2, 2, 1, 1),
    "^": ("ridge",     "Ridge / elevated",    2, 3, 1, 4),
    "w": ("sump",      "Water / sump",        IMPASSABLE, IMPASSABLE, 1, 0),
    "P": ("deploy",    "Deploy pad (player)", 1, 1, 1, 1),
    "E": ("spawn",     "Bloom spawn seam",    1, 1, 1, 0),
    "X": ("exit",      "Extraction tile",     1, 1, 1, 1),
    "H": ("hold",      "Hold-zone tile",      1, 1, 1, 2),
    "B": ("wall",      "Blockhouse wall",     IMPASSABLE, IMPASSABLE, 99, 0),
    "D": ("dock",      "Dock perimeter",      1, 1, 1, 2),
}
TILE_TO_CHAR = {v[0]: k for k, v in TILES.items()}

OBJECTIVE_TILES = {"spawn", "exit", "hold", "dock"}

# Same floor as maps_amaranth.py's own thresholds -- a genuinely broken
# map catch, not a tight fit.
MIN_DEPLOY_PADS = 4
MIN_SPAWN_SEAMS = 1

# =====================================================================
# THE MAPS -- House Amaranth's own campaign. Grow this dict one mission at
# a time; each entry is {"name": <mission display name>, "const": <TS
# const identifier>, "ascii": [<row strings>]}.
# =====================================================================
GRIDS = {
    # Mission 1, "First Harvest" (Act I -- Harvest Ground). Tutorial-sized,
    # deliberately small and simple to match Warden's own Mission 1
    # ("Muster") -- establishes Marrow on an ordinary ward-crop terrace
    # before anything is wrong. A Crawlmass drift (bloom_crawlmass, the
    # same low-tier swarm Muster itself opens on) wandered onto the
    # bloom_mat patch in the terrace's northwest corner; deploy is the
    # south field. Namespaced "house_amaranth" (not "amaranth_house") to
    # match every sibling file this pass created
    # (campaignHouseAmaranth.ts / mapsHouseAmaranth.ts / this script).
    "mission_house_amaranth_1": {
        "name": "First Harvest",
        "const": "FIRST_HARVEST_TILES",
        "ascii": [
            "EE............",
            "..............",
            "..~~~.........",
            "..~~~.........",
            "..............",
            "..............",
            "..............",
            "..............",
            "....PPPPP.....",
        ],
    },
    # Mission 2, "The Long Contract" (Act I -- Harvest Ground). A walled
    # diversion-relay room with one doorway -- the bargain's actual
    # machinery, defended for the first time. Deliberately the SAME proven
    # wall/hold/spawn geometry maps_amaranth.py's own "Wire and Mud"
    # (Warden Mission 2, also a hold_zone/one-doorway relay-room mission)
    # already ships and has been sim-tuned on for a week -- reusing a
    # validated shape for a genuinely analogous fiction beat is not the
    # same thing as reusing content; every tile identity, coordinate, and
    # count below is freshly authored for this file, only the STRUCTURE
    # (interior walled room, single west-facing doorway, spawn seams past
    # the far wall, reachable only by going around) is deliberately
    # borrowed from a shape already proven to validate and play fairly.
    # Border retextured scrub/ridge -> bloom_mat, fitting House Amaranth's
    # ward-crop-terrace fiction over Warden's military-terrain one.
    "mission_house_amaranth_2": {
        "name": "The Long Contract",
        "const": "THE_LONG_CONTRACT_TILES",
        "ascii": [
            "~~~~.............~~~~~",
            "~~..................~~",
            "~~....BBBBBB........~~",
            "P.....BHHHHB........~~",
            "PP....BHHHHB........~~",
            "P......HHHHBE.......~~",
            "PP....BHHHHBE.......~~",
            "P.....BHHHHB........~~",
            "~~....BBBBBB........~~",
            "~~..................~~",
            "~~~~.............~~~~~",
        ],
    },
    # Mission 3, "Second Harvest" (Act I -- Harvest Ground). A ward-crop
    # survey team is cut off when a drift runs heavier than predicted --
    # House Amaranth's first extraction mission, same beat Warden's own
    # Mission 5 ("Restock, Not Rescue") plays first for their side.
    # Deliberately reuses THAT map's proven open-field/two-seam/deploy-west-
    # exit-east shape (maps_amaranth.py's own FORAGING_PARTY_TILES) rather
    # than inventing a fresh extract_unit geometry from zero -- same "borrow
    # a validated shape for a genuinely analogous beat" discipline Mission
    # 2's own comment above already explains. Every tile identity below is
    # freshly authored for House Amaranth: border ridge/scrub -> bloom_mat
    # (the terrace's own overgrown edge), the two rubble/structure obstacle
    # clusters -> bloom_mat (thick, uncut crop rows blocking a straight
    # line, not literally the same feature). Extraction target: Orin
    # (Fieldwright track) -- the survey team's own hands-on specialist,
    # same track Warden's Lask/Vashti already carry as extract_unit targets
    # in that campaign's own precedent.
    "mission_house_amaranth_3": {
        "name": "Second Harvest",
        "const": "SECOND_HARVEST_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~~~",
            "~~~................~~~",
            "~....................~",
            "~.............E......~",
            "P........~~..........X",
            "PP.......~~.........XX",
            "P..........~~...E....X",
            "PP.........~~.......XX",
            "P........~~..........X",
            "~..............E.....~",
            "~....................~",
            "~~~................~~~",
            "~~~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 4, "Good Neighbors" (Act I -- Harvest Ground). First contact
    # with Warden Company patrols on the shared border -- wary, correct,
    # unfriendly. A fresh geometry, not a borrowed one: the map's own
    # point is a border checkpoint road (the "=" spine) running the full
    # interior, splitting House Amaranth's own side (deploy, west) from
    # the far side the patrol works. The fight itself is still Bloom vs.
    # the lance -- the engine has one hostile faction, and this beat is
    # tension/dialogue over a shared incursion, not PvP against Warden's
    # own pilots. Two spawn seams sit on House Amaranth's own side (where
    # the actual fight happens); the third, past the road, reads as the
    # incursion reaching toward the patrol's own ground too, without
    # anything crossing the checkpoint mechanically.
    "mission_house_amaranth_4": {
        "name": "Good Neighbors",
        "const": "GOOD_NEIGHBORS_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~",
            "~...E....=.......~",
            "~........=.......~",
            "~PP......=.......~",
            "~PP......=...E...~",
            "~P.......=.......~",
            "~........=.......~",
            "~........=.......~",
            "~...E....=.......~",
            "~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 5, "The Seal Arrives" (Act I -- Harvest Ground). A House
    # officer holding Halcyon's seal visits for a muster; Marrow has to make
    # it look easy. Reuses Warden's own "Sporewatch Ridge" (Mission 7, also
    # a hold_zone) proven raised-plateau shape -- a ridge-walled dais with
    # no doorway (open on all four sides, unlike Mission 2's single-entry
    # relay room) -- deliberate shape variety from this campaign's own
    # Mission 2, and a real fit for a formal muster ground: the ridge reads
    # as reviewing-stand elevation, not a bunker. Border scrub -> bloom_mat;
    # ridge kept as ridge (raised ground, not a texture swap this time --
    # a muster dais SHOULD read as elevated terrain, same tile family the
    # original uses it for).
    "mission_house_amaranth_5": {
        "name": "The Seal Arrives",
        "const": "THE_SEAL_ARRIVES_TILES",
        "ascii": [
            "~~~~~~~~PPPP~~~~~~~~",
            "~.......PPPP.......~",
            "~..................~",
            "~......^^^^^^......~",
            "~......^HHHH^......~",
            "~......^HHHH^......~",
            "~......^HHHH^......~",
            "~......^^^^^^......~",
            "~....~~~~~~~~~~....~",
            "~....~~~~~~~~~~....~",
            "~..................~",
            "~~~~~~~~EEEE~~~~~~~~",
        ],
    },
    # Mission 6, "House Colors" (Act I -- Harvest Ground). Mirrors Warden's
    # own Mission 6 -- the SAME checkpoint, the SAME incident, House
    # Amaranth's own side of it. Unlike every other borrowed shape so far,
    # this one is deliberately NOT retextured: it's meant to read as the
    # literal same place (Thane's Crossing, maps_amaranth_grids.py's own
    # HOUSE_COLORS_TILES), transcribed fresh into this file the same
    # discipline demands (never cross-imported), gate wall and flanking
    # guard structures intact. Warden's own Mission 10 ("The Amaranth
    # Betrayal") already shows this same location AFTER the withdrawal --
    # gate wide open, nobody holding it. This mission is the withdrawal
    # itself: Marrow's own detachment, still holding the line, still
    # fighting for it, right up until the order comes to walk away from
    # what they just held clean.
    "mission_house_amaranth_6": {
        "name": "House Colors",
        "const": "HOUSE_COLORS_TILES",
        "ascii": [
            ",,,,,,,,,,,,,,,,,,,,",
            ",........B.........,",
            ",........B.........,",
            ",......##B.##......,",
            "P......##B.##..E...,",
            "PP===============E==",
            "P================E==",
            "P......##B.##..E...,",
            ",......##B.##......,",
            ",........B.........,",
            ",........B.........,",
            ",,,,,,,,,,,,,,,,,,,,",
        ],
    },
    # Mission 7, "Deeper Terraces" (Act I -- Harvest Ground). Expanding the
    # ward-crop program onto a new tier -- a research team needs pulling
    # out when the drift there runs hot. No Warden mirror named for this
    # one in the plan doc's own §6 table, so a fresh geometry rather than a
    # borrowed shape: the map's own point is a literal two-tier terrace,
    # not just a fiction label. Deploy sits on the established lower tier
    # (south, safe ground House Amaranth has held for a while); a two-row
    # ridge band splits it from the new upper tier (north) the program is
    # only just opening -- ridge tiles are passable, not a wall (same
    # elevated-terrain cost every other ridge use in this file already
    # carries), so the "climb" is a real movement-cost tax, not a hard
    # gate. The new tier is where the drift actually runs hot: two spawn
    # seams and the research team's own extraction cluster live up there;
    # two more spawn seams sit at the ridge's own base (idx4/idx14, under
    # the two plain gap-columns left in the ridge band as the readable
    # "ramp" points) -- Bloom that's already crept partway down before the
    # squad even reaches the climb, real pressure on the approach itself,
    # not just at the top. Extraction target: Orin again (Fieldwright) --
    # same track precedent as Mission 3, and Warden's own campaign reuses
    # a single Fieldwright (Anand) as its extract_unit target more than
    # once too, so this isn't inventing a new convention.
    "mission_house_amaranth_7": {
        "name": "Deeper Terraces",
        "const": "DEEPER_TERRACES_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~",
            "~..E.....XX.....E..~",
            "~........XX........~",
            "~^^^.^^^^^^^^^.^^^^~",
            "~^^^.^^^^^^^^^.^^^^~",
            "~...E..............~",
            "~..................~",
            "~.............E....~",
            "~..................~",
            "~PP................~",
            "~P.................~",
            "~PP................~",
            "~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 8, "The Quiet Growth" (Act I -- Harvest Ground). First sign
    # the diverted Bloom isn't staying where it's put -- a night watch that
    # shouldn't need this much watching. House Amaranth's own first
    # survive_n_turns mission, same "cheapest ask" first-outing discipline
    # Warden's own Mission 9 ("Cut Off") set for that objective type:
    # modest turnLimit, no hold room, deploy roughly central. Directly
    # applying the real lesson that mission's later Act III siblings had to
    # learn the hard way (campaignAmaranth.ts's own Mission 34/35 comments):
    # this engine's AI never moves without a visible target, and
    # survive_n_turns has no hold zone to eventually walk the squad into,
    # so the pressure has to already be in range from turn 1 -- built in
    # from the start here rather than discovered by a bad sim run. A tight,
    # compact watch-post layout: deploy dead center, four spawn seams (N/S/
    # E/W) close enough on every side that the squad reads as genuinely
    # surrounded, not waiting for something to arrive.
    "mission_house_amaranth_8": {
        "name": "The Quiet Growth",
        "const": "THE_QUIET_GROWTH_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~",
            "~......EE......~",
            "~..............~",
            "~..............~",
            "~EE..........EE~",
            "~.....PPP......~",
            "~.....PPP......~",
            "~..............~",
            "~..............~",
            "~......EE......~",
            "~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 9, "Loyalist Eyes" (Act I -- Harvest Ground). A sector-
    # governor auditor tours the program; Marrow has to hold a clean,
    # boring battle for an audience hoping for a mess. No Warden mirror
    # named for this one; a fresh geometry, and a genuinely different hold
    # shape from this campaign's own two prior hold_zone maps -- not
    # Long Contract's single doorway, not Seal Arrives' open-on-all-sides
    # dais, but a walled audit courtyard with TWO gates (north/south),
    # deliberately a different tactical problem: attention has to split
    # between two chokepoints, not concentrate on one. The squad's already
    # positioned inside when the fight starts -- deploy sits inside the
    # courtyard itself, not approaching it, matching the fiction (they're
    # already standing post for the tour when the drift shows up).
    "mission_house_amaranth_9": {
        "name": "Loyalist Eyes",
        "const": "LOYALIST_EYES_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~",
            "~.......EE.......~",
            "~................~",
            "~BBBBBBB..BBBBBBB~",
            "~B..............B~",
            "~BPP...HHHH.....B~",
            "~BPP...HHHH.....B~",
            "~BP....HHHH.....B~",
            "~B..............B~",
            "~BBBBBBB..BBBBBBB~",
            "~................~",
            "~.......EE.......~",
            "~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 10, "The Choir, Heard From Afar" (Act I -- Harvest Ground).
    # Mirrors Warden's own Mission 8 mid-boss ("The Choir Sings") -- the
    # same coordinated Bloom pack, met differently: House Amaranth doctrine
    # handles it by redirection, not annihilation, so only the stragglers
    # that wouldn't be steered actually get fought here (the "heard from
    # afar" framing -- the bulk of the swarm passes at a distance, off
    # camera, redirected clean). Map deliberately reuses THE_CHOIR_SINGS_
    # TILES' own proven open-field/ridge-corner shape from mapsAmaranth.py
    # (border retextured ridge/scrub -> bloom_mat, same discipline every
    # other borrowed House Amaranth shape uses -- the interior bloom_mat
    # crop clusters were already the right tile identity, untouched).
    "mission_house_amaranth_10": {
        "name": "The Choir, Heard From Afar",
        "const": "THE_CHOIR_HEARD_FROM_AFAR_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~~~",
            "~~~~..............~~~~",
            "~~~~..............~~~~",
            "~....................~",
            "~...................E~",
            "P................EE..~",
            "PP...............EE..~",
            "PP...............EE..~",
            "P........~~~~........~",
            "~........~~~~.......E~",
            "~~~~..............~~~~",
            "~~~~..............~~~~",
            "~~~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 11, "What the Terraces Cost" (Act I -- Harvest Ground). A
    # ward-crop technician goes missing inside the growth zone -- the
    # bargain's first quiet, unlogged casualty. No Warden mirror named for
    # this one; a fresh geometry, and a genuinely different extract_unit
    # shape from this campaign's own two prior extractions (Second
    # Harvest's open field, Deeper Terraces' two-tier ridge climb): a
    # cluttered "growth zone" maze, three separate bloom_mat crop-cluster
    # bands (two rows tall each, same precedent Second Harvest's own
    # obstacle clusters already set) breaking sightlines across the whole
    # width, not just two obstacles in an otherwise open field. Two of the
    # four spawn seams sit tucked directly against the clusters (not out
    # in the open) -- something can be right next to you in this terrain
    # and stay hidden, the actual mechanical reading of "the growth zone
    # swallowed her."
    "mission_house_amaranth_11": {
        "name": "What the Terraces Cost",
        "const": "WHAT_THE_TERRACES_COST_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~",
            "~.....E.......E....~",
            "~..................~",
            "~..~~....~~....~~..~",
            "~..~~....~~....~~..~",
            "~..................~",
            "P.................X~",
            "PP...............XX~",
            "P.................X~",
            "~..~~.E..~~.E..~~..~",
            "~..~~....~~....~~..~",
            "~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 12, "Harvest's End" (Act I -- Harvest Ground, act finale).
    # A diversion relay fails under real load for the first time; Marrow
    # holds the line long enough for a fix, at real cost to her own staff.
    # No true walls anywhere on this map -- every other hold_zone map so
    # far used a hard chokepoint (Mission 5's ridge behind open ground,
    # Mission 9's two blockhouse gates); this one deliberately has none,
    # the actual mechanical reading of "the thing that's supposed to hold
    # here doesn't." The relay itself sits center as the hold zone (3x4
    # H block, same footprint convention as Mission 5's own HHHH x3). Two
    # habblock/structure clusters (passable but costly, not impassable --
    # same "#" identity Data Pack tile costs already give it) flank the
    # relay and break sightlines without sealing anything off. Four spawn
    # seams spread across the top band feed the ground wave via
    # enemy_deploy; the burrowed-ambush and flyer-reinforcement waves this
    # mission was built around (Maxime, 31 Aug 2026: "add some undertow or
    # flyers too") are pinned coordinates instead, same discipline
    # Undertow always ships with campaign-wide -- not tied to a marked "E"
    # tile at all, see campaignHouseAmaranth.ts's own comment on the
    # composition.
    "mission_house_amaranth_12": {
        "name": "Harvest's End",
        "const": "HARVESTS_END_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~",
            "~..E....E..E....E..~",
            "~..................~",
            "~..####......####..~",
            "~..####......####..~",
            "~..................~",
            "~.......HHHH.......~",
            "~.......HHHH.......~",
            "~.......HHHH.......~",
            "~..................~",
            "~...PPPP....PPPP...~",
            "~..................~",
            "~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 13, "New Terraces, New Faces" (Act II -- The Bargain Holds).
    # Integrating a second lance as the program expands past what one
    # company can hold. First House Amaranth map built around a genuinely
    # different enemy-composition SHAPE rather than the Crawlmass+Splitfang
    # base every Act I mission (bar the Choir and Harvest's End) reached
    # for -- Maxime, 31 Aug 2026: "vary between the different enemy unit
    # ... we got 6-7 enemy unit. so lets vary tjing up." Gallcyst
    # (data/bloom.ts, sessile, moveRange 0) hasn't appeared anywhere in
    # this campaign's first 12 missions -- a real gap, not a coincidence,
    # confirmed by grepping every enemyWaves block before writing this one.
    # The new terraces come with their own freshly-installed point-defense,
    # a single 3x6 structure block center-map (the construction site
    # itself), with the fixed Gallcyst turrets pinned inside it and
    # Sporethrower support pinned just outside -- something to converge on
    # and take, not a swarm to meet in the open. Two far spawn seams feed
    # the Crawlmass filler via enemy_deploy.
    "mission_house_amaranth_13": {
        "name": "New Terraces, New Faces",
        "const": "NEW_TERRACES_NEW_FACES_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~",
            "~..E............E..~",
            "~..................~",
            "~......######......~",
            "~......######......~",
            "~......######......~",
            "~..................~",
            "~..................~",
            "~..................~",
            "~...PPPP....PPPP...~",
            "~..................~",
            "~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 14, "The Governor's Patience" (Act II -- The Bargain Holds).
    # Political pressure sharpens; a loyalist liaison officer needs
    # escorting out once he's seen too much. extract_unit, extractUnitId
    # pilot_orin (her fourth time as this campaign's extraction target --
    # named directly rather than glossed, same discipline every prior reuse
    # got. She's the one who has to reach him and get him out; the fiction
    # reads Orin's own exposure during that run as the thing the mechanic
    # actually represents). A checkpoint corridor, not an open field or a
    # maze -- a genuinely different extract_unit shape again: rubble cover
    # clusters flank a clear center lane running deploy(west) to exit
    # (east), with a real choice between the guarded flanks and the exposed
    # middle. Undertow (data/bloom.ts, burrowed) pinned at the flank
    # clusters -- the "political danger, hidden until it's already on you"
    # reading, and this campaign's first time using Undertow as the
    # PRIMARY threat rather than a small secondary addition (Mission 12's
    # own 2-unit support role).
    "mission_house_amaranth_14": {
        "name": "The Governor's Patience",
        "const": "THE_GOVERNORS_PATIENCE_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~~~",
            "~....................~",
            "~....................~",
            "P..%%............%%..X",
            "PP..%%..........%%..XX",
            "P....................X",
            "PP..%%..........%%..XX",
            "P..%%............%%..X",
            "~....................~",
            "~..E..............E..~",
            "~~~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 15, "Rootbound" (Act II -- The Bargain Holds). First real
    # sign of what will become the Wellroot -- a diversion relay's target
    # zone growing faster than it's told to. hold_zone, the campaign's
    # fourth (Mission 2, 9, 12), and a different shape again: the hold
    # itself sits center in open ground, with four bloom_mat overgrowth
    # clusters at the map's four corners -- the encroachment the pitch
    # describes made literal in terrain, not just narration. Sporethrower
    # pinned inside each cluster: this campaign's first time using
    # Sporethrower as the PRIMARY threat rather than a 1-2 unit secondary
    # addition it's always been through Act I (Missions 6, 7, 11) and
    # Mission 13 (paired with Gallcyst). Four separate ranged sightlines
    # into one central hold zone is a genuinely different tactical problem
    # from every prior hold_zone map's melee-wave or ambush shape.
    "mission_house_amaranth_15": {
        "name": "Rootbound",
        "const": "ROOTBOUND_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~",
            "~..E............E..~",
            "~~~~............~~~~",
            "~~~~............~~~~",
            "~..................~",
            "~.......HHHH.......~",
            "~.......HHHH.......~",
            "~.......HHHH.......~",
            "~..................~",
            "~~~~............~~~~",
            "~~~~............~~~~",
            "~...PPPP....PPPP...~",
            "~..................~",
            "~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 16, "The Long Ledger" (Act II -- The Bargain Holds). A rival
    # House tries to poach the diversion contract by force -- the bargain
    # has enemies who aren't the Bloom, per the plan doc's own §6 pitch.
    # First House Amaranth mission fielding hostile mechs at all (every
    # prior one, including Mission 6's own mirror beat, fought Bloom only)
    # -- data/units.ts's generic HOSTILE_MECHS (hostile_mech_01-04,
    # "Unmarked Mech", tank/meeps/meeps/reeps, tier G), not
    # AMARANTH_HOSTILE_MECHS (House Amaranth's own line troopers, wrong
    # faction for an attacker) or AMARANTH_CONSCRIPT_MECHS (already
    # committed elsewhere, campaignAmaranth.ts's own Mission 16
    # "Collaborators" -- a different campaign, different mission, confirmed
    # via that file's own comment before reusing anything). "Unmarked"
    # reads as deniable, which is exactly what a rival House poaching a
    # bargain by force would actually send. A fresh map shape: a supply
    # depot straddling a single east-west road, two warehouse rows (north/
    # south) flanking it, deploy centered on the road defending the depot
    # itself -- spawn seams sit at BOTH far ends of the road (west and
    # east), a two-pronged pincer down the one avenue in, not this
    # campaign's now-repeated center-block-plus-corner-spawns shape
    # (Missions 12/13/15 all used a variant of that). Border bloom_mat,
    # matching the campaign's own majority convention (Mission 6 is the
    # only prior exception, and for a documented reason -- a literal
    # unretextured reuse of Warden's own checkpoint map).
    "mission_house_amaranth_16": {
        "name": "The Long Ledger",
        "const": "THE_LONG_LEDGER_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~~~",
            "~....................~",
            "~....####....####....~",
            "~....####....####....~",
            "~....................~",
            "~E.================.E~",
            "~....................~",
            "~....####....####....~",
            "~....####....####....~",
            "~......PPPPPPPP......~",
            "~~~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 17, "What Grows Beneath" (Act II -- The Bargain Holds, plan
    # doc §6). Mirrors Warden's own Mission 17, other side: House
    # Amaranth's own survey team finds what Warden will later call the
    # Wellroot, and reports -- against Marrow's instinct -- that it's
    # still within tolerance. `extract_unit`. A fresh geometry (a dig-site
    # trench, not a reuse of Warden's own WELLROOT_TILES shape): ridge rims
    # top and bottom with periodic ramp gaps down into the open trench
    # floor, deploy west / exit east across four rows each (a wide,
    # multi-lane approach rather than a single-file corridor), spawn seams
    # on both ridge shoulders plus one dead-center in the trench floor
    # itself -- the thing being surveyed is directly in the squad's own
    # path out, not off to a side.
    "mission_house_amaranth_17": {
        "name": "What Grows Beneath",
        "const": "WHAT_GROWS_BENEATH_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~~~~~",
            "~^^^.^^^^^^.^^^^^^.^^^^~",
            "~....E............E....~",
            "~PP..................XX~",
            "~PP..................XX~",
            "~PP........E.........XX~",
            "~PP..................XX~",
            "~....E............E....~",
            "~^^^.^^^^^^.^^^^^^.^^^^~",
            "~......................~",
            "~~~~~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 18, "Cultivator's Gambit" (Act II -- The Bargain Holds, plan
    # doc §6: "Deploying a new containment array directly onto contested,
    # still-hot ground"). `contested_landing` -- the SAME objective type
    # Warden's own Mission 15 "Landfall" introduced (engine/mission.ts's
    # contested_landing branch is byte-for-byte eliminate_all's own check;
    # the "opposed drop" identity lives entirely in this geometry: spawn
    # seams close enough to the deploy block to be well inside a first-
    # turn hostile-phase move+attack, no grace period). Landfall itself
    # reads as a beachhead -- one direction of approach, deploy hugging one
    # edge with spawns ahead of it. This mission is a genuinely different
    # shape of the same idea, matching its own "gambit" framing: the
    # containment array (and the 10-pilot lance escorting it) drops dead
    # center of the hot ground, with spawn seams on all four sides -- N/S/
    # E/W, none more than 2-4 tiles from the deploy block's own edge. Not a
    # landing under fire from one direction; a landing surrounded. Ten
    # deploy pads (rows 4-5, cols 8-12) match the 10-pilot Act II squad
    # exactly -- no wraparound needed, a first for this campaign. Rubble
    # and wrecked-structure fragments scattered through the remaining open
    # ground read as "still-hot" -- recent fighting already happened here,
    # nothing pristine about this LZ.
    "mission_house_amaranth_18": {
        "name": "Cultivator's Gambit",
        "const": "CULTIVATORS_GAMBIT_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~~~",
            "~...........%%.......~",
            "~..##...EE.....%.....~",
            "~.....%..........%...~",
            "~.......PPPPP...EE...~",
            "~..EE...PPPPP........~",
            "~....%............%..~",
            "~......%...EE........~",
            "~.........%...%..##..~",
            "~..%............%....~",
            "~~~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # Mission 19, "The Weight of the Seal" (Act II -- The Bargain Holds,
    # plan doc §6: "Halcyon Amaranth herself visits the front for the
    # first time; Marrow holds a real fight while explaining, live, why
    # the numbers still work"). `hold_zone`. Halcyon herself hasn't
    # appeared in person anywhere in this campaign yet -- Mission 5 "The
    # Seal Arrives" was her seal-holder proxy on a controlled muster
    # ground, Mission 9 "Loyalist Eyes" a hostile auditor on a managed
    # tour. This is different on purpose: an actual forward overlook at
    # the front line, not a rehearsed review -- Halcyon watches a real
    # fight break out around her, not a clean one staged for her benefit.
    # A compact 3x4 hold block (12 tiles, matching this campaign's own
    # established hold_zone sizing) flanked by ridge on both the north and
    # south approach, deploy hugging the west edge (8 pads). Gallcyst
    # (data/bloom.ts: sessile, moveRange 0, attackRange [1,3]) dug in on
    # the hold block's own WEST flank, between deploy and the zone itself
    # -- moved here after a first-pass sim (see campaignHouseAmaranth.ts's
    # own comment) found the squad clusters on the hold tile nearest
    # deploy every time hold_zone only requires ONE tile occupied, which
    # left an east-flank Gallcyst permanently out of its own attackRange 3
    # and doing nothing at all. Dug in on the approach side instead, it's
    # actually in the fight regardless of which hold tile gets taken --
    # the real design constraint a stationary archetype puts on its own
    # placement, unlike every mobile archetype this file has spawned so
    # far. Splitfang seams north and south of the overlook for fast
    # harassment converging from above and below rather than head-on -- a
    # genuinely new pairing for this campaign's own hold_zone missions
    # (Gallcyst hasn't been paired with Splitfang before; Mission 13
    # paired it with Sporethrower instead).
    "mission_house_amaranth_19": {
        "name": "The Weight of the Seal",
        "const": "THE_WEIGHT_OF_THE_SEAL_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~~~",
            "~.........EE.........~",
            "~.........^^^^^^...%.~",
            "~PP....%.E.HHHH......~",
            "~PP......E.HHHH......~",
            "~PP......E.HHHH......~",
            "~PP.......^^^^^^.....~",
            "~.......%.........%..~",
            "~....%...............~",
            "~.........EE.........~",
            "~~~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # House Amaranth Act II, Mission 20 ("Marrow's Line") — the same shared
    # convergence battle Warden Company fights (see mapsAmaranth.py's own
    # MARROWS_LINE_TILES), played from House Amaranth's side per the
    # campaign plan's own note (Section 5): a separate map/mission entry,
    # not a reuse of Warden's data, because deploy zones, composition and
    # the objective itself all differ by side. House Amaranth (led by
    # pilot_marrow, exemptFromPermadeath) deploys west; the exit sits far
    # east, a full traversal away rather than adjacent to deploy — a first
    # draft of this map put the exit right next to deploy and the sim
    # never engaged the enemy at all (100% win regardless of enemy count,
    # since Marrow could just walk out). The Warden Company mirror force
    # (WARDEN_HOSTILE_MECHS/WARDEN_RIVAL_MECHS in units.ts) spawns as a
    # north/south flanking pincer partway down the lane plus a center
    # blocker roughly two-thirds of the way to the exit — Rourke herself,
    # "closing a line" per the briefing, positioned to actually contest
    # the extraction route rather than sit behind it. Objective is
    # extract_unit, not eliminate_all — a disciplined disengagement rather
    # than a rout. Broken ridge/rubble bands north and south of an open
    # middle lane, same "avoid a flat killbox" shape this campaign's other
    # missions use, channeling the fight into the same lane the exit sits
    # on rather than letting it be skirted.
    "mission_house_amaranth_20": {
        "name": "Marrow's Line",
        "const": "HOUSE_AMARANTH_MARROWS_LINE_TILES",
        "ascii": [
            "~~~~~~~~~~~~~~~~~~~~~~~~",
            "~,,,,,,%%,,,^^,,,,,,,,,~",
            "~,,,,,,%%,E,^^,,,,,,,,,~",
            "~,,,,,,%%,,,^^,,,,,,,,,~",
            "~,PPP,,,,,,,,,,,,,,XX,,~",
            "~,PPP,,,,,,,,,,E,,,XX,,~",
            "~,PPP,,,,,,,,,,,,,,XX,,~",
            "~,PPP,,,,,,,,,,,,,,XX,,~",
            "~,,,,,,%%,,,^^,,,,,,,,,~",
            "~,,,,,,%%,E,^^,,,,,,,,,~",
            "~,,,,,,%%,,,^^,,,,,,,,,~",
            "~~~~~~~~~~~~~~~~~~~~~~~~",
        ],
    },
    # House Amaranth Act III opener, Mission 21 ("After the Line") — plan
    # doc §6: "Marrow returns from the duel changed -- not broken from the
    # bargain, committed to it harder... eliminate_all." Deliberately the
    # SAME disputed ground Mission 20 (Marrow's Line) was fought over --
    # scrub/rubble/no bloom_mat, same as that map, not this campaign's
    # usual ward-crop-terrace fiction -- read as literal continuity: once
    # both militaries pull back from the line, the Bloom moves into the
    # wreckage they left behind. A 4x3 rubble block at the map's own
    # center (cols 9-12, rows 3-5) IS that wreckage -- an Undertow burrow
    # point (spawn seams tucked at its west/east edges, same "pinned at
    # the flank clusters" precedent Missions 12/14 already established),
    # not a fresh design element. eliminate_all doesn't time out
    # (engine/mission.ts's own house rule #5), so there's no Mission-20-style
    # "exit placed too close" trap to worry about here -- the only real
    # question is whether the squad can actually kill everything, not
    # whether it can walk around the fight.
    "mission_house_amaranth_21": {
        "name": "After the Line",
        "const": "AFTER_THE_LINE_TILES",
        "ascii": [
            "....................",
            "....................",
            ",,,,,,,,,,,,,,,,,EE,",
            "PP,,,,,,E%%%%E,,,,,,",
            "PP,,,,,,,%%%%,,,,,,,",
            "PP,,,,,,E%%%%E,,,,,,",
            "PP,,,,,,,,,,,,,,,,,,",
            "PP,,,,,,,,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,EE,",
            "....................",
            "....................",
        ],
    },
    # Mission 22, "Audit Under Fire" (Act III). Plan doc §6: "the loyalist
    # audit turns hostile -- literally -- when a diversion relay comes under
    # attack mid-inspection." First House Amaranth protect_asset mission --
    # same "D" dock-perimeter tile Warden's own Mission 22 ("Ash on the
    # Water") introduced, reused here for a SECONDARY relay under
    # inspection, not the original one (that's Mission 32, "Hold the Root,"
    # later this act, deliberately the bigger/worse version of the same
    # objective type).
    #
    # v3 -- v1 (fully open field, cosmetic-only lanes) sim-tuned as a hard
    # 100%->0% cliff, no chokepoint at all. v2 (Ash on the Water's own
    # proven single-spawn-per-causeway geometry, sump filling the rest)
    # over-corrected the other way: a single spawn tile at the causeway's
    # far end queues every hostile into a single-file trickle the squad can
    # camp and farm forever -- 36 enemies (12 Sporethrower + 24 Crawlmass,
    # nearly 4x this campaign's largest count anywhere else) still won 49/50,
    # confirmed by a verbose run showing only ~1 hostile reaching the relay
    # per turn regardless of how many were queued behind it. Real finding,
    # not just a tuning number: a single distant spawn point makes a
    # causeway-style chokepoint nearly unbeatable at ANY enemy count, because
    # the bottleneck controls arrival RATE, not just approach angle. Fixed
    # by spreading three spawn seams along each causeway's own length
    # (cols 2/7/12) instead of one at the far end -- hostiles now arrive
    # from multiple points along the lane in the same turn instead of
    # queuing behind each other, so raising the count actually raises
    # pressure again. Still the same sump-causeway shape otherwise
    # (reflavored as flooded drainage channels around the relay pad).
    "mission_house_amaranth_22": {
        "name": "Audit Under Fire",
        "const": "AUDIT_UNDER_FIRE_TILES",
        "ascii": [
            "BBBBBBBBBBBBBBBBBBBB",
            "BwwwwwwwwwwwwwPP...B",
            "B.E....E....E.PPDDDB",
            "B.............PPDDDB",
            "BwwwwwwwwwwwwwPPDDDB",
            "BwwwwwwwwwwwwwPPDDDB",
            "BwwwwwwwwwwwwwPPDDDB",
            "B.E....E....E.PPDDDB",
            "B.............PPDDDB",
            "BwwwwwwwwwwwwwPP...B",
            "BBBBBBBBBBBBBBBBBBBB",
        ],
    },
    # Mission 23, "The Root Answers Back" (Act III). Plan doc §6: "the
    # Wellroot pushes back against containment for the first time -- not an
    # escape, a negotiation, in the only language it has." hold_zone. Reuses
    # Mission 19's own proven shape (central hold block, ridge flanks north
    # and south, spawn seams past each flank) rather than a walled room --
    # the Wellroot itself (bloom_wellroot, data/bloom.ts: sessile, acid,
    # attackRange [1,3], the same colossal boss Warden fights outright in
    # their own Mission 21 "Cut the Root") is placed two tiles east of the
    # hold block's own edge at (13,4) -- close enough to threaten every hold
    # tile with acid, sessile so it can never leave that spot, present as
    # the actual "negotiation" rather than a fight to the death (hold_zone
    # doesn't require killing it, matching the pitch: this mission is about
    # holding position under what it's willing to do, not defeating it).
    "mission_house_amaranth_23": {
        "name": "The Root Answers Back",
        "const": "THE_ROOT_ANSWERS_BACK_TILES",
        "ascii": [
            ",,,,,,,,,,,,,,,,,,,,,,",
            ",,,,,,,,,EE,,,,,,,,,,,",
            ",,,,,,,,^^^^,,,,,%,,,,",
            "PP,,,,,E,HHHH,,,,,,,,,",
            "PP,,,,,,,HHHH,,,,,,,,,",
            "PP,,,,,E,HHHH,,,,,,,,,",
            ",,,,,,,,^^^^,,,,,%,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,",
            ",,,,,,,,,EE,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,",
        ],
    },
    # Mission 24, "Seizure Order" (Act III). Plan doc §6: "sector command
    # moves to seize the program by force... Marrow has to get Halcyon out
    # ahead of loyalist troops." extract_unit, but the extraction target is
    # Halcyon Amaranth herself -- a civilian, not a deployable pilot (she's
    # never had a pilot record; a combat stat block would misrepresent who
    # she is). Uses CampaignMission.civilianSpawns/extractThreshold (same
    # mechanic Warden's own Mission 31 "The Last Convoy" introduced) instead
    # of extractUnitId -- a single civilian spawn, extractThreshold left
    # unset (defaults to 1, "everyone has to make it"), matching the
    # single-VIP stakes the pitch actually describes. First mission fighting
    # LOYALIST_HOSTILE_MECHS (data/units.ts) -- sector command's own
    # regulars, a human-military hostile that isn't Warden Company,
    # introduced here rather than reusing WARDEN_HOSTILE_MECHS (a different
    # faction in this fiction, even though mechanically identical shape).
    "mission_house_amaranth_24": {
        "name": "Seizure Order",
        "const": "SEIZURE_ORDER_TILES",
        "ascii": [
            "......................",
            ",,,,,,,,,EE,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,",
            "PP,,,,,,,%%,,,,,,,,,XX",
            "PP,,,,,,,%%,,,,,,,,,XX",
            "PP,,,,,,,%%,,,,,,,,,XX",
            "PP,,,,,,,%%,,,,,,,,,XX",
            ",,,,,,,,,,,,,,,,,,,,,,",
            ",,,,,,,,,EE,,,,,,,,,,,",
            "......................",
            "......................",
        ],
    },
    # Mission 25, "Going Dark" (Act III). Plan doc §6: "cut off from sector
    # command and from Warden's border entirely, the front holds alone for
    # the first time." survive_n_turns. Deploy dead center with spawn seams
    # on all four sides (north/south/east/west) rather than the usual one or
    # two flanks -- the map's own geometry IS the pitch: no relief column,
    # no safe direction to retreat toward, pressure from everywhere at once.
    "mission_house_amaranth_25": {
        "name": "Going Dark",
        "const": "GOING_DARK_TILES",
        "ascii": [
            "....................",
            ",,,,,,,,EE,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,,,,",
            ",,,,,^^,,,,,,^^,,,,,",
            "E,,,,,,,,PP,,,,,,,,E",
            ",,,,,,,,PP,,,,,,,,,,",
            "E,,,,,,,,PP,,,,,,,,E",
            ",,,,,%%,,,,,,%%,,,,,",
            ",,,,,,,,,,,,,,,,,,,,",
            ",,,,,,,,EE,,,,,,,,,,",
            "....................",
        ],
    },
    # Mission 26, "The Bramble" (Act III) -- the new signature threat's
    # debut. Plan doc §6: "a strain of the diverted Bloom breaks true
    # containment doctrine for the first time -- fast, aggressive, nothing
    # like the tame drift the program is built around." eliminate_all
    # (doesn't time out, house rule #5). Bloom-mat patches scattered across
    # the WHOLE field, not one clump -- "spreading uncontrolled" as literal
    # map geometry, not just flavor text, same discipline this file's own
    # earlier missions used (Mission 25's spawn-from-all-sides for "holds
    # alone"). Two spawn seams, opposite corners, each pushing bramble units
    # down through the bloom-mat patches toward deploy.
    "mission_house_amaranth_26": {
        "name": "The Bramble",
        "const": "THE_BRAMBLE_TILES",
        "ascii": [
            "......................",
            ",,,,~~~,,,,,,,,EE,,,,,",
            ",,,,~~~,,,,,,,,,,,,,,,",
            "PP,,,,~~~,,,,,,~~~,,,,",
            "PP,,,,,,,,,,,,,~~~,,,,",
            "PP,,,,,,,,,,,,,,,,,,,,",
            "PP,,,,,,,,,,,,,~~~,,,,",
            "PP,,,,~~~,,,,,,~~~,,,,",
            ",,,,~~~,,,,,,,,,,,,,,,",
            ",,,,~~~,,,,,,,,EE,,,,,",
            "......................",
        ],
    },
    # Mission 27, "Salvage the Season" (Act III). Plan doc §6: "pulling a
    # whole terrace's ward-crop technicians out ahead of a Bramble breach."
    # extract_unit with civilianSpawns (multi-unit, not a single VIP like
    # Mission 24) -- the plan doc doesn't flag this one "scripted partial
    # loss" the way Mission 31 later is, so extractThreshold is left unset
    # (everyone has to make it, same as the pitch's own "pulling a whole
    # terrace... out" reading -- a clean evacuation, not a scripted
    # casualty). Bramble reappears (its first mission, 26, established the
    # stat block) as the pursuing threat "ahead of" which the technicians
    # are being pulled.
    "mission_house_amaranth_27": {
        "name": "Salvage the Season",
        "const": "SALVAGE_THE_SEASON_TILES",
        "ascii": [
            "........................",
            ",,,,,,,,,,EE,,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,,,",
            "PP,,,,,,~~,,,,,,,,,,XXXX",
            "PP,,,,,,,,,,,,,,,,,,XXXX",
            "PP,,,,,,~~,,,,,,,,,,XXXX",
            "PP,,,,,,,,,,,,,,,,,,XXXX",
            ",,,,,,,,,,,,,,,,,,,,,,,,",
            ",,,,,,,,,,EE,,,,,,,,,,,,",
            "........................",
            "........................",
        ],
    },
    # Mission 28, "Marrow's Choice" (Act III). Warden's own mirrored
    # Mission 28 ("Marrow's Reckoning," campaignAmaranth.ts) closes their
    # side of this rivalry with hostile_mech_marrow -- House Amaranth's own
    # version is the other half: an escalated rematch against
    # hostile_mech_rourke + WARDEN_HOSTILE_MECHS, the exact antagonists
    # from Mission 20 ("Marrow's Line"), reused rather than reflavored,
    # because this IS that fight again, not a new one. Deliberately "a
    # bigger version of Mission 20's dueling ground" the same way Warden's
    # own Mission 28 map comment describes theirs -- same core shape
    # (rubble/ridge alcove clusters top and bottom flanking a central
    # corridor, deploy block on the west edge, no Bloom present on this map
    # on purpose, pure House-Amaranth-vs-Warden-Company), widened from
    # Mission 20's 24x12 to 26x12 and with two additional far-east corner
    # spawn seams (cols 24-25, rows 1 and 10) alongside the original
    # alcove-cluster seams -- reinforcements arriving from a second,
    # farther-out direction, matching the turn-5/turn-8 wave-split pattern
    # Warden's own Mission 28 build log describes ("two more troopers held
    # back... rather than everyone landing on turn 1").
    #
    # The one deliberate omission: no exit tiles anywhere on this map.
    # Mission 20 had a two-wide exit column on the east edge (a real
    # retreat option, matching that mission's extract_unit/withdrawal
    # objective). Removing it here is the map's own way of stating the
    # narrative beat plainly -- "the last moment either of them could still
    # have walked away clean" closes with this mission, replaced by a
    # committed eliminate_all.
    "mission_house_amaranth_28": {
        "name": "Marrow's Choice",
        "const": "MARROWS_CHOICE_TILES",
        "ascii": [
            "..........................",
            ",,,,,,,,%%,,^^,,,,,,,,,,EE",
            ",,,,,,,,%%,E,^^,,,,,,,,,,,",
            ",,,,,,,,%%,,^^,,,,,,,,,,,,",
            "PPP,,,,,,,,,,,,,,,,,,,,,,,",
            "PPP,,,,,,,,,,,,,E,,,,,,,,,",
            "PPP,,,,,,,,,,,,,,,,,,,,,,,",
            "PPP,,,,,,,,,,,,,E,,,,,,,,,",
            ",,,,,,,,%%,,^^,,,,,,,,,,,,",
            ",,,,,,,,%%,E,^^,,,,,,,,,,,",
            ",,,,,,,,%%,,^^,,,,,,,,,,EE",
            "..........................",
        ],
    },
    # Mission 29, "The Governor's Answer" (Act III). Plan doc §6: "sector
    # command's seizure force actually lands; House Amaranth loses a whole
    # outer terrace holding them off." hold_zone, tagged "scripted
    # strategic cost, mirrors Warden's Mission 29" -- resolved the same way
    # Warden's own Mission 29 ("The Outer Ring Falls," see that build log's
    # own note) resolved an identical tag: a real, winnable-and-losable
    # hold_zone, not a forced-loss mechanic. The narrative cost (the
    # terrace itself) lands as a dialogue beat regardless of the tactical
    # result, the same technique Mission 28's own closure event already
    # used here -- not a new mechanic this map needs to support.
    #
    # Reuses Mission 23's own proven central-hold-block-plus-ridge-flank
    # shape rather than risking a first-time geometry on a mission that's
    # explicitly about a defense actually being overrun -- same discipline
    # Warden's own Mission 33 build log states outright ("same proven shape
    # ... rather than risking a first-time... room on the campaign's last
    # hold_zone missions"). Widened 22x11 -> 24x11 and given two NEW spawn
    # seams on the map's own east edge (rows 3/5) alongside the original
    # west/north/south seams -- a real siege converging from four
    # directions rather than the usual two, matching "seizure force
    # actually lands" as literal geometry, not just flavor text (same
    # discipline this file's own Mission 25/26 comments already used).
    # First mission fielding LOYALIST_HOSTILE_MECHS as the hold_zone
    # threat rather than the extract_unit escort role they debuted in
    # (Mission 24).
    "mission_house_amaranth_29": {
        "name": "The Governor's Answer",
        "const": "THE_GOVERNORS_ANSWER_TILES",
        "ascii": [
            "........................",
            ",,,,,,,,,EE,,,,,,,,,,,,,",
            ",,,,,,,,^^^^,,,,,%,,,,,,",
            "PP,,,,,E,HHHH,,,,,,,,,EE",
            "PP,,,,,,,HHHH,,,,,,,,,,,",
            "PP,,,,,E,HHHH,,,,,,,,,EE",
            ",,,,,,,,^^^^,,,,,%,,,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,,,",
            ",,,,,,,,,EE,,,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,,,",
            "........................",
        ],
    },
    # Mission 30, "Two Fronts" (Act III). Plan doc §6: "fighting the
    # Bramble and loyalist regulars in the same battle for the first time
    # -- the two-front pressure the act has been building toward."
    # eliminate_all. Deploy sits dead center of the map on purpose -- the
    # squad caught literally between both fronts, not just narratively:
    # bloom_mat patches and Bramble spawn seams on the west edge, rubble
    # patches and LOYALIST_HOSTILE_MECHS spawn seams on the east edge, same
    # discipline this file's own Mission 25/26/29 comments already used
    # (pitch language as literal map geometry, not flavor text alone).
    # First mission with both a Bloom archetype and a human-military
    # archetype on the same map at the same time in this campaign.
    "mission_house_amaranth_30": {
        "name": "Two Fronts",
        "const": "TWO_FRONTS_TILES",
        "ascii": [
            "........................",
            ",,~~~,,,,,,,,,,,,,,%%%,,",
            "EE~~~,,,,,,,,,,,,,,%%%EE",
            ",,~~~,,,,,,,,,,,,,,%%%,,",
            ",,,,,,,,,,PPPP,,,,,,,,,,",
            ",,,,,,,,,,PPPP,,,,,,,,,,",
            ",,,,,,,,,,PPPP,,,,,,,,,,",
            ",,~~~,,,,,,,,,,,,,,%%%,,",
            "EE~~~,,,,,,,,,,,,,,%%%EE",
            ",,~~~,,,,,,,,,,,,,,%%%,,",
            "........................",
        ],
    },
    # Mission 31, "What the Program Costs" (Act III). Plan doc §6:
    # "evacuating House Amaranth's own civilian ward-crop workers ahead of
    # the Bramble breach -- not everyone gets out." extract_unit,
    # multi-civilian, tagged "scripted partial loss, mirrors Warden's
    # Mission 31." Unlike Mission 27 (extractThreshold discovered
    # empirically, no narrative partial-loss flag), this mission's
    # extractThreshold is set deliberately low from the start, informed by
    # that same Mission 27 finding (leaving extractThreshold unset is
    # nearly an instant-loss trap the moment any one civilian dies) --
    # applied proactively here rather than rediscovered.
    #
    # Same deploy-west/exit-east corridor shape Mission 27 proved out,
    # widened 24x11 -> 26x11, with bloom_mat scattered across MORE of the
    # field than Mission 27's single clean patch -- "the Bramble breach" is
    # a worse containment failure this time, not the same threat replayed.
    # One additional spawn seam sits INSIDE the evac corridor itself (row
    # 4, col 10) rather than only at the map's own north/south edges -- the
    # "staggered ambush" beat Warden's own Mission 31 build log names
    # directly, the Bramble already inside the corridor by the time the
    # convoy is moving, not purely chasing from outside it.
    "mission_house_amaranth_31": {
        "name": "What the Program Costs",
        "const": "WHAT_THE_PROGRAM_COSTS_TILES",
        "ascii": [
            "..........................",
            ",,,,,,,,,,,,EE,,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,,,,,",
            "PP,,,,,,~~,,,,,,,,,,,,XXXX",
            "PP,,,,,,,,E,,,,~~,,,,,XXXX",
            "PP,,,,,,~~,,,,,,,,,,,,XXXX",
            "PP,,,,,,,,,,,,,,,,,,,,XXXX",
            ",,,,,,,,,,,,,,,,,,,,,,,,,,",
            ",,,,,,,,,,,,EE,,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,,,,,",
            "..........................",
        ],
    },
    # Mission 32, "Hold the Root" (Act III). Plan doc §6: "defending the
    # original diversion relay -- the one the whole program was built
    # around -- through the Bramble's worst push." protect_asset, this
    # campaign's SECOND (Mission 22 was the first, a secondary relay under
    # loyalist audit). Deliberately a different feel from Mission 22's
    # walled-blockhouse/flooded-causeway geometry -- this relay sits in
    # open ground already half-overrun, bloom_mat scattered on every side
    # of the dock rather than behind sump/wall chokepoints, spawn seams on
    # three of four sides (deploy holds the west) for "worst push" as
    # literal geometry, same discipline this file's other Act III missions
    # already established. This is also the mission the plan doc's own
    # objectiveParams.assetMaxHp comment anticipated wanting "a different
    # ship-toughness feel than 22" -- the CampaignMission entry
    # (campaignHouseAmaranth.ts) overrides assetMaxHp up from the default
    # 300, since this relay is the one the whole program depends on, not a
    # secondary structure under inspection.
    "mission_house_amaranth_32": {
        "name": "Hold the Root",
        "const": "HOLD_THE_ROOT_TILES",
        "ascii": [
            "........................",
            ",,,,,,,,,,,EE,,,,,,,,,,,",
            ",,,,,,,,~~,,,,~~,,~~,,,,",
            ",,,,,,,,~~,,,,~~,,~~,,,,",
            ",,,,,,,,,,,,,,,,,,,,,,,,",
            "PP,,,,,,,,DDDD,,~~,,,,,,",
            "PP,,,,,,,,DDDD,,~~,,,,E,",
            "PP,,,,,,,,DDDD,,~~,,,,E,",
            "PP,,,,,,,,DDDD,,~~,,,,,,",
            ",,,,,,,,~~,,,,~~,,~~,,,,",
            ",,,,,,,,~~,,,,~~,,~~,,,,",
            ",,,,,,,,,,,EE,,,,,,,,,,,",
            "........................",
        ],
    },
    # Mission 33, "The Innermost Terrace" (Act III). Plan doc §6: "final
    # perimeter around House Amaranth's own seat of power; tone shifts from
    # managing a program to surviving one." hold_zone, tagged "multi-wave."
    # Warden's own mirrored mission ("The Innermost Ring") build log states
    # its own reasoning directly worth reusing here: "same proven shape...
    # rather than risking a first-time... room on the campaign's last
    # hold_zone missions -- the ring reads through wave count and staggered
    # approach corridors instead." Same call here -- this campaign's own
    # proven central-hold-block-plus-ridge-flank shape (Missions 19/23/29),
    # scaled up to this act's largest hold_zone map yet (26x13, vs. Mission
    # 29's 24x11), with FIVE distinct spawn clusters (north, south,
    # east-near, east-far, and a close north/south flank pair) rather than
    # the four Mission 29 used -- "the seat of power" reads as more
    # approach vectors converging, not just a bigger single wave.
    # Bramble-only threat (no loyalist mix this time) -- Mission 30 already
    # proved the two-threat convergence beat; Mission 35 is where the
    # Bramble and the Wellroot converge next, so the roster stays
    # Bramble-alone here rather than reaching for a third combination just
    # because the map has room for one.
    "mission_house_amaranth_33": {
        "name": "The Innermost Terrace",
        "const": "THE_INNERMOST_TERRACE_TILES",
        "ascii": [
            "..........................",
            ",,,,,,,,,,,,EE,,,,,,,,,,,,",
            ",,,,,,,,,,^^^^^^,,,,%%,,,,",
            ",,,,,,,,,,^^^^^^,,,,%%,,,,",
            ",,,,,,,,,,,,,,,,,E,,,,,,,,",
            "PP,,,,,,,,,HHHH,,,,,,,,,,,",
            "PP,,,,,,,,,HHHH,,,,,,,,,E,",
            "PP,,,,,,,,,HHHH,,,,,,,,,E,",
            "PP,,,,,,,,,HHHH,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,E,,,,,,,,",
            ",,,,,,,,,,^^^^^^,,,,%%,,,,",
            ",,,,,,,,,,^^EE^^,,,,%%,,,,",
            "..........................",
        ],
    },
    # Mission 34, "No Word From the Seal" (Act III). Plan doc §6:
    # "Halcyon's gone silent -- no confirmation House Amaranth still has
    # political cover at all." survive_n_turns, tagged "darkest hour,
    # mirrors Warden's Mission 34." This campaign's second survive_n_turns
    # mission (Mission 25, "Going Dark," was the first) -- same discipline,
    # deploy dead center with no relief column and no safe direction, taken
    # one step further: EIGHT spawn points (north, south, east, west, and
    # all four corners) instead of Mission 25's four, since this is a
    # worse version of the same idea, not the same crisis replayed. Per
    # this file's own Mission 25 comment, survive_n_turns has consistently
    # tuned smoothly/monotonically in this campaign, unlike the zero-
    # tolerance objective types -- expect this one to behave the same way.
    "mission_house_amaranth_34": {
        "name": "No Word From the Seal",
        "const": "NO_WORD_FROM_THE_SEAL_TILES",
        "ascii": [
            "........................",
            ",,,,,,,,,,,EE,,,,,,,,,,,",
            ",,E,,,,,,,,,,,,,,,,,,E,,",
            ",,,,,,,,,^^^^^^,,,,,,,,,",
            ",,,,,,,,,^^^^^^,,,,,,,,,",
            ",,,,%%,,,,PPPP,,,,%%,,,,",
            ",E,,%%,,,,PPPP,,,,%%,,E,",
            ",E,,%%,,,,PPPP,,,,%%,,E,",
            ",,,,%%,,,,PPPP,,,,%%,,,,",
            ",,,,,,,,,^^^^^^,,,,,,,,,",
            ",,E,,,,,,^^^^^^,,,,,,E,,",
            ",,,,,,,,,,,EE,,,,,,,,,,,",
            "........................",
        ],
    },
    # Mission 35, "The Root Turns" (Act III). Plan doc §6: "the Bramble and
    # the original Wellroot node move together for the first time -- the
    # two threats becoming one." hold_zone, tagged "final threat breaches
    # containment." The Wellroot is sessile (bloom_bramble's own kin-stat
    # comparison in data/bloom.ts and Mission 23's own comment both
    # establish this -- attackRange [1,3], acid, can never leave its own
    # tile) so "move together" reads as coordination, not literal
    # movement: the Wellroot anchors this fight from a fixed position (same
    # placement logic Mission 23 introduced -- two tiles east of the hold
    # block's own edge, close enough to threaten every hold tile with its
    # own acid) while Bramble waves converge around it, no longer an
    # uncontrolled swarm but visibly directed. Reuses this campaign's own
    # proven central-hold-block-plus-ridge-flank shape (Missions 19/23/29/
    # 33) one more time, at Mission 33's own scale (24x13).
    "mission_house_amaranth_35": {
        "name": "The Root Turns",
        "const": "THE_ROOT_TURNS_TILES",
        "ascii": [
            "........................",
            ",,,,,,,,,,,EE,,,,,,,,,,,",
            ",,,,,,,,,,,,,,,,,,~~,,,,",
            ",,,,,,,,,^^^^^^,,,~~,,,,",
            ",,,,,,,,,^^^^^^,,,,,,,,,",
            "PP,,,,,,,,HHHH,,,,,,,,,,",
            "PP,,,,,,,,HHHH,,,,,,,,E,",
            "PP,,,,,,,,HHHH,,,,,,,,E,",
            "PP,,,,,,,,HHHH,,,,,,,,,,",
            ",,,,,,,,,^^^^^^,,,~~,,,,",
            ",,,,,,,,,^^^^^^,,,~~,,,,",
            ",,,,,,,,,,,EE,,,,,,,,,,,",
            "........................",
        ],
    },
    # Mission 36, "The Stalling Season Ends" (Act III finale). Plan doc §6:
    # "hold until the containment doctrine actually closes the loop. The
    # Bloom, at House Amaranth's own scale, genuinely pacified." Same
    # objective type Warden's own finale uses (survive_n_turns -> Victory),
    # and the same discipline this campaign's own Missions 25/34 already
    # proved out for it -- deploy dead center, no relief column, no safe
    # direction, eight spawn points ringing every approach (map's own
    # STALLING_SEASON_ENDS_TILES comment covers the geometry) -- one more
    # notch bigger than Mission 34's own version, matching "the last, worst
    # push before the doctrine holds" rather than a smaller victory-lap
    # fight.
    "mission_house_amaranth_36": {
        "name": "The Stalling Season Ends",
        "const": "STALLING_SEASON_ENDS_TILES",
        "ascii": [
            "..........................",
            ",,,,,,,,,,,,EE,,,,,,,,,,,,",
            ",,E,,,,,,,,,,,,,,,,,,,,E,,",
            ",,,,,,,,,,^^^^^^,,,,,,,,,,",
            ",,,,,,,,,,^^^^^^,,,,,,,,,,",
            ",,,,%%,,,,,PPPP,,,,,%%,,,,",
            ",E,,%%,,,,,PPPP,,,,,%%,,E,",
            ",E,,%%,,,,,PPPP,,,,,%%,,E,",
            ",,,,%%,,,,,PPPP,,,,,%%,,,,",
            ",,,,,,,,,,^^^^^^,,,,,,,,,,",
            ",,E,,,,,,,^^^^^^,,,,,,,E,,",
            ",,,,,,,,,,,,EE,,,,,,,,,,,,",
            "..........................",
        ],
    },
}

# =====================================================================
# Output plumbing (same shape as maps.py/maps_amaranth.py, duplicated not
# imported)
# =====================================================================
lines = []


def out(s=""):
    lines.append(s)


def hdr(title):
    out("=" * 78)
    out(title)
    out("=" * 78)


def passable_ground(tile_id):
    for ch, (tid, _n, bip, cent, _fly, _d) in TILES.items():
        if tid == tile_id:
            return bip is not IMPASSABLE and cent is not IMPASSABLE
    raise KeyError(tile_id)


def to_tiles(grid):
    return [[TILES[ch][0] for ch in row] for row in grid]


# =====================================================================
# Validation -- identical logic to maps.py's/maps_amaranth.py's own
# validate(). Duplicated rather than imported; see the file header.
# =====================================================================
def validate(grid):
    problems = []
    widths = sorted({len(r) for r in grid})
    if len(widths) != 1:
        for y, row in enumerate(grid):
            if len(row) != len(grid[0]):
                problems.append(
                    f"row {y} is {len(row)} wide, but row 0 is {len(grid[0])} wide"
                )
    w = len(grid[0])
    h = len(grid)

    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch not in TILES:
                problems.append(f"({x},{y}) is '{ch}', which is not a tile")

    if problems:
        return False, {
            "w": w, "h": h, "tiles": "?", "P": "?", "E": "?", "H": "?",
            "X": "?", "D": "?", "reachable": "?", "walkable": "?",
            "orphan_walkable": "?",
        }, problems

    tiles = to_tiles(grid)
    counts = {}
    for row in tiles:
        for t in row:
            counts[t] = counts.get(t, 0) + 1

    n_deploy = counts.get("deploy", 0)
    n_spawn = counts.get("spawn", 0)
    if n_deploy < MIN_DEPLOY_PADS:
        problems.append(f"only {n_deploy} deploy pad(s); need at least {MIN_DEPLOY_PADS}")
    if n_spawn < MIN_SPAWN_SEAMS:
        problems.append(f"no Bloom spawn seam (need at least {MIN_SPAWN_SEAMS})")

    start = [(x, y) for y in range(h) for x in range(w) if tiles[y][x] == "deploy"]
    seen = set(start)
    q = deque(start)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                if passable_ground(tiles[ny][nx]):
                    seen.add((nx, ny))
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            t = tiles[y][x]
            if t in OBJECTIVE_TILES and (x, y) not in seen:
                problems.append(f"objective tile '{t}' at ({x},{y}) cannot be walked to")

    walkable_total = sum(1 for y in range(h) for x in range(w) if passable_ground(tiles[y][x]))
    stats = {
        "w": w, "h": h, "tiles": w * h,
        "P": n_deploy, "E": n_spawn,
        "H": counts.get("hold", 0), "X": counts.get("exit", 0), "D": counts.get("dock", 0),
        "reachable": len(seen), "walkable": walkable_total,
        "orphan_walkable": walkable_total - len(seen),
    }
    return not problems, stats, problems


# =====================================================================
# Run validation over whatever's in GRIDS so far
# =====================================================================
order = list(GRIDS.keys())
results = []
all_ok = True
for mid in order:
    d = GRIDS[mid]
    ok, stats, problems = validate(d["ascii"])
    all_ok = all_ok and ok
    results.append((mid, d, ok, stats, problems))

hdr(f"HOUSE AMARANTH -- MAP VALIDATION ({len(order)} of 36 missions authored so far)")
out(
    "id".ljust(30) + "name".ljust(20) + "w".rjust(2) + "h".rjust(4)
    + "tiles".rjust(7) + "P".rjust(4) + "E".rjust(4) + "H".rjust(4)
    + "X".rjust(4) + "D".rjust(4)
)
for mid, d, ok, s, _p in results:
    out(
        mid.ljust(30) + d["name"][:18].ljust(20)
        + str(s["w"]).rjust(2) + str(s["h"]).rjust(4) + str(s["tiles"]).rjust(7)
        + str(s["P"]).rjust(4) + str(s["E"]).rjust(4) + str(s["H"]).rjust(4)
        + str(s["X"]).rjust(4) + str(s["D"]).rjust(4)
    )

if not all_ok:
    out()
    out("PROBLEMS FOUND:")
    for mid, _d, ok, _s, problems in results:
        for p in problems:
            out(f"  {mid}: {p}")

out()
hdr(
    f"All {len(order)} authored House Amaranth map(s) valid. {36 - len(order)} still to author."
    if all_ok
    else "HOUSE AMARANTH MAPS INVALID -- see problems above. Nothing emitted."
)

# =====================================================================
# Emit
# =====================================================================
TS_HEADER = """// AUTO-GENERATED by design/maps_house_amaranth.py from its own ASCII
// source. Edit the ASCII in that script, re-run, and paste the matching
// const block(s) below into src/data/mapsHouseAmaranth.ts. Never hand-edit
// a *_TILES grid in that file directly -- same discipline maps.py and
// maps_amaranth.py already enforce for their own campaigns.

import type { TileType } from './types';
"""


def emit_ts():
    parts = [TS_HEADER]
    for mid in order:
        d = GRIDS[mid]
        rows = ["  [" + ", ".join(f'"{TILES[ch][0]}"' for ch in row) + "]," for row in d["ascii"]]
        parts.append(f"\nconst {d['const']}: TileType[][] = [\n" + "\n".join(rows) + "\n];\n")
    return "".join(parts)


if __name__ == "__main__":
    print("\n".join(lines))
    if all_ok and order:
        out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "maps_house_amaranth_generated.ts")
        with open(out_path, "w") as f:
            f.write(emit_ts())
        print(f"\nWrote {out_path}")
    if not all_ok:
        sys.exit(1)
