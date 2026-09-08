# Build Log Addendum — Shop Weapon Branch Row / Convert-All Collision, 5 September 2026

Real bug, found by actually looking — the exact gap the Combat Medic addendum (same day, earlier) flagged as still open: "nobody has watched this render in a real Shop screen." Maxime got the dev server running on his own machine and handed me Chrome access to go check it live. First click on the 4th Munti branch button broke.

## What was actually broken

`ShopPanel.ts`'s per-pilot Shop card draws two things on the same row: the weapon-branch buttons (1-4 of them depending on class) starting from the card's left edge, and a "Convert to company" button at a FIXED position (`SHOP_CARD_R - 104`) meant to always sit clear to the right of them. That fixed position was never wrong — it was just derived assuming at most 3 branch buttons, which was true of every class until tonight. 3 buttons at the old 210px width / 216px pitch reach x=686; Convert-All starts at x=741, comfortable margin. Combat Medic made Munti the first real 4-branch class, and button 4 at that same pitch reaches x=902 — 161px into Convert-All's own footprint.

That overlap wasn't just cosmetic. Two different failures came out of it, both reproduced live in this session, not just read off a screenshot:

- An **owned** 4th-slot button (equip/equipped) is always interactive — `makeShopButton(..., true, ...)`, no affordability check — so it permanently sits on top of Convert-All and eats every click meant for it. Any Munti who owns all 4 branches loses access to Convert-All for that pilot, for good, with no workaround in the UI.
- An **unowned, unaffordable** 4th-slot button has no interactive zone at all — `makeShopButton` returns before `setInteractive` when `enabled` is false — so the click falls straight through it onto Convert-All underneath. This is exactly what happened testing tonight: clicked "BUY Combat Medic (220)" on Spec. Corin Lask (176 personal points, short of the 220 cost), and it silently ran Convert All instead — personal points 176 → 0, company points +88, no branch purchased, no error, no indication anything but the intended purchase happened.

Confirmed live in Chrome (screenshot + zoom on the button row) before touching any code, then confirmed again in code: `ShopPanel.ts` lines ~596 (`convertX`) and ~630 (`BRANCH_BTN_W = 210`, `bx += 216`) — two independent constants that only happened to agree with each other by coincidence, for as long as no class had more than 3 branches.

## The fix

`ShopPanel.ts`, `drawPilotRow` — the weapon-branch row now sizes itself to whatever's actually being drawn, capped at the original 210px, instead of using a flat constant:

```ts
const BRANCH_ROW_GAP = 6;
const BRANCH_ROW_SAFETY_MARGIN = 20; // breathing room before Convert-to-company's own left edge
const branchRowRightBound = convertX - 85 - BRANCH_ROW_SAFETY_MARGIN;
const branchRowAvailW = branchRowRightBound - (SHOP_CARD_L + 14);
const fitWidth = Math.floor((branchRowAvailW - BRANCH_ROW_GAP * (buildable.length - 1)) / buildable.length);
const BRANCH_BTN_W = Math.min(210, fitWidth);
const BRANCH_BTN_PITCH = BRANCH_BTN_W + BRANCH_ROW_GAP;
```

For 1-3 branches (every class but Munti, today) this computes to exactly 210/216 — the math works out to more available space than the cap allows, so `Math.min` picks 210 every time. Zero pixel change for Meeps, Tank, Reeps, or Munti's own first 3 branches. Only a class with a genuine 4th branch ever gets a narrower button — currently just Munti, until Meeps/Tank's own 4th-slot question gets answered one way or the other. If they do get one later, this fix already covers it; nothing else to revisit.

## Verification

`tsc --noEmit`, `eslint .`, `lint-cast-collision.mjs`, `vite build`, `vitest run` — all clean, same 94 files / 2221 tests as this afternoon's Combat Medic build (this fix touches only rendering/layout code with no dedicated unit tests — the bug it fixes wouldn't have been caught by the automated gate either way, which is worth sitting with: this class of bug is Chrome-shaped, not tsc-shaped). Committed to the device (`ShopPanel.ts`, mtime-checked clean, no drift).

Then re-verified live, post-fix, in the same Chrome session:
- Corin Lask's row (4 buttons + Convert-All) now renders with clean, visible gaps between all 5 elements — zoomed screenshot confirms no overlap.
- Re-clicked the same spot that triggered the accidental convert — this time it's a genuine no-op, personal points stayed at 176. The fall-through is gone.
- Did not re-verify the positive "click an affordable BUY and it actually purchases" path live — no pilot on hand had enough personal points to afford any branch at the time, and that code path (`purchaseWeaponBranch`) wasn't touched by this fix at all, only the button's screen position and interactive-zone sizing were.

One more thing worth naming plainly: the accidental Convert-All from testing (Corin Lask, 176 → 0 personal / +88 company) did **not** persist — reloading via Continue brought personal points back to 176, meaning the game's autosave hadn't caught that action yet. No real damage to the save, but flagging it since it happened on Maxime's actual campaign file, not a throwaway test save.

## Still open

- Meeps/Tank's 4th-branch question is still Maxime's own call, not resolved by this fix — this just means whichever way that goes, the Shop won't silently break again.
- `lint-spoiler` still needs Maxime's own machine (unchanged standing gap — this fix added zero new strings, purely numeric/layout logic).
