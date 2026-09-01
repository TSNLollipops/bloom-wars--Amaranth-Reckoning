# Build Log Addendum — Tab-to-Cycle Unit Selection (30 Aug 2026)

Maxime, live: *"we could prolly instil some kinda way to mvoe easily
between mech like in xcom."*

## What existed before

Selecting a unit in Battle only ever happened by clicking its tile on the
board (`handleBoardClick`, `scenes/Battle.ts`). No keyboard cycling, no
clickable roster/portrait row — the HUD's own "standing tallies" section is
text-only (overwatch/concealed/interdicted/painted-contact counts), nothing
per-unit-clickable. This is genuinely new UX, not a bug fix, matching this
session's own "scope before building" discipline for feature-shaped asks.

## What shipped

`[Tab]` / `[Shift+Tab]` cycles the player's selectable units, mirroring
XCOM's own "next/previous soldier with actions left" binding — the same
well this project already reached into once this session for `[Space]` to
end turn (`doEndTurn`'s own comment: "Maxime reached for it before checking
whether it existed").

Eligibility is the exact same guard the click-select branch already uses:
`side === "player"`, not `downed`/`npcIncapacitated`/`isCivilian`,
`actionsRemaining > 0`. A unit that's already spent its turn is skipped,
same as XCOM greying out a finished soldier. Order follows
`mission.livingUnits()`'s own order (deployment order, stable across a
turn) so repeated presses step through the squad the same way every time.
No current selection starts at the first eligible unit; already at the last
one wraps around.

A static `[tab] next mech` hint sits below the `END TURN [space]` button —
deliberately not routed through the Mission 1 tutorial-hint flow
(`tutorialHasSelected` etc.), since there's no natural one-shot trigger
condition for it; it's meant to sit there as a standing reminder, the way a
real XCOM HUD keeps its own hotkey legend on screen rather than teaching it
once.

## Scope notes

- No camera panning was needed — the board has no scroll/pan system at all
  (confirmed before building), so cycling just needs to update the
  selection and refresh highlights, identical to what a click already does.
- Nothing about combat balance, targeting, or the action bar changed —
  this only touches which unit gets selected and when.

## Verification

- `npm run typecheck` / `npm run lint` / `npm test` all clean (1163/1163 at
  the time this landed).
- Logic-traced against the existing click-select code path line by line,
  not click-tested — same standing gap this session's MapSelect.ts
  addendum already flagged: no Playwright/browser automation available in
  this sandbox to actually press Tab in a running build and watch it work.
