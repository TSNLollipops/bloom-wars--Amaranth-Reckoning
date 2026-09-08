# Build Log Addendum — B2: assignable lances and the Hangar Deck crew records

**5 Sep 2026.** Claude (Cowork session). Shipped to the repo on `lorian-pc`. Gate green: `tsc`, `eslint`, cast-collision, **92 files / 2181 tests**, `vite build`. Live verification: `tools/verify/checkRosterPanel.mjs`, 22 checks.

Answers the open questions in `Bloom_Wars_Hangar_Roster_Stats_Panel_Plan_v1.md`, which had sat since 29 Aug marked "confirm before it's built."

---

## Maxime's decisions, as asked and answered

| Question | Answer |
|---|---|
| Scope | **The full plan doc** — ambient Favorability removed, Hangar Deck roster panel built, service records on the cards |
| Lance grouping | **Real assignable lances**, persisted — not the cheaper static-arrival reading the plan doc recommended |
| Ambient label | **Drop the number, keep the rest** — name, Stage badge, ♥/⚡ tags stay |
| Lost pilots on a lance page | **Gone** — the Vault's roll owns the dead, no duplication |
| Deployment | **Lance pre-selects, override allowed** — a convenience, not a constraint |
| Composition rules | Hard cap of 5; **Munti as a warning, not a block** (revised mid-build, see below) |
| Meks | **Follow their pilot** to the new lance's workshop |

---

## The two findings that changed the spec

### 1. "Munti required" would have bricked lances permanently

Maxime originally picked a hard Munti requirement. Checked against the actual roster before building:

| Lance batch | Pilots | Muntis |
|---|---|---|
| A (start) | 5 | 1 |
| B (Mission 12) | 5 | 1 |
| C (Mission 24) | 5 | 1 |

**Exactly three Muntis for three lances, zero spare.** Two consequences: only one legal arrangement of Muntis exists (one each), so the rule fights the feature it's attached to; and in a permadeath game, losing one Munti leaves 2 for 3 lances — **one lance could never be legal again, permanently, with no recovery.**

The requirement was also redundant. `canLaunchMission` already refuses a Munti-less squad at launch, with its own message. A save-time block adds no safety and creates a dead end. Put to Maxime, who agreed: **hard cap of 5 stays, Munti becomes a warning.** A lance without one saves fine, is flagged in the tab strip and the header, and is refused by the existing deploy gate if you actually try to launch it.

### 2. A hard cap alone deadlocks a full roster — found by live verification, not by reasoning

15 pilots, 3 lances, cap 5 means from Act III onward **every lance sits at exactly 5/5**. Under a hard cap that makes *every* move illegal in *every* direction, with no "make room first" available because every other lance is full too. The feature works at 5 pilots and 10, and is completely frozen at 15.

Unit tests didn't catch it — they built partial rosters. The browser run did, immediately, because it used the real 15-pilot midgame save.

**Fix: `swapPilotLances`.** A trade never changes any lance's size, so it's cap-exempt by construction and is the operation that keeps a full roster editable. In the panel, a `[ trade ]` handle on every row picks a pilot up; clicking another pilot's handle trades them. Attempting a move into a full lance no longer dead-ends — it picks the pilot up and says *"2nd Lance is full (5 is the most that can deploy together) — pick someone there to trade with."*

A regression test now asserts the deadlock exists for plain moves at full roster, so nobody removes the swap later without hitting it again.

---

## What shipped

**Engine (`engine/campaignState.ts`).** `CampaignPilotEntry.lance?: LanceId` as an *override*, not an eager write — every pre-existing save keeps arrival behavior with no migration. `lanceOfPilotIn` / `lanceOfMekIn` are the live read paths; the original `lanceOfPilot` / `lanceOfMek` stay untouched and still answer "where did they arrive." Plus `lanceRoster`, `lanceFieldability`, `assignPilotToLance`, `swapPilotLances`, `MAX_LANCE_SIZE`, `LANCE_IDS`, `lanceDisplayName`. **18 new unit tests.**

**The panel (`scenes/ui/RosterPanel.ts`).** Standalone class in `scenes/ui/`, following `StandingsPanel`, rather than an eleventh inline overlay on Hub.ts — same answer to Track 3's sprawl concern the memorial got. Lance tabs showing occupancy against the cap and flagging an unfieldable lance even when you're not looking at it; per-pilot rows carrying path, tier, personal points, Favorability, relationship tag, and the B2 service record (missions flown with wins, kills, times downed, most-used ability). A pilot who has never flown reads *"no missions flown yet"* rather than a row of zeroes.

**A second console.** The Hangar Deck already had a ROSTER & GEAR console opening ShopPanel, per Maxime's 30 Aug call to reuse it "rather than build a second, thinner roster view." That decision stands — this is a different screen (who your people are, not what you can buy them), so it gets its own walk-up point 220px clear of the existing one, matching how the Vault plinth and Workshop bench already work. One E press never means two screens.

**Meks follow their pilot.** `reseedCrewAfterLanceChange` re-homes affected Mek NPCs in place on assignment — deliberately targeted rather than re-running `buildNpcs()`, which *creates* NPCs and would duplicate the entire crew. Berths need no work: `needRoomFor` resolves through `lanceOf` at the moment it's needed, so they self-correct. Verified live: a traded pilot's Mek physically relocates from `workshop` to `workshopB`, and the traded-for Mek moves the other way.

**Ambient Favorability number removed** (`favorabilityLabel`). The name, Stage badge and ♥/⚡ tags stay — those are status, not a ticking counter. `npc.favorability` itself is untouched and still drives everything it always did; this is display-only. The number now lives solely in the crew-records panel, checked on purpose.

**Lance quick-pick on the Transporter Pad.** Top-left `fill from: [1st] [2nd] [3rd]`, clear of the pad list. Sets the selection and gets out of the way — every pad stays individually toggleable, and a player who never touches it gets precisely the old behavior. Nothing about the deploy gate or mission balance changes.

---

## Two more bugs the screenshots caught

Neither was visible to `tsc`, `eslint` or 2181 unit tests:

- **The lance tabs overlapped each other.** Their x positions were computed at construction from the bare label (`[ 1st Lance ]`), but render widens them with occupancy (`[ 1st Lance 5/5 ]`). Tabs are now laid out at render time, after their text is final.
- **The `⇄` glyph isn't in the monospace face** and rendered as `≠`. Replaced with plain words.

---

## Doc-touch flags

- `Bloom_Wars_Hangar_Roster_Stats_Panel_Plan_v1.md` — every open question in §3 is now answered; §2b's "memorial/KIA entry on their lance page" is resolved as **no** (the Vault roll owns it). Its §1 landmine warning was right, and the reading it recommended against is the one that shipped.
- `Bloom_Wars_First_Game_Dev_Feature_Gap_Report_1Sep2026.md` — **B2 is done.** With B3, B6 and B7 also shipped today, the remaining B-list items are B4 (portrait wiring), B5 (briefing room) and B8 ("last words").
- `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §2 — the Hangar Deck row is no longer aspirational; it now has both consoles.
- `Bloom_Wars_Now_And_Next.md` — B2 shipped. Still open from earlier today: the **Vault overlay's own overflow** (measured at 563 against a 552 bound in some states, varies with campaign state, nothing clips or scrolls), and `package.json` still at version `0.0.1`.

---

## Note for whoever tunes lances later

`MAX_LANCE_SIZE` is 5 and the deploy cap is 5 in Act I — but `ACT2_DEPLOY_CAP` is 10 and `ACT3_DEPLOY_CAP` is 15. So from Act II on, a single lance can no longer fill a deployment on its own, and the quick-pick fills 5 of 10 or 5 of 15 slots. That is not a bug in this pass — it's what "lance of 5" and "deploy 15" mean together — but if lances are meant to scale with the act, `MAX_LANCE_SIZE` is the one constant to change, and the swap-vs-cap deadlock analysis above changes with it.
