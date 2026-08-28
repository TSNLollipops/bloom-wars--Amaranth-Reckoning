// src/data/bloom.ts
// The seven pre-rolled Bloom creatures, transcribed from Data Pack §8.
// colorPalette values use the real Bioterror Bank families from Canon
// Pass v1 §E (the Data Pack shipped placeholder hex before that pass).
//
// Vision was only given explicitly in the Data Pack for Crawlmass,
// Undertow and Heartwood. The other four are first-pass design values
// inferred from their Perception category (GDD §5.1) — not source, cheap
// to retune, flagged the same way the project flags everything designed-
// but-not-simulated.
import type { BloomArchetype } from "./types";

export const BLOOM: Record<string, BloomArchetype> = {
  bloom_crawlmass: {
    id: "bloom_crawlmass",
    displayName: "Crawlmass",
    weaponType: "claws",
    movementType: "swarm",
    perception: "chemical",
    intelligence: "reflexive",
    endurance: 40,
    vitality: 60,
    moveRange: 4,
    attackRange: [1, 1],
    attackPower: 22,
    vision: 3,
    swarmSize: [8, 14],
    colorPalette: ["#B7B4AE", "#DCD9D2", "#7A2430"],
    spriteKey: "bloom_blob_small",
  },
  bloom_splitfang: {
    id: "bloom_splitfang",
    displayName: "Splitfang",
    weaponType: "claws",
    movementType: "swarm",
    perception: "compound",
    intelligence: "pack",
    endurance: 70,
    vitality: 70,
    moveRange: 5,
    attackRange: [1, 1],
    attackPower: 38,
    vision: 4, // not source-specified — first-pass value, see file header
    swarmSize: [3, 5],
    colorPalette: ["#3DDCFF", "#F2E63D", "#8A4A2A"],
    spriteKey: "bloom_pack_medium",
  },
  bloom_undertow: {
    id: "bloom_undertow",
    displayName: "Undertow",
    weaponType: "spines",
    movementType: "burrow",
    perception: "seismic",
    intelligence: "reflexive",
    endurance: 60,
    vitality: 50,
    moveRange: 4,
    attackRange: [1, 1],
    attackPower: 55,
    vision: 3,
    onHit: "fx_none",
    colorPalette: ["#1A1A24", "#3A2E4A", "#A97C4F"],
    spriteKey: "bloom_spike_burrow",
  },
  bloom_sporethrower: {
    id: "bloom_sporethrower",
    displayName: "Sporethrower",
    weaponType: "projectile",
    movementType: "limbless",
    perception: "compound",
    intelligence: "reflexive",
    endurance: 50,
    vitality: 80,
    moveRange: 2,
    attackRange: [2, 3],
    attackPower: 34,
    vision: 5, // not source-specified — first-pass value, see file header
    colorPalette: ["#8A867E", "#DCD9D2", "#C24D63"],
    spriteKey: "bloom_launcher_limbless",
  },
  bloom_gallcyst: {
    id: "bloom_gallcyst",
    displayName: "Gallcyst",
    weaponType: "acid",
    movementType: "sessile",
    perception: "chemical",
    intelligence: "reflexive",
    endurance: 140,
    vitality: 20,
    moveRange: 0,
    attackRange: [1, 3],
    attackPower: 30,
    vision: 3, // not source-specified — first-pass value, see file header
    onHit: "fx_acid_dot",
    colorPalette: ["#6B4358", "#4A2E3A", "#B4FF3D"],
    spriteKey: "bloom_turret_sessile",
  },
  bloom_sirenmaw: {
    id: "bloom_sirenmaw",
    displayName: "Sirenmaw",
    weaponType: "sonic",
    movementType: "flight_membrane",
    perception: "thermal",
    intelligence: "pack",
    endurance: 80,
    vitality: 70,
    moveRange: 6,
    attackRange: [1, 2],
    attackPower: 25,
    vision: 5, // not source-specified — first-pass value, see file header
    onHit: "fx_debuff_attack",
    colorPalette: ["#D9CBB0", "#A97C4F", "#3DDCFF"],
    spriteKey: "bloom_flyer_membrane",
  },
  // Independent campaign addition (Amaranth Act I, Mission 8 "The Choir
  // Sings" — claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md
  // §8: "a Sirenmaw-descended pack fighting in coordination, pack-tier
  // intelligence made audible"). Built the same documented way as the
  // Data Pack's own seven, per §3's own scope note that Act I needs no new
  // systems, only "two new Bloom encounters built from existing
  // categories." intelligence: "pack" is load-bearing, not flavour — it's
  // what makes engine/ai.ts's existing packAllies() coordination apply for
  // free (same SPLITFANG_PACK_RADIUS, no new engine code), which is the
  // whole mechanical point of this archetype. Tuned above Sirenmaw
  // (END 80->110, VIT 70->85, attackPower 25->32) since this is Act I's
  // mid-boss encounter, not a first-contact threat.
  bloom_choir: {
    id: "bloom_choir",
    displayName: "The Choir",
    weaponType: "sonic",
    movementType: "flight_membrane",
    perception: "thermal",
    intelligence: "pack",
    endurance: 110,
    vitality: 85,
    moveRange: 6,
    attackRange: [1, 2],
    attackPower: 32,
    vision: 6,
    swarmSize: [3, 4],
    onHit: "fx_choir_dissonance",
    colorPalette: ["#D9CBB0", "#6B4A8A", "#3DDCFF"],
    spriteKey: "bloom_flyer_choir",
  },
  bloom_heartwood: {
    id: "bloom_heartwood",
    displayName: "The Heartwood",
    weaponType: "concussive",
    movementType: "sessile",
    perception: "seismic",
    intelligence: "emergent",
    endurance: 400,
    vitality: 60,
    moveRange: 0,
    attackRange: [1, 4],
    attackPower: 60,
    vision: 8,
    onHit: "fx_knockback_1",
    colorPalette: ["#1A1A24", "#5C4A78", "#6B4358"],
    spriteKey: "bloom_mass_large",
  },
  // The Wellroot (Amaranth Act II boss, Mission 21 "Cut the Root") — real
  // stat block, 27 Aug 2026. Independent Campaign doc §8 always described
  // this as "a sessile hive-node rooted into House Amaranth's terraces;
  // huge Endurance, acid-heavy," but until this pass Mission 21 shipped it
  // as a straight, unmodified reuse of bloom_heartwood's own stat block —
  // flagged as a real gap in both the build log's "still open" list and
  // the Codex Design doc's own bestiary section (§6, "flagged, not
  // written" — a codex entry describing this as a unique escalated threat
  // would have been describing a creature that didn't actually exist).
  //
  // Deliberately Gallcyst's lineage (weaponType/onHit), not Heartwood's —
  // Gallcyst is the one other acid archetype already in the game, and
  // "acid-heavy" was never true of the old Heartwood-reuse (concussive,
  // knockback). This also means each of the three named Amaranth threats
  // now descends from a distinct base archetype instead of two of them
  // sharing one: the Choir from Sirenmaw (flight), the Wellroot from
  // Gallcyst (acid), the Unnamed from Heartwood (concussive) — see that
  // archetype's own comment below for its side of the same lineage split.
  //
  // Endurance/vitality placed on the campaign's own escalation curve
  // (Act I's Heartwood at 400/60, Act III's Unnamed at 560/70) rather than
  // picked freehand — validated via design/combat_sim.py's own "THE
  // WELLROOT" section and the matching case in engine/__tests__/
  // combat.test.ts's Collapse-rule suite: at a flat 70 dmg/hit, Heartwood
  // dies in 7 hits, Wellroot in 8, the Unnamed in 9 — strictly escalating,
  // same test attack across all three.
  //
  // attackPower / attackRange, 27 Aug 2026 — NOT the first numbers tried.
  // The original plan was attackPower 40 (down from Heartwood's 60) on the
  // theory that fx_acid_dot's stacking damage would make up the difference
  // — Gallcyst's own design already leans on its DoT the same way. That
  // theory turned out to be wrong in a way worth recording: at the time
  // this fight shipped, NONE of the BLOOM_ON_HIT_EFFECTS below (acid_dot,
  // debuff_attack, knockback) were actually wired into the engine —
  // `engine/turnManager.ts`, the file this same comment block said
  // DoT/debuff ticking "lives in," didn't exist yet. Every Bloom
  // archetype's onHit field was pure flavor data at that point, Heartwood's
  // own fx_knockback_1 included — this predates the Wellroot and isn't
  // specific to it. Running the actual mission (tools/_scratch_batch_sim.ts,
  // a throwaway wrapper around npm run sim's own per-turn loop, 3
  // independent batches of 40-60) at attackPower 40 came back 80% win —
  // nearly 2.5x the documented 35% "deliberately tight" baseline this
  // fight was tuned to — because the compensating DoT was never actually
  // landing. Restoring attackPower to 60 (matching Heartwood) while
  // keeping attackRange pulled in to [1,3] (down from Heartwood's [1,4])
  // reproduced 35/25/37% across the same three batches — close enough to
  // the original tuning to call it a match. Shipped at that config, with
  // the acid identity being weaponType/onHit/colorPalette/perception only,
  // not yet a mechanical difference from Heartwood's concussive kit — and
  // an explicit flag left here (and in the build log / Master Index) that
  // wiring the on-hit-effects engine later would need this number
  // re-validated, since attackPower 60 was calibrated assuming the DoT
  // stayed inert.
  //
  // That flag came due, 27 Aug 2026 — engine/turnManager.ts now exists and
  // fx_acid_dot actually fires (status-effect DoT + the tile-under-target
  // converting to bloom_mat, both real). Re-running the identical batch
  // validation at the still-shipped attackPower 60 came back 0/40 wins
  // (two independent N=40 batches, 0% and 0%) — not a milder version of
  // the predicted double-dip, a total collapse of this fight's win rate.
  // Isolating the two new effects separately: acid_dot's DoT alone (no
  // tile conversion) at attackPower 60 was already 0/40; at attackPower 40
  // it was 1/40 (3%). Cutting attackPower all the way to 20 (with the full
  // effect — DoT + tile conversion — restored) reproduced the original
  // target band: 30% and 35% across two independent N=40 batches. That
  // number is a validated CANDIDATE, not shipped here — attackPower is
  // still 60 below, unchanged, pending Maxime's call, since this is
  // exactly the kind of balance-number decision the project's own rules
  // reserve for him rather than an engine change quietly re-tuning around.
  // See the Master Index's 27 Aug batch-job entry for the full account.
  bloom_wellroot: {
    id: "bloom_wellroot",
    displayName: "The Wellroot",
    weaponType: "acid",
    movementType: "sessile",
    perception: "chemical",
    intelligence: "emergent",
    endurance: 480,
    vitality: 65,
    moveRange: 0,
    attackRange: [1, 3],
    attackPower: 60,
    vision: 6,
    onHit: "fx_acid_dot",
    colorPalette: ["#2A1F14", "#5C6B2E", "#9ACD32"],
    spriteKey: "bloom_wellroot_colossal",
  },
  // Independent campaign addition (Amaranth Act III, Mission 35 "The Last
  // Ring" — claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md
  // §8: "The Unnamed (Act 3 final threat) — the source, growing beneath
  // Meridian, emergent-tier, the campaign's true final boss, largest
  // Endurance wall in the campaign, built to make the Collapse rule do
  // maximum horror work." Same lineage as bloom_heartwood — same
  // weaponType/movementType/perception/intelligence, i.e. this campaign's
  // reading of "the Unnamed" is "what the Heartwood becomes at the actual
  // source" rather than an unrelated new creature, same relationship
  // bloom_choir already has to bloom_sirenmaw. Every stat pushed past
  // Heartwood's own: END 400->560 (+40%, the same escalation ratio Choir
  // used over Sirenmaw and Mission 32's own assetMaxHp used over the
  // protect_asset default) — "largest Endurance wall in the campaign" is
  // load-bearing spec, not flavor, so this has to strictly exceed 400.
  // VIT nudged 60->70, not dropped further: still low enough to stay
  // Severance-vulnerable (GDD §8's own "designed answer to the Gallcyst and
  // the Heartwood," extended here to the thing they were both leading up
  // to) and still reads as "grinds forever, then a sudden real collapse"
  // per the Collapse rule's own shape, just survivable enough that a
  // single lucky hit after a long siege doesn't feel cheap. attackPower
  // 60->75, attackRange [1,4]->[1,5], vision 8->9 — a bigger, farther-
  // reaching threat, same onHit (fx_knockback_1, proven at Heartwood's own
  // magnitude — no empirical basis yet for a bigger knockback value, so
  // not inventing one). See this mission's own comment in
  // campaignAmaranth.ts for the hold_zone-not-eliminate_all interpretation
  // call this stat block feeds into.
  //
  // Renamed from an earlier working name to "The Unnamed" on 26 Aug 2026
  // after a cross-project naming collision was caught (the old name is
  // already load-bearing, locked material on the Qiraki side) — deliberate,
  // in-fiction irony, not a placeholder: the thing at the heart of a
  // 36-mission war that command never gets around to properly designating.
  // Stats, lineage, and mission behavior are all unchanged; only the id,
  // displayName, and spriteKey moved.
  bloom_unnamed: {
    id: "bloom_unnamed",
    displayName: "The Unnamed",
    weaponType: "concussive",
    movementType: "sessile",
    perception: "seismic",
    intelligence: "emergent",
    endurance: 560,
    vitality: 70,
    moveRange: 0,
    attackRange: [1, 5],
    attackPower: 75,
    vision: 9,
    onHit: "fx_knockback_1",
    colorPalette: ["#0D0D14", "#7A3AA0", "#8B1E3F"],
    spriteKey: "bloom_unnamed_colossal",
  },
};

// Data Pack §8.1 — on-hit effects and special rules, as engine-consumable
// parameters. DoT/debuff ticking lives in engine/turnManager.ts.
export const BLOOM_ON_HIT_EFFECTS: Record<
  string,
  { kind: "acid_dot" | "debuff_attack" | "knockback" | "none"; magnitude: number; duration: number }
> = {
  fx_none: { kind: "none", magnitude: 0, duration: 0 },
  fx_acid_dot: { kind: "acid_dot", magnitude: 8, duration: 2 }, // 8 dmg/turn for 2 turns; converts target tile to bloom_mat
  fx_debuff_attack: { kind: "debuff_attack", magnitude: 0.2, duration: 2 }, // -20% ATK, target + friendlies within 2 tiles; does not stack, longest duration wins
  fx_knockback_1: { kind: "knockback", magnitude: 1, duration: 0 },
  // The Choir (bloom_choir, Amaranth Act I Mission 8) — same debuff_attack
  // kind as Sirenmaw's fx_debuff_attack, tuned up (-20%/2 turns ->
  // -30%/3 turns) since "pack-tier intelligence made audible" is meant to
  // read as several coordinated voices compounding the disorientation, not
  // a stronger single hit. Same does-not-stack/longest-duration-wins rule.
  fx_choir_dissonance: { kind: "debuff_attack", magnitude: 0.3, duration: 3 },
};

// Data Pack §8.1 special rules not captured by the stat block:
//   - Undertow: burrowed on spawn, not drawn/targetable. Surfaces when any
//     unit ends its move adjacent, or is revealed by burrow detection
//     (vibrissal chassis or Runemaster-primary mek, within vision).
//     An attack on the turn it surfaces deals x1.5.
//   - Splitfang: pack AI — any Splitfang within 3 tiles of another shares
//     its target.
//   - Sporethrower: cannot counterattack and cannot be counterattacked at
//     range — mirrors the player Reeps rule exactly.
//   - Gallcyst: move 0. Runemaster potency scales the ATTACKER's effects,
//     not the defender's — a Runemaster-equipped pilot hit by Gallcyst
//     acid takes the same duration.
//   - Sirenmaw: flying — ignores all terrain movement cost, cannot be
//     blocked by units or terrain.
//   - Heartwood: move 0, emergent AI. Every 2 turns from turn 3, spawns 2
//     Undertow burrowed at the map's spawn seams (see data/campaign.ts).
//     Prioritises the Munti above all other targets.
export const UNDERTOW_SURFACE_DAMAGE_MULT = 1.5;
export const SPLITFANG_PACK_RADIUS = 3;
