# Squad Composition, Deploy Caps, and Lance Integration

## The three lances, tied to Rourke's rank

Original plan, confirmed and corrected in-doc 25 Aug (the Independent Campaign doc's §6/§9/§10 had said ~20 pilots/4 lances — wrong): 1 lance fielded in Act I, 2 in Act II, 3 in Act III, matching Rourke's own rank progression and the difficulty curve.

- **Warden Company** (5 pilots) — the whole Act I roster. `ACT1_DEPLOY_CAP = 5`, no real composition choice yet.
- **Second Lance** (Okafor, Solheim, Vashti — 3 pilots) — integrates via `integrateSecondLance()` on Mission 12's win. `ACT2_DEPLOY_CAP = 8`. `ACT2_DEFAULT_SQUAD` is all 8.
- **Third Lance** (Kova, Ness, Onwuka, Delgado, Yeun — 5 pilots) — integrates via `integrateThirdLance()` on Mission 24's win, completing the 4-path × 3-chassis archetype grid (Delgado is the first pilot in the campaign on the Quartermaster mek track). `ACT3_DEPLOY_CAP = 12` (of 15 total). `ACT3_DEFAULT_SQUAD` fields 12, benching Tarrant/Reyes/Ness.

Both integration functions are idempotent and free, same shape as the Munti guarantee — can't fail, can't double-add.

## `deployCapForMission` and `TransporterPad.ts`

Branches by act to enforce the right cap. A real softlock was found and fixed here 25 Aug: the no-picker fast path (fires whenever losing-one/gaining-one keeps the roster at exactly the deploy cap) was reading the mission's hardcoded static pilot list instead of the live, status-filtered roster — so a permanently-lost pilot's card kept rendering (looking completely normal) while a freshly-generated replacement never appeared anywhere, and the deploy gate correctly-but-silently refused to launch. Fixed by reading `activePilotIds` on that path too.

## Retuning cost of a bigger squad (Act III)

Confirmed directly rather than assumed: a 12-pilot squad clears faster and absorbs more damage than the 8-pilot squads most of the campaign was tuned against. Missions 25/26/28 needed real retuning once Act III's roster came online — Mission 26 in particular went from unwinnable-at-12 (map corridor too narrow, units gridlocking each other) to reverting cleanly to its original 8-pilot squad rather than forcing the full 12 through a 3-tile-wide corridor. See those missions' own files.

Full narrative: archive, "batch 2... squad composition," "batch 6... Third Lance built," and "TransporterPad softlock" addenda.
