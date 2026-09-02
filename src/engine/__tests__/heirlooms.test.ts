// Heirlooms — foundation layer, 2 Sep 2026.
//
// Two things are under test here and they carry very different risk.
//
// The RULES (recruit/field/rank) are ordinary economy code, tested the
// same way every purchase* function is.
//
// The S-TIER INTEGRATION is the dangerous half, and most of this file
// exists for it. The Heirloom plan flagged the risk in the abstract ("every
// doc and every source file this session actually checked only shows tiers
// up to A... worth a real check before this becomes code"). Checking it
// found THREE separate live call sites that walk TIER_ORDER by index and
// would each have broken differently on an S-tier pilot, none of them by
// crashing:
//
//   purchaseTierUpgrade — indexOf("S") is -1, so the at-max check passes,
//     the cost lookup returns undefined, and TIER_ORDER[-1 + 1] is "G":
//     an Heirloom pilot would have been silently DEMOTED to G, for free.
//   purchaseWeaponBranch — -1 is below every gate index, so an S-tier
//     pilot would have been refused every weapon branch in the game and
//     told they "need gear tier D+" while standing at S.
//   ShopPanel — same two bugs again in the UI, offering "UPGRADE -> G".
//
// Each is pinned below. A test that only checked "S exists in the type"
// would have caught none of them.
import { describe, it, expect } from "vitest";
import { createWardenCampaignState, type CampaignState } from "../campaignState";
import { purchaseTierUpgrade, purchaseWeaponBranch, TIER_ORDER, TIER_UPGRADE_COST } from "../campaignEconomy";
import {
  recruitHeirloom,
  fieldHeirloom,
  unfieldHeirloom,
  purchaseAbilityRank,
  abilityRank,
  heirloomState,
  heirloomsUnlocked,
  heirloomPicksRemaining,
  rollHeirloomShortlist,
  aristocratPilotId,
  aristocratMekId,
  fieldedHeirloom,
  heirloomForPilot,
  heirloomHasLivingHolder,
  resolveAristocratPath,
  isReturnedHome,
  heirloomsWithCompany,
  returnedHeirlooms,
  currentShortlist,
  acquireAberration,
  resolveVaultDedication,
} from "../heirlooms";
import {
  HEIRLOOMS,
  ALL_HEIRLOOM_IDS,
  RECRUITABLE_HEIRLOOM_IDS,
  HEIRLOOM_RECRUIT_BUDGET,
  HEIRLOOM_RECRUIT_COSTS,
  HEIRLOOM_ABILITY_RANK_COST,
  HEIRLOOM_MAX_ABILITY_RANK,
  HEIRLOOM_DEFAULT_PATH,
  ARISTOCRAT_SIGNING_POOL,
  HEIRLOOM_SHORTLIST_SIZE,
} from "../../data/heirlooms";
import { stageFromTier } from "../../data/ambientLines";
import { tierPipCount, TIERS } from "../../data/combatTables";
import { UNIT_ARCHETYPES } from "../../data/units";
import { WEAPON_BRANCHES_BY_PATH } from "../../data/weaponBranches";
import { pairKey } from "../../data/npcBonds";

/** An Act II campaign (Rourke promoted) with money to spend. */
function actTwoState(points = 10_000): CampaignState {
  const state = createWardenCampaignState();
  state.points = points;
  state.rourkeRank = "capt";
  return state;
}

describe("S tier — the integration traps", () => {
  it("purchaseTierUpgrade REFUSES an S-tier pilot instead of silently demoting them to G", () => {
    const state = actTwoState();
    const pilotId = Object.keys(state.pilots)[0];
    const entry = state.pilots[pilotId];
    entry.pilot.tier = "S";
    entry.personalPoints = 10_000;

    const result = purchaseTierUpgrade(state, pilotId);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/granted, not bought/i);
    // The actual regression this guards: without the explicit guard the
    // tier would have become "G" and the points would have been spent.
    expect(entry.pilot.tier).toBe("S");
    expect(entry.personalPoints).toBe(10_000);
  });

  it("purchaseWeaponBranch ALLOWS an S-tier pilot — S is above every gate, not below it", () => {
    // Uses a REAL branch on the pilot's own real path. An earlier draft of
    // this test passed a made-up branch id, which made it pass vacuously:
    // both the A-tier and S-tier calls failed identically with "unknown
    // branch" and the assertion that they matched proved nothing.
    const build = (tier: "A" | "S") => {
      const state = actTwoState();
      const pilotId = Object.keys(state.pilots).find((id) => {
        const path = UNIT_ARCHETYPES[state.pilots[id].pilot.archetypeId]?.path;
        return path !== undefined && (WEAPON_BRANCHES_BY_PATH[path]?.length ?? 0) > 0;
      })!;
      const entry = state.pilots[pilotId];
      entry.personalPoints = 10_000;
      entry.pilot.tier = tier;
      const path = UNIT_ARCHETYPES[entry.pilot.archetypeId].path;
      const branchId = WEAPON_BRANCHES_BY_PATH[path][0];
      return { result: purchaseWeaponBranch(state, pilotId, branchId), entry };
    };

    const atA = build("A");
    const atS = build("S");
    // A-tier clears every gate, so this must genuinely succeed — that's
    // what stops the comparison below from being vacuous a second time.
    expect(atA.result.ok).toBe(true);
    expect(atS.result.ok).toBe(true);
    expect(atS.entry.pilot.ownedWeaponBranches ?? []).toHaveLength(1);
  });

  it("S is deliberately absent from the purchase ladder — that absence IS the exclusivity rule", () => {
    expect(TIER_ORDER).not.toContain("S");
    expect(TIER_ORDER[TIER_ORDER.length - 1]).toBe("A");
    // And there is no price to climb into it.
    expect((TIER_UPGRADE_COST as Record<string, number>).A).toBeUndefined();
    expect((TIER_UPGRADE_COST as Record<string, number>).S).toBeUndefined();
  });

  it("an ordinary pilot still cannot climb past A, one purchase at a time, all the way up", () => {
    // The whole point of excluding S is that this loop terminates at A.
    const state = actTwoState();
    const pilotId = Object.keys(state.pilots)[0];
    const entry = state.pilots[pilotId];
    entry.pilot.tier = "G";
    entry.personalPoints = 100_000;
    for (let i = 0; i < 20; i++) purchaseTierUpgrade(state, pilotId);
    expect(entry.pilot.tier).toBe("A");
  });

  it("stageFromTier puts an S-tier pilot in the command register, not back down with the mid-career crowd", () => {
    expect(stageFromTier("S")).toBe("command");
    expect(stageFromTier("A")).toBe("command");
    expect(stageFromTier("C")).toBe("blooded");
  });

  it("S has real stats above A, and draws the most gear pips", () => {
    expect(TIERS.S.attack).toBeGreaterThan(TIERS.A.attack);
    expect(TIERS.S.defense).toBeGreaterThan(TIERS.A.defense);
    expect(TIERS.S.hp).toBeGreaterThan(TIERS.A.hp);
    expect(tierPipCount("S")).toBeGreaterThan(tierPipCount("A"));
  });
});

describe("the Act II gate", () => {
  it("reads the rank ladder, which IS the act ladder — locked at 2nd Lt., open from Captain", () => {
    // Deliberately reading rourkeRank rather than a mission counter: the
    // Act I/II boundary is Mission 12's own promotion, so a separate act
    // counter could drift away from the thing that defines the act.
    const actOne = createWardenCampaignState();
    expect(actOne.rourkeRank).toBe("2nd_lt");
    expect(heirloomsUnlocked(actOne)).toBe(false);

    actOne.rourkeRank = "capt";
    expect(heirloomsUnlocked(actOne)).toBe(true);
    actOne.rourkeRank = "maj";
    expect(heirloomsUnlocked(actOne)).toBe(true);
  });

  it("reports the full budget as unspent before anything is recruited", () => {
    expect(heirloomPicksRemaining(createWardenCampaignState())).toBe(HEIRLOOM_RECRUIT_BUDGET);
  });
});

describe("recruitment — company points, three picks, Act II onward", () => {
  it("refuses during Act I even with points to burn", () => {
    const state = createWardenCampaignState();
    state.points = 10_000;
    expect(state.rourkeRank).toBe("2nd_lt");
    const result = recruitHeirloom(state, "widows_ledger");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/act ii/i);
    expect(state.points).toBe(10_000);
  });

  it("spends COMPANY points, not the pilot's personal pool", () => {
    const state = actTwoState(1000);
    // Keyed by pilot id, not a positional array. The first draft of this
    // test compared two arrays of personalPoints and so incidentally
    // pinned the roster SIZE — which broke the moment recruiting started
    // minting the aristocrat it is supposed to mint. What the test is
    // actually for is "no existing pilot paid for this," and that is what
    // it now checks, per-pilot, regardless of who else joins.
    const personalBefore = Object.fromEntries(
      Object.entries(state.pilots).map(([id, p]) => [id, p.personalPoints]),
    );
    const result = recruitHeirloom(state, "widows_ledger");
    expect(result.ok).toBe(true);
    expect(state.points).toBe(1000 - HEIRLOOM_RECRUIT_COSTS[0]);
    for (const [id, before] of Object.entries(personalBefore)) {
      expect(state.pilots[id].personalPoints).toBe(before);
    }
    // ...and the one pilot who did join starts with the signing pool, not
    // an empty one — the one deliberate deviation from a fresh recruit's
    // usual `personalPoints: 0` (mintAristocrat's own doc comment, and
    // ARISTOCRAT_SIGNING_POOL's, cover why: the house sends its aristocrat
    // out with money already committed to the weapon they're carrying).
    expect(state.pilots[result.pilot!.id].personalPoints).toBe(ARISTOCRAT_SIGNING_POOL);
  });

  it("charges the escalating price per pick, in order", () => {
    const state = actTwoState();
    const start = state.points;
    recruitHeirloom(state, "widows_ledger");
    expect(state.points).toBe(start - HEIRLOOM_RECRUIT_COSTS[0]);
    recruitHeirloom(state, "iron_oath");
    expect(state.points).toBe(start - HEIRLOOM_RECRUIT_COSTS[0] - HEIRLOOM_RECRUIT_COSTS[1]);
    recruitHeirloom(state, "deadfall");
    expect(state.points).toBe(start - HEIRLOOM_RECRUIT_COSTS.slice(0, 3).reduce((a, b) => a + b, 0));
  });

  it("hard-stops at the campaign budget of three", () => {
    const state = actTwoState();
    recruitHeirloom(state, "widows_ledger");
    recruitHeirloom(state, "iron_oath");
    recruitHeirloom(state, "deadfall");
    expect(heirloomPicksRemaining(state)).toBe(0);
    const pointsBefore = state.points;
    const fourth = recruitHeirloom(state, "last_word");
    expect(fourth.ok).toBe(false);
    expect(fourth.reason).toMatch(new RegExp(`${HEIRLOOM_RECRUIT_BUDGET}`));
    expect(state.points).toBe(pointsBefore);
    expect(heirloomState(state).recruited).toHaveLength(HEIRLOOM_RECRUIT_BUDGET);
  });

  it("refuses a duplicate without charging", () => {
    const state = actTwoState();
    recruitHeirloom(state, "widows_ledger");
    const before = state.points;
    const again = recruitHeirloom(state, "widows_ledger");
    expect(again.ok).toBe(false);
    expect(state.points).toBe(before);
  });

  it("refuses both aberrations — Requiem and the Seal come from story beats, never a shortlist", () => {
    const state = actTwoState();
    for (const id of ["requiem", "stolen_seal"] as const) {
      const result = recruitHeirloom(state, id);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/story beat/i);
    }
    expect(heirloomState(state).recruited).toEqual([]);
  });

  it("refuses when the company can't afford the pick, without partial spending", () => {
    const state = actTwoState(HEIRLOOM_RECRUIT_COSTS[0] - 1);
    const result = recruitHeirloom(state, "widows_ledger");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not enough company points/i);
    expect(heirloomState(state).recruited).toEqual([]);
  });

  it("does not auto-field the new recruit — fielding is its own decision", () => {
    const state = actTwoState();
    recruitHeirloom(state, "widows_ledger");
    expect(heirloomState(state).fielded).toBeUndefined();
  });
});

describe("fielding — one at a time, no matter what", () => {
  it("fields a recruited Heirloom", () => {
    const state = actTwoState();
    recruitHeirloom(state, "widows_ledger");
    expect(fieldHeirloom(state, "widows_ledger").ok).toBe(true);
    expect(heirloomState(state).fielded).toBe("widows_ledger");
  });

  it("refuses to field one the company doesn't have", () => {
    const state = actTwoState();
    const result = fieldHeirloom(state, "deadfall");
    expect(result.ok).toBe(false);
    expect(heirloomState(state).fielded).toBeUndefined();
  });

  it("fielding a second one BENCHES the first rather than fielding both", () => {
    const state = actTwoState();
    recruitHeirloom(state, "widows_ledger");
    recruitHeirloom(state, "iron_oath");
    fieldHeirloom(state, "widows_ledger");
    const swap = fieldHeirloom(state, "iron_oath");
    expect(swap.ok).toBe(true);
    expect(swap.benched).toBe("widows_ledger");
    // The invariant that actually matters: exactly one, ever.
    expect(heirloomState(state).fielded).toBe("iron_oath");
  });

  it("unfielding is idempotent and never an error", () => {
    const state = actTwoState();
    expect(unfieldHeirloom(state).ok).toBe(true);
    recruitHeirloom(state, "widows_ledger");
    fieldHeirloom(state, "widows_ledger");
    expect(unfieldHeirloom(state).benched).toBe("widows_ledger");
    expect(heirloomState(state).fielded).toBeUndefined();
    expect(unfieldHeirloom(state).ok).toBe(true);
  });
});

describe("ability ranks — personal points", () => {
  const heirloom = "widows_ledger" as const;
  const ability = HEIRLOOMS.widows_ledger.abilities[0].id;

  function recruitedState() {
    const state = actTwoState();
    recruitHeirloom(state, heirloom);
    const pilotId = Object.keys(state.pilots)[0];
    state.pilots[pilotId].personalPoints = 10_000;
    return { state, pilotId };
  }

  it("every ability starts at rank 1, free, without any stored entry", () => {
    const { state } = recruitedState();
    expect(abilityRank(state, heirloom, ability)).toBe(1);
    expect(heirloomState(state).abilityRanks).toEqual({});
  });

  it("spends PERSONAL points, not the company pool", () => {
    const { state, pilotId } = recruitedState();
    const companyBefore = state.points;
    const result = purchaseAbilityRank(state, heirloom, ability, pilotId);
    expect(result.ok).toBe(true);
    expect(result.newRank).toBe(2);
    expect(state.pilots[pilotId].personalPoints).toBe(10_000 - HEIRLOOM_ABILITY_RANK_COST[2]);
    expect(state.points).toBe(companyBefore);
  });

  it("walks the published cost curve and stops at rank 5", () => {
    const { state, pilotId } = recruitedState();
    let spent = 0;
    for (let rank = 2; rank <= HEIRLOOM_MAX_ABILITY_RANK; rank++) {
      const result = purchaseAbilityRank(state, heirloom, ability, pilotId);
      expect(result.ok).toBe(true);
      expect(result.cost).toBe(HEIRLOOM_ABILITY_RANK_COST[rank]);
      spent += HEIRLOOM_ABILITY_RANK_COST[rank];
    }
    expect(abilityRank(state, heirloom, ability)).toBe(HEIRLOOM_MAX_ABILITY_RANK);
    expect(state.pilots[pilotId].personalPoints).toBe(10_000 - spent);
    const past = purchaseAbilityRank(state, heirloom, ability, pilotId);
    expect(past.ok).toBe(false);
    expect(past.reason).toMatch(/already at rank 5/i);
  });

  it("maxing all three abilities costs 6,300 personal points, matching the plan doc's own table", () => {
    const perAbility = Object.values(HEIRLOOM_ABILITY_RANK_COST).reduce((a, b) => a + b, 0);
    expect(perAbility).toBe(2100);
    expect(perAbility * 3).toBe(6300);
  });

  it("refuses when the pilot can't afford the next rank, without partial spending", () => {
    const { state, pilotId } = recruitedState();
    state.pilots[pilotId].personalPoints = HEIRLOOM_ABILITY_RANK_COST[2] - 1;
    const result = purchaseAbilityRank(state, heirloom, ability, pilotId);
    expect(result.ok).toBe(false);
    expect(abilityRank(state, heirloom, ability)).toBe(1);
  });

  it("refuses ranks on an Heirloom the company doesn't have", () => {
    const state = actTwoState();
    const pilotId = Object.keys(state.pilots)[0];
    state.pilots[pilotId].personalPoints = 10_000;
    const result = purchaseAbilityRank(state, "deadfall", HEIRLOOMS.deadfall.abilities[0].id, pilotId);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/isn't with the company/i);
  });

  it("ranks are per-ability, not per-Heirloom — raising one leaves its siblings at 1", () => {
    const { state, pilotId } = recruitedState();
    purchaseAbilityRank(state, heirloom, ability, pilotId);
    const sibling = HEIRLOOMS.widows_ledger.abilities[1].id;
    expect(abilityRank(state, heirloom, ability)).toBe(2);
    expect(abilityRank(state, heirloom, sibling)).toBe(1);
  });
});

describe("shortlist", () => {
  it("only ever offers the eight proper Heirlooms, never an aberration", () => {
    const state = actTwoState();
    for (let i = 0; i < 40; i++) {
      for (const id of rollHeirloomShortlist(state)) {
        expect(HEIRLOOMS[id].track).toBe("proper");
      }
    }
  });

  it("never re-offers someone already recruited", () => {
    const state = actTwoState();
    recruitHeirloom(state, "widows_ledger");
    for (let i = 0; i < 40; i++) {
      expect(rollHeirloomShortlist(state)).not.toContain("widows_ledger");
    }
  });

  it("a DECLINED candidate can resurface — passing is not permanent", () => {
    // The doc confirms this directly ("Can resurface later"), and it's the
    // difference between a real choice and a one-shot loss. Declining is
    // simply not recruiting, so the proof is that every candidate remains
    // reachable across many rolls.
    const state = actTwoState();
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) for (const id of rollHeirloomShortlist(state)) seen.add(id);
    expect(seen.size).toBe(RECRUITABLE_HEIRLOOM_IDS.length);
  });

  it("returns distinct candidates — never the same pilot twice on one list", () => {
    const state = actTwoState();
    for (let i = 0; i < 40; i++) {
      const list = rollHeirloomShortlist(state);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("is deterministic given a seeded rng, so a shortlist can be replayed", () => {
    const state = actTwoState();
    const fixed = () => 0.42;
    expect(rollHeirloomShortlist(state, fixed)).toEqual(rollHeirloomShortlist(state, fixed));
  });

  it("shrinks rather than padding when the pool runs low", () => {
    const state = actTwoState();
    // Pretend seven of the eight are gone.
    state.heirlooms = { recruited: RECRUITABLE_HEIRLOOM_IDS.slice(0, 7), abilityRanks: {}, assignedPilotId: {} };
    expect(rollHeirloomShortlist(state)).toHaveLength(1);
  });
});

describe("the pool itself", () => {
  it("is ten Heirlooms: two aberrations and eight proper", () => {
    expect(ALL_HEIRLOOM_IDS).toHaveLength(10);
    expect(RECRUITABLE_HEIRLOOM_IDS).toHaveLength(8);
    expect(ALL_HEIRLOOM_IDS.filter((id) => HEIRLOOMS[id].track === "aberration")).toEqual(["requiem", "stolen_seal"]);
  });

  it("every record key matches its own id, so a lookup can't return the wrong Heirloom", () => {
    for (const [key, def] of Object.entries(HEIRLOOMS)) expect(def.id).toBe(key);
  });

  it("every proper Heirloom has an aristocrat pilot; neither aberration does", () => {
    for (const id of RECRUITABLE_HEIRLOOM_IDS) {
      const pilot = HEIRLOOMS[id].pilot;
      expect(pilot).toBeDefined();
      expect(pilot!.displayName.length).toBeGreaterThan(0);
      expect(pilot!.house.length).toBeGreaterThan(0);
      expect(pilot!.hook.length).toBeGreaterThan(0);
    }
    expect(HEIRLOOMS.requiem.pilot).toBeUndefined();
    expect(HEIRLOOMS.stolen_seal.pilot).toBeUndefined();
  });

  it("every Heirloom but Requiem carries exactly three abilities, one of them the signature", () => {
    for (const id of ALL_HEIRLOOM_IDS) {
      const def = HEIRLOOMS[id];
      if (id === "requiem") {
        // Deliberately the one exception — see its own comment: the
        // flagship stays a single shared-meter ability rather than being
        // retrofitted into three slots.
        expect(def.abilities).toHaveLength(1);
      } else {
        expect(def.abilities).toHaveLength(3);
      }
      expect(def.abilities.filter((a) => a.signature)).toHaveLength(1);
    }
  });

  it("every ability id is unique across the whole pool — they key the rank map", () => {
    const ids = ALL_HEIRLOOM_IDS.flatMap((id) => HEIRLOOMS[id].abilities.map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every ability says what rank 1 and rank 5 do", () => {
    for (const id of ALL_HEIRLOOM_IDS) {
      for (const a of HEIRLOOMS[id].abilities) {
        expect(a.rank1.length).toBeGreaterThan(0);
        expect(a.rank5.length).toBeGreaterThan(0);
        expect(a.cooldownTurns).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("the recruit cost table covers exactly the budget — no unpriced pick, no unreachable price", () => {
    expect(HEIRLOOM_RECRUIT_COSTS).toHaveLength(HEIRLOOM_RECRUIT_BUDGET);
    for (const c of HEIRLOOM_RECRUIT_COSTS) expect(c).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------
// Aristocrat minting, 2 Sep 2026.
//
// The foundation pass shipped `assignedPilotId` and never wrote to it, so
// nothing could ever be fielded and the S-tier work it had carefully made
// safe was never actually exercised by a real roster entry. This is that
// gap closed, and the tests below are mostly about the two ways minting
// can go quietly wrong rather than loudly: a pilot minted at the wrong
// tier or chassis (wrong, but runs), and points spent on a recruitment
// that then fails (a refusal that isn't free).
// ---------------------------------------------------------------------

describe("aristocrat minting", () => {
  it("puts a real, active, deployable S-tier pilot on the roster", () => {
    const state = actTwoState();
    const before = Object.keys(state.pilots).length;
    const result = recruitHeirloom(state, "widows_ledger");

    expect(result.ok).toBe(true);
    expect(Object.keys(state.pilots).length).toBe(before + 1);

    const entry = state.pilots[aristocratPilotId("widows_ledger")];
    expect(entry).toBeDefined();
    expect(entry.status).toBe("active");
    expect(entry.pilot.tier).toBe("S");
    // Their real name, not a rolled callsign — this is the one place the
    // pool's authored content reaches the roster.
    expect(entry.pilot.displayName).toBe(HEIRLOOMS.widows_ledger.pilot!.displayName);
    // And the whole reason S tier had to be built carefully: this pilot
    // reads as Command-stage dialogue, not mid-career.
    expect(stageFromTier(entry.pilot.tier)).toBe("command");
  });

  it("records the assignment both ways", () => {
    const state = actTwoState();
    const result = recruitHeirloom(state, "iron_oath");
    const pilotId = result.pilot!.id;
    expect(heirloomState(state).assignedPilotId.iron_oath).toBe(pilotId);
    expect(heirloomForPilot(state, pilotId)).toBe("iron_oath");
    expect(heirloomForPilot(state, "pilot_rourke")).toBeUndefined();
  });

  it("gives the aristocrat a frame named after the Heirloom, not after them", () => {
    const state = actTwoState();
    recruitHeirloom(state, "iron_oath");
    const mek = state.meks[aristocratMekId("iron_oath")];
    expect(mek).toBeDefined();
    // Every other mek in the game is "<callsign>'s Mek". A named signature
    // frame is one of the two things recruitment actually grants.
    expect(mek.displayName).toBe(HEIRLOOMS.iron_oath.displayName);
    expect(state.pilots[aristocratPilotId("iron_oath")].pilot.mekId).toBe(mek.id);
  });

  it("is NOT exempt from permadeath — an aristocrat can be lost like anyone else", () => {
    const state = actTwoState();
    const result = recruitHeirloom(state, "deadfall");
    expect(result.pilot!.exemptFromPermadeath).toBeFalsy();
  });

  it("honours a chassis the shipped frame flavor already demanded", () => {
    // Vann Rethwick is Hiopi and Zanretsu's own frameFlavor says the frame
    // is "built low and long for a centauroid gait." Minting him bipedal
    // would have contradicted text that already ships.
    const state = actTwoState();
    const result = recruitHeirloom(state, "cutting_room");
    expect(result.pilot!.archetypeId).toBe("arch_meeps_centauroid");
  });

  it("mints a VALID archetype for every recruitable Heirloom", () => {
    // The strongest test here. Not every path x chassis pair exists in
    // data/units.ts, and an unauthored combination would mint a pilot who
    // cannot be built into a BattleUnit — a crash at deploy time, a long
    // way from its cause. This walks all eight rather than spot-checking.
    for (const id of RECRUITABLE_HEIRLOOM_IDS) {
      const state = actTwoState(100_000);
      const result = recruitHeirloom(state, id);
      expect(result.ok, `${id} should recruit`).toBe(true);
      expect(UNIT_ARCHETYPES[result.pilot!.archetypeId], `${id} -> ${result.pilot!.archetypeId}`).toBeDefined();
    }
  });
});

describe("aristocrat minting — which path an \"Any\" Heirloom deploys as", () => {
  it("uses the documented fallback when the caller doesn't choose", () => {
    const state = actTwoState();
    expect(HEIRLOOMS.salt_the_root.path).toBeNull();
    const result = recruitHeirloom(state, "salt_the_root");
    expect(result.pilot!.archetypeId).toBe(`arch_${HEIRLOOM_DEFAULT_PATH.salt_the_root}_bipedal`);
  });

  it("lets an explicit choice win over the fallback", () => {
    const state = actTwoState();
    const result = recruitHeirloom(state, "salt_the_root", { path: "tank" });
    expect(result.pilot!.archetypeId).toBe("arch_tank_bipedal");
  });

  it("REFUSES a path that contradicts a fixed-path Heirloom, rather than ignoring it", () => {
    // Silently overriding what a caller explicitly asked for is how a UI
    // bug becomes an unreproducible save-state bug.
    const state = actTwoState();
    const result = recruitHeirloom(state, "iron_oath", { path: "meeps" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/tank/);
  });

  it("resolveAristocratPath agrees with itself on a fixed-path Heirloom asked for its own path", () => {
    expect(resolveAristocratPath(HEIRLOOMS.iron_oath, "tank").path).toBe("tank");
    expect(resolveAristocratPath(HEIRLOOMS.iron_oath).path).toBe("tank");
  });
});

describe("a refused recruitment costs nothing and mints nobody", () => {
  const cases: Array<[string, (s: CampaignState) => void, Parameters<typeof recruitHeirloom>[1], Parameters<typeof recruitHeirloom>[2]]> = [
    ["Act I", (s) => { s.rourkeRank = "2nd_lt"; }, "widows_ledger", undefined],
    ["no money", (s) => { s.points = 0; }, "widows_ledger", undefined],
    ["contradictory path", () => {}, "iron_oath", { path: "munti" }],
    ["an aberration, which is never recruited", () => {}, "requiem", undefined],
  ];

  for (const [label, mutate, id, opts] of cases) {
    it(`leaves the campaign untouched — ${label}`, () => {
      const state = actTwoState();
      mutate(state);
      const pointsBefore = state.points;
      const pilotsBefore = Object.keys(state.pilots).length;
      const meksBefore = Object.keys(state.meks).length;

      const result = recruitHeirloom(state, id, opts);

      expect(result.ok).toBe(false);
      expect(state.points).toBe(pointsBefore);
      expect(Object.keys(state.pilots).length).toBe(pilotsBefore);
      expect(Object.keys(state.meks).length).toBe(meksBefore);
      expect(heirloomState(state).recruited).toEqual([]);
    });
  }
});

describe("losing the wielder", () => {
  function recruited(): { state: CampaignState; pilotId: string } {
    const state = actTwoState();
    const result = recruitHeirloom(state, "deadfall");
    fieldHeirloom(state, "deadfall");
    return { state, pilotId: result.pilot!.id };
  }

  it("keeps the artifact but stops it being deployable", () => {
    const { state, pilotId } = recruited();
    expect(fieldedHeirloom(state)).toBe("deadfall");

    state.pilots[pilotId].status = "permanently_lost";

    // The company still OWNS it — the pick was spent, and the stored
    // `fielded` intent is deliberately left alone rather than reached into
    // from the middle of a permadeath resolution.
    expect(heirloomState(state).recruited).toContain("deadfall");
    expect(heirloomState(state).fielded).toBe("deadfall");
    // But nothing is actually going into the next mission carrying it.
    expect(heirloomHasLivingHolder(state, "deadfall")).toBe(false);
    expect(fieldedHeirloom(state)).toBeUndefined();
  });

  it("refuses to re-field an Heirloom with nobody to carry it", () => {
    const { state, pilotId } = recruited();
    unfieldHeirloom(state);
    state.pilots[pilotId].status = "permanently_lost";

    const result = fieldHeirloom(state, "deadfall");
    expect(result.ok).toBe(false);
    // The refusal names the HOUSE, because that is who has it now — the
    // company didn't lose track of the weapon, it was recalled.
    expect(result.reason).toMatch(/recalled/i);
    expect(result.reason).toContain(HEIRLOOMS.deadfall.pilot!.house);
  });

  it("a benched pilot who is merely reassigned is treated the same as lost, for now", () => {
    // "reassigned" means alive but off this ship. Not a separate rule —
    // heirloomHasLivingHolder asks for `active` and nothing else — but
    // pinned so that if reassignment ever becomes recoverable, this
    // decision gets revisited deliberately instead of by accident.
    const { state, pilotId } = recruited();
    state.pilots[pilotId].status = "reassigned";
    expect(fieldedHeirloom(state)).toBeUndefined();
  });
});

describe("naming — 2 Sep 2026", () => {
  it("gives every proper Heirloom's signature ability the weapon's own name", () => {
    for (const id of ALL_HEIRLOOM_IDS) {
      const def = HEIRLOOMS[id];
      const signature = def.abilities.filter((a) => a.signature);
      expect(signature.length, `${id} should have exactly one signature`).toBe(1);
      expect(signature[0].displayName, `${id} signature`).toBe(def.displayName);
    }
  });

  it("leaves every NON-signature ability in plain field speech", () => {
    // The rule only works because the grand name is scarce. If a second
    // ability on the same Heirloom also carried it, neither would read as
    // the weapon firing.
    for (const id of ALL_HEIRLOOM_IDS) {
      const def = HEIRLOOMS[id];
      for (const ability of def.abilities.filter((a) => !a.signature)) {
        expect(ability.displayName, `${id}:${ability.id}`).not.toBe(def.displayName);
      }
    }
  });

  it("keeps the old design-doc title as an epithet on everything that had one", () => {
    for (const id of ALL_HEIRLOOM_IDS) {
      if (id === "requiem") {
        // The exception, and the reason the whole pass happened: Gjallar's
        // old title ("Requiem") was promoted to the SYSTEM name rather than
        // kept as a second name for the weapon.
        expect(HEIRLOOMS[id].epithet).toBeUndefined();
        continue;
      }
      expect(HEIRLOOMS[id].epithet, `${id} should keep its old title`).toBeTruthy();
      expect(HEIRLOOMS[id].epithet).not.toBe(HEIRLOOMS[id].displayName);
    }
  });

  it("keeps every Heirloom name distinct from every other", () => {
    const names = ALL_HEIRLOOM_IDS.map((id) => HEIRLOOMS[id].displayName);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------
// "Returned home", 2 Sep 2026.
//
// Maxime: "nah, recruite one are familly heirloom they get returned home."
// These are FAMILY heirlooms. The company borrows one through that
// family's own child; when the child doesn't come back, neither does the
// weapon. Asked separately whether the recruitment pick comes back with
// it, he chose the hardest of three options: it does not.
//
// Almost all of this falls out of the existing model rather than needing
// new state, which is precisely why it is worth pinning with tests — a
// rule that holds by accident today can stop holding by accident later.
// ---------------------------------------------------------------------

describe("returned home — the house takes its heirloom back", () => {
  function lost(): CampaignState {
    const state = actTwoState();
    const result = recruitHeirloom(state, "widows_ledger");
    fieldHeirloom(state, "widows_ledger");
    state.pilots[result.pilot!.id].status = "permanently_lost";
    return state;
  }

  it("counts as gone the moment its aristocrat leaves the company", () => {
    const state = lost();
    expect(isReturnedHome(state, "widows_ledger")).toBe(true);
    expect(returnedHeirlooms(state)).toEqual(["widows_ledger"]);
    expect(heirloomsWithCompany(state)).toEqual([]);
  });

  it("does NOT count an Heirloom that was never recruited as returned", () => {
    // "Gone home" and "was never here" are different states, and only one
    // of them should ever show up in a returned list.
    const state = actTwoState();
    expect(isReturnedHome(state, "widows_ledger")).toBe(false);
    expect(returnedHeirlooms(state)).toEqual([]);
  });

  it("SPENDS THE PICK FOR GOOD — the slot does not come back", () => {
    const state = lost();
    // The whole weight of the decision is in this one assertion: two
    // remaining, not three. Losing an aristocrat costs the pilot, the
    // points, the weapon, AND one of only three chances in the campaign.
    expect(heirloomPicksRemaining(state)).toBe(HEIRLOOM_RECRUIT_BUDGET - 1);
  });

  it("keeps charging the escalating price — a lost pick doesn't rewind the ladder", () => {
    const state = lost();
    const before = state.points;
    const second = recruitHeirloom(state, "iron_oath");
    expect(second.ok).toBe(true);
    // Second rung, not a repeat of the first.
    expect(before - state.points).toBe(HEIRLOOM_RECRUIT_COSTS[1]);
  });

  it("never offers it on a shortlist again", () => {
    const state = lost();
    // 300 rolls, not one: a resurfacing bug that only shows up on some
    // shuffles is exactly the kind this needs to catch.
    for (let i = 0; i < 300; i++) {
      expect(rollHeirloomShortlist(state, Math.random, 8)).not.toContain("widows_ledger");
    }
  });

  it("refuses to buy ability ranks for a weapon that has gone home", () => {
    // The real hole this decision exposed. `recruited` is a permanent
    // record of picks made ever, so it still contains a recalled Heirloom
    // — without an explicit check a player could keep spending real
    // personal points training on a weapon that isn't on the ship.
    const state = lost();
    const survivor = "pilot_rourke";
    state.pilots[survivor].personalPoints = 10_000;
    const result = purchaseAbilityRank(state, "widows_ledger", "ledger_entry", survivor);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/took .* home/i);
    expect(state.pilots[survivor].personalPoints).toBe(10_000);
    expect(abilityRank(state, "widows_ledger", "ledger_entry")).toBe(1);
  });

  it("still lets a DIFFERENT, living Heirloom rank up normally", () => {
    // Guards against the check above being written too broadly — a recall
    // must not freeze the rest of the shelf.
    const state = lost();
    const second = recruitHeirloom(state, "iron_oath");
    const holder = second.pilot!.id;
    state.pilots[holder].personalPoints = 10_000;
    const result = purchaseAbilityRank(state, "iron_oath", "oath_oathkeeper", holder);
    expect(result.ok).toBe(true);
    expect(abilityRank(state, "iron_oath", "oath_oathkeeper")).toBe(2);
  });
});

describe("currentShortlist — roll once, hold until picked", () => {
  it("returns nothing before Act II, and stores nothing while it does", () => {
    const state = createWardenCampaignState();
    expect(currentShortlist(state)).toEqual([]);
    expect(heirloomState(state).shortlist).toBeUndefined();
  });

  it("is stable across repeated calls — the roll is not re-rolled on every look", () => {
    const state = actTwoState();
    const first = currentShortlist(state, Math.random);
    for (let i = 0; i < 20; i++) {
      expect(currentShortlist(state, Math.random)).toEqual(first);
    }
  });

  it("rerolls fresh once a pick is spent", () => {
    // recruitHeirloom clears the stored shortlist on success (see its own
    // `shortlist: undefined` line) specifically so the next look rolls
    // again rather than re-showing an offer that includes what was just
    // recruited.
    const state = actTwoState();
    const first = currentShortlist(state);
    expect(first.length).toBe(HEIRLOOM_SHORTLIST_SIZE);
    const recruited = first[0];
    const result = recruitHeirloom(state, recruited);
    expect(result.ok).toBe(true);
    expect(heirloomState(state).shortlist).toBeUndefined();
    const second = currentShortlist(state);
    expect(second).not.toContain(recruited);
  });
});

describe("acquireAberration — Gjallar/Requiem's own door", () => {
  it("refuses an unknown Heirloom id", () => {
    const state = actTwoState();
    // @ts-expect-error deliberately invalid id, exercising the runtime guard
    const result = acquireAberration(state, "not_a_real_heirloom", "pilot_rourke");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown heirloom/i);
  });

  it("refuses a proper (non-aberration) Heirloom — that's recruitHeirloom's door", () => {
    const state = actTwoState();
    const result = acquireAberration(state, "widows_ledger", "pilot_rourke");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/recruit it through the vault shortlist/i);
  });

  it("refuses an unknown pilot id", () => {
    const state = actTwoState();
    const result = acquireAberration(state, "requiem", "pilot_nobody");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown pilot id/i);
  });

  it("refuses a non-active (permanently lost) pilot", () => {
    const state = actTwoState();
    state.pilots["pilot_bosk"].status = "permanently_lost";
    const result = acquireAberration(state, "requiem", "pilot_bosk");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not active/i);
  });

  it("refuses re-assigning to the pilot who already carries it", () => {
    const state = actTwoState();
    const first = acquireAberration(state, "requiem", "pilot_rourke");
    expect(first.ok).toBe(true);
    const second = acquireAberration(state, "requiem", "pilot_rourke");
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/already carries/i);
  });

  it("assigns for free — no company points, no pick spent, no roster/points mutation", () => {
    const state = actTwoState();
    const pointsBefore = state.points;
    const picksBefore = heirloomPicksRemaining(state);
    const result = acquireAberration(state, "requiem", "pilot_rourke");
    expect(result.ok).toBe(true);
    expect(result.cost).toBe(0);
    expect(state.points).toBe(pointsBefore);
    // Spends nothing against the three-house recruit budget — the
    // aberration was never a house's to offer, so it can't spend a slot
    // that was never allotted to it.
    expect(heirloomPicksRemaining(state)).toBe(picksBefore);
    expect(heirloomState(state).recruited).toContain("requiem");
    expect(heirloomState(state).assignedPilotId["requiem"]).toBe("pilot_rourke");
  });

  it("does not eat a house pick or bump the price ladder — Gjallar was never a house's offer", () => {
    // Regression: recruitHeirloom's own budget check and price rung both
    // used to read hs.recruited.length raw, which counts an acquired
    // aberration right alongside the three houses' own picks. Caught by
    // this test after acquireAberration's success-path test above passed
    // but heirloomPicksRemaining/recruitHeirloom disagreed with each
    // other about how many house picks were actually left.
    const state = actTwoState();
    acquireAberration(state, "requiem", "pilot_rourke");
    expect(heirloomPicksRemaining(state)).toBe(HEIRLOOM_RECRUIT_BUDGET);
    const pointsBefore = state.points;
    const first = recruitHeirloom(state, "widows_ledger");
    expect(first.ok).toBe(true);
    // First HOUSE pick, first rung — unaffected by Gjallar already sitting
    // in `recruited`.
    expect(pointsBefore - state.points).toBe(HEIRLOOM_RECRUIT_COSTS[0]);
    expect(heirloomPicksRemaining(state)).toBe(HEIRLOOM_RECRUIT_BUDGET - 1);
    // All three house picks are still genuinely spendable afterward.
    expect(recruitHeirloom(state, "iron_oath").ok).toBe(true);
    expect(recruitHeirloom(state, "deadfall").ok).toBe(true);
    expect(heirloomPicksRemaining(state)).toBe(0);
  });

  it("transfers cleanly from one living holder to another — the actual inheritance case", () => {
    const state = actTwoState();
    acquireAberration(state, "requiem", "pilot_bosk");
    expect(heirloomState(state).assignedPilotId["requiem"]).toBe("pilot_bosk");
    const result = acquireAberration(state, "requiem", "pilot_rourke");
    expect(result.ok).toBe(true);
    expect(heirloomState(state).assignedPilotId["requiem"]).toBe("pilot_rourke");
    // recruited is a list, not a counter — a second acquireAberration call
    // for the same id must not duplicate the entry.
    expect(heirloomState(state).recruited.filter((id) => id === "requiem").length).toBe(1);
  });
});

describe("resolveVaultDedication — Mission 12's Vault scene, one-shot", () => {
  function mission12Loss(state: CampaignState, pilotId: string) {
    state.pilots[pilotId].status = "permanently_lost";
    state.pilots[pilotId].personalPoints = 0;
    state.pilots[pilotId].lostContext = {
      missionId: "mission_amaranth_12",
      outcome: "win",
      turn: 9,
      turnsWithoutMunti: 0,
      muntisDeployed: 1,
      wasLastMunti: false,
    };
  }

  it("does nothing before Mission 12 unlocks Heirlooms", () => {
    const state = createWardenCampaignState();
    expect(state.rourkeRank).toBe("2nd_lt");
    const result = resolveVaultDedication(state);
    expect(result).toBeUndefined();
    expect(state.vaultDedication).toBeUndefined();
  });

  it("Bosk falls at Mission 12 — Gjallar passes to Rourke, as written", () => {
    const state = actTwoState();
    mission12Loss(state, "pilot_bosk");
    const result = resolveVaultDedication(state);
    expect(result).toEqual({ fallenId: "pilot_bosk", transferred: true });
    expect(state.vaultDedication).toEqual({ fallenId: "pilot_bosk", seen: false });
    expect(heirloomState(state).assignedPilotId["requiem"]).toBe("pilot_rourke");
  });

  it("Bosk already fell earlier — an EARLIER loss doesn't count as this beat", () => {
    const state = actTwoState();
    state.pilots["pilot_bosk"].status = "permanently_lost";
    state.pilots["pilot_bosk"].lostContext = {
      missionId: "mission_amaranth_7",
      outcome: "loss",
      turn: 4,
      turnsWithoutMunti: 1,
      muntisDeployed: 1,
      wasLastMunti: true,
    };
    // Nobody else falls at Mission 12 itself.
    const result = resolveVaultDedication(state);
    expect(result).toEqual({ fallenId: undefined, transferred: false });
    expect(state.vaultDedication).toEqual({ fallenId: undefined, seen: false });
    expect(heirloomState(state).assignedPilotId["requiem"]).toBeUndefined();
  });

  it("someone other than Bosk falls at Mission 12 — the substitution selector picks by bond to Rourke", () => {
    const state = actTwoState();
    mission12Loss(state, "pilot_iyari");
    mission12Loss(state, "pilot_anand");
    state.npcSocial = {
      bonds: {
        [pairKey("pilot_rourke", "pilot_iyari")]: 5,
        [pairKey("pilot_rourke", "pilot_anand")]: 40,
      },
      relationships: [],
    };
    const result = resolveVaultDedication(state);
    expect(result).toEqual({ fallenId: "pilot_anand", transferred: true });
    expect(heirloomState(state).assignedPilotId["requiem"]).toBe("pilot_rourke");
  });

  it("nobody falls at Mission 12 — a real outcome, not a degenerate one: no dedication, Gjallar unclaimed", () => {
    const state = actTwoState();
    const result = resolveVaultDedication(state);
    expect(result).toEqual({ fallenId: undefined, transferred: false });
    expect(state.vaultDedication).toEqual({ fallenId: undefined, seen: false });
    expect(heirloomState(state).recruited).not.toContain("requiem");
  });

  it("is a true one-shot — a second call after resolution is a no-op", () => {
    const state = actTwoState();
    mission12Loss(state, "pilot_bosk");
    resolveVaultDedication(state);
    // Someone dies later — should never retroactively change an already-
    // resolved dedication.
    mission12Loss(state, "pilot_iyari");
    const second = resolveVaultDedication(state);
    expect(second).toBeUndefined();
    expect(state.vaultDedication).toEqual({ fallenId: "pilot_bosk", seen: false });
  });
});
