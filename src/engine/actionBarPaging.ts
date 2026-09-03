// Battle action-bar paging — 3 Sep 2026.
//
// WHAT THIS FIXES, stated precisely, because the first version of this
// comment overstated it and the corrected number is the interesting one.
//
// scenes/Battle.ts draws the selected unit's verbs into a fixed pool of six
// buttons (ACTION_SLOTS). availableActions() builds one entry per verb the
// unit's kit holds, and until this file existed the overflow handling was a
// console.warn plus `out.slice(0, ACTION_SLOTS.length)` — any seventh verb
// dropped on the floor with nothing on screen saying so.
//
// THE HONEST CURRENT STATE: nothing overflows today. The worst build a
// player can actually assemble is exactly six buttons, filling the bar to
// the last slot with zero headroom. It is NOT eight, and the earlier
// arithmetic that said so was wrong for a reason worth writing down: an
// Heirloom's abilities only ever reach its OWN wielder (Battle.ts's
// resolveDeployRoster sets heirloomAbilityRanks on that one roster entry),
// and a wielder's archetype is minted as `arch_<path>_<chassis>` with a
// chassis fixed by the Heirloom def — bipedal for nine of the ten, one
// centauroid, never vibrissal. Vibrissal is the only chassis carrying a
// third archetype verb (abil_sensor_sweep), so the "Munti Vibrissal with
// Migawari = seven buttons" case that motivated this file cannot happen.
// Checked by deriving the reachable builds from the live data rather than
// multiplying archetypes by Heirlooms, which is what produced the wrong
// number. The two builds that reach six exactly:
//   Migawari (last_word)  as arch_munti_bipedal — SCREEN + CLEAR + its own
//     three, plus the unconditional OVERWATCH. Six.
//   Surtr (cinder_line)   as arch_munti_bipedal — same shape, and Surtr is
//     an "Any"-path Heirloom, so the player chooses munti and gets there.
//
// WHY BUILD IT ANYWAY. Six of six is not "fine," it is one button of margin
// away from a silent, invisible failure, and every direction that margin
// could go is a direction this project is actively moving: ~30 Heirloom
// abilities are typed in data/heirlooms.ts and roughly half are wired into
// combat so far, with more landing most sessions; a fourth active on any
// existing kit, an Heirloom given a vibrissal chassis, a new archetype
// verb, or a second ability-granting weapon branch each take the worst
// build to seven. The failure mode is the part that makes this worth
// pre-empting rather than waiting for: the player sees no error, no
// warning, no gap — a verb they bought and ranked up in the Vault simply
// never appears, exactly like the Missiles branch granting an ability the
// bar never offered (feature-gap report A8, fixed 1 Sep 2026). That one
// took a playtester to find. So did the Munti losing FIRE before it.
//
// engine/__tests__/actionBarPaging.test.ts asserts the six-of-six figure
// against the live data every run, so the day a kit pushes it to seven the
// suite says so out loud instead of the button quietly vanishing.
//
// WHY PAGING RATHER THAN MORE SLOTS. Adding a third row of buttons moves
// the wall without removing it: the kits are ~30 abilities and growing, so
// whatever slot count gets picked today is a number some future kit
// exceeds, silently, again. Paging is correct for any count. The cost is
// one slot spent on the MORE button, and that cost is only paid when it's
// actually needed — at six verbs or fewer the bar is byte-for-byte what it
// was before this file existed, no MORE button, nothing to learn.
//
// Phaser-free on purpose, same reason as engine/hoverTipLayout.ts and
// engine/hubGeometry.ts: every file in scenes/ imports "phaser" at module
// scope, which throws outside a real browser, so nothing that lives inside
// a scene can be unit-tested. Off-by-one page math is exactly the kind of
// thing this project's own standing rule says to assert rather than
// eyeball, and the "is every verb reachable" question this file exists to
// answer is a test, not a click-through.

/** What the bar should draw right now, for one selected unit on one page. */
export interface ActionBarPage<T> {
  /**
   * The options to put in the visible slots, in slot order. Never longer
   * than the slot count, and never longer than `slotCount - 1` when
   * `hasMoreButton` is true.
   */
  items: T[];
  /**
   * True when the LAST slot is a "MORE" button rather than an action.
   * False whenever everything fits, which is the common case.
   */
  hasMoreButton: boolean;
  /** 1-based, for display ("2/3"). Always within [1, pageCount]. */
  page: number;
  /** Always at least 1, even for an empty bar. */
  pageCount: number;
  /** Slot index the MORE button occupies, or -1 when there isn't one. */
  moreSlotIndex: number;
}

/**
 * How many actions fit on one page given `slotCount` buttons and `total`
 * actions to place. Equal to `slotCount` when everything fits (no MORE
 * button needed) and `slotCount - 1` otherwise.
 *
 * Split out from pageActionBar because the page COUNT depends on it and so
 * does the slice, and computing it twice from two slightly different
 * expressions is how a bar ends up with an unreachable last action.
 */
export function actionsPerPage(slotCount: number, total: number): number {
  if (slotCount <= 0) return 0;
  if (total <= slotCount) return slotCount;
  // A one-slot bar cannot both hold an action and hold MORE. There is no
  // right answer at slotCount === 1 with overflow — either an action is
  // unreachable or MORE has nowhere to live — so this picks "every action
  // is still reachable" and lets the MORE button overlap slot 0, on the
  // grounds that a lost verb is a real bug and this case is unreachable
  // from the real bar (ACTION_SLOTS is six; the test suite pins that).
  // Clamping to 1 rather than 0 is also what keeps pageCount finite.
  return Math.max(1, slotCount - 1);
}

/**
 * Clamp a page index into range. Deliberately clamps rather than wraps:
 * this is the "the bar was on page 3 and the player just selected a unit
 * with four verbs" case, where landing on the last valid page is less
 * confusing than landing wherever a modulo puts you. Wrapping is what
 * advancePage does, and only when the player actually presses MORE.
 */
export function clampPageIndex(pageIndex: number, pageCount: number): number {
  if (!Number.isFinite(pageIndex) || pageIndex < 0) return 0;
  return Math.min(Math.floor(pageIndex), Math.max(0, pageCount - 1));
}

/**
 * The next page after pressing MORE — wraps back to the first page from the
 * last one, so MORE always does something and the player can never get
 * stranded on a page with a dead button. A cycle is also what makes the
 * single button work in both directions on a two-page bar, which is the
 * overwhelmingly common overflow case (seven or eight verbs).
 */
export function advancePage(pageIndex: number, pageCount: number): number {
  if (pageCount <= 1) return 0;
  return (clampPageIndex(pageIndex, pageCount) + 1) % pageCount;
}

/**
 * Slice `options` into what the bar should show on page `pageIndex`
 * (0-based).
 *
 * The guarantee this whole file exists for: for any `options` and any
 * `slotCount >= 1`, every element of `options` appears on exactly one page.
 * Nothing is ever dropped. `actionBarPaging.test.ts` asserts that against
 * the live archetype and Heirloom data, not just against made-up counts.
 */
export function pageActionBar<T>(options: readonly T[], slotCount: number, pageIndex: number): ActionBarPage<T> {
  if (slotCount <= 0) {
    return { items: [], hasMoreButton: false, page: 1, pageCount: 1, moreSlotIndex: -1 };
  }
  const perPage = actionsPerPage(slotCount, options.length);
  const pageCount = Math.max(1, Math.ceil(options.length / perPage));
  const safeIndex = clampPageIndex(pageIndex, pageCount);
  const hasMoreButton = options.length > slotCount;
  return {
    items: options.slice(safeIndex * perPage, safeIndex * perPage + perPage),
    hasMoreButton,
    page: safeIndex + 1,
    pageCount,
    moreSlotIndex: hasMoreButton ? slotCount - 1 : -1,
  };
}

/**
 * The label for the MORE button. Carries the page counter because a button
 * that just says "MORE" gives the player no idea whether pressing it is
 * about to show them two more verbs or ten, and no idea that pressing it
 * again comes back here.
 */
export function moreButtonLabel(page: number, pageCount: number): string {
  return `MORE ${page}/${pageCount}`;
}
