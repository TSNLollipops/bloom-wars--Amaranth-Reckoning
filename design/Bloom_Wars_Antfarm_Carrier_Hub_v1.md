# THE BLOOM WARS — The Antfarm: Carrier Hub & Between-Mission Story Layer v1

**A design pass turning two things into one thing — NON-CANON where it touches the Amaranth Reckoning, additive everywhere else**

*Written 22 August 2026. Answers two asks that turned out to be the same feature: "add Sunrider-style story moments between missions" and "start planning the antfarm carrier — workshop, heirloom, energy, more squads, faster ship fires." Both point at the same screen. This document builds that screen.*

---

## 0. Two asks, one answer

The Spitball doc already parked this, twice, without connecting the two entries: "Carrier as an ant-base hub, XCOM Avenger style — a real base-management layer between missions" sits a few lines above "Sunrider's EN-budget system... stays parked for a possible future ship layer." They're the same future. A hub screen is exactly where XCOM's Avenger-walk banter lives *and* exactly where Sunrider's ship-deck conversations live — those are two well-known instances of one genre convention, not two features. Build one hub. It carries the workshop, the Heirloom Vault, the Energy resource, roster growth, and the social scenes, because a real place has rooms and rooms are where all of this already wants to live.

This does not replace the existing debrief screen's mechanics (gear tier purchases, spare mek parts, mek secondaries — Build Brief step 11, GDD §6.4). It gives that screen a floor plan and adds new things to spend on and look at once you're standing in it.

**Scope note, matching the Amaranth Reckoning doc's own discipline:** this hub is designed for a battalion-scale campaign — a roster that grows, a ship that can be damaged, veterans who earn named ultimates. The 4-mission vertical slice (5 pilots, no composition choice, one shared Heirloom slot) doesn't need it and nothing here touches that slice. Amaranth Reckoning is the first campaign big enough to justify building this, which is presumably why the ask landed here first.

## 1. The identity call: Providence is the Antfarm

Recommendation, easy to veto: the hub *is* Providence, the ship Amaranth Reckoning already names for Act II fire support (Mission 14, "Steel Rain") and already puts in harm's way (Mission 22, "Ash on the Water" — "the Providence takes real damage"). Rather than inventing a fourth named ship, give an existing one a second job. The crew nickname for it is "the Antfarm" — not its service designation, just what Warden Company calls the thing they keep tunneling new rooms into every time the roster outgrows it, which is often. That's an in-fiction joke that also happens to explain the mechanic: the hub keeps getting bigger because the war keeps making it need to.

Consequences this creates, all of them already consistent with the existing table in §10 of the campaign doc:

- **Act I has no hub**, because Providence isn't forward-deployed yet — matches the squad-scaling table's "off-board support: none" for Act I exactly. The hub unlocks the same mission the call-in ability does (Mission 14), so it's one unlock, not two.
- **Mission 22 gets real teeth.** "Protect Asset" currently means an off-board ship with a damage state. If that ship is also the player's own hub, damage to it can knock a room or an upgrade offline for a mission or two — the first time the player's *base* is the thing at risk, rehearsing exactly the stakes Act III needs before Act III asks for them. The doc already calls this mission a "rehearsal for Act III's capital-ship stakes"; this makes it rehearse the right thing.
- **Meridian's Oath is untouched.** That's a separate capital ship introduced in Act III (Mission 25) for capital-scale fire support and Mission 32's defense — a different, bigger, later thing. Nothing here renames or merges it with Providence.

**The one thing this doc has to protect:** Providence stays scenery. It is never piloted, never a played unit, never a ship-combat layer — the hub is a menu you visit between missions, not a mode you play. That's the same discipline the campaign doc already locked for the capital-ship objective missions ("the ship is fragile scenery you defend, never a unit you pilot, keeping the 'Freespace never gave us capital ships' instinct intact"). A hub with rooms in it is a much shorter step toward accidentally building ship combat than it looks like from here — worth a flag now rather than a scope argument in six months.

## 2. The rooms

Five rooms for v1. Each does one mechanical job and one narrative job — that pairing is deliberate, not incidental, because it's what keeps this from being a menu with flavor text bolted on.

| Room | Mechanical job | Narrative job |
| --- | --- | --- |
| **Hangar Deck** | Roster and deploy management, mission select | Low-stakes group banter — the room everyone passes through, so it's the room where casual voice lives |
| **The Workshop** | Gear tier purchases, mek secondaries, spare parts, carrier upgrade modules (new — §3) | The Quartermaster's domain; running commentary on the war through its logistics, not its battles |
| **The Vault** | Heirloom management, dedication, salvage integration (new — §4) | Grief-adjacent. The campaign's heaviest room, used sparingly on purpose |
| **Berths** | Lance recruitment, roster capacity (new — §6) | One-on-one pilot scenes — the actual Sunrider slot: quarters, rest, the people rather than the war |
| **CIC / Bridge** | Fire-support call-in configuration, Energy allocation (new — §5) | Marrow sightings, House Amaranth politics, campaign-plot beats — briefing-adjacent in subject, never in tone |

A sixth room, a common mess deck with no mechanical function at all, is worth wanting and worth not building yet — see §9.

## 3. The Workshop (added workshop)

Two layers. The first already exists and just moves into this room unchanged: gear tier purchases, spare mek parts, mek secondary specializations, at their existing costs (Data Pack §12.1). The second is new.

**Carrier Upgrade Modules** — a second thing the same points currency buys, spent from the ship's own ledger rather than a pilot's. This is a deliberate expansion of "points buy exactly three things, which is deliberately few" (GDD §6.4), and it's licensed by the campaign doc's own Appendix B, which already flags that the points economy "needs its own balance pass at build time" once it's scaled across 36 missions and a fivefold roster — this is that scaling, not a new precedent. Every module carries a real cost, same rule the Heirloom table already enforces: nothing here is strictly better than not buying it.

| Module | Effect | Cost |
| --- | --- | --- |
| **Auxiliary Berths** | Pulls a lance's worth of deploy slots in early, ahead of the Act's scripted schedule ("more squads," on demand rather than only at Act breaks) | Heavy point cost, and a permanent DEF penalty to Providence itself for the rest of the act — crew diverted to billeting is crew not on damage-control stations, which is exactly what Mission 22 is waiting to punish |
| **Forward Battery** | Reduces the Energy cost of a fire-support call-in, or shortens its cooldown ("faster ship fires," directly) | Heavy point cost, not purchasable before Mission 14 — the ability doesn't exist yet to upgrade |
| **Fabrication Bay Expansion** | Raises every Fabricator mek's spare-part cap campaign-wide, not just one pilot's | Point cost scaled to how many Fabricator meks are in the current roster, so it gets more expensive as the payoff gets bigger |
| **Runic Integration Line** | Required before a *salvaged* Heirloom (see §4 — The Debutante's Answer is the one example that exists today) can be assigned to anyone. Without it, a salvaged Heirloom sits in the Vault, inert | Moderate point cost, one-time |

## 4. The Vault (added heirloom)

A physical home for the 20-name Heirloom pool the campaign doc already built (§9 of the Amaranth Reckoning doc). Nothing about the pool's rules changes; the Vault is where the rule everyone already agreed to becomes a scene instead of a stat change.

The existing unlock condition — reaching A tier is "Heirloom-adjacent," and *surviving a real story beat afterward* is the actual unlock, "not a shop purchase" — currently has no "where." The Vault is the where. A veteran's dedication happens here: a short scene, once, the moment the story beat resolves. Requiem's transfer from Bosk to Rourke at the end of Mission 12 is the obvious first one to write, and it should be treated as load-bearing the way the GDD uses that exact word for the base slice's Mission 1b briefing — "the only thing the game ever says about a mission whose weight the player is expected to work out on their own." Same idea, moved from a briefing to a scene: this is the one moment in the whole campaign the hub isn't allowed to be quiet about. See §7 below for why it doesn't get to be skippable.

Salvaged Heirlooms are a second, smaller case worth naming explicitly: The Debutante's Answer is tagged "salvaged, not issued" in the existing table, which already implies it doesn't arrive through the normal unlock path. The Vault is where it sits, uncalibrated, until the Workshop's Runic Integration Line is bought — a small, concrete link between the two rooms rather than a special case bolted onto one ability.

**Open, not decided here:** whether a permanently lost pilot's Heirloom (if they were carrying one) is retired, orphaned back into the pool, or memorialized in the Vault as unusable. The campaign doc doesn't currently say whether Amaranth Reckoning reuses the base game's "points invested in a lost pilot are not recovered" rule (Canon Pass §C.3) for Heirlooms specifically. Worth a line whenever that gets decided — flagged, not guessed at.

## 5. Energy (added energy)

A resource that belongs to the ship, not to any pilot or mek — a separate axis from HP, points, or Heirloom charge, the same way the campaign doc's own research already scoped it: Sunrider's EN-budget was explicitly researched, explicitly rejected for the mech-combat layer (two-action XCOM economy won that argument on its merits), and explicitly "parked for a possible future ship layer instead." This is that ship layer, finally given something to be attached to.

- **What it fuels:** Providence's fire-support call-ins, and — if this ever gets built out — active defense during Protect Asset missions (Ash on the Water, Hold at the Spire), which right now are pure damage-sponge scenery with no player lever. Energy is a cheap way to give the player one button in those missions without turning them into ship combat.
- **How it's gained:** flat regen per mission completed, the same performance bonuses already defined for points (Data Pack §12.3 — turns under limit, no pilot downed, no spare parts spent) also feed Energy. No new tracked stats, no new scoring rules — the existing scorecard just has a second column now.
- **Cap and use-it-or-lose-it:** capped per act, and unused Energy does not carry across an act boundary. That's a deliberate contrast with points (which persist) — it keeps each act's Energy budget a real decision made on that act's own terms, rather than something that snowballs into Act III being trivially funded by Act I discipline.
- **Its cost is logistical, not personal.** Severance's whole design point is that its cost is felt immediately and specifically — it can kill your own unit, right now, on purpose. Energy shouldn't try to copy that; it's a different tension serving a different scale. Its cost is opportunity and scarcity: what you didn't buy this act because you spent Energy instead of banking it. That's a real cost. It doesn't need to also be a dramatic one — the game already has a mechanic that does dramatic, and diluting Severance's exclusivity on "this can hurt you" would cost more than it'd add.

## 6. Berths and squad growth (more squads)

The campaign doc already scripts roster growth — 5 at Act I, 10 across two lances at Act II open, roughly 20 across four lances by Act III (§10's squad-scaling table). That schedule stays the floor; nothing here delays or replaces it. Auxiliary Berths (§3) is the only lever that moves it, and only earlier, and only at the DEF cost already described. This keeps the campaign's pacing author-controlled by default, with hub investment as optional acceleration for a player who wants to pay for it — additive, not a rewrite of a table that's already been thought through.

## 7. The story-moment layer

This is the actual Sunrider ask, and it's the smallest technical lift in this document, because the campaign already has the exact right-shaped tool for it. GDD §7 defines `MissionEvent` — a flat trigger/action data record, no special-cased code — specifically so scripted moments stay data. A hub scene is the same idea at a different trigger point:

```
interface HubScene {
  id: string;
  room: "hangar" | "workshop" | "vault" | "berths" | "cic";
  trigger: { type: "after_mission" | "heirloom_unlock" | "roster_change";
             missionId?: string; pilotId?: string };
  participants: string[];       // pilot ids
  beats: { speaker: string; text: string }[];   // no branching in v1
  once: boolean;
}
```

**No branching dialogue in v1.** A tree multiplies writing cost fast and buys very little at this campaign's stage — flag it for later (§9), don't build it now. This is the same "prototype the small version first" instinct the campaign doc already applies to itself in its own Appendix C.

**No new art.** GDD §12.2 already solved this problem for the exact reason it's about to come up again: "confirmed no artist for Sunrider-style hand-painted portraits... a coloured circle with two initials. Real portraits are a later drop-in against the same field." Hub scenes use that same placeholder, just with more screen time and a name-plate. The art decision doesn't need to be reopened; it needs to be reused.

**Reconciling this with the "briefings never editorialize" rule.** GDD §10.1 is explicit that mission briefings state the task and nothing else — "a single extra clause of atmosphere would do the narrating the discipline exists to prevent." That rule is untouched and this layer doesn't argue with it; it's a different room doing a different job. The Qiraki side of this project already has the exact craft rule this needs, and Spitball Ideas already declared it the game's tone too, by default: *"warmth lives in the dialogue, the dark lives in the background."* Briefings are the background. The hub is where the dialogue lives. Two rooms, one house, already-agreed rule — this doc isn't asking for a new tone decision, just pointing at the one that's already made and applying it somewhere it hasn't been applied yet.

## 8. Beat placement across the 36 missions

Concrete placements, tied to beats the campaign doc already named. This is a starting pass, not a full script — enough to prove the room-per-scene idea against real content before committing to writing all of it.

| After mission | Room | What it's for |
| --- | --- | --- |
| 1 — Muster | Hangar Deck | First-time-in-a-lance banter. Mission 1 establishes all five voices in combat; this is the social equivalent |
| 5 — Foraging Party | Berths | Restock-not-death, felt rather than mechanical — someone processing having watched a squadmate go down and come back |
| 8 — The Choir Sings | Workshop | Post-mid-boss banter; a natural slot for a Rourke/Iyari (Foxfire) rivalry beat, given her established competitive streak |
| **12 — The Fallow Line** | **Vault** | **Load-bearing, not skippable.** Requiem's transfer from Bosk to Rourke. The campaign doc wants "the friend-or-foe rule read as grief rather than as game design" — this scene is the only place that reading actually gets delivered |
| 13 — New Colors, Old Wounds | Hangar Deck | The second lance arrives; direct payoff for the roster-growth beat the mission title is already about |
| 17 — The Wellroot Uncovered | CIC | House Amaranth's collaboration becomes visible; political-complexity beat matching Act II's "moral weight of a civil war" |
| 20 — Marrow's Line | CIC | Processing the first named mech-vs-mech duel; a strong slot for Anand (Farsight), already established as "the company's real mentor once Bosk is gone" |
| A-tier unlocks, whenever they occur | Vault | Each Heirloom dedication scene, data-driven off the unlock event, not tied to a specific mission number |
| 24 — Two Fires (Act II finale) | CIC or Hangar Deck | Rourke's promotion to Major; the tone hinge into Act III's grimmer register |
| 29 — The Outer Ring Falls | CIC | Deliberately short and grim — this is where Act III starts earning the tonal shift the doc names outright at Mission 33 ("tone shifts from 'win' to 'survive'"). This scene shouldn't try to comfort anyone |
| 31 — The Last Convoy | Berths | Quiet, earned rest. The Qiraki side of this project already models exactly this need mid-siege — the gigafish sequence's own beat sheet calls for "3-4 chapters of genuine rest and recuperation, earned downtime, not filler, the reader needs the breath as much as the characters do." Same instinct, same place in the structure |
| Before 36 — Until Relief | Vault | Meridian's Vow — the battalion-wide Heirloom "reserved narratively for the finale" gets its dedication scene here, explicitly, before the last mission spends it |

## 9. Build cost, honestly

**Tier 1 — cheap, build alongside Act II's own prototype pass.** A room-based reskin of the existing debrief/shop screen (Hangar + Workshop only), the `HubScene` data type, and the Mission 12 Vault scene written by hand because it's the one that has to exist for any of this to be worth doing. No new resource yet. Existing placeholder portraits.

**Tier 2 — moderate.** Energy, the Forward Battery / Auxiliary Berths / Fabrication Bay Expansion modules, the Vault's dedication trigger wired to the existing A-tier unlock condition.

**Tier 3 — later, don't build yet.** Branching dialogue, an affinity/relationship layer, the Mess Deck, animated portraits, and — much later — exposing hub scenes to the player-authored mod kit already parked in Spitball Ideas.

Recommend Tier 1 lands alongside Act II's prototype, the same seam where ship fire-support and the composition choice both already come online per the campaign doc's own Appendix — not before Act I is proven, matching Appendix C's own "prototype Act 1 first" advice. This doc doesn't override that sequencing; it just has somewhere to plug in once that sequencing gets there.

## 10. Open questions — your call

- **Providence-as-Antfarm** — the whole document leans on this. Easy to swap for a new, unnamed ship if that reads better once there's more of the campaign written; nothing else here would need to change structurally.
- **Mandatory vs. skippable scenes.** Mission 12's Vault scene reads as mandatory to me for the reason stated above. Everything else I'd default to skippable-but-logged (so a player who skips can still read it later from the Vault or a "ship's log"), but that's a real tone call, not a technical one.
- **Does Energy ever touch Meridian's Oath?** As written, Energy is Providence-only. Whether Act III's capital ship gets its own pool, shares this one, or stays outside this system entirely is untouched here.
- **Salvaged-vs-lost Heirloom handling**, per §4 — flagged, not resolved.
