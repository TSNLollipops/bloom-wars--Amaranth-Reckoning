# THE BLOOM WARS — The Amaranth Reckoning

**An Independent 3-Act / 36-Mission Campaign Concept — NON-CANON, parallel continuity**

*Delivered to Maxime as a .docx on 22 August 2026 (`design/Bloom_Wars_The_Amaranth_Reckoning.docx` in the bloom-wars repo). This is the project-durable text version for future sessions — see that file for the fully formatted version.*

**Status update, 25 August 2026 (superseding the 22 Aug note below — that note was left stale for several days and caused real confusion in at least one other conversation working from this doc; if you're reading this to answer "what's actually built," this paragraph is the one to trust, not the one below it).** All 36 missions are built, sim-tuned, tested, and delivered as of this session: Act I (Missions 1–12), Act II (13–24), and Act III (25–36, including the finale — "The Innermost Ring," "No Word from the Fleet," "The Last Ring" with the new final-boss archetype "The Unnamed," and "Until Relief"). The campaign is complete. `src/data/campaignAmaranth.ts` is ground truth for exact current state — check it directly rather than trusting any status paragraph, including this one, to have been kept current going forward. `claude/Bloom_Wars_Amaranth_Act1_Build_Log_v1.md` has the batch-by-batch build history and final tuning numbers for every mission, including the finale's own real sim-tested win rates (Mission 35's Unnamed siege is the campaign's hardest fight by design, ~40-55% win; the others run 60-85%). Team One's book-canon 4-mission slice remains archived in the repo (`src/data/campaign.ts`/`maps.ts`), not deleted, not currently shipped.

**Status update, 22 Aug 2026, same day (historical — see the 25 Aug update above for current state).** This is no longer "a second campaign concept" — Maxime decided the game is built around this campaign exclusively going forward, archiving Team One's book-canon 4-mission slice out of the shipped game (kept in the repo, not deleted, per his own "we might reuse them later"). Full reasoning is logged in `claude/Bloom_Wars_Spitball_Ideas.md`'s "Resolved discussion" section — this doc gets the practical fallout: §6a below is new, and a few lines elsewhere are flagged rather than rewritten wholesale, since the actual mission-by-mission text is real authorial work for later, not something to silently patch here.

---

## 1. What this is, and why it sits outside canon

A self-contained campaign concept: three acts, thirty-six missions, a new cast, a new antagonist. Built to run in parallel with the existing Bloom Wars canon rather than inside it — same galaxy, same sixty-year war against the Bloom, a different frontier sector entirely, no shared characters, no shared plot beats. "Elsewhere in the war": another company, another front, roughly the same broad moment in the conflict as everything already locked for Team One, never touching it.

Why the separation: Team One's roster, the Mission 3 wipe, and the rebellion arc opening the game's original Act 2 are tied directly into the book series' own locked continuity. Building a second campaign on top of that risks contradicting something the books have decided. Building a second campaign beside it costs nothing.

**Reused freely:** the Bloom's mechanical Bestiary (the seven archetype categories — weapon, movement, perception, intelligence, Endurance/Vitality, swarm type) and the archetype-generation method itself; the four combat paths and the Meeps > Reeps > Tank > Meeps triangle; mek specialisation tracks; chassis species (human, Hiopi, Osnian); restock-not-death with rare scripted exceptions **— refined 22 Aug 2026, see §6a: restock is now conditional on a living Munti, not universal, and "rare scripted exceptions" is superseded by a general permadeath rule with exactly one exempt character**; the Heirloom-grade tier, expanded here into a battalion-scale roster rather than one shared slot, using a ratio the existing docs already lock but never build (see Section 9).

**Not reused:** Team One's five pilots, the Mission 3 wipe, the node raid, the rebellion arc, or any institution tied to that storyline. This document invents its own political texture from scratch, light-touch on purpose. It also does not use the book series' reserved terminology anywhere — the same hard rule the game's own lint check enforces on code.

## 2. Inspirations, and the horror requested

WW1 for Act 1 — static defense, trench-line attrition, ground that changes hands one raid at a time, a green officer's education by attrition. The Bloom's acid-tile spread plays the gas-attack beat; the Undertow plays the tunnel war. WW2 for Act 2 — mobile combined arms, an opposed landing, city fighting, a breakout from encirclement, the moral weight of a civil war layered over an alien one, a population of reluctant conscripts. The blend for Act 3 — WW1 defense-in-depth (falling back ring by ring around a capital that isn't supposed to fall) plus WW2 siege endurance plus a Freespace instinct: help is coming, and you don't get to know when.

Concrete Freespace-horror techniques used throughout: briefings that never editorialize; the existing Collapse rule (a creature that hits hardest exactly when it looks weakest); scale mismatch; things you cannot see until too late (the Undertow, used three times); a superweapon that kills your own people exactly as readily as the enemy; capital ships you can lose.

## 3. The scope question — is this too big?

Honest answer: thirty-six missions at full Data-Pack depth (tile-by-tile maps, validated wave tables) would be enormous, and this document doesn't attempt that — it's pitched at the "campaign design" altitude the Master Index already reserves for a later pass. Recommendation: prototype **Act 1 first**, since it asks the engine for nothing beyond one new objective type and two new Bloom encounters built the documented way.

**What's new, act by act:**
- **Act I:** no new systems. 5-unit deploy throughout. One new objective type (Survive N Turns, already flagged cheap in Build Brief §6). Two new Bloom encounters built from existing categories.
- **Act II:** two real asks. A composition choice (roster 10, deploy ~5–8) — the exact next step the GDD already anticipated ("the first thing Act 1's back half does"). An off-board ship fire-support call-in ability (not a played unit, not a ship-combat sim).
- **Act III:** three more asks. Bigger maps / higher deploy cap. A capital-ship escort/objective mechanic — the ship is fragile scenery you defend, never a unit you pilot, keeping the "Freespace never gave us capital ships" instinct intact. Two more new objective types (Contested Landing, Protect Asset), both introduced in Act 2 so Act 3 isn't the first time they appear.

**Status, 25 Aug 2026 (see the top-of-document status update for the authoritative version — this line is left for historical continuity):** all 36 missions across all three acts are built in the repo (`src/data/campaignAmaranth.ts`, `mapsAmaranth.ts`), playable from mission-select. The campaign is complete.

## 4. The Amaranth Reach

A frontier cluster held nominally by a sector governor-general answering to a core that's never in real danger. The Reach's wealth and name come from **House Amaranth**, its founding dynasty, chartered generations back, holding the sector's richest agricultural/bio-processing terraces and fielding its own chartered mech battlegroup alongside loyalist regulars. **Meridian** is the Reach's capital world — shipyards, orbital elevator, and the place Act 3 falls back toward.

**The Seal and the Sword** (worldbuilding device, kept implicit in play): a charter house's battlegroup is nominally commanded by a House officer holding its seal — political, not necessarily competent — while a professional soldier actually runs it day to day. Common enough that nobody remarks on it. Also the whole shape of Colonel Marrow's arc.

## 5. House Amaranth's fall

Not simple cowardice or opportunism. The Bloom itself hasn't been around long enough for a deep dynastic myth — this reaches back to the war's own first years. The Reach's terraces made House Amaranth the first people anywhere to get a close, sustained look at what the Bloom does to living tissue, decades before anyone on the core worlds thought to ask. Halcyon Amaranth's mother started the ward-crop program in the first decade of the outbreak, treating early Bloom drift the way a farmer treats blight — study it, breed resistance, redirect it. Halcyon inherited both the research and the conviction that it worked. When the war turns hard enough on her own watch, she cashes three decades of that work in as leverage: divert the Bloom elsewhere, spare House lands, call it stewardship. It works — long enough to look like wisdom — until the thing they thought they'd tamed outgrows the leash. The Wellroot (Act 2) is that success turning into infestation; the Unnamed (Act 3, beneath Meridian) is what it becomes once nobody is redirecting it at all. By Act 3, loyalists have quietly stopped saying "the Amaranth Reach" out loud — implied, never explained on the page.

## 6. Warden Company — the starting roster

- **2nd Lt. Dessa Rourke**, callsign "Lark" — Meeps, human. Protagonist. Green, aggressive, quick; not yet a commander. Growth arc: learning patience. By Act 3 the unit she leads carries the opposite of her callsign — "Warden." **The one mechanically permadeath-exempt pilot in the roster — see §6a.**
- **M.Sgt. Halvard Bosk**, callsign "Anvil" — Tank, human. The mentor. Written to be lost covering the withdrawal at the end of Act 1 (the campaign's one deliberately-plotted loss). **No longer a scripted safe-until-then death — see §6a: he's subject to the same live permadeath rule as anyone but Rourke, so this beat only lands on Bosk specifically if he's actually still alive to reach it.**
- **Pvt. Tegan Iyari**, callsign "Foxfire" — Meeps, Hiopi (centauroid). Young, competitive, second melee voice, second charge-ability answer.
- **Cpl. Priya Anand**, callsign "Farsight" — Reeps, Osnian (vibrissal). Watchful; the squad's eyes against the Undertow; becomes the company's real mentor once Bosk is gone (**if** Bosk is gone by then rather than earlier or later — see §6a).
- **Spec. Corin Lask**, callsign "Patch" — Munti, human. The fragile centre everyone organizes around. **Mechanically, not just narratively, the fragile centre now — see §6a: restock for the whole squad depends on a Munti being alive on the field, and Lask is the only one at the start of the campaign.**

Roster doubles to two lances (10) as Warden Company forms in Act 2; grows to three lances (15) by Act 3. **Corrected 25 Aug 2026 (chat): earlier drafts of this line said "roughly 20 across four lances" — that was never the actual plan. Maxime's own words, clarified after batch 5 shipped a version built on the old number: "my original plan was to allow player to field 1 lance act 1, then 2 lance, act 2 tthen 3 act 3. to go with the rank incrase of MC and the difficulty spike." 5 pilots/lance × 3 lances = 15, tied to Rourke's own rank progression (2nd Lt. → Capt. → Maj.) rather than a flat headcount target. §9 and §10 below are corrected to match; §9's Heirloom-pool math ("4 × 5 = 20") is flagged rather than silently re-derived — see that section's own note.** Expanded-bench naming is a build-time task, not scoped here. **Updated 22 Aug 2026: that bench is no longer assumed to be entirely hand-authored — see §6a, "rotating cast."** The unit keeps the name "Warden Company" long after it stops being company-sized, because nobody in it wants to change it.

## 6a. Roster mechanics — permadeath, the Munti, and the one exception (new, 22 Aug 2026)

Full design conversation and reasoning preserved in `claude/Bloom_Wars_Spitball_Ideas.md`'s "Resolved discussion" section, quoted verbatim there. This section is the practical summary for whoever's working on this doc's own content.

**The rule.** Maxime: "if there a muntie there is restock. no munties no restock." Checked live, every time a unit is reduced to 0 HP: is a Munti currently alive and on the field? Yes — standard restock, exactly like the rest of this doc already assumes (back at full strength next mission). No — that loss is permanent, gone from the roster for good. Not a one-way flag that stays tripped for the rest of a mission — if a Fabricator mek gets a Munti redeployed mid-mission, the safety net is back on for whoever goes down after that.

**Fabricator stays separate.** Spending a spare part to redeploy a downed pilot mid-mission (§ existing GDD/Data Pack rule) is about getting someone back into the fight, not about whether losing them again is reversible — that's still decided purely by the live Munti check above, every time.

**No plot armor except Rourke.** Maxime, asked directly and generally: "im a xcom purist." Asked specifically whether this covers Bosk's Act 1 finale: "for bosk and the scripted death. yeah." Then, naming the one exception: "the only character that is safe is the mc." Practical effect on this document: every named death written into the mission list below (Bosk, Mission 12; the partial losses in Missions 12, 29, 31) is now a *plan*, not a *guarantee* — it only happens to that specific pilot if that pilot is still alive when the beat comes up. Whoever writes each mission's actual text needs to handle "whichever pilot is left in that role" rather than assuming the named cast survives on schedule. One piece of existing continuity survives this cleanly with no extra work: Requiem's inheritance (Bosk → Rourke, §9) already routes to the one pilot who can't be lost, so that chain holds regardless of what else happens to the roster around her. **Narrowed, 25 Aug 2026 — see §6b: this exemption has only ever covered the permadeath roll itself, never her Stress/Morale/panic. §6b gives that distinction real mechanical teeth for the first time.**

**Sharper still, 25 Aug 2026 (same day, later) — this isn't narrative favoritism, it's a mission-fail condition.** Maxime, cutting straight to the actual mechanism: "the mc only has plot armor becasuse if she dies the missions failed and its back to mission briefing." That's the real shape of "the only character that is safe is the mc" — not a flag that quietly reroutes a death roll away from her, but a protect-the-commander objective, the same structural idea as a VIP-down fail state in any XCOM-style game. Rourke going to 0 HP doesn't get redirected onto someone else and it doesn't get waved off — it ends the mission attempt outright and sends the player back to the briefing screen to try again, with nothing about that attempt ever resolving, including the permadeath check itself. She isn't exempt from that check so much as the check never gets a chance to run for her specifically, because the mission that would trigger it never completes. Worth being precise about the distinction going forward — a fail-and-retry trigger, not a flagged-safe unit — since it's a cleaner, more internally consistent design than a bespoke immortality flag, and it's exactly what makes §6b's Stress/Morale exposure read as intended rather than contradictory: the mission-fail rule only ever protects the campaign from losing its commander outright, nothing more, which is precisely the room §6b needed to make her fragility read as pace instead of plot armor.

**Built in the live engine, 25 Aug 2026 (same day, later still).** Confirmed against the actual sim logs before this was fixed: the live engine's prior treatment of Rourke reaching 0 HP was a third framing, different from both the sandbox's old victim/survivor swap and this section's own "mission fails" rule — she was flagged fully exempt from the permadeath check and always resolved as a standard restock, silently, with the mission continuing (`"exempt from permadeath — always a standard restock"` in the Mission 8 Taunt-verification log, `Bloom_Wars_Amaranth_Act1_Build_Log_v1.md`). That's now replaced with the rule as designed above: Rourke reaching 0 HP ends the mission attempt immediately as its own distinct outcome (`"commander_down"`, not a win, not a loss, and never reaching the permadeath check at all), discards that attempt's own state exactly the way the 12-hour real-time recall already does (no points, no roster change, no permanent consequence), and returns the player to the mission-select/briefing screen so the same mission can be retried from the top. A full from-scratch campaign restart (discarding the whole save, not just the attempt) is explicitly a later mode, not this one — see the build log's own addendum for the implementation.

**Flags a real mismatch, not resolved here.** The sandbox's own approximation of this rule (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13.2) still implements the older victim/survivor-swap framing — a death roll landing on her redirects to whoever she's paired with, so someone else dies in her place instead. That mismatch is specific to the standalone `pilot_creator.html` sandbox, which has no mission-attempt/briefing-screen concept to fail back to the way the live game does — not fixed there yet, flagged and reasoned through in the Antfarm doc's own dated log rather than duplicated or silently rebuilt here.

**The deploy gate.** Maxime: "cant go into mission without a munties. Munties are essentially vip that fight back and heal." A mission cannot be launched unless the deploying squad includes at least one living Munti, enforced at the same deploy screen that already caps squad size per §10's table. Every mission is implicitly a protect-the-asset mission underneath its stated objective — except the asset fights and heals rather than being a helpless escort. This is why a guaranteed recruit path isn't optional: without one, a roster that hits zero living Muntis can never launch another mission — a spreadsheet dead end, not a story beat.

**Recruit-phase mechanic — RESOLVED, 22 Aug 2026, full reasoning in the Spitball doc.** Two tracks. **Emergency Munti replacement** is automatic and free: the moment living Munti count hits zero at a debrief screen, a fresh recruit is offered, no points spent, cannot be skipped in a way that leaves the roster unable to launch — this is what actually delivers the guarantee Maxime asked for: "make sure if player lose munties they can get replacement next mission." **Discretionary recruiting** — buying an extra pilot of any class, including a backup Munti, before you're down to zero — stays a normal points-shop purchase like a gear tier or spare mek part. The split matters: the emergency track guarantees the campaign can't dead-end, but doesn't undo the loss — a lost Munti's tier/mek investment is locked to that specific pilot under the existing "points spent on a mek are points spent on that specific person" rule, so replacements start G-tier, stock gear, same as day one. Confirmed tactical payoff, Maxime's own words: a second Munti bought proactively "become something usefull especially since... act 2 give you up to 8 character on screen" — real 7th/8th deploy-slot value once Act II's composition choice opens (§10), not just bench insurance. Still open: the discretionary track's actual points cost (a balance number) and how much of a creation UI exists beyond identity/cosmetics — "natural balance" already rules out custom stat allocation.

**Rotating cast + player character creation, beyond the recruit mechanic itself.** Necessary infrastructure for the permadeath rule to be survivable across a 36-mission campaign generally, not just the Munti-specific piece above — a campaign this long, with real permanent losses, needs the bench to keep refilling with real, player-shaped people rather than running dry. "Natural balance" points toward generated pilots following the same tier/chassis/mek-track rules every named pilot already follows rather than being hand-tuned individually. Real overlap with the "Character mod kit + map editor" idea already parked in the Spitball doc; worth designing this with half an eye on that rather than building the same capability twice.

**Sequencing — deliberately not started yet.** Maxime's own priority, stated the same conversation: get this hard tactical loop built and proven before touching the Antfarm Carrier Hub's narrative/social layer (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md`) or the "fear and motivation" morale system he separately floated for it (a Sunrider-style between-mission cooldown managing the cast's psychological state, XCOM 2 Will/Darkest Dungeon Stress-adjacent — genuinely new design, not in that doc yet). **See §6b — the first concrete piece of that floated morale system now has a locked design decision attached, though the system itself is still deliberately unstarted, same sequencing as this note already sets.**

## 6b. Command Fatigue — Rourke's own Stress gates campaign advance (new, 25 Aug 2026)

Maxime, sharpening §6a's "no plot armor except Rourke" before it got read too broadly: "the only thing the MC is exempt [from] is [death itself] — [the] canned answer. i think she should feel loss and panic too. slowing a player advance in the military campaign." Confirmed against the actual sandbox code the same day: nothing there has ever exempted her from Stress, Morale, mourning, or any other emotional consequence — only from the permadeath roll itself (one bug found and fixed in the sandbox to make that consistently true across every roll path, see `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13.2). This section is the live-game side of the same answer: not just "she still feels it," but a real mechanical consequence for the first time.

Locked as **design intent for the live game specifically**, not the sandbox — the sandbox has no campaign-advance gate to hook this into regardless (same reasoning `Bloom_Wars_Rank_And_Command_v1.md` §5 already gives for why that doc's own mechanic bypasses the sandbox too). This doesn't jump the sequencing §6a already set: the "fear and motivation" morale system stays deliberately unstarted behind the hard tactical loop. What's decided here is what one piece of that system will do once it starts, not a reason to start it early.

**The rule.** Once the morale system exists, Rourke's own Stress/Morale state becomes a second deploy gate, parallel to the Munti gate above: cross into a "breaking" state and the next mission can't be launched until she's brought back under it — through whatever downtime/recovery mechanism that system ends up offering. Same underlying shape as the Munti gate's own framing: "every mission is implicitly a protect-the-asset mission underneath its stated objective" was already true of Lask; this extends it — the commander is an asset too, just one that can't be lost outright, only run down.

**Why this is worth locking in, not just noting.** An MC who can never actually die risks feeling weightless — permadeath is what gives every other loss in this design its teeth, and she's carved out of it entirely. This closes that gap without touching her exemption: her fragility shows up as *pace* instead of as *death*. Push her too hard, lose too many people around her, and the campaign itself slows down and makes the player deal with it — she can't be taken away, but momentum can be. That's a real answer to "why doesn't her invincibility feel cheap," not just a side effect of one chat message.

**Exact numbers, deliberately not set here.** No Stress/Morale system exists in the live engine yet — this is intent for when one does, not a tunable spec. Whatever threshold defines "breaking," and whatever brings her back down (downtime, a Rec-Room equivalent, a specific NPC interaction), gets designed alongside the rest of the morale system, not invented in isolation in this section.

**Open naming question, flagged rather than guessed.** If the parked player-customizable-MC idea (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md`'s own parked note, 25 Aug 2026) ever ships, this gate should probably key off "whoever currently holds Company Commander" rather than Rourke specifically — she holds that role today, but the rule's spirit is about the seat, not the person in it. Not deciding this now; just not writing her name into the mechanic's actual trigger condition when "the acting Company Commander" costs nothing extra to say instead.

**Cross-ref.** Pairs naturally with Command Vacuum (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13.2, sandbox-built and shipped 25 Aug 2026) — that mechanic is a Lance Lead's loss hurting the pilots under them; this one is the top commander's own strain hurting the player's ability to keep going. Same underlying idea — command has a cost that ripples outward — at two different points in the chain of command.

## 7. Colonel Ysolde Marrow — the rival

Holds House Amaranth's sword, not its seal. Career officer, common-born, brilliant, proving herself her whole life to a family that will never let her hold rank by birth. Executes Halcyon Amaranth's bargain out of the same debt that put her in her seat, not malice. Recurs across all three acts: distant sighting (Mission 6), named mirror-match where she withdraws in good order (Mission 20), and a closing turn (Mission 28) where she finally chooses who she actually serves — too late to undo anything, in time to matter once. The underlying tragedy: she was always better than the woman she served.

## 8. The Bloom — this campaign's signature threats

Existing seven archetypes used first (Crawlmass, Splitfang, Undertow, Sporethrower, Gallcyst, Sirenmaw as the base). Three new named threats, built the same documented way:

- **The Choir** (Act 1 mid-boss) — a Sirenmaw-descended pack fighting in coordination, pack-tier intelligence made audible. **Built, `bloom_choir` (`data/bloom.ts`), Mission 8.**
- **The Wellroot** (Act 2 boss) — a sessile hive-node rooted into House Amaranth's terraces; huge Endurance, acid-heavy; the proof of collaboration as a fight. **Built, Mission 21 "Cut the Root" — reuses `bloom_heartwood`'s own stat block directly rather than a distinct new archetype entry (flagged here, not fixed: this means it's currently mechanically identical to the vertical slice's tutorial boss, just relabeled in mission text, not a reskinned/escalated stat block the way Choir got one).**
- **The Unnamed** (Act 3 final threat) — the source, growing beneath Meridian, emergent-tier, the campaign's true final boss, largest Endurance wall in the campaign, built to make the Collapse rule do maximum horror work. **Built 25 Aug 2026, `bloom_unnamed` (`data/bloom.ts`) — a real new stat block, not a Heartwood reuse: END 560 (exceeds Heartwood's 400, per this section's own "largest Endurance wall" spec), VIT 70, attackRange [1,5], attackPower 75. See that archetype's own comment for the full derivation. Debuts in Mission 35 "The Last Ring," spawned mid-siege via a scripted event rather than present from turn 1 — objective is hold_zone, not eliminate_all (see that mission's own comment in `campaignAmaranth.ts` for the full interpretation call: the Unnamed's own survival or death never factors into the win check, only holding the zone does). Sim-tested at 55% win — the campaign's hardest fight by design. Renamed from an earlier working name, 26 Aug 2026 — a cross-project naming collision with locked Qiraki material was caught; deliberate in-fiction irony, not a placeholder — see Spitball Ideas for the full note. Stats and mission behavior unchanged.**

## 9. The Heirlooms — Requiem, and Nineteen More

The existing design locks one Heirloom slot per Party, but its own porting appendix already flags the next step without building it: "up to five [Heirloom-grade pilots] per carrier... only matters when the Heirloom becomes more than one slot." Warden Company at full Act 3 strength is four lances — four carriers' worth of pilots. 4 × 5 = 20. That's not an arbitrary number; it's the existing ratio scaled to this battalion's actual size.

**Flagged 25 Aug 2026, not resolved here:** §6's roster correction means Act 3 is actually three lances (15 pilots), not four (20) — so the "4 × 5 = 20" derivation above no longer matches the corrected roster size on its own terms (3 × 5 = 15). Left unresolved on purpose rather than silently cutting five entries from the table below or re-deriving a new count: whether the Heirloom pool should shrink to 15 to match, or deliberately stay a 20-entry pool that outnumbers the roster (more variety to draw from than there are pilots to ever hold all of them at once, or headroom for a future roster increase) is a real creative call, not an arithmetic one. Maxime's call for whenever this section actually gets built. **Still true as of 25 Aug 2026 — only Requiem is actually implemented in the engine (every mission's own `heirloomCharge` field); the other nineteen, including "Meridian's Vow" below (specced for Mission 36), remain table entries only, not built. Missions 33–36 do not attempt to build them — flagged as a real, separate future system, matching this section's own standing note.**

Not one shared ultimate, twenty distinct ones, none reused from anything already assigned to a canon character or carrier. A veteran earns their own the way the tier ladder already implies: A tier is "Heirloom-adjacent" in the GDD's own table, so treat reaching it — and surviving a real story beat afterward — as the actual unlock condition, not a shop purchase. Twenty is a pool to draw from as pilots reach that point during build, the same way the seven Bloom archetypes are pre-rolled rather than generated on the spot.

Requiem stays the flagship, with a specific owner: Bosk's own heirloom, inherited by Rourke the moment he's lost covering the withdrawal in Mission 12 — which makes Act 1's finale the reason the player has it at all, and the friend-or-foe rule read as grief rather than as game design. **Still holds under §6a's permadeath rule regardless of exactly when Bosk is lost, since it inherits to Rourke either way — she's the one pilot guaranteed to be there to receive it.**

**This is also how the campaign delivers an Advance Wars-style CO power per veteran commander without building a second, parallel special-ability system next to the Heirloom one.** One mechanical system, two skins — a CO power, mechanically, is a Heirloom-grade effect. Nothing new needs building to make that true.

Every entry carries a real, felt cost — none are strictly-better versions of the base kit:

| Name | Best fit | Effect & cost |
|---|---|---|
| **Requiem** | Party-founding — Bosk's, then Rourke's | A line of damage eight tiles long, friend and foe alike, no exception. Ignores the full-HP cap. Cost: it doesn't check sides — a bad line costs you the ally standing in it. |
| **The Long Silence** | Tank | One devastating, guaranteed strike against a single target. Cost: the wielder's own mech drops to 1 HP the instant it resolves. |
| **Widow's Ledger** | Meeps | Every kill this turn stacks a growing damage bonus for the rest of the mission. Cost: counter damage against the wielder doubles for as long as the stack holds. |
| **The Last Word** | Munti | Fully restores one downed ally mid-mission, no spare part spent. Cost: the healer's own max HP is permanently reduced for the rest of the campaign. |
| **Deadfall** | Reeps | An unavoidable, uncounterable strike at double normal damage, any range. Cost: reveals the wielder's position to every enemy on the map for the rest of the turn. |
| **The Hollow Choir** | Any — Bloom specialist | Copies a weapon effect from any Bloom archetype already fought this campaign onto the wielder's next attack. Cost: the wielder suffers whatever on-hit effect they just inflicted. |
| **Groundfall** | Tank | Quadruples personal defence for two turns and drags every nearby enemy into melee range. Cost: the overshield drops to zero for everyone but the wielder while active. |
| **Cinder Line** | Any — area denial | Sets a whole line of tiles burning for several turns. Cost: it doesn't check sides — your own retreat route burns too. |
| **Farsight's Reckoning** | Reeps | Guarantees a critical hit against every enemy currently detected anywhere on the map, not just in range. Cost: consumes this turn and the wielder's entire next turn. |
| **The Debt Collector** | Munti | Restocks every downed ally on the board at once, full HP, no spare parts spent. Cost: the Munti is pulled from the board for the rest of the mission. |
| **Stormbreak** | Any — late-mission | A wide-radius blast that scatters and heavily damages every unit caught in it, friend or foe. Cost: a long charge, unusable before a mission's back half. |
| **The Iron Oath** | Tank | The wielder cannot be reduced below 1 HP for three turns. Cost: every point of damage spared lands at once the moment it ends. |
| **Hush** | Anti-Bloom specialist | Forces every Bloom unit in a radius down to Reflexive-tier AI for a turn. Cost: does nothing against House Amaranth or any non-Bloom target. |
| **The Debutante's Answer** | Meeps — salvaged, not issued | A captured House Amaranth officer's sidearm: an instant execute on any enemy already below half HP. Cost: the wielder's mech is stunned, skipping its next turn. |
| **Salt the Root** | Anti-Bloom specialist | Massive bonus damage against sessile/hive-type Bloom specifically (Gallcyst-family, the Wellroot, the Unnamed). Cost: notably weak against everything else. |
| **Last Muster** | Munti — story-gated | Refields every pilot lost so far this act, at reduced stats, for the rest of this mission only. Cost: they're gone again the moment the mission ends. |
| **The Quiet Part** | Reeps / Osnian | Removes the wielder from enemy targeting entirely for two turns. Cost: the wielder cannot act at all while active. |
| **Bloodprice** | Meeps | Converts the wielder's own remaining HP directly into bonus damage on the next attack. Cost: the lower the HP, the harder the hit, and the more it's risking. |
| **The Cutting Room** | Meeps / Hiopi centauroid | A single move that charges through and strikes every enemy in a straight line, ignoring terrain cost, ending adjacent to the last one hit. Cost: full commitment, no calling it off partway through. |
| **Meridian's Vow** | Battalion-wide — Mission 36 only | A battalion-wide damage and defence buff. Cost: usable exactly once in the entire campaign, ever — reserved, narratively, for the finale. |

## 10. Squad scaling — quick reference

| Act | Roster | Typical deploy | Off-board support | Rank | Heirlooms |
|---|---|---|---|---|---|
| I — The Fallow Line | 5 | 5 | none | 2nd Lt. → Capt. | 1 (Requiem), locked until Mission 12 |
| II — Two Fires | 10 (2 lances) | 5–8 | Ship fire-support call-in | Capt. → Maj. | a handful more come online as veterans reach A tier — visible/capped |
| III — The Last Ring | 15 (3 lances) | 8–12 | Capital fire-support + escortable capital-ship objectives | Maj.+ | up to 15 across the battalion — fully available, pending §9's own open question on the 20-entry pool |

*Note, 22 Aug 2026: this table's roster counts are the pre-permadeath plan — how big Warden Company is meant to get if nobody's lost outside the scripted beats. Under §6a's real permadeath rule, actual roster size at any point depends on how the campaign's actually played; the rotating-cast/recruit system is what's meant to keep the real number tracking this table's intent rather than only ever shrinking.*

**Corrected 25 Aug 2026 (chat):** the Act III row above originally read "~20 (4 lances)" / "up to 20 across the battalion" — corrected to 15/3 lances to match §6's own correction. In the actual built game, Act III's deploy cap (`ACT3_DEPLOY_CAP`, `scenes/TransporterPad.ts`) is 12, landing inside this row's "8–12" range at its top end.

---

## Act I — The Fallow Line

*WW1-style static war. Rourke's five-mech lance holds a strip of border trench-and-terrace country called the Fallow Line, alongside a House Amaranth detachment. Nothing works right, nobody has enough, and the war is mostly waiting — until it isn't.*

1. **Muster** — *Eliminate All (tutorial).* A Crawlmass probe on Rourke's first morning. Establishes all five voices; one clean win before anything real finds them.
2. **Wire and Mud** — *Hold Zone.* A Splitfang probe at the forward listening post. First chokepoint tactic (Bosk in the doorway).
3. **The Low Ground** — *Eliminate All.* Bloom mat catches a supply detail overnight — the gas-attack beat.
4. **Tunnel Rats** — *Eliminate All, featuring Undertow.* First burrower contact; Anand's sensor makes it winnable rather than horrifying.
5. **Foraging Party** — *Extract Unit.* First extraction; restock-not-death tested for real. **Under §6a, this is also the first mission where "restock" has a real condition attached (a live Munti) rather than being unconditional — worth this mission actually teaching that, not just extraction mechanics.**
6. **House Colors** — *Eliminate All.* A checkpoint dispute with House Amaranth turns violent. First distant sighting of Marrow.
7. **Sporewatch Ridge** — *Hold Zone.* Ridge-tile value against a Sporethrower push.
8. **The Choir Sings** — *Eliminate All* [mid-boss, new Bloom archetype]. First coordinated Bloom pack.
9. **Cut Off** — *Survive N Turns* [new objective type]. Comms sabotage (House Amaranth's doing, unrevealed yet) strands the lance.
10. **The Amaranth Betrayal** — *Extract Unit.* House Amaranth abandons a shared position; first felt gear-loss cost.
11. **The Long Walk Back** — *Extract Unit.* Fighting withdrawal through lost ground.
12. **The Fallow Line** — *Hold Zone* [act finale, scripted loss]. Thistledown Watch falls by design; Bosk covers the gate and doesn't make it out. Rourke promoted to Captain. **See §6a: "Bosk covers the gate" is the campaign's intent, not a guarantee — this only plays out on Bosk specifically if he's still alive going into this mission. Whoever writes this mission's real content needs a version of this beat that works for whichever pilot is actually left holding the gate.**

## Act II — Two Fires

*WW2-style mobile combined-arms war. Warden Company forms around Rourke's survivors and a second lance. Ship fire support arrives. The enemy is now unmistakably two enemies.*

13. **New Colors, Old Wounds** — *Eliminate All.* Integrating the second lance.
14. **Steel Rain** — *Eliminate All* [introduces ship fire support]. First Providence call-ins.
15. **Landfall** — *Contested Landing* [new objective type]. Opposed drop; the D-Day beat.
16. **Collaborators** — *Eliminate All.* House Amaranth conscripts; moral-complexity bonus objective.
17. **The Wellroot Uncovered** — *Extract Unit.* Bloom growth deliberately rooted into House Amaranth terraces.
18. **Breakout at Draven's Cut** — *Eliminate All.* Joint Bloom/House Amaranth pincer; composition choice finally matters.
19. **The Silent Ward** — *Eliminate All.* Undercity fighting beneath Colvane City.
20. **Marrow's Line** — *Eliminate All* [rival introduction]. First named mech-vs-mech duel with Marrow.
21. **Cut the Root** — *Eliminate All* [boss — Wellroot node]. First proper Bloom boss since the Choir.
22. **Ash on the Water** — *Protect Asset* [new objective type]. The Providence takes real damage; rehearsal for Act 3's capital-ship stakes.
23. **The Amaranth Accord** — *Extract Unit.* Confirmation of a deliberate bargain with the Bloom, not mere neglect.
24. **Two Fires** — *Eliminate All* [act finale]. Two-front convergence; House Amaranth's regulars broken; Marrow escapes. Rourke promoted to Major.

## Act III — The Last Ring

*The Bloom's growth, accelerated by House Amaranth's meddling, surges toward Meridian faster than accounted for. Warden Company — battalion-strength, still "Warden Company" — falls back ring by ring while a relief fleet burns toward the Reach on a timeline nobody on the ground can see.*

**Roster note, 25 Aug 2026:** the Third Lance (5 pilots, `THIRD_LANCE_PILOTS`/`campaignAmaranth.ts`) integrates on Mission 24's own win — the same "previous act's finale, won" beat Second Lance uses at Mission 12 — so it's already part of the roster as of Mission 25, not something this act opens without. See §6's own correction for why this is 3 lances (15), not 4 (20).

25. **The Reckoning** — *Eliminate All* [introduces capital fire support]. First contact with the surge's new scale; first Meridian's Oath call-in.
26. **The Unnamed Beneath** — *Extract Unit.* Discovery of the hive beneath Meridian, fed by the Wellroot network.
27. **Falling Back to Meridian** — *Hold Zone (chained withdrawal).* Multi-line defense-in-depth retreat.
28. **Marrow's Reckoning** — *Eliminate All* [rival closure]. Marrow turns on Halcyon Amaranth mid-battle at personal cost.
29. **The Outer Ring Falls** — *Hold Zone* [scripted strategic loss]. Meridian's outer ring overrun by design.
30. **Ashes of the Second Ring** — *Eliminate All.* City fighting; Meridian's Oath damaged on-station.
31. **The Last Convoy** — *Extract Unit (multi-unit)* [scripted partial loss]. Civilian evacuation; not everyone gets out. **Same flag as Mission 12: "not everyone gets out" is a design intent, not a guaranteed specific — see §6a.**
32. **Hold at the Spire** — *Protect Asset.* Defending a grounded capital ship before it can lift.
33. **The Innermost Ring** — *Hold Zone (multi-wave).* Final perimeter; tone shifts from "win" to "survive."
34. **No Word from the Fleet** — *Survive N Turns* [darkest hour]. Comms down; no confirmation of relief.
35. **The Last Ring** — *Hold Zone* [final boss breaches]. The Unnamed begins breaching into the open mid-siege.
36. **Until Relief** — *Survive N Turns → Victory* [campaign finale]. Hold until the relief fleet's countdown ends. Epilogue: the Reach holds, changed for good; nobody calls it the Amaranth Reach anymore.

**Build status, 25 Aug 2026: Missions 33–36 built this session — see the build log's own batch-7 addendum for the actual sim-tested numbers, the interpretation calls made building the finale, and The Unnamed's own stat derivation.** The campaign is complete: all 36 missions built, sim-tuned, tested, and delivered.

---

## Appendix A — New objective types needed

- **Survive N Turns** — win at turn count with objective(s) intact. Missions 9, 34, 36. Cheapest ask (Build Brief §6 already flags it). **Built.**
- **Contested Landing** — eliminate-all/hold-zone hybrid during an initial vulnerable landing window. Mission 15. **Built.**
- **Protect Asset** — a non-player off-board asset (a ship) with its own damage state, implicitly defended. Missions 22, 32. **Built.**

## Appendix B — Points economy note

The existing 4-mission slice pays ~700–780 points against a shop priced for that length. Scaling the same bonus structure (turns under limit, no pilot downed, no spare parts spent, no Heirloom used) across 36 missions and a roster growing fivefold needs its own balance pass at build time — a numbers exercise on an already-validated formula, not a redesign. **The recruit system's discretionary track (§6a) is part of that same future balance pass — its actual points cost isn't set yet.**

## Appendix C — Closing recommendation

Build Act 1 first as its own small vertical slice, the same way the original 4-mission slice proved the core loop. If it plays — if holding a line feels different from winning a fight, if losing Bosk lands the way the Mission 3 wipe was designed to land — Acts 2 and 3 are a content problem with a short, known list of engine asks attached, not an open question about whether the campaign works at all. **22 Aug 2026: "if losing Bosk lands" now has a sharper, harder version of the same question underneath it — does losing whoever's actually left standing land, whether or not that's Bosk, whether or not it's Mission 12. That's the real test of the permadeath rule in §6a, and it's a bigger claim than the original sentence was making.** **25 Aug 2026: the recommendation's own premise is now moot — all three acts are built, not just Act 1 — but the underlying question (does the permadeath rule actually land emotionally, mission to mission) is still the real open question, now answerable by actually playing it rather than by further design-doc reasoning.**
