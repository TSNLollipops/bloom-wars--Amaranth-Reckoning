# Build Log Addendum — Hangar Deck sidebar shop clipped by the OVERHEARD dock (4 Sep 2026)

## What happened

Maxime sent a phone photo of his live game (Hangar Deck, Personal Shop) showing what looked like a clipped "CONVERT ALL (1..." button and an "OVERHEARD" chat panel overlapping the shop cards.

First pass got it wrong. I tested the *standalone* `Hangar` scene (the one you reach via Map Select — a menu-driven flow with a full 1074px-wide camera and no chat dock) and it looked completely clean even at absurd point values, so I told him it was a photo-framing artifact. That answer was wrong because it tested the wrong screen.

Maxime corrected it: he'd opened the shop from inside the walkable Hub — the Hangar Deck room's own terminal — not from the menu. That's a different code path (`Hub.ts`'s `openHangarShop()`), reusing the same `ShopPanel` class but hosted inside the Hub scene, which is not full-width.

## Root cause

`Hub.ts` added a second camera for the OVERHEARD chat dock a few days after the Hangar Shop overlay first shipped (30 Aug). That change narrowed Hub's own **main camera viewport** to 0–838px (see `DOCK_SPLIT_X` in `Hub.ts`), leaving the dock the remaining 838–1074px on its own camera. Every other Hub overlay (Vault, Workshop, History, Highlights, Peg Board, Poker, Darts) was already sized to `ROOM_BOUNDS` (130–830), so none of them noticed. The Hangar Shop overlay wasn't touched — it still used `ShopPanel`'s native 900px-wide card layout (`SHOP_CARD_L/R` = 30–930), built for `Debrief.ts`/`Hangar.ts`, both of which really do have a full 1074-wide camera with nothing else on screen.

The result: the personal-points readout and the entire "Convert to company" button sat past x=838. Hub's main camera simply stops drawing there — it's not a mask or an opacity thing, the viewport rectangle ends — and the dock's own camera draws the chat log in that same screen region. Live-verified: forcing `personalPoints` to 999,999 and screenshotting the *standalone* Hangar scene showed the button rendering fine (wraps to 2 lines at that extreme, still fully inside the canvas); doing the same via `Hub.openHangarShop()` showed the readout and button hard-cut at x≈838 with the dock sitting right there. Confirms it wasn't the photo.

This is also a real gap in the UI sweep (`sweepUi.mjs`/`auditUiText.mjs`) built earlier this week: its OFFSCREEN check compares against the 1074×640 **canvas**, not a scene's own (possibly narrower) main-camera **viewport**. The sweep's own save file has every pilot at 0 personal points too, so even a longer test string never got exercised. The full 28-screen sweep re-run after this fix shows 0 findings either way — it wouldn't have caught this bug before the fix, and doesn't need to catch anything now that it's fixed. Worth fixing that blind spot in the audit tool at some point; not done today.

## Fix

Added `ShopPanel.fitWidth(maxRight)` — a uniform scale-down of the panel's two internal layers (`shopLayer`, `navLayer`), anchored on the panel's own horizontal center (480) and top edge, called once by `Hub.ts` right after constructing its `ShopPanel` instance: `this.hangarShop.fitWidth(ROOM_BOUNDS.right)`. This brings the shop's cards to exactly the same 130–830 box every other Hub overlay already uses. `Debrief.ts` and `Hangar.ts` are untouched — they never call `fitWidth`, so their layout is pixel-identical to before.

Also fixed: `Hub.ts`'s own overlay chrome (the framing background rectangle and the "[close — Esc]" button), which is built directly in `buildHangarShopOverlay()` and is *not* part of `ShopPanel` — it had the exact same 900-wide assumption baked in independently and needed its own, separate fix (now uses `ROOM_BOUNDS` too).

**Trade-off, stated plainly:** fitting a 900-wide panel into a 700-wide box is a real ~22% shrink (scale factor 350/450 ≈ 0.778), not a cosmetic nudge — an 8px label renders around 6px. Screenshotted at a realistic 1,234 personal points and it reads fine in practice, but it's smaller than the same screen in the menu-driven Hangar flow. If that turns out to bother anyone in actual play, the real fix is giving this one host a native narrower layout instead of scaling a wide one down — more work (touches shared layout math three scenes depend on), not done today, `fitWidth` exists specifically so that's an easy A/B rather than the only option committed to.

## Verification

- `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` (1968 tests) — all clean.
- `npx vite build` — clean.
- `checkUiAuditSelfTest.mjs` — still passes (unrelated to this bug, re-run because Hub.ts changed).
- Full 28-screen `sweepUi.mjs` re-run — 0 findings, 0 skipped, 0 console errors.
- New standing check: `tools/verify/checkHangarShopFitsDock.mjs` — forces personalPoints to 999,999, opens the Hangar Shop from inside the Hub, and asserts the rightmost label stays clear of `DOCK_SPLIT_X` (838). This is the check that would have caught the original bug and will catch a regression of this specific class. Currently passes with ~18px of clearance.

## Files changed

- `src/scenes/shop/ShopPanel.ts` — added `fitWidth()`.
- `src/scenes/Hub.ts` — calls `fitWidth()`, resized its own overlay chrome to `ROOM_BOUNDS`, dropped the now-unused `SHOP_CARD_W`/`SHOP_CARD_R` import.
- `tools/verify/checkHangarShopFitsDock.mjs` — new, cloud-sandbox-only regression check.

No GDD/Data Pack/Build Brief change needed — this is a rendering bug fix, not a design decision.
