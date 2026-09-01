# Build Log Addendum — Mission-Select Act-Tab Click-Through Bug, 30 Aug 2026

Maxime, live: *"there is abug when I chose mission if I scroll down the mission number and I then clic on the act pannel, i hitthe mission underneath the act panel instead of the act panel."*

## Root cause, read directly from the code, not guessed

`scenes/MapSelect.ts` — the mission-select screen. The Act tab row (one tab per `CampaignDef` in `data/allCampaigns.ts`; live since Act I/II/III all exist there now, 3 entries, `CAMPAIGNS.length > 1`) sits fixed at y~116, above the scrollable mission list (`missionListLayer`, masked to `[listTop, canvas bottom]` so a scrolled card clips at the list's own top edge).

The mask is render-only. Phaser's input plugin hit-tests every interactive object by its own bounds regardless of any `GeometryMask`, and resolves a click to whichever interactive object is **topmost in the display list** at that screen position — masked-invisible or not. The tab buttons were created (`this.add.rectangle(...).setInteractive(...)`) *before* `this.missionListLayer = this.add.container(0, 0)` in the old code, which put the tab row *earlier* in the display list. Scroll the mission list far enough (`missionListLayer.y` goes negative) and an upper mission card's rendered position moves up into the tab row's own y~116 band — invisible there thanks to the mask, but still later in the display list, so Phaser handed it the click instead of the tab sitting visually on top of it. Exactly the bug reported: click the Act panel, hit the mission card hiding underneath it.

## Fix

Reordered `create()` so `missionListLayer` is created *first*, before every fixed header control (`hangarLayer`/CAMPAIGN SHOP, the MENU overlay button, the Act tab row). Everything created after it is later in the display list and wins the hit-test in the overlap band — the exact reverse of the bug, with zero visual change (the mask already made scrolled cards invisible in that band either way; only which object *receives the click* there changes). `renderMissionList()` still just populates the same container's children — moving that call doesn't change the container's own position in the scene's display list.

## Verification

typecheck/lint/full test suite (1157/1157) all clean — this is pure UI reordering, no engine logic touched, so nothing in the existing suite exercises it either way. **Not click-tested in a live browser** — this project's own tracked Playwright gap (Consolidated Build Plan's "Cross-cutting still-open item") applies here same as every other UI fix this session; logic-traced against Phaser's actual input-priority behavior (topmost-in-display-list wins hit-testing, independent of masking) rather than assumed. Worth a real click-test once Playwright is running, same as the rest of that backlog.
