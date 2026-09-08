# Build Log Addendum — Recruit your own lance, five lance slots, earned callsigns

**5 Sep 2026.** Claude (Cowork session). Shipped to `lorian-pc`. Gate green: `tsc`, `eslint`, cast-collision, **92 files / 2196 tests**, `vite build`. Live: `checkRecruitLance.mjs`, plus `checkRosterPanel.mjs` and `checkMemorial.mjs` still passing.

Two asks, same session, both structural:

> *"maximum number of lance total is 5 because i want to plan ahead for gladiator. current number of lance in the carrier per act is 1. so it only grow at 3."*

> *"player should recruit their lance teamate not have a team be creste for them"*

---

## 1. Five lance slots, three live

`LanceId` now carries five ids (a–e), sized for Gladiator, where lances are the activation unit (30 mechs = 6 lances of 5) and the fleet grows to 5 carriers. How many lances a carrier *has* is separate: `lanceCount()` / `activeLanceIds()`, one granted per act, so this campaign grows 1 → 2 → 3 and stops. The roster panel and the Transporter Pad quick-pick show only real lances; 4th and 5th never appear. Assigning into an ungranted lance is refused by name.

**`MAX_LANCE_SIZE` (5 pilots per lance) and `MAX_LANCES` (5 lances per carrier) are the same number and completely different facts.** Documented apart and tested apart, because that collision will otherwise bite someone.

Lances d/e have nowhere to live on this carrier — three workshops and three berth rooms physically exist — so those maps became `Partial` with a documented fallback to 1st Lance's rooms. A future 4th lance bunks with 1st rather than crashing on an undefined room id.

---

## 2. Lances arrive empty; you recruit them

`integrateSecondLance` / `integrateThirdLance` used to hand over five finished pilots. They now grant an **empty** lance. Rourke's promotion still fires from both — the rank comes from commanding a second lance, not from who is standing in it.

**The ten authored 2nd/3rd Lance pilots became the recruit pool** rather than being deleted. Okafor, Solheim, Tarrant, Vashti, Reyes, Kova, Ness, Onwuka, Delgado, Yeun are real written characters with names, callsigns and authored Meks — recruiting draws from them first, so you still choose your squad and none of that writing is wasted. A campaign where Solheim never signed on is a different campaign. Once the pool is dry, hiring generates pilots instead.

**Recruiting lives in ROSTER & GEAR** (Maxime's call), on the existing ShopPanel recruit card, reusing `DISCRETIONARY_RECRUIT_COST`. The card now has a lance selector (only lances with an opening are pickable) and a candidate list you sign by name, plus the original class buttons for a generic hire.

### Why the dialogue survived

The worry was the writing. Measured before building rather than guessed:

| | total | naming a specific pilot |
|---|---|---|
| briefings | 36 | 8 |
| dialogue lines | 49 | **42** |

Most-named: **Anand 25, Rourke 14, Bosk 6**, then Okafor 3 and Solheim 2. Anand, Rourke and Bosk are all **1st Lance**, which stays authored and granted — so 45 of the 49 mentions are untouched. Only Okafor's 3 lines and Solheim's 2 can now reference someone who was never recruited.

**Those 5 lines are the one open content item from this pass.** Not rewritten here — that's Maxime's prose, and the fix is either a small rewrite or a runtime speaker fallback, which is a decision, not a chore.

The social sim needed nothing: ambient lines, banter, hot topics, small talk, romance and toxic pairs are all driven by catalyst personalities, with near-zero hardcoded pilot ids. A recruit slots straight in.

---

## 3. Callsigns are earned, not issued

Maxime: *"Allow recruit to gain callsign via actions."*

`PilotRecord.callsign` is new and optional. A **generated** recruit joins as `Cpl. Vera Okonkwo` — a real rank and name from a pool, replacing the old `Recruit "Sprocket"` placeholder — and earns a callsign **on their first kill**, at which point their name becomes `Cpl. Vera Okonkwo — "Tinder"`. Debrief shows a callout for it: *"THE CREW HAS A NAME FOR THEM NOW."*

`awardCallsign` no-ops for anyone who already has one, which means the ten authored candidates arrive already named. Okafor has been "Ledger" since before the player met him, and this must never rename him. That distinction is the rule, not an accident: **written characters come as written; anonymous recruits earn their name.**

Name pools are deliberately plain lists — Maxime: *"Itl be ultimately part of the creator editor"* — so that editor can replace them without touching logic.

---

## 4. Two real bugs this pass caught

**A rank regression I introduced and nearly shipped.** `deriveRourkeRank` inferred rank from whether the authored lance pilots were in the roster. With empty lances it derived `2nd_lt` forever, and `backfillRourkeRank` would then have **silently demoted a Major to 2nd Lieutenant on every load.** Caught because six existing rank tests failed. Now derived from `lanceCount` — command, not membership.

**The recruit card jumped pages after every hire.** Each hire adds a 148px pilot row to the same shop list, which repaginates and pushes the recruit card away. Signing a five-pilot lance meant hunting for the card again after almost every click. Found by the live check stopping at 2 of 5 recruits. Fixed with a `keepRecruitVisible` flag that re-finds the recruit page after a hire.

---

## 5. Save compatibility

An in-progress campaign must not lose its squad or rank. `lancesGranted` is optional and backfilled by `derivedLanceCount` — the exact pre-5-Sep rule — so a mid-Act-III save keeps three lances, all fifteen pilots, and Major. There is a dedicated regression test for precisely that.

---

## Doc-touch flags

- `Bloom_Wars_Hangar_Roster_Stats_Panel_Plan_v1.md` — its §1 "landmine" warning about lance meaning is now fully resolved: lances are assignable, granted per act, capped at five for Gladiator.
- `Bloom_Wars_Gladiator_Fleet_Battle_Concept_v1.md` — **arithmetic worth settling before that gets built against:** 30 mechs on field is 6 lances of 5, but the ceiling set today is 5 lances per carrier. Either a Gladiator carrier fields more than 5 lances, or lances there aren't 5 mechs, or the 30 comes from multiple carriers.
- `Bloom_Wars_First_Game_Dev_Feature_Gap_Report_1Sep2026.md` — B2 done; B4, B5, B8 remain.
- `Bloom_Wars_Now_And_Next.md` — recruiting shipped. Open: the 5 Okafor/Solheim dialogue lines; the Vault overlay's own overflow; `package.json` still `0.0.1`.

## Still open, deliberately

- **The 5 dialogue lines** naming Okafor and Solheim.
- **`MAX_LANCE_SIZE` vs the act deploy caps.** Lances hold 5; Act II deploys 10 and Act III deploys 15. So from Act II a single lance can't fill a deployment and the quick-pick fills 5 of 15. Not a bug — it's what "lances of 5" and "deploy 15" mean together — but if lances should scale with the act, that constant is the lever.
- **First kill as the callsign trigger** is my call, not Maxime's. Easy to move to a different action.
