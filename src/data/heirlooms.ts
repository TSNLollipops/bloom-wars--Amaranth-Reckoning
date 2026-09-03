// Heirlooms — the aristocrat mechs, 2 Sep 2026.
// Maxime: "for the heirloom thing, yeah go for it. i'm taking advance from
// the plan." (Pulled forward from EA Launch Plan Week 2.)
//
// Source: claude/Bloom_Wars_Heirloom_Weapons_Plan_v1.md, transcribed
// against the actual current doc rather than from memory, per this
// project's own standing rule. Ten Heirlooms, two tracks:
//
//   Track A — Aberrations (2). Gjallar (the Requiem-system weapon) and
//     Simulacrum. No aristocrat
//     pilot, no recruitment, no house. Unlocked by their own story beats.
//     Maxime's own framing: Requiem is stolen, and "borsk isnt aristocrat";
//     the Seal is captured goods nobody in Warden Company can legitimately
//     hold, which is the whole point of its unreliable kit.
//   Track B — Proper Heirlooms (8). Each arrives WITH its own named
//     aristocrat pilot — "in canon heirloom are specialised mech with
//     specialised high class pilot. the are the aristorcrat mech." Every
//     one is a variation on "the rich kid slumming it with the military to
//     get familial honor."
//
// WHAT THIS FILE IS AND ISN'T. This is the data layer and the campaign
// rules layer's source of truth: identities, kits, rank text, cooldowns.
//
// VAULT PHASE 2, SLICE 1 (2 Sep 2026): five of these ~28 abilities are now
// real in combat — oath_iron_word, lastword_field_triage, farsight_signature,
// salt_root_salt, ledger_overextended (engine/mission.ts, engine/combat.ts,
// engine/ai.ts, scenes/Battle.ts). See claude/Bloom_Wars_Build_Log_Addendum_
// VaultPhase2Slice1_02Sep2026.md for what shipped, the interpretation calls
// made turning prose rank text into real numbers, and what's still open.
//
// VAULT PHASE 2, SLICE 2 (3 Sep 2026): three more, this time all three
// SIGNATURE abilities — ledger_entry, oath_oathkeeper, deadfall_strike
// (engine/mission.ts, engine/combat.ts, scenes/Battle.ts). Eight of ~28 real
// now. Everything else, Requiem included, is still exactly what the
// paragraph below always said: kit data with no engine behind it yet. See
// claude/Bloom_Wars_Build_Log_Addendum_VaultPhase2Slice2_03Sep2026.md for
// what shipped, the interpretation calls made turning prose rank text into
// real numbers (deadfall_strike's "reveal" clause especially — this
// codebase has no general "make a unit more visible" concept beyond
// breaking an existing ambush/screen cloak, flagged plainly rather than
// faked), and what's still open.
//
// VAULT PHASE 2, SLICE 3 (3 Sep 2026): Surtr's full 3-ability kit —
// cinder_line_signature, cinder_firebreak, cinder_draft (engine/mission.ts,
// scenes/Battle.ts). Eleven of ~28 real now. The first genuinely NEW hazard
// mechanic this pass has needed (every prior ability reused existing
// state — postures, HP floors, a doubled attack) — see engine/mission.ts's
// own SurtrLine interface comment for the full design and why it's a
// separate tracked hazard rather than a reuse of data/bloom.ts's bloom_mat.
// The line-targeting UI itself has no precedent to transcribe (Requiem, the
// one other "line" this codebase's own vocabulary names, is still unbuilt)
// — a straight 8-directional line from the wielder, one click sets both
// direction and length, is a judgment call flagged at its own definition
// (engine/mission.ts's CINDER_LINE_DIRECTIONS comment), not a transcription
// of spec.
//
// VAULT PHASE 2, SLICE 4 (3 Sep 2026): Zanretsu's full 3-ability kit —
// cutting_room_charge, cutting_room_momentum, cutting_room_sure_footing
// (engine/mission.ts, scenes/Battle.ts). Twelve of ~28 real now. (This
// header paragraph was missed when slice 4 shipped — added retroactively
// here rather than left silently absent, since every other slice gets one.)
//
// VAULT PHASE 2, SLICE 5 (3 Sep 2026): Migawari's remaining 2 of 3
// abilities — lastword_signature, lastword_last_rites (engine/mission.ts,
// engine/units.ts, engine/campaignState.ts, scenes/Battle.ts).
// lastword_field_triage was already live since slice 1 and is untouched.
// Fourteen of ~28 real now. lastword_signature is the first ability in the
// whole kit whose cost is permanent and cross-mission rather than a
// mission-time cooldown/resource: it writes a multiplicative max-HP
// penalty onto the wielder's own persistent PilotRecord (data/types.ts's
// permanentMaxHpMultiplier), following the exact Mission-records/
// Debrief-applies split this codebase already uses for permadeath
// (PermanentLossRecord/applyMissionLosses) — see engine/mission.ts's
// LastWordSignatureCostRecord and engine/campaignState.ts's
// applyLastWordSignatureCosts for the two halves. lastword_last_rites is
// the first ability that lets an already-downed unit act again
// mid-mission, on borrowed time that unconditionally expires at that same
// player turn's own end (engine/mission.ts's resolveLastRitesBorrowedTime)
// — a temporary, non-persistent effect, unlike its signature sibling.
//
// VAULT PHASE 2, SLICE 6 (3 Sep 2026): Simulacrum's full 3-ability kit —
// seal_borrowed_authority, seal_ledgerhall_static, seal_inherited_weight
// (engine/mission.ts, engine/units.ts, engine/turnManager.ts,
// engine/campaignState.ts, scenes/Battle.ts). Seventeen of ~28 real now.
// stolen_seal is this pass's first ABERRATION (no aristocrat pilot — see
// this file's own header above); who actually ends up holding it in combat
// is a pre-existing, out-of-scope gap (nothing anywhere calls
// engine/heirlooms.ts's acquireAberration for "stolen_seal" specifically —
// checked, not assumed), this slice only makes the kit work once someone
// does. seal_borrowed_authority is the first ability whose draw pool is
// campaign-persistent, cross-mission tracked state of a NEW kind
// (CampaignState.foughtOnHitEffectKinds, engine/campaignState.ts's
// recordFoughtOnHitEffectKinds) rather than reusing an existing pattern —
// see that field's own comment for the full design, including the honest
// finding that House Amaranth hostile mechs ARE reachable inside Warden
// Company's own campaign but currently carry no on-hit-effect data at all
// to contribute. seal_ledgerhall_static's jam state is real and tested but
// has a stated, honest limitation: engine/ai.ts's decideHostileAction has
// no per-ability dispatch to actually gate against (see
// BattleUnit.jammedAbilityId's own comment).
//
// VAULT PHASE 2, SLICE 7 (3 Sep 2026): requiem_severance (Gjallar) —
// engine/mission.ts's "Vault Phase 2, slice 7" section, engine/combat.ts's
// applyRequiemBloomDamage, scenes/Battle.ts's GJALLAR button/targeting.
// Eighteen of ~28 real now, and the LAST of this build-out's ten Heirlooms
// to get any ability wired at all — this is genuinely the final slice,
// unlike every prior one. The one ability this file's own header above
// calls "the worst candidate to build first... the one fixed point in the
// pool," built last on purpose. Deliberately NOT added to
// HEIRLOOM_ABILITIES_LIVE_IN_COMBAT below despite being fully wired and
// tested — see that constant's own inline comment for why (the set's real
// job is "is a rank-up purchase honest to offer," and Requiem's own rank5
// text is "Unchanged... does not rank up"). Two flagged, unresolved
// assumptions worth Maxime's own read, both spelled out in full in
// engine/mission.ts's own section header rather than repeated here: (1)
// GDD §8.2's "any own unit" origin is implemented as "the ordinary selected
// acting unit," not a literal two-unit-selection flow; (2) an active
// Oathkeeper floor or Tank shield still mitigates a Requiem hit, since
// mech-shape damage routes through the same applyMechDamage every other
// source in the game uses.
//
// THE ABILITIES ARE NOT ALL IMPLEMENTED IN COMBAT — nothing in
// engine/mission.ts reads most of an Heirloom's kit, and no Battle action
// bar offers most of them. That was deliberate at the time this file was
// first written, and is still the honest state for everything outside the
// slice above: ~30 distinct abilities, several of which need genuinely new
// engine mechanics (burning tiles that damage both sides, a unit that cannot
// drop below 1 HP with deferred damage, a move-through-and-strike line), are
// a separate build from the recruitment/progression economy this pass ships.
// Recording the kits as real, typed data now means that build is
// transcription rather than re-derivation, and means the Vault and the
// shortlist have something true to show.
//
// THE HARD RULE, carried from the plan doc §1d, unchanged and absolute:
//   "No Heirloom ability besides the Requiem system's own signature
//   line-attack may ignore the full-HP damage cap or hit friendlies
//   unconditionally. Both of those properties stay Requiem's alone."
// Surtr's burning tiles are the closest thing to an exception and are
// deliberately not one: the player CHOOSES where to place the hazard and
// gets two tools to manage it. Gjallar is the only thing in the game that
// doesn't ask your permission.
//
// NAMING, 2 Sep 2026. Two levels, and they are not the same word any more:
// "the Requiem system" is the MECHANIC (one company-wide charge, an 8-tile
// line, no friend-or-foe exception); "Gjallar" is the one weapon that runs
// it, Bosk's and then Rourke's. Every Heirloom below carries its own grand
// name in a real language, chosen for what it does — see HeirloomDef's own
// displayName comment for the rule and
// claude/Bloom_Wars_Heirloom_Naming_Update_2Sep2026.md for the decision.

import type { Path } from "./types";

export type HeirloomId =
  | "requiem"
  | "stolen_seal"
  | "widows_ledger"
  | "iron_oath"
  | "deadfall"
  | "last_word"
  | "salt_the_root"
  | "cutting_room"
  | "cinder_line"
  | "farsights_reckoning";

/** Aberrations have no aristocrat pilot and are never offered on a shortlist. */
export type HeirloomTrack = "aberration" | "proper";

export interface HeirloomAbility {
  id: string;
  displayName: string;
  /** The Heirloom's headline ability — one per Heirloom. */
  signature: boolean;
  /** What rank 1 does. Granted free the moment the Heirloom is acquired. */
  rank1: string;
  /** What rank 5 adds or changes. Ranks 2-4 scale between the two. */
  rank5: string;
  /**
   * Turns between uses. 0 means passive/always-on (or triggered by
   * something other than a cooldown), and those abilities are never
   * "ready" or "recharging" — they simply apply.
   */
  cooldownTurns: number;
}

export interface HeirloomPilot {
  displayName: string;
  house: string;
  /** Why this particular scion is out here — the hook, one line. */
  hook: string;
  /**
   * Which chassis family this aristocrat's own body/frame belongs to, in
   * data/units.ts's `arch_<path>_<suffix>` vocabulary. Absent means
   * "bipedal," the standard every generated recruit already gets
   * (campaignState.ts's generatePilot uses the same default and the same
   * three-value vocabulary).
   *
   * Only set where the ALREADY-WRITTEN frameFlavor text demands it, rather
   * than assigned freshly: Vann Rethwick is Hiopi and The Cutting Room's
   * own flavor line says the frame is "built low and long for a centauroid
   * gait." Minting him bipedal would have contradicted shipped text.
   */
  chassis?: HeirloomChassis;
}

/** data/units.ts archetype-id suffixes. Same three values campaignState.ts's own ArchetypeChassisSuffix carries; duplicated rather than shared because that one is deliberately file-local there. */
export type HeirloomChassis = "bipedal" | "centauroid" | "vibrissal";

export interface HeirloomDef {
  id: HeirloomId;
  /**
   * The artifact's own inherited name, in the old tongue it was named in.
   *
   * NAMING RULE, decided 2 Sep 2026 (Maxime: "give it an epic fantasy
   * sounding name. relate to its action, can be in another language. like
   * zaibatsu", after picking "gjallar" for Bosk's own weapon):
   *
   *   - The Heirloom itself carries a grand name in a real language,
   *     chosen to describe what the weapon DOES, not what it costs.
   *   - Its SIGNATURE ability carries that same name, because the
   *     signature IS the weapon firing.
   *   - Every other ability keeps a plain, in-English field name. That is
   *     the crew's own name for a move, not the house's name for an
   *     artifact, and keeping them plain is what stops the grand names
   *     from turning into noise.
   *
   * This also honours the standing convention that Heirloom-grade gear
   * "should sound like inherited privilege rather than earned gear" —
   * every other tier of kit in this game is deliberately punchy and
   * plain-spoken by comparison.
   */
  displayName: string;
  /**
   * The name this Heirloom went by in the design docs before the 2 Sep
   * naming pass — kept, not discarded, because several of them are good
   * and because a codex line reads better as "Skuld, the Widow's Ledger"
   * than as either name alone. Absent on Gjallar, which never had a second
   * name (its old title, "Requiem", was promoted to the SYSTEM name — see
   * claude/Bloom_Wars_Heirloom_Naming_Update_2Sep2026.md).
   */
  epithet?: string;
  track: HeirloomTrack;
  /** null on the two "Any"-path Heirlooms, which suit every path. */
  path: Path | null;
  frameFlavor: string;
  /** Present on every Track B Heirloom, absent on both aberrations. */
  pilot?: HeirloomPilot;
  abilities: HeirloomAbility[];
}

// ---- Ability rank economy ---------------------------------------------
//
// Plan doc §1c's own table, transcribed. Rank 1 is free at acquisition;
// ranks 2-5 are bought with PERSONAL points — the one place the two point
// economies meet on the same Heirloom, since recruitment itself spends
// COMPANY points. Maxing all three abilities is 6,300 personal points.
// Explicitly "not run through any sim" in the source doc; unchanged here.

export const HEIRLOOM_MAX_ABILITY_RANK = 5;

/** Personal-point cost to go FROM the index rank TO the next one. Index 0 is unused (rank 1 is free). */
export const HEIRLOOM_ABILITY_RANK_COST: Record<number, number> = {
  2: 250,
  3: 400,
  4: 600,
  5: 850,
};

/**
 * Vault Phase 2, slices 1 and 2 (2-3 Sep 2026) — which ability ids are
 * actually real in combat right now. Single source of truth for the one fact
 * `engine/mission.ts`'s canX()/verb() pairs and this file's own header
 * comment both already state in prose (oath_iron_word, lastword_field_triage,
 * farsight_signature, salt_root_salt, ledger_overextended from slice 1;
 * ledger_entry, oath_oathkeeper, deadfall_strike from slice 2 — see
 * `claude/Bloom_Wars_Build_Log_Addendum_VaultPhase2Slice1_02Sep2026.md` and
 * `claude/Bloom_Wars_Build_Log_Addendum_VaultPhase2Slice2_03Sep2026.md`),
 * exported once so a UI that needs the answer (the Vault's ability shelf)
 * doesn't hand-copy a second list that can drift out of sync with
 * engine/mission.ts as more abilities get wired.
 *
 * Deliberately NOT read by engine/mission.ts itself — every ability's own
 * canX() there already gates on `unit.abilities.includes(<id>)` and its own
 * cooldown, which is the real, load-bearing gate; this set exists purely so
 * a shop screen can decide whether "rank this up" is honest to offer, same
 * spirit as recruitHeirloom's own refusal-is-free rule: don't let a player
 * spend real personal points on a rank that changes nothing in play.
 */
export const HEIRLOOM_ABILITIES_LIVE_IN_COMBAT: ReadonlySet<string> = new Set([
  "oath_iron_word",
  "lastword_field_triage",
  "farsight_signature",
  "salt_root_salt",
  "ledger_overextended",
  "ledger_entry",
  "oath_oathkeeper",
  "deadfall_strike",
  "cinder_line_signature",
  "cinder_firebreak",
  "cinder_draft",
  // Vault Phase 2, slice 4 (3 Sep 2026) — Zanretsu's full 3-ability kit.
  "cutting_room_charge",
  "cutting_room_momentum",
  "cutting_room_sure_footing",
  // Vault Phase 2, slice 5 (3 Sep 2026) — Migawari's remaining 2 of 3
  // abilities (lastword_field_triage was already live, slice 1).
  "lastword_signature",
  "lastword_last_rites",
  // Vault Phase 2, slice 6 (3 Sep 2026) — Simulacrum's full 3-ability kit.
  "seal_borrowed_authority",
  "seal_ledgerhall_static",
  "seal_inherited_weight",
  // Vault Phase 2, slice 7 (3 Sep 2026) — requiem_severance (Gjallar) is now
  // genuinely wired end-to-end in combat (engine/mission.ts's
  // canRequiemSeverance/requiemSeverance, tested in
  // engine/__tests__/gjallarRequiem.test.ts) but is DELIBERATELY NOT added
  // here, unlike every other ability above. Read this set's own header
  // comment again: its real, load-bearing job isn't "is this ability
  // implemented," it's "is a RANK UP purchase honest to offer" — and for
  // Requiem the answer is no, on the ability's own record: "rank5:
  // 'Unchanged — Requiem does not rank up. It is the one fixed point in the
  // pool.'" Nothing in requiemSeverance() ever reads heirloomRank/
  // heirloomAbilityRanks["requiem_severance"] — adding this id here would
  // let the Vault (scenes/Hub.ts) show a real "[ rank up ]" button that
  // takes a wielder's personal points and changes literally nothing in
  // play, exactly the failure mode this set's own comment says it exists
  // to prevent. FLAGGED for Maxime: the alternative is special-casing
  // Hub.ts's own rendering to suppress a buy button for this one ability
  // while still marking it "live," which is more invasive for the same
  // observable outcome (no dishonest purchase) — this pass took the
  // smaller, single-line fix over touching Hub.ts's UI logic, at the cost
  // of the Vault showing Requiem's status text as "(not implemented in
  // combat yet)" even though it now is. That status LABEL being
  // technically stale is judged the lesser problem versus letting a real
  // purchase go through for nothing — worth Maxime's own call either way.
]);

/**
 * Personal points an aristocrat is minted WITH, decided 2 Sep 2026 —
 * "the house sends them with money," the option taken over cutting the
 * rank-cost ladder itself.
 *
 * Not an arbitrary starting balance: it's exactly HEIRLOOM_ABILITY_RANK_COST
 * ranks 2 and 3 on ONE ability (250 + 400), chosen so the number has a
 * legible, teachable meaning rather than a tuned-to-feel figure — the house
 * paid for the weapon to be worth carrying at all, and everything past rank
 * 3 is earned in the field like any other pilot's gear.
 *
 * The arithmetic that makes this necessary rather than merely generous:
 * mission earnings run KILL_BONUS(5)/SURVIVAL_BONUS(5)/OBJECTIVE_BONUS(10)
 * per pilot per mission (campaignEconomy.ts) — roughly 25-40 points on a
 * good mission. Heirlooms unlock at Act II at the earliest
 * (heirloomsUnlocked), so an aristocrat recruited the moment that opens has
 * at most ~24 missions left: a lifetime ceiling of maybe 600-950 personal
 * points EARNED, before this pool existed. The third recruit of the
 * campaign's 3-pick budget — by design the latest and priciest pick — could
 * join with six missions left and never afford a single rank on anything.
 * This pool is what makes that pick arrive useful instead of arriving
 * broke.
 *
 * A dead aristocrat's personalPoints (this pool included) are zeroed by
 * applyPermadeathCheck like any other pilot's — consistent with, and
 * sharpening, the returned-home rule: the house's investment goes home
 * empty-handed along with the weapon.
 *
 * PLACEHOLDER in the same sense HEIRLOOM_RECRUIT_COSTS is: argued, not
 * simulated. One named constant, one line to retune.
 */
export const ARISTOCRAT_SIGNING_POOL = 650;

// ---- Recruitment economy ----------------------------------------------

/** The campaign-long budget: "the mc only get to pick up to 3 heirloom pilot during campaign". */
export const HEIRLOOM_RECRUIT_BUDGET = 3;

/** "and field one at a time no matter what" — across ALL sources, aberrations included. */
export const HEIRLOOM_FIELD_LIMIT = 1;

/**
 * Company-point cost of each successive recruitment, escalating.
 *
 * PLACEHOLDER, and flagged as one — the source doc's §6 open question 2
 * states this outright: "Locked: the currency (company points), the budget
 * (3 picks), the mechanism (shortlist). Not locked: what a pick actually
 * costs, or whether all three cost the same or escalate."
 *
 * Escalating rather than flat, and the reasoning is worth stating so it
 * can be argued with: a flat price makes the second and third picks
 * strictly easier decisions than the first (the company's income grows
 * over a campaign), which quietly undoes the scarcity the 3-of-8 budget
 * exists to create. Rising costs keep the last pick a real commitment.
 * Anchored against the company-pool prices already shipped
 * (DISCRETIONARY_RECRUIT_COST is 80, bay builds run ~130) so an aristocrat
 * reads as several times the price of an ordinary recruit without leaving
 * the same universe of numbers. Not sim-validated — combat_sim.py covers
 * Bloom stats and maps, not company-pool pricing.
 */
export const HEIRLOOM_RECRUIT_COSTS: readonly number[] = [250, 400, 600];

/**
 * How many candidates a shortlist offers at once.
 *
 * Not specified anywhere in the source doc — inferred from the mechanism
 * it DOES specify ("shortlist with specialty, you are given a codex info
 * with anme and weapons and you pick one"). Three is the smallest number
 * that makes a pick feel like a choice between real alternatives rather
 * than an accept/decline, and it leaves enough of the eight unseen that a
 * later shortlist still has something new to show.
 */
export const HEIRLOOM_SHORTLIST_SIZE = 3;

/**
 * Which path an "Any"-path Heirloom's aristocrat actually deploys as.
 *
 * `path: null` means the Heirloom SUITS every path, not that its pilot has
 * none — a deployed unit needs a real archetype. The design-true answer is
 * to let the player pick at the moment of recruitment, and recruitHeirloom
 * accepts exactly that (`opts.path`); this table is only the fallback for
 * a caller that doesn't ask, which today means every caller, since no
 * shortlist UI exists yet.
 *
 * PLACEHOLDER, and both picks are argued rather than guessed so they can
 * be argued back: Delenda is an up-close anti-hive specialist whose
 * signature is a damage multiplier on its own attacks, so meeps; Surtr is
 * "a single oversized ordnance rack" laying hazard down the field, which
 * is artillery, so reeps. Neither is locked — this is one line each to
 * change, and the shortlist UI should supersede the table entirely.
 */
export const HEIRLOOM_DEFAULT_PATH: Partial<Record<HeirloomId, Path>> = {
  salt_the_root: "meeps",
  cinder_line: "reeps",
};

export const HEIRLOOMS: Record<HeirloomId, HeirloomDef> = {
  // ---- Track A: aberrations ------------------------------------------
  requiem: {
    id: "requiem",
    // The ID stays `requiem` on purpose: "Requiem" is now the SYSTEM
    // name (the mechanic — one company-wide charge, an 8-tile line, no
    // friend-or-foe exception), while GJALLAR is the name of the one
    // weapon Bosk carries and Rourke inherits. Old Norse, "the
    // resounding" — Heimdall's horn, blown once, heard by everyone.
    // Keeps the bell/toll resonance the old "Requiem" title carried at
    // the exact beat the weapon changes hands.
    displayName: "Gjallar",
    track: "aberration",
    path: null,
    frameFlavor: "The Anvil-line frame, after Bosk's own callsign.",
    // No epithet: this one never had a second name. Its old title,
    // "Requiem", became the system's name rather than staying the
    // weapon's, which is the whole reason Gjallar had to be found.
    // Deliberately ONE ability, not three. The plan doc leaves the
    // retrofit an open question (§6.3) and leans "stays as-is, since the
    // flagship should look mechanically different from the rest of the
    // shelf." Keeping it as-is is also the conservative choice: Requiem's
    // NUMBERS are locked, reviewed design (Data Pack §11.5), and this pass
    // has no mandate to touch them.
    //
    // CORRECTION, 2 Sep 2026 (Vault Phase 2 slice 1 pass): this entry used
    // to claim Requiem was "shipped, tested and sim-validated content" —
    // checked against the actual code rather than taken on memory or an
    // older plan, per this project's own standing rule, and that line was
    // wrong. abil_severance exists as a spec (data/abilities.ts's SEVERANCE
    // constant) and gets one comment-reference in engine/combat.ts ("the
    // second thing in the game that can delete a full-HP unit... Severance
    // is meant to be the only one") — it has never been wired into
    // engine/mission.ts, engine/ai.ts, or a Battle action bar. Requiem has
    // never fired in a mission. What's actually locked is the Data Pack
    // §11.5 DESIGN — the numbers, the friend-or-foe exception, the collapse
    // check — not an implementation of it. Left unbuilt on purpose this
    // pass regardless (see this file's own header): it's the one ability
    // allowed to break every other safety rule here, which makes it the
    // worst candidate to build first rather than the safest.
    //
    // UPDATE, 3 Sep 2026 (Vault Phase 2 slice 7): built. The paragraph
    // above is kept rather than deleted — it was true when written, and
    // this project's convention is to date-stamp corrections in place, not
    // quietly erase the record of what was still missing. As of this pass,
    // requiem_severance IS wired into engine/mission.ts (canRequiemSeverance
    // / getRequiemDirectionTargets / previewRequiemSeverance /
    // requiemSeverance, plus a shared requiemCharge meter accrued off of
    // resolveAttack) and into the GJALLAR action-bar button, targeting
    // flow, and hover-tip in scenes/Battle.ts, with a dedicated
    // engine/combat.ts choke point (applyRequiemBloomDamage) so the
    // Bloom-side Endurance bypass doesn't leak into the ordinary
    // applyBloomDamage path everything else uses. Covered by 20 new tests
    // in engine/__tests__/gjallarRequiem.test.ts (geometry, cap-bypass,
    // friend-or-foe, charge gating, Bloom collapse-check, and interaction
    // with Oathkeeper/shields/on-hit effects). Two points were genuinely
    // ambiguous in the source docs and were resolved by conservative
    // reading rather than guessed silently — flagged for Maxime to
    // confirm or correct, not treated as settled:
    //   1. "Any own unit" as the line's origin (GDD phrasing) was read as
    //      the acting/selected unit, since nothing else in this codebase
    //      has a two-unit-selection UI flow to reuse, and inventing one
    //      would be new scope this pass had no mandate for.
    //   2. Oathkeeper's HP floor and shield absorption were left ACTIVE
    //      against a Requiem hit — "ignores the full-HP damage cap" and
    //      "hits friend and foe alike" were read as specific, named
    //      exceptions, not a blanket "ignores all mitigation" grant.
    // Also worth naming plainly rather than burying: under the current
    // locked SEVERANCE.damage value (80), the full-HP-cap bypass is
    // mechanically inert against mech-shape targets, since 80 is already
    // under FULL_HP_DAMAGE_CAP (90) — the cap bypass only does real work
    // against Bloom targets, where it skips the Endurance layer entirely
    // and checks Vitality straight. Tested and documented, not silently
    // glossed over. requiem_severance is deliberately NOT added to
    // HEIRLOOM_ABILITIES_LIVE_IN_COMBAT below despite being fully wired —
    // see that set's own comment for why.
    abilities: [
      {
        id: "requiem_severance",
        // ID unchanged deliberately. Renaming `requiem_severance` (and
        // data/abilities.ts's shipped `abil_severance`) is real, separate
        // work flagged in the naming-update doc; this pass only moves the
        // player-facing string.
        displayName: "Gjallar",
        signature: true,
        rank1: "A line attack that ignores the full-HP damage cap and hits friend and foe alike, no exception. Collapse-checks Bloom directly.",
        rank5: "Unchanged — Requiem does not rank up. It is the one fixed point in the pool.",
        cooldownTurns: 0, // the existing shared 0-100 charge meter, not a turn cooldown
      },
    ],
  },
  stolen_seal: {
    id: "stolen_seal",
    // Latin, "a likeness, a phantom." A jury-rigged spoof wearing a real
    // key's face — and a kit whose signature is literally copying whatever
    // it just fought.
    displayName: "Simulacrum",
    epithet: "The Stolen Seal",
    track: "aberration",
    path: null,
    frameFlavor: "An Amaranth command-frame, unmistakably not Warden Company make, running a jury-rigged access spoof instead of a real key.",
    abilities: [
      {
        id: "seal_borrowed_authority",
        displayName: "Simulacrum",
        signature: true,
        rank1: "Next attack copies a random on-hit effect drawn from any Bloom archetype or House Amaranth unit fought this campaign.",
        rank5: "Reroll the draw once per use before committing.",
        cooldownTurns: 5,
      },
      {
        id: "seal_ledgerhall_static",
        displayName: "Ledgerhall Static",
        signature: false,
        rank1: "Jams one random enemy ability for 2 turns.",
        rank5: "Jams the target's strongest available ability specifically — the spoof has finally learned enough to be selective.",
        cooldownTurns: 4,
      },
      {
        id: "seal_inherited_weight",
        displayName: "Inherited Weight",
        signature: false,
        rank1: "At mission start, roll a random DEF bonus (0 to +15) for the whole mission.",
        rank5: "The roll's floor narrows to +8 to +15 — still random, never bad.",
        cooldownTurns: 0,
      },
    ],
  },

  // ---- Track B: proper Heirlooms, aristocrat-piloted -------------------
  widows_ledger: {
    id: "widows_ledger",
    // Old Norse, "debt — that which is owed"; also the Norn of what must
    // come. Ledger Entry is a tally that grows every kill until it is
    // collected in one stroke.
    displayName: "Skuld",
    epithet: "Widow's Ledger",
    track: "proper",
    path: "meeps",
    frameFlavor: "Stripped down, over-clocked, a frame built to spend itself fast.",
    pilot: {
      displayName: "Corin Ashby-Voss",
      house: "House Voss",
      hook: "Measures worth in numbers, their own and everyone else's. House Voss keeps score on everything, and Corin's honor at home is a running tally — Warden Company is just the first place that tally has ever been life-or-death.",
    },
    abilities: [
      {
        id: "ledger_entry",
        displayName: "Skuld",
        signature: true,
        rank1: "Each kill this mission stacks +8% damage for the rest of the mission.",
        rank5: "Stack cap raised, and the bonus also applies to move range past 3 stacks.",
        cooldownTurns: 0,
      },
      {
        id: "ledger_closing_argument",
        displayName: "Closing Argument",
        signature: false,
        rank1: "A guaranteed finishing strike against any target at or below 25% HP, any range within move.",
        rank5: "Threshold raised to 35%.",
        cooldownTurns: 3,
      },
      {
        id: "ledger_overextended",
        displayName: "Overextended",
        signature: false,
        rank1: "Trade defense for one turn: 0 DEF, +40% ATK.",
        rank5: "Duration extended to 2 turns.",
        cooldownTurns: 2,
      },
    ],
  },
  iron_oath: {
    id: "iron_oath",
    // Latin, "one who stands surety for another." Not a generic word for
    // a shield — the exact legal sense of taking on someone else's
    // liability, which is Oathkeeper (damage deferred, not avoided) and
    // Debt Paid (an ally's hit redirected onto you) stated in one word.
    displayName: "Vindex",
    epithet: "The Iron Oath",
    track: "proper",
    path: "tank",
    frameFlavor: "The widest, slowest silhouette in the game — deliberately not fast, on purpose.",
    pilot: {
      displayName: "Dame Perrine Castellan",
      house: "House Castellan",
      hook: "Raised from childhood to shield her house's name. Honor-guard-as-upbringing: slumming it reads less like escape than like the family doctrine finally getting a real target to stand in front of.",
    },
    abilities: [
      {
        id: "oath_oathkeeper",
        displayName: "Vindex",
        signature: true,
        rank1: "Cannot be reduced below 1 HP for 2 turns. All spared damage lands the instant it ends.",
        rank5: "Duration 3 turns, and the deferred damage is halved on landing instead of full.",
        cooldownTurns: 5,
      },
      {
        id: "oath_iron_word",
        displayName: "Iron Word",
        signature: false,
        rank1: "Taunt in radius 2 — every hostile that can reach the wielder must target it this turn.",
        rank5: "Radius 3.",
        cooldownTurns: 3,
      },
      {
        id: "oath_debt_paid",
        displayName: "Debt Paid",
        signature: false,
        rank1: "Redirect the next instance of ally damage within radius 1 onto the wielder instead.",
        rank5: "Radius 2.",
        cooldownTurns: 4,
      },
    ],
  },
  deadfall: {
    id: "deadfall",
    // Japanese 一撃, "a single blow." One unavoidable, uncounterable
    // strike — and then every enemy on the map knows exactly where you are.
    displayName: "Ichigeki",
    epithet: "Deadfall",
    track: "proper",
    path: "reeps",
    frameFlavor: "A long, low profile, built to never be found until it's already fired.",
    pilot: {
      displayName: "Ilse Dunmoor",
      house: "House Dunmoor",
      hook: "Quiet by philosophy, not just by role. 'Unseen until the moment' is how House Dunmoor teaches its own, and the kit's own reveal — delayed at rank 5, never removed — is a plan that works exactly until it doesn't, on a schedule nobody controls.",
    },
    abilities: [
      {
        id: "deadfall_strike",
        displayName: "Ichigeki",
        signature: true,
        rank1: "An unavoidable, uncounterable strike at x2 damage, any range. Reveals the wielder's position to every enemy for the rest of the turn.",
        rank5: "The reveal is delayed one full turn instead of immediate — one free shot at true stealth per use.",
        cooldownTurns: 5,
      },
      {
        id: "deadfall_vanish",
        displayName: "Vanish",
        signature: false,
        rank1: "Removed from enemy targeting entirely for 1 turn. Cannot act while active.",
        rank5: "Duration 2 turns.",
        cooldownTurns: 4,
      },
      {
        id: "deadfall_marked_round",
        displayName: "Marked Round",
        signature: false,
        rank1: "Next hit on this target grants all allies +15% damage against it for 2 turns.",
        rank5: "+25%, duration 3 turns.",
        cooldownTurns: 2,
      },
    ],
  },
  last_word: {
    id: "last_word",
    // Japanese 身代わり, "one who takes another's place" — the word for a
    // substitute who absorbs a fate meant for someone else. The
    // substitution here is literal: the wielder's own max HP, permanently,
    // for an ally's life.
    displayName: "Migawari",
    epithet: "The Last Word",
    track: "proper",
    path: "munti",
    frameFlavor: "Visibly overbuilt on the repair bay, underbuilt everywhere else.",
    pilot: {
      displayName: "Osric Ferrow",
      house: "House Ferrow",
      hook: "Self-sacrifice as performance. Grew up on House Ferrow's own branding — a house that markets itself on giving everything for others — and believed it a little too literally, a little too young.",
    },
    abilities: [
      {
        id: "lastword_signature",
        displayName: "Migawari",
        signature: true,
        rank1: "Fully restores one downed ally mid-mission, no spare part spent. The wielder's own max HP is permanently reduced 10% for the rest of the campaign, each use.",
        rank5: "The permanent cost drops to 5% per use — never removed entirely, only softened.",
        cooldownTurns: 6,
      },
      {
        id: "lastword_field_triage",
        displayName: "Field Triage",
        signature: false,
        rank1: "Repair two allies in radius 2 this turn instead of one.",
        rank5: "Radius 3.",
        cooldownTurns: 3,
      },
      {
        id: "lastword_last_rites",
        displayName: "Last Rites",
        signature: false,
        rank1: "A downed ally (not yet lost to permadeath) can act one final time this turn before resolving.",
        rank5: "The ally also gets a full heal for that one action, then goes down again as normal.",
        cooldownTurns: 5,
      },
    ],
  },
  salt_the_root: {
    id: "salt_the_root",
    // Latin, from Carthago delenda est — "that which must be destroyed."
    // Carries the salted-earth association the old title was reaching for,
    // in the language that association actually comes from.
    displayName: "Delenda",
    epithet: "Salt the Root",
    track: "proper",
    path: null,
    frameFlavor: "Matted, scarred, built from Bloom-derived salvage rather than clean Foundry parts.",
    pilot: {
      displayName: "Thessaly Amaranth",
      house: "House Amaranth",
      // SPOILER FIX, 2 Sep 2026 — Maxime, screenshot: this line named
      // Mission 28 by number and said flat-out "is built to test that
      // claim," which is designer's-note phrasing that leaked into
      // player-facing copy, not in-universe voice, and it's shown on the
      // Vault shortlist from Act II onward — well before a player is
      // anywhere near Act III. Every sibling hook in this file (Ichigeki,
      // Vindex, Igawari) foreshadows without citing a mission number or
      // breaking voice; matched that here instead of just trimming the
      // reference.
      hook: "Halcyon's cousin and the house black sheep — left home to study the Bloom, an unglamorous specialty by Amaranth standards, and insists (often, maybe too often) that her house doesn't matter to her anymore. She's never actually had to find out if that's true.",
    },
    abilities: [
      {
        id: "salt_root_salt",
        displayName: "Delenda",
        signature: true,
        rank1: "x1.6 damage against sessile/hive-type Bloom (Gallcyst-family, the Wellroot, the Unnamed). x0.7 against everything else.",
        rank5: "The penalty against non-sessile targets shrinks to x0.85.",
        cooldownTurns: 0,
      },
      {
        id: "salt_scorched_ground",
        displayName: "Scorched Ground",
        signature: false,
        rank1: "Bloom mat under the target stops regrowing for 3 turns.",
        rank5: "Also stops spreading in radius 1 of the target.",
        cooldownTurns: 4,
      },
      {
        id: "salt_vermins_eye",
        displayName: "Vermin's Eye",
        signature: false,
        rank1: "Reveals every Bloom unit on the map, burrowed or not, for 1 turn.",
        rank5: "Duration 2 turns.",
        cooldownTurns: 5,
      },
    ],
  },
  cutting_room: {
    id: "cutting_room",
    // Japanese 斬裂, "cut and rend." A line of cuts through everything in
    // the way, which cannot be called off once begun.
    displayName: "Zanretsu",
    epithet: "The Cutting Room",
    track: "proper",
    path: "meeps",
    frameFlavor: "Built low and long for a centauroid gait — visibly wrong on a human pilot's frame. This Heirloom doesn't transfer well outside Iyari's own chassis family.",
    pilot: {
      displayName: "Vann Rethwick",
      house: "House Rethwick",
      chassis: "centauroid",
      hook: "Old Hiopi nobility, and the one aristocrat here who isn't human. Resents slumming it with grunts more openly than any of the other seven — which paradoxically makes him the truest believer in the whole system: he still thinks the class gap should matter, and is visibly annoyed that Warden Company mostly doesn't.",
    },
    abilities: [
      {
        id: "cutting_room_charge",
        displayName: "Zanretsu",
        signature: true,
        rank1: "Move through and strike every enemy in a straight line, ignoring terrain cost, ending adjacent to the last one hit. Full commitment — cannot be called off partway through. Damage falls off against the 3rd+ target hit.",
        rank5: "Damage no longer drops off against the 3rd+ target in the line.",
        cooldownTurns: 4,
      },
      {
        id: "cutting_room_momentum",
        displayName: "Momentum",
        signature: false,
        rank1: "+2 move on the turn immediately following any Zanretsu use.",
        rank5: "Also grants +10% ATK that same turn.",
        cooldownTurns: 0,
      },
      {
        id: "cutting_room_sure_footing",
        displayName: "Sure Footing",
        signature: false,
        rank1: "Immune to knockback and forced movement for 1 turn.",
        rank5: "Duration 2 turns.",
        cooldownTurns: 2,
      },
    ],
  },
  cinder_line: {
    id: "cinder_line",
    // Old Norse — the fire-giant who burns the world at the end of it.
    // Halden's own hook is "better it burns than passes to whoever's
    // circling," which is that myth's logic applied to a family estate.
    displayName: "Surtr",
    epithet: "Cinder Line",
    track: "proper",
    path: null,
    frameFlavor: "Built around a single oversized ordnance rack, everything else stripped to the minimum to carry it.",
    pilot: {
      displayName: "Halden Kestrel",
      house: "House Kestrel",
      hook: "Willing to burn what his house can't hold onto. Kestrel's grip on its holdings is visibly slipping, and Halden decided that if the family can't keep something, better it burns than passes to whoever's circling. He isn't here for honor exactly — scorched earth is a philosophy he's already applied to his own family's future once.",
    },
    abilities: [
      {
        id: "cinder_line_signature",
        displayName: "Surtr",
        signature: true,
        // The hard rule (§1d) applies: this is an opt-in hazard the player
        // PLACES, with two tools below to manage it — not a guaranteed
        // line through the squad the way Gjallar's beam is.
        rank1: "Sets a chosen line of up to 5 tiles burning for 3 turns — 15 damage/turn to anything standing on it, hostile or friendly, no exception on the tiles themselves.",
        rank5: "Duration 4 turns, damage unchanged.",
        cooldownTurns: 5,
      },
      {
        id: "cinder_firebreak",
        displayName: "Firebreak",
        signature: false,
        rank1: "Instantly extinguish one of the wielder's own active Surtr lines.",
        rank5: "Extinguishing also deals the line's remaining total damage to every hostile currently standing on it, all at once.",
        cooldownTurns: 1,
      },
      {
        id: "cinder_draft",
        displayName: "Draft",
        signature: false,
        rank1: "Allies moving through a friendly Surtr line take no burn damage for 1 turn.",
        rank5: "Duration 2 turns.",
        cooldownTurns: 3,
      },
    ],
  },
  farsights_reckoning: {
    id: "farsights_reckoning",
    // Greek Πανόπτης, "all-seeing" — the epithet of hundred-eyed Argus.
    // Reveals every hostile on the map, burrowed included, then kills one
    // of them from anywhere.
    displayName: "Panoptes",
    epithet: "Farsight's Reckoning",
    track: "proper",
    path: "reeps",
    frameFlavor: "Sensor-heavy, visibly antenna-studded, the least armored silhouette in the pool.",
    pilot: {
      displayName: "Reya Solenne",
      house: "House Solenne",
      hook: "Quiet in a different register than Ilse — Reya's honor runs on information rather than glory. House Solenne's idea of prestige was apparently never about battlefield spectacle, which makes her presence here a quieter, more personal choice than most: nobody expects her to prove anything loudly, which may be exactly why she came.",
    },
    abilities: [
      {
        id: "farsight_signature",
        displayName: "Panoptes",
        signature: true,
        rank1: "Reveals every hostile unit on the map, including burrowed, for 1 turn.",
        rank5: "Duration 2 turns.",
        cooldownTurns: 5,
      },
      {
        id: "farsight_reckoning",
        displayName: "Reckoning",
        signature: false,
        rank1: "A guaranteed critical hit against any single currently-detected target, anywhere on the map, not just in range. Consumes the wielder's entire next turn.",
        rank5: "The turn-consumption cost is waived if the target is a burrowed unit revealed this same mission.",
        cooldownTurns: 4,
      },
      {
        id: "farsight_standing_watch",
        displayName: "Standing Watch",
        signature: false,
        rank1: "Allies within radius 3 gain +1 vision for 2 turns.",
        rank5: "Radius 4.",
        cooldownTurns: 2,
      },
    ],
  },
};

/** Every Heirloom id, in the source doc's own presentation order. */
export const ALL_HEIRLOOM_IDS = Object.keys(HEIRLOOMS) as HeirloomId[];

/** The eight that come with an aristocrat pilot — the only ones a shortlist ever offers. */
export const RECRUITABLE_HEIRLOOM_IDS: HeirloomId[] = ALL_HEIRLOOM_IDS.filter((id) => HEIRLOOMS[id].track === "proper");

/** Cost of the Nth recruitment (0-indexed). Beyond the budget there is no price — the caller should refuse first. */
export function heirloomRecruitCost(alreadyRecruited: number): number | undefined {
  return HEIRLOOM_RECRUIT_COSTS[alreadyRecruited];
}

// ---- The houses talk to each other (2 Sep 2026) --------------------------
//
// Decided with Maxime the same day the recall itself was decided, one step
// on from it: a house taking its heirloom home is not a fixed event, it
// varies by what the company was doing when their child was killed. Asked
// how hard that should bite, he took the hardest option offered — "full
// teeth, same pass" — and picked all four available signals rather than a
// subset.
//
// Worth being exact about what these are NOT keyed on. There is only one
// way to die in this game: evaluatePermadeathCheck (engine/campaignState.ts)
// returns a permanent loss on exactly one condition, no living Munti left
// on that side, and everything else is a restock. Maxime, stating the rule
// plainly when this design first went to him with three imagined causes of
// death: "die only count if there no restock." So "how did they die" is a
// constant and carries no information. What varies is the arrangement the
// company had in place — and that is a thing an outside party can actually
// hold them to account for, which is what makes it worth a house's anger.

/** What a house thinks of the company after getting its heirloom back. */
export type HouseVerdict = "honoured" | "aggrieved" | "estranged";

/**
 * The specific charge a house can level. Kept as ids rather than prose so
 * the same finding can drive a line of dialogue, a Codex entry and a
 * mechanical penalty without three copies of the wording drifting apart.
 */
export type HouseCharge =
  /** The squad launched on the legal minimum of one Munti. */
  | "thin_manifest"
  /** Their own child was that one Munti — the company made the heir the lifeline. */
  | "sole_lifeline"
  /** The company lost the mission too. The death bought nothing. */
  | "nothing_gained"
  /** The squad kept fighting with no lifeline on the board and their child was still out there. */
  | "left_alone";

/**
 * Grievance weight per charge. Placeholders in the same sense as the
 * 250/400/600 recruit ladder — argued, not simulated, and worth a real
 * tuning pass once a player can actually reach this.
 */
export const HOUSE_CHARGE_WEIGHTS: Record<HouseCharge, number> = {
  thin_manifest: 2,
  sole_lifeline: 1,
  nothing_gained: 2,
  left_alone: 1,
};

/** Turns without a lifeline before "left_alone" doubles. Two turns is a full round of both sides acting, twice. */
export const HOUSE_LEFT_ALONE_SEVERE_TURNS = 3;

/** Score at or above which a house is done with the company. */
export const HOUSE_ESTRANGED_AT = 4;
/** Score at or above which a house is angry but still dealing. */
export const HOUSE_AGGRIEVED_AT = 2;

/**
 * What one house's verdict costs the company with the OTHER houses.
 *
 * Aimed sideways on purpose. A house whose heirloom has already gone home
 * has nothing left to take away — punishing them punishes nothing. The
 * aristocracy talking amongst itself is both the only place a penalty can
 * land and the more interesting version: the arrangement was never with one
 * family, it was with a class, and the class keeps notes.
 */
export const HOUSE_VERDICT_COST_STEPS: Record<HouseVerdict, number> = {
  honoured: 0,
  aggrieved: 1,
  estranged: 2,
};

/** Shortlist entries withdrawn per verdict. Fewer houses will put a name forward at all. */
export const HOUSE_VERDICT_SHORTLIST_PENALTY: Record<HouseVerdict, number> = {
  honoured: 0,
  aggrieved: 0,
  estranged: 1,
};

/** A shortlist never shrinks below this — a pick with no options isn't a pick, it's a lockout by another name. */
export const HEIRLOOM_SHORTLIST_MIN = 1;

/**
 * The half-sentence a crew member adds when the recall comes up in the Hub.
 * Lives here rather than in data/hotTopics.ts because it is the house's
 * voice, not the crew's — the crew line carries the news, this carries the
 * temperature. Substituted into {VERDICT_CLAUSE} the same way
 * {KID_CLAUSE} already works, which is the pattern this file is copying
 * rather than inventing.
 */
export const HOUSE_VERDICT_CLAUSES: Record<HouseVerdict, string> = {
  honoured: "Courier came for it himself. Said the family had no complaint",
  aggrieved: "The letter that came with the courier wasn't warm",
  estranged: "They didn't send a courier. They sent someone to read the manifest out loud",
};
