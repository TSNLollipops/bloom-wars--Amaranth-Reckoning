// Battle action-bar paging (3 Sep 2026). See engine/actionBarPaging.ts's
// own header for why the bar needed paging at all: six fixed slots, kits
// that already push eight buttons, and an overflow path that used to drop
// the extras with nothing but a console.warn.
//
// Two halves here, and the second one is the one that matters. The first
// asserts the page math in isolation. The second reads scenes/Battle.ts's
// OWN source, extracts the exact list of abilities that get a button, and
// checks against the live archetype/Heirloom/weapon-branch data that every
// one of those buttons is reachable for every unit that could ever hold
// them. That's the regression this file exists to prevent, and it can't be
// written any other way — Battle.ts imports "phaser" at module scope, so a
// test can't import it and call availableActions() directly.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  pageActionBar,
  actionsPerPage,
  clampPageIndex,
  advancePage,
  moreButtonLabel,
} from "../actionBarPaging";
import { UNIT_ARCHETYPES } from "../../data/units";
import { HEIRLOOMS } from "../../data/heirlooms";
import { MISSILE_GRANT_ABILITY, MASER_LANCE_GRANT_ABILITY } from "../../data/weaponBranches";

/** The real bar. Kept in sync with scenes/Battle.ts's ACTION_SLOTS by the last test below. */
const SLOTS = 6;

describe("pageActionBar", () => {
  it("changes nothing at all when every action fits", () => {
    for (let n = 0; n <= SLOTS; n++) {
      const opts = Array.from({ length: n }, (_, i) => `a${i}`);
      const p = pageActionBar(opts, SLOTS, 0);
      expect(p.items).toEqual(opts);
      expect(p.hasMoreButton).toBe(false);
      expect(p.moreSlotIndex).toBe(-1);
      expect(p.pageCount).toBe(1);
      expect(p.page).toBe(1);
    }
  });

  it("spends the last slot on MORE only once there is genuine overflow", () => {
    expect(pageActionBar(Array(SLOTS).fill("x"), SLOTS, 0).hasMoreButton).toBe(false);
    const over = pageActionBar(Array(SLOTS + 1).fill("x"), SLOTS, 0);
    expect(over.hasMoreButton).toBe(true);
    expect(over.moreSlotIndex).toBe(SLOTS - 1);
    expect(over.items).toHaveLength(SLOTS - 1);
  });

  it("never drops an action, for any count and any slot count", () => {
    for (let slots = 1; slots <= 8; slots++) {
      for (let n = 0; n <= 40; n++) {
        const opts = Array.from({ length: n }, (_, i) => i);
        const first = pageActionBar(opts, slots, 0);
        const seen: number[] = [];
        for (let page = 0; page < first.pageCount; page++) {
          seen.push(...pageActionBar(opts, slots, page).items);
        }
        expect(seen.slice().sort((a, b) => a - b)).toEqual(opts);
        expect(seen).toHaveLength(n); // no duplicates either — exactly one page each
      }
    }
  });

  it("never puts more items in a page than there are drawable slots", () => {
    // From 2 slots up. At exactly 1 slot an overflowing bar has no way to
    // hold both an action and MORE; actionsPerPage() documents the choice
    // it makes there, and the degenerate test below pins it.
    for (let slots = 2; slots <= 8; slots++) {
      for (let n = 0; n <= 40; n++) {
        const opts = Array.from({ length: n }, (_, i) => i);
        const p = pageActionBar(opts, slots, 0);
        const drawable = p.hasMoreButton ? slots - 1 : slots;
        expect(p.items.length).toBeLessThanOrEqual(drawable);
      }
    }
  });

  it("clamps an out-of-range page instead of blanking the bar", () => {
    const opts = Array.from({ length: 8 }, (_, i) => i);
    const p = pageActionBar(opts, SLOTS, 99);
    expect(p.page).toBe(p.pageCount);
    expect(p.items.length).toBeGreaterThan(0);
    expect(pageActionBar(opts, SLOTS, -3).page).toBe(1);
  });

  it("wraps back to the first page so MORE is never a dead button", () => {
    expect(advancePage(0, 2)).toBe(1);
    expect(advancePage(1, 2)).toBe(0);
    expect(advancePage(2, 3)).toBe(0);
    expect(advancePage(0, 1)).toBe(0); // single page: pressing it changes nothing
  });

  it("degenerate slot counts stay finite rather than looping forever", () => {
    expect(actionsPerPage(0, 5)).toBe(0);
    expect(actionsPerPage(1, 5)).toBe(1);
    expect(pageActionBar([1, 2, 3], 0, 0).pageCount).toBe(1);
    expect(clampPageIndex(Number.NaN, 3)).toBe(0);
    // One slot, three actions: three pages of one, so nothing is lost —
    // MORE overlapping the only slot is the price, and it is not a case
    // the real six-slot bar can reach.
    const one = pageActionBar([1, 2, 3], 1, 0);
    expect(one.pageCount).toBe(3);
    expect(one.items).toEqual([1]);
    expect(one.hasMoreButton).toBe(true);
  });

  it("labels MORE with the page counter", () => {
    expect(moreButtonLabel(1, 2)).toBe("MORE 1/2");
  });
});

// ---------------------------------------------------------------------------
// The real guard: no unit in the game can hold a verb the bar can't reach.
// ---------------------------------------------------------------------------

const BATTLE_SRC = readFileSync(fileURLToPath(new URL("../../scenes/Battle.ts", import.meta.url)), "utf8");

/**
 * Every ability id that earns its own action-bar button, read out of
 * Battle.ts's availableActions() rather than duplicated here by hand — a
 * hand-kept copy would go stale the first time an ability is added, which
 * is the exact failure mode this test exists to catch.
 */
function abilitiesWithButtons(): Set<string> {
  const start = BATTLE_SRC.indexOf("private availableActions()");
  const end = BATTLE_SRC.indexOf("private runActionSlot(", start);
  expect(start, "availableActions() not found in Battle.ts — this test needs renaming").toBeGreaterThan(-1);
  expect(end, "runActionSlot() not found after availableActions() in Battle.ts").toBeGreaterThan(start);
  const body = BATTLE_SRC.slice(start, end);
  const ids = new Set<string>();
  for (const m of body.matchAll(/unit\.abilities\.includes\("([a-z_0-9]+)"\)/g)) ids.add(m[1]);
  return ids;
}

/** OVERWATCH is pushed unconditionally for every unit, before any ability check. */
const ALWAYS_PRESENT_ACTIONS = 1;

const PATHS = ["meeps", "tank", "reeps", "munti"] as const;

/**
 * Every kit a player can actually put on one unit, derived the way the game
 * derives it rather than by multiplying archetypes by Heirlooms.
 *
 * The distinction is the whole reason this helper exists. An Heirloom's
 * abilities reach only its own wielder (Battle.ts resolveDeployRoster), and
 * that wielder's archetype is minted as `arch_<path>_<chassis>` from the
 * Heirloom def's own fixed chassis (engine/heirlooms.ts mintAristocrat) —
 * so most archetype x Heirloom pairs are not builds at all. An earlier
 * version of this test took the cross product and reported a worst case of
 * eight buttons; the real figure is six. Getting that wrong in the safe
 * direction still would have been getting it wrong.
 */
/**
 * Every ability-granting weapon branch reachable on `path`, as (label
 * suffix, granted ability id) pairs, always including the no-branch case
 * (empty suffix, no id) first. Two such branches exist now — reeps_missiles
 * (5 Sep 2026's Maser Lance is the second, per that branch's own header
 * comment in data/weaponBranches.ts) — each reachable on exactly one path,
 * so a build never needs to consider two grants at once, but this stays a
 * list rather than an if/else specifically so a THIRD grant only needs one
 * more entry here, not a new nested loop.
 */
function grantedAbilityOptionsFor(path: string): Array<{ suffix: string; abilityId: string | null }> {
  const options: Array<{ suffix: string; abilityId: string | null }> = [{ suffix: "", abilityId: null }];
  if (path === "reeps") options.push({ suffix: " + Missiles", abilityId: MISSILE_GRANT_ABILITY });
  if (path === "tank") options.push({ suffix: " + Maser Lance", abilityId: MASER_LANCE_GRANT_ABILITY });
  return options;
}

function reachableBuilds(buttons: Set<string>): Array<{ label: string; verbs: Set<string> }> {
  const out: Array<{ label: string; verbs: Set<string> }> = [];
  for (const h of Object.values(HEIRLOOMS)) {
    const heirloomVerbs = h.abilities.map((ab) => ab.id).filter((x) => buttons.has(x));
    const chassis = h.pilot?.chassis ?? "bipedal";
    for (const path of h.path ? [h.path] : PATHS) {
      const archetypeId = `arch_${path}_${chassis}`;
      const arch = UNIT_ARCHETYPES[archetypeId];
      if (!arch) continue; // mintAristocrat refuses this pairing too
      const archVerbs = (arch.abilities ?? []).filter((x) => buttons.has(x));
      for (const { suffix, abilityId } of grantedAbilityOptionsFor(path)) {
        const verbs = new Set([...archVerbs, ...heirloomVerbs]);
        if (abilityId) verbs.add(abilityId);
        out.push({ label: `${h.id} as ${archetypeId}${suffix}`, verbs });
      }
    }
  }
  // Plus every ordinary (non-Heirloom) pilot, who can still hold a branch.
  for (const arch of Object.values(UNIT_ARCHETYPES)) {
    const archVerbs = (arch.abilities ?? []).filter((x) => buttons.has(x));
    for (const { suffix, abilityId } of grantedAbilityOptionsFor(arch.path)) {
      const verbs = new Set(archVerbs);
      if (abilityId) verbs.add(abilityId);
      out.push({ label: `${arch.id}${suffix}`, verbs });
    }
  }
  return out;
}

describe("action bar reachability against the live data", () => {
  const buttons = abilitiesWithButtons();

  it("finds the button list in Battle.ts at all", () => {
    expect(buttons.size).toBeGreaterThan(10);
    expect(buttons.has("abil_sensor_sweep")).toBe(true);
    expect(buttons.has(MISSILE_GRANT_ABILITY)).toBe(true);
    expect(buttons.has(MASER_LANCE_GRANT_ABILITY)).toBe(true);
  });

  it("Battle.ts still draws exactly SLOTS buttons", () => {
    // If ACTION_SLOTS grows or shrinks, the counts below stop meaning
    // anything, so fail loudly here rather than quietly passing.
    const slotBlock = BATTLE_SRC.slice(BATTLE_SRC.indexOf("const ACTION_SLOTS: Coord[] = ["));
    const literal = slotBlock.slice(0, slotBlock.indexOf("];"));
    expect(literal.match(/\{ x:/g) ?? []).toHaveLength(SLOTS);
  });

  it("every verb of every build a player can actually assemble is reachable", () => {
    for (const build of reachableBuilds(buttons)) {
      const count = ALWAYS_PRESENT_ACTIONS + build.verbs.size;
      const options = Array.from({ length: count }, (_, i) => i);
      const seen: number[] = [];
      const pages = pageActionBar(options, SLOTS, 0).pageCount;
      for (let p = 0; p < pages; p++) seen.push(...pageActionBar(options, SLOTS, p).items);
      expect(seen.slice().sort((x, y) => x - y), `unreachable action for ${build.label}`).toEqual(options);
    }
  });

  it("the worst real build is exactly six buttons — no headroom left", () => {
    // This number is the argument for the paging existing, so it is pinned
    // rather than described. It is EXPECTED to break: the moment an
    // Heirloom kit gains a fourth active, or one is given a vibrissal
    // chassis, or a second ability-granting weapon branch ships, this
    // assertion fails and whoever is reading the failure learns that the
    // MORE button just went live in real play — which is the announcement
    // that used to be a silently missing button. Raise the number here,
    // don't delete the test.
    const worst = reachableBuilds(buttons).reduce(
      (best, b) => (ALWAYS_PRESENT_ACTIONS + b.verbs.size > best.count ? { count: ALWAYS_PRESENT_ACTIONS + b.verbs.size, label: b.label } : best),
      { count: 0, label: "" },
    );
    expect(worst.count, `worst real build is ${worst.label}`).toBe(SLOTS);
  });

  it("names the builds that sit at the limit, so a change to any of them is visible", () => {
    // A third build joined the original two here 5 Sep 2026: Maser Lance
    // (Tank's own granted-ability branch) equipped on cinder_line's
    // Tank-chassis wielder reaches the same six-button ceiling, without
    // exceeding it. Still worth naming — one more active landing on either
    // this build or the original two tips it into the MORE button, same
    // "no headroom left" warning the test above already gives, now with a
    // second Heirloom to watch alongside last_word.
    const atLimit = reachableBuilds(buttons)
      .filter((b) => ALWAYS_PRESENT_ACTIONS + b.verbs.size === SLOTS)
      .map((b) => b.label)
      .sort();
    expect(atLimit).toEqual(["cinder_line as arch_munti_bipedal", "cinder_line as arch_tank_bipedal + Maser Lance", "last_word as arch_munti_bipedal"]);
  });
});
