# Build Log Addendum — Hangar panel depth fix + Hold Zone visibility (30 Aug 2026)

Follows the same-day addendum on the hangar click-passthrough bug and the Mission 12 investigation. Two more things came out of Maxime's follow-up reports.

## Part 1 — the hangar panel's washed-out look: a second, separate bug

Maxime's screenshot showed the panel readable in outline (title, borders, close button) but every actual row of content faded almost to nothing. This is not the same bug as the earlier click-passthrough fix — that one was about which handler *received* a click; this one is about what actually *painted* on screen, and both needed fixing.

**Root cause:** `ShopPanel`'s own two content containers (`shopLayer`, `navLayer`) are created with no explicit depth, defaulting to 0 — invisible to its other two callers (Hangar.ts, Debrief.ts), since each of those dedicates its whole scene to the panel and nothing else competes for depth there. Hub.ts is different: its own `hangarShopOverlay` container (the title/border/close-button chrome) sits at depth 60 with a near-opaque (0.97 alpha) background rectangle. With ShopPanel's real content stuck at depth 0, that background painted almost entirely over it — every roster row, stat, and button was rendering *behind* a near-opaque veil, showing through only as a faint ghost. Confirmed by reading both files together, not guessed from the screenshot alone.

**Fix:** added a small `ShopPanel.setDepth()` method (same shape as the `setVisible()` method Tier 4 already added for this exact "shared component, one caller needs extra control" situation), and Hub.ts now calls `this.hangarShop.setDepth(61)` once, right after construction — one above the overlay's own depth, enough to clear it. A no-op for Hangar.ts/Debrief.ts, since neither calls it.

**Verification:** typecheck/lint clean, 1140/1140 tests passing. Still not click-tested live (Hub.ts's own standing Playwright gap), but this one is a straightforward depth-ordering fix with a clearly identified mechanism, not a judgment call.

## Part 2 — "i reach turn 16 and it give me mission failed, no unit died, i cleared lot of bloom"

This turned out to be a real, separate finding from the Mission 12 commander-focus-fire mechanism reported earlier — and a much more direct explanation for "reached the turn limit with nobody dead and still lost."

**Traced through `engine/mission.ts`'s `checkWinLoss`:** `hold_zone`'s actual win condition is a live snapshot — a player unit standing *on* the map's hold-zone tile(s), with no hostile also standing on them, checked fresh every time `checkWinLoss` runs, starting at `holdUntilTurn`. It doesn't need to be held continuously, just true at least once in that window. Losing outright happens on the `turn > turnLimit` branch if that snapshot never once came true.

**The actual bug: nothing on screen ever showed this.** Grepped the entire live battle scene (`scenes/Battle.ts`) for any reference to the hold zone at all — zero matches. No tile highlight showing where it is, no status readout showing whether it's currently held, contested, or empty. A player who spends the mission doing exactly what the game otherwise rewards — hunting down and clearing Bloom — has no way to know they also need to physically stand a unit on one specific, otherwise-unmarked tile, or that an enemy standing there blocks the win even if a player unit is there too. "No unit died, I cleared lot of bloom, mission failed" is exactly what that gap produces: doing everything the mission visibly asks for and losing anyway on a condition nothing ever surfaced.

**Fix — two additions, following patterns this file already established for other objective types (Protect Asset's always-on ship-HP line was the direct model):**

- **On the map:** the hold-zone tile(s) now carry a persistent teal outline (a hue not used by any other highlight on the board), always visible — not gated behind selecting a unit, since this is core objective state, not an action preview, same reasoning Protect Asset's HP line already used. The fill color reports live status without needing to cross-reference the HUD: green once the win condition is currently true, red while a hostile occupies the zone, dim teal otherwise.
- **In the HUD panel:** a new always-visible line, `Hold Zone (teal tile(s)): <status>`, cycling through "standing by (holds from turn N)" / "HELD — objective clear" / "CONTESTED — a hostile is on the zone" / "EMPTY — no one is standing on it" — text-equivalent to the map color, so a player reading only the HUD (or not distinguishing the colors) gets the same information.

This applies to every `hold_zone` mission in the campaign (Missions 7, 12, 33, 35, and any others using that objective type), not just Mission 12 — the gap was structural (nothing in Battle.ts ever handled this objective type's own state), not mission-specific.

**Verification:** typecheck/lint clean, 1140/1140 tests passing. This is new UI, not new engine logic — `checkWinLoss` itself is untouched, so no sim/balance impact; this only makes visible what the engine was already deciding. Same standing Playwright caveat as every other Battle.ts/Hub.ts visual change this session — logic-traced, not click-tested live yet.

**Mission 12's commander-focus-fire finding (previous addendum) is still open and unrelated to this fix** — that one's about turn 4's Choir+Splitfang alpha strike on the commander specifically, a different failure mode from reaching turn 16 without ever having stood on the zone. Both can be true at once; this pass only closes the second one.
