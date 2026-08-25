# THE BLOOM WARS — Crew Banter & Conversation Generator: Phrase Bank v1

**Design content pass, zero code.** Written 25 August 2026 in response to Maxime's ask: *"the crew banter generator and conversation maker. I want to make the npc as alive as possible. following the formula (A+B)+(a+b4(c))=D+E."* This is content, not a system spec — the system it plugs into (the NPC Reaction Engine formula, Favorability, Stress) is already designed elsewhere and is only summarized here as much as the phrase bank needs. Same standing rule as everything else on the social/hub side of this project: **nothing here is wired into the game.** This is the raw material a future build would consume, saved now so the voice work doesn't have to be redone from scratch when that gate opens.

**Where this content is meant to live, mechanically, once it's built:** the ambient-line pool `claude/Bloom_Wars_Spitball_Ideas.md` and `claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §7 both flag as still-undesigned — "something like a rotating ambient-line pool per pilot, keyed to their current state" — plus the Rec Room / after-action / Stress-check contexts that pool would need to cover. Nothing below invents a new system; it fills in content for gaps three existing docs already named and left open.

---

## 0. How this bank is organized, and why

Three things are true about this project already, and this bank is built to fit all three rather than invent a fourth:

1. **The Reaction Engine's catalyst layer (`c`) is a closed set of nine animal labels** — Wolf, Dog, Cat, Crow, Raven, Bear, Fox, Rabbit, Shark (`claude/Bloom_Wars_NPC_Reaction_Engine_v1.md` §2) — already confirmed as the vocabulary both named pilots and player-created ones get read against (`claude/Bloom_Wars_Character_Editor_v1.md` §2). So this bank is written **per catalyst, not per named character** — a Wolf-catalyst line works for any pilot tagged Wolf, hand-authored or player-rolled. That's what makes it a *generator* and not 300 one-off barks that only ever fire for five named pilots.
2. **Two things affect how a pilot's voice matures, per Maxime: "military rank AND G-A ranks. they affect character growth."** Those are two different, already-existing tracks in this project (Qiraki's own D-through-S military rank ladder is a separate thing from the game's gear-tier ladder — see the note at the end of this section) and this bank collapses them into **three usable voice stages** rather than tracking every individual rank/tier combination separately, for the same reason the Reaction Engine simplified three catalyst lists down to one: buildable now beats theoretically complete.
3. **The existing rank-gated hub design (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §12) already has real rank names on record** — 2nd Lt. through Capt. through Maj., tied to Warden Company's actual campaign (missions 1-11 / 12-23 / 24+). This bank's three stages map onto that ladder directly, so a line picked for "Stage 2" already matches the rank a Capt.-tier pilot would actually hold.

### The three voice stages

| Stage | Reads as | Military rank band | Gear tier band | What changes in the voice |
| --- | --- | --- | --- | --- |
| **1 — Green** | Rookie, first deployment | 2nd Lt. / Pvt. / Cpl. / Spec. (junior, pre-Mission 12) | G – F | The catalyst trait shows in its rawest, least-earned form. Eager, a little insecure underneath, hasn't been tested by real loss yet. |
| **2 — Blooded** | Veteran, survived a real cost | Capt. / Sgt. and equivalent (Mission 12 – 23 band) | E – C | The trait has been tested and complicated by something that actually went wrong. More deliberate, more scarred, less need to prove it out loud. |
| **3 — Command** | Elite, others orient around them | Maj.+ and equivalent (Mission 24+) | B – A | The trait is fully owned and usually turned outward — toward the squad, not just the self. Quiet confidence, often with dry humor about their own type. |

**Note on the two rank tracks, so this doesn't get confused with what's already locked elsewhere:** Qiraki canon has an individual **D-through-S rank** ladder (soldier standing, gated by connective-AI grade) that is a *different scale* from the game's own **G-through-A gear tier** (`Bloom_Wars_Data_Pack_v0.1.docx` §4.4) — the two aren't meant to line up letter-for-letter. What this bank actually uses is the game's own **military rank titles** (2nd Lt./Capt./Maj., already on record for Warden Company) running alongside the game's own **gear tier**, which is what Maxime's answer asked for ("military rank AND G-A ranks") and what the game already tracks per pilot. Nothing here invents a new progression system — it reads the two the campaign already has.

### How a line gets picked (once this is wired up — not built yet)

`catalyst` (one of 9, from the pilot's Layer-2 read) + `stage` (1/2/3, derived from the pilot's current military rank and gear tier) + `context` (below) → one line, picked at random from that cell's pool so repeats aren't obvious on a short playthrough.

**Five contexts, matching rooms/systems that already exist in design:**

- **Hangar** — ambient, low-stakes, "talk to the crew" banter (Hangar Deck, `Bloom_Wars_Spitball_Ideas.md`'s Normandy-style ask)
- **After Action** — post-mission, the actual Favorability-gaining moment for having fought together
- **Off Duty** — Rec Room: Poker, Fletchers, the peg board, or a drink at the ship bar (§13.2 of the Hub doc)
- **Under Pressure** — a Stress moment or a CO's-grotto-style check-in (§11.4)
- **Close Call** — the specific "a Munti just saved someone" beat, staged as banter per the Hub doc's own rule: *"a close call is a joke opportunity, not a trauma beat."*

---

## 1. WOLF — teamwork

Reads as: syncing with the squad, having someone's back before being asked. Arc: **eager to belong → trusts because it's been tested → leads by making the squad feel like one unit.**

### Stage 1 — Green

**Hangar**
- "Just tell me where you need me and I'll be there. That's — that's the whole plan, right? Stick together?"
- "I keep counting heads before I move. Probably overkill this early. Feels wrong not to."
- "Nobody warned me how much of this job is just knowing where everyone else is standing."

**After Action**
- "That was the first time I actually felt like part of something instead of just next to it."
- "I moved because you moved. Didn't even think about it. Is that bad?"
- "We didn't lose anyone. I keep saying that like it's not the whole point."

**Off Duty**
- "Deal me in. I'm terrible at this, but I'd rather lose with everyone watching than win alone."
- "One drink. I want to remember tonight, not black it out."

**Under Pressure**
- "I don't know how to be useful to people I haven't fought next to yet."
- "Tell me the squad's fine and I'll believe whatever else you say after that."

**Close Call**
- "Okay — okay, that's twice now I've almost had a heart attack over someone who's standing right there laughing at me."

### Stage 2 — Blooded

**Hangar**
- "I used to think 'watch each other's backs' was just something people said. Turns out it's a skill. Took losing count to learn it."
- "Ask me who's got point today and I already know, without checking the board."
- "We don't talk about the ones we lost keeping this squad tight. Maybe we should. Not today."

**After Action**
- "Nobody got left. I stopped taking that for granted a while ago."
- "You covered a lane you didn't have to. I noticed. I always notice now."
- "There's a version of that fight where I go it alone and it goes worse. I know which version I picked."

**Off Duty**
- "Fletchers, and I'm not letting anyone hustle me twice in one deployment."
- "Buy the next round. Not because I lost — because we're all still here to drink it."

**Under Pressure**
- "I don't spiral anymore when someone's late back. I used to. The squad taught me patience I didn't have."
- "Talk to me like I'm one of the team having a bad day, not like I'm about to break."

**Close Call**
- "You scared ten years off every one of us. Ten. We counted."

### Stage 3 — Command

**Hangar**
- "This isn't my squad. It's ours. I just happen to be the one who says 'move' first."
- "Half of leading is knowing which of you needs a push and which of you needs me to shut up and trust it."
- "I've stopped keeping score of who saved who. Lost track years ago. That's the point."

**After Action**
- "Every one of you walked back. I don't say that lightly and I don't say it every time — today I'm saying it."
- "That's what a squad that trusts each other looks like from the outside. Good. Remember what it felt like."
- "I gave the order. You made it work. Don't let anyone tell you different, including me on a bad day."

**Off Duty**
- "Pull up a chair. Rank doesn't get you out of losing at Fletchers on my watch."
- "Drink's on me tonight. Every one of you earned it in a different way and I noticed all of them."

**Under Pressure**
- "You don't have to carry that alone just because you outrank the person who'd help you carry it."
- "I've learned to say 'I need a minute' out loud instead of pretending I don't. Try it. It works."

**Close Call**
- "We're framing that moment. Someday it's a story with a happy ending instead of the alternative, and I want it on the wall."

---

## 2. DOG — loyalty

Reads as: devoted to specific people, steadfast without needing a fresh reason every time. Arc: **fast, slightly naive attachment → loyalty survives a real scare → becomes the thing the whole unit structurally relies on.**

### Stage 1 — Green

**Hangar**
- "You're my wingman now. I've decided. You don't get a vote."
- "I already know I'd take a hit for half this lance and we've known each other a week."
- "Is it weird that I feel more loyal to you people than I did to half my old unit?"

**After Action**
- "You didn't have to circle back for me. You did anyway. I'm not going to forget that."
- "I stuck by you out there because that's just — that's just what you do. Right?"
- "First mission and I already know who I'm not leaving behind. That was fast."

**Off Duty**
- "I'll sit with you even if you don't want to talk. Just say the word."
- "Pull up a stool. You don't drink alone on my watch, not tonight."

**Under Pressure**
- "I get attached fast. I know. I'm working on not making that everyone else's problem."
- "Tell me you're okay and I'll believe you even when I shouldn't. That's on me to fix."

**Close Call**
- "Don't you ever do that to me again. I mean it. Also — glad you're fine. Also, don't."

### Stage 2 — Blooded

**Hangar**
- "I lost someone I was that loyal to once. Doesn't stop me being loyal again. Just makes it heavier."
- "You don't have to earn my loyalty twice. Once was enough, and it's still holding."
- "I choose who I stand next to now. It's not automatic anymore. It's better because it's not."

**After Action**
- "I've buried the version of loyalty that just runs on instinct. What's left is the kind that survives losing someone. This is that kind."
- "You'd have done the same for me. I know because I've watched you do it for someone else."
- "That's the third time we've walked off the same field together. I keep a count now. Didn't used to."

**Off Duty**
- "Peg board. Loser buys, same as always, and I'm not losing to you again."
- "One drink for the ones who made it back. Second one's just because I like your company."

**Under Pressure**
- "I don't panic when someone I care about gets hurt anymore. I get quiet and I fix it. Learned that the hard way."
- "Ask me how I'm holding up. I'll actually tell you now instead of saying 'fine.'"

**Close Call**
- "You keep doing this to me. I keep showing up anyway. That's the deal, apparently."

### Stage 3 — Command

**Hangar**
- "People say loyalty like it, but around here it's a job. I do the job. Every day, on purpose."
- "I've earned the right to worry about all of you out loud now. Don't take that away from me."
- "You can rotate anyone out of this squad except the loyalty. That part's not for sale."

**After Action**
- "I've buried people I was loyal to. That doesn't make me loyal to the rest of you any less — it makes me sure of what I'm choosing."
- "Every one of you knows exactly where I stand. That's not an accident. That's years of showing up."
- "I don't say 'I've got you' lightly anymore. When I say it, it's load-bearing."

**Off Duty**
- "Poker night. I'm buying because I remember what it cost to still have a table full of people to buy for."
- "Sit. Drink. I'll tell you which one of you I'm proudest of tonight, and it changes every week."

**Under Pressure**
- "I've learned the difference between loyalty and not letting people rest. Go rest. I've got the watch."
- "You don't need to prove anything to me. That ship sailed a long time ago, in your favor."

**Close Call**
- "I've stopped being surprised when this squad pulls someone back from the edge. I'd be more surprised if we ever stopped."

---

## 3. CAT — selfishness

Reads as: self-interest first, transactional, guards their own time and resources. Arc: **blunt, almost comic self-interest → learns to selectively invest because it now pays off → reframes squad-survival as self-interest, matured.**

### Stage 1 — Green

**Hangar**
- "I'm not here to make friends. I'm here to not die. If those overlap, great."
- "What's in it for me if I cover your flank? I'm asking for real."
- "I keep my gear in better shape than anyone here. That's not vanity, that's math."

**After Action**
- "I covered you because a dead squad is a squad that can't cover me next time. Purely practical."
- "Don't thank me. I did the math and helping you was the correct play."
- "I got mine out intact. Everyone else's business is everyone else's business."

**Off Duty**
- "I'm playing to win, not to be friendly. Ante up."
- "One drink. I'm not buying a round for people I've known a week."

**Under Pressure**
- "I don't do the whole 'talk about your feelings' thing. Ask me something useful instead."
- "I'm fine. I'm always fine. It's less effort than not being fine."

**Close Call**
- "Glad you're not dead. Would've been annoying to train a replacement."

### Stage 2 — Blooded

**Hangar**
- "Turns out keeping a couple of you alive is cheaper long-term than starting over with strangers. I've done the math twice now."
- "I still don't do this out of the goodness of my heart. I do it because losing you costs me something real now."
- "Careful — I've started caring what happens to a few of you specifically. Don't make it weird."

**After Action**
- "I covered you because losing you would actually cost me something now. That's new. I'm not thrilled about it."
- "You'd have done the same for me by now. I checked. You would have."
- "I got everyone out intact this time. Even me being smug about it is a group activity, apparently."

**Off Duty**
- "Fletchers. I'm still playing to win, but I'll admit it's better with people I don't hate."
- "Fine. I'll buy the round. Don't make this a thing."

**Under Pressure**
- "I don't do feelings talk. I do 'here's the actual problem, let's fix it.' Same effect, less crying."
- "I'm not fine, and unlike a year ago I'll admit that to exactly one or two people. You're one of them."

**Close Call**
- "You scared me. I don't love saying that. But you scared me, and I'm saying it."

### Stage 3 — Command

**Hangar**
- "I still call it self-interest. Nobody's corrected me because they've noticed my self-interest looks a lot like protecting all of you now."
- "I've stopped pretending this is transactional. It just sounds better when I keep saying it is."
- "Ask anyone — I still negotiate everything. I just negotiate on your behalf now too."

**After Action**
- "Everyone's accounted for. I'd call that a good return on investment, if I still believed that's what this is."
- "I used to keep score of what I owed people. I've lost track completely. Feels like losing, honestly. I don't mind."
- "You're all mine to look after now, whether I ever agreed to that in so many words or not."

**Off Duty**
- "I'm still playing to win. I'm also making sure everyone's actually having a good night. Both things, apparently."
- "Round's on me. Don't read into it. Read into it a little."

**Under Pressure**
- "I don't do sentiment. I do results. The result, right now, is you sitting down and letting me handle this."
- "I've learned looking after people isn't weakness. It's just a longer-term kind of selfish. I'm at peace with that."

**Close Call**
- "I nearly lost someone I've spent years pretending I don't care about. Pretending's officially over."

---

## 4. CROW — indulgence

Reads as: chases whatever currently has their attention, tangents, appetite, theories. Arc: **scattered, chasing distractions → indulgence becomes deliberate stress management → the appetite for the unusual becomes real expertise, owned with humor.**

### Stage 1 — Green

**Hangar**
- "Okay but hear me out — what if the Bloom isn't random, what if there's a pattern, I've been tracking it—"
- "I collect weird stuff. Bolts, bad jokes, one Bloom carapace piece I'm definitely not supposed to have."
- "Give me five minutes and a bored afternoon and I will find you a conspiracy theory about literally anything on this ship."

**After Action**
- "That fight is going straight into my theory. Everything goes into the theory eventually."
- "I got distracted mid-fight thinking about why the pack broke formation like that. Nearly got hit. Worth it, probably."
- "New data point! I'm annoyingly pleased about this given what it cost to get it."

**Off Duty**
- "Poker's just a excuse for me to watch everyone's faces and build theories about them. Deal me in."
- "One drink turns into me explaining my whole Bloom-migration theory to whoever's still listening. Fair warning."

**Under Pressure**
- "I deal with stress by finding something new to obsess over. It's not healthy. It works, though."
- "Don't ask me how I'm doing, ask me what I'm currently fixated on. Same answer, better mood."

**Close Call**
- "See, THIS is going in the theory. 'Munti saves override probability entirely.' I'm onto something."

### Stage 2 — Blooded

**Hangar**
- "My theories used to be about the Bloom. Half of them are about keeping this squad alive now. Priorities shifted."
- "I still chase every weird lead. I've just learned which ones are worth chasing during a fight and which ones wait."
- "Turns out half my 'conspiracy theories' were just me noticing patterns nobody else had time to. That's a compliment I give myself now."

**After Action**
- "I clocked the pack behavior shift before anyone called it. Nobody believed me the first three times. I've stopped needing them to."
- "My attention wanders less in a fight now. Not gone. Less. I call that progress."
- "That detail I obsessed over last month just saved someone's life today. I'm allowed to be smug about that one."

**Off Duty**
- "Peg board. I've got a theory about the pattern in this game too. Of course I do."
- "One drink, one new obsession explained in too much detail. It's basically a ritual at this point."

**Under Pressure**
- "I chase distractions on purpose now. It's not avoidance, it's maintenance. There's a difference and I've learned it."
- "Give me something to dig into and I'll steady out. Always has worked. Now I actually trust that about myself."

**Close Call**
- "That's going in the log under 'things that nearly broke my brain and also my heart, same afternoon.'"

### Stage 3 — Command

**Hangar**
- "People used to roll their eyes at my theories. Half of them are standard doctrine around here now. I notice things. Turns out that's a skill."
- "I still chase tangents. I've just learned to bring the squad along for the useful ones."
- "Ask me anything. I probably have a theory. Most of them are right now, which honestly still surprises me."

**After Action**
- "I called that pack shift four minutes before it happened. Nobody's surprised anymore. I still am, a little."
- "My attention doesn't wander in a fight anymore. It's not that I stopped noticing everything — I just stopped letting it cost anyone."
- "Every strange detail I ever chased down came together today. I'd call that vindication, if I were the type to gloat. I am the type."

**Off Duty**
- "Fletchers. I'll walk you through my current theory whether you asked or not — that's the deal, that's always been the deal."
- "Drinks are on me. Ask me what I'm obsessed with this week. It's a good story, I promise."

**Under Pressure**
- "I still cope by chasing something strange and specific. I've just learned to notice when someone else needs that same outlet, and hand it to them."
- "My mind still won't sit still. I've made peace with steering it instead of fighting it. Recommend it, honestly."

**Close Call**
- "I've got a whole file of near-misses like that one. I don't reread it for fun anymore. I reread it because it reminds me why we do the rest of this."

---

## 5. RAVEN — instruction

Reads as: teaches, corrects, explains, the one who tells you how. Arc: **over-explains before earning the authority to → instructs from real scar tissue → becomes the generous, patient mentor others actually seek out.**

### Stage 1 — Green

**Hangar**
- "Actually, you'll want to angle your approach two degrees wider than that — I read it in a manual, don't look at me like that."
- "I know I sound like I've done this for years. I have not. I've just read everything."
- "Let me walk you through why that worked. I promise it's useful and not just me showing off. Mostly."

**After Action**
- "Told you the approach angle mattered. I wasn't sure until it actually worked, if I'm honest."
- "I called the timing on that and got lucky it landed right. I'll take it."
- "Next time, hold two turns longer before the push. I'm learning this in real time right alongside you."

**Off Duty**
- "I can walk you through Fletchers technique or we can just play. Your call. I vote technique."
- "One drink and I promise not to explain the fermentation process. No promises on anything else."

**Under Pressure**
- "I deal with nerves by explaining things to people whether they asked or not. Bear with me."
- "Ask me something you actually want to know. I'm better at answering than I am at just sitting with it."

**Close Call**
- "See, that's exactly the scenario the manual warns about. I did not expect to see it in person quite so fast."

### Stage 2 — Blooded

**Hangar**
- "I only teach what actually almost got someone killed now. Cuts the material down a lot, honestly."
- "I used to explain everything. I've learned which lessons land and which ones just make me feel useful. Different skill."
- "Ask me a real question and I'll give you a real answer, no manual quotes attached. Learned that the hard way."

**After Action**
- "That call I made — I got it from a mistake I watched someone else make once. Didn't want to repeat it."
- "I taught you that angle because I saw what happens when someone doesn't know it. I'd rather you learn it from me than from that."
- "Good instinct out there. You didn't need my help on that one and I noticed."

**Off Duty**
- "Peg board — I'll teach you the pattern this time, no lecture attached, I promise."
- "One drink. I'll actually just talk instead of instructing for once. Rare, savor it."

**Under Pressure**
- "I've stopped explaining my way through everything. Some things you just have to sit in. Learning that too."
- "Tell me what's actually wrong. I'll skip the lesson and just listen this time."

**Close Call**
- "I've seen that exact scenario end differently. I'm glad this is the version I get to remember instead."

### Stage 3 — Command

**Hangar**
- "People come to me before a fight now, not after. That's the actual job, I think. Nobody told me, I just noticed."
- "I don't lecture anymore unless it's asked for. Funny how much more people listen once you stop insisting."
- "Every hard lesson I've got, I'll hand over free. No charge, no ego attached anymore."

**After Action**
- "You made that call yourself out there. I didn't have to say a word. That's the whole point of teaching, and I finally believe it."
- "I've buried the version of me that needed to be the smartest person in the briefing. What's left just wants everyone walking home."
- "That's a lesson I learned from losing someone. I'd rather hand it to you than watch you learn it the same way."

**Off Duty**
- "Sit. I'll teach you the peg board properly this time — not to win, just because it's a good thing to know."
- "Drinks on me. Ask me anything. I've got fewer answers than I used to pretend, and I'm finally okay saying that."

**Under Pressure**
- "You don't need a lesson right now. You need someone to sit with you. I can do both, but I know which one this is."
- "I've learned the best thing I can teach is that it's fine to not have it together today."

**Close Call**
- "I've watched that scenario go every possible way over the years. I'll take this ending every single time."

---

## 6. BEAR — isolation

Reads as: solitary, guarded, prefers distance, watchful from the edge of the room. Arc: **newly guarded, a little defensive about it → isolation becomes a respected professional posture → softens at the edges without disappearing; the squad becomes the one exception.**

### Stage 1 — Green

**Hangar**
- "I'm not being rude. I just don't do the group thing well yet. Give it time."
- "I'll take the corner table. Not because I dislike you. I just need the corner."
- "I don't know how to small-talk. I know how to watch a room. That's what I've got right now."

**After Action**
- "I hung back and covered the angle nobody else was watching. That's just where I end up."
- "I don't celebrate loud. I noticed everyone made it back, though. That's mine, quietly."
- "Ask someone else how it went. I'll just say it went fine and mean it more than it sounds."

**Off Duty**
- "I'll watch the game. I don't need to be dealt in to enjoy it."
- "One drink, alone, at the end of the bar. That's not a rejection. That's just the shape of my evening."

**Under Pressure**
- "I don't want company right now. I might in an hour. Ask again in an hour."
- "I process things by myself first. Always have. I'll talk when there's something worth saying."

**Close Call**
- "I noticed before anyone called it. Didn't say anything. Would've if it went the other way."

### Stage 2 — Blooded

**Hangar**
- "I still take the corner table. Nobody questions it anymore. That's its own kind of belonging, I've decided."
- "I watch the room because it's useful, not because I'm avoiding it. Both used to be true. Now it's mostly the first one."
- "I don't talk much. When I do, people have started actually listening. That's new, and I don't hate it."

**After Action**
- "I caught the angle nobody else had eyes on. Again. Somebody has to be the one watching the edges."
- "I don't need thanks for holding the line alone out there. I'd have done it whether anyone noticed or not."
- "Everyone made it back. I'll admit that mattered to me more than I let on."

**Off Duty**
- "I'll sit at the edge of the table. Deal me in anyway. I like watching more than I like winning."
- "One drink, still alone, still at the end of the bar. A couple of you have started just — sitting there with me. I've stopped minding."

**Under Pressure**
- "I still need distance first. I've learned to say so instead of just disappearing. Small improvement, real one."
- "I don't need you to fix it. I need you to know it's there. That's enough."

**Close Call**
- "I don't do relief out loud well. Just know I felt it. All of it."

### Stage 3 — Command

**Hangar**
- "I still keep to the edges. I've just noticed the edges are where this whole squad's safety usually gets decided, so I don't mind the reputation."
- "People assume isolation means I don't care. It's the opposite. I watch you all closer than anyone."
- "I don't need the room anymore. I've got the handful of you that matter, and that's plenty."

**After Action**
- "I watched every angle out there so none of you had to. That's the job I picked, and I'd pick it again."
- "I don't say this often — I was glad every one of you made it back. Write that down, it won't happen twice this month."
- "Solitude taught me to notice everything. Everything I notice, I spend on keeping you alive now."

**Off Duty**
- "I'll sit with the squad tonight. Still not talking much. Still here. That's the whole message."
- "Drink's on me, for once. I don't do this for many people. Consider it noted."

**Under Pressure**
- "I've learned the difference between needing space and needing to be alone. Come find me when I need the first one. I'll let you, now."
- "You don't have to talk me through it. Just don't leave the room yet. That's what I actually need."

**Close Call**
- "I don't scare easy. That scared me. I'm not going to pretend otherwise anymore — not to you."

---

## 7. FOX — trickery

Reads as: cunning, misdirection, enjoys getting one over, doesn't always read the room. Arc: **trickery for fun and showing off → feints and misdirection start actually saving lives → full tactical cunning, respected by command, still keeps the humor.**

### Stage 1 — Green

**Hangar**
- "I swapped the labels on the ration crates. Don't tell the Quartermaster. Actually, tell him. It'll be funnier."
- "I like knowing something you don't. It's not personal. It's just fun."
- "Watch — I bet I can talk my way past that duty roster before end of shift."

**After Action**
- "I baited them left, everyone else hit right. Worked better than I expected, honestly."
- "I got a little too pleased with myself out there. In my defense, it worked."
- "That feint was mostly improvised. Don't tell command it was mostly improvised."

**Off Duty**
- "Poker. I will absolutely bluff you and I will absolutely enjoy it."
- "One drink, and I'm definitely going to tell an exaggerated version of today. It's more fun that way."

**Under Pressure**
- "I deal with nerves by pulling pranks. Bad coping mechanism. Effective one."
- "Don't take my jokes as me not taking this seriously. It's just how I get through it."

**Close Call**
- "Okay, that one wasn't funny. I'm still going to make it funny later, but not right now."

### Stage 2 — Blooded

**Hangar**
- "I still like knowing something you don't. These days it's usually the thing that keeps you alive, so I've decided that's fine."
- "My tricks used to be for fun. Half of them are tactics now. The other half are still just for fun."
- "I read the room better these days. Mostly so I know exactly when to make it worse on purpose."

**After Action**
- "That feint wasn't improvised this time. I planned it. Felt strange being the responsible one for a second."
- "I baited the whole pack into a kill box. Command's going to ask how I knew that would work. I'm not telling them it was a guess."
- "I got everyone out using a trick that could've gone very wrong. I've started thinking harder before I commit to those. Progress."

**Off Duty**
- "Fletchers. I'm still bluffing you, but I'll admit it's more fun when you actually see it coming half the time now."
- "One drink, and this time the exaggerated story has an actual point to it. Character growth."

**Under Pressure**
- "I still crack jokes under stress. I've learned to check who needs the joke and who needs me to stop."
- "I trick my own head into calm the same way I trick the enemy into a bad position. Whatever works."

**Close Call**
- "I'm going to make a joke about this eventually. Today's not that day. Ask me next week."

### Stage 3 — Command

**Hangar**
- "I don't play tricks for fun much anymore. I play them because I've watched the right one save a whole squad. That's a better reason."
- "People trust my read on a bad situation now. Feels strange, being the reliable one. I'm still funny about it, don't worry."
- "I know something you don't. This time it's a plan that keeps all of you breathing. Old habits, better reasons."

**After Action**
- "I've stopped needing anyone to be impressed by the trick. I just need it to work. It worked."
- "That misdirection came from years of learning exactly how far I can push a bad plan before it stops being clever. We're under that line. Barely."
- "I got everyone home using a play nobody else would have tried. I don't need credit for it. I'll take it anyway, quietly."

**Off Duty**
- "Poker night, my rules. I'll still bluff every one of you, and every one of you will still fall for it, and that's exactly why I love this crew."
- "Drinks are on me. I'll tell the real version of the story tonight, for once. Don't get used to it."

**Under Pressure**
- "I still cope with a joke first. I've learned to follow it with something real, right after, so it doesn't just deflect."
- "I read this room the way I read a battlefield. Right now it's telling me someone needs quiet, not a punchline. I can do quiet."

**Close Call**
- "I've made peace with not turning every near-miss into a bit. This one, I'm just glad about. No joke attached."

---

## 8. RABBIT — nurturing

Reads as: caretaking, healing, worry for others' wellbeing before their own. Arc: **anxious caretaking that doesn't trust its own judgment under fire → steadied by real competence, the fear stops paralyzing → becomes the squad's actual anchor, quietly load-bearing.**

### Stage 1 — Green

**Hangar**
- "I keep a mental list of everyone's HP even when we're not in a fight. I don't know how to turn that off."
- "Tell me if something hurts. Please. I'd rather know too early than too late."
- "I'm not as steady as I want to be yet. I'm working on it. I promise I'm working on it."

**After Action**
- "I patched you up with my hands shaking the whole time. Got it done anyway. I'll take that as a win."
- "I keep replaying whether I could've reached you faster. You're fine. I know you're fine. I still replay it."
- "Everyone's stable. I said it three times to myself before I believed it."

**Off Duty**
- "I'll play, but I'm also going to check on you twice during the hand. Occupational habit."
- "One drink, and I'm still going to ask if you're actually okay underneath the joking around."

**Under Pressure**
- "I worry about everyone else so I don't have to sit with how I'm doing. I know that's backwards. I do it anyway."
- "Ask me how I'm holding up and I'll deflect to how you're holding up. Every time. It's a whole thing."

**Close Call**
- "I got there in time. I got there in time. I need to say that a few more times before my hands stop shaking."

### Stage 2 — Blooded

**Hangar**
- "I still keep the mental list. It doesn't scare me the way it used to — I trust my hands now more than I trust my worry."
- "I've saved enough of you now that I believe it when I say I've got this. Took a while to believe that."
- "Tell me if something hurts. I'll actually know what to do about it this time, and it won't be shaking while I do it."

**After Action**
- "I got to you in time because I trusted the read instead of freezing on it. That's new. That's good."
- "I've stopped replaying every call after the fact. Mostly. I trust the ones I made today."
- "Everyone's stable. I believed it the first time I said it, for once."

**Off Duty**
- "I'll play properly this time instead of half-watching the room for injuries that aren't happening. Progress."
- "One drink. I'm still checking on you underneath the joking. That part never goes away and I've stopped apologizing for it."

**Under Pressure**
- "I've learned to let people worry about me back. Still strange. Still letting it happen."
- "Ask me how I'm doing and I might actually answer honestly this time. Might."

**Close Call**
- "I got there. My hands didn't even shake this time. I noticed that, right in the middle of it."

### Stage 3 — Command

**Hangar**
- "Everyone orients around me without saying it out loud. I noticed a while back. I try to be worth orienting around."
- "I don't panic-check the roster anymore. I just know. Years of this does that to you."
- "Tell me if something hurts. I'll fix it, and I won't need to be told twice, and I won't shake doing it. Not anymore."

**After Action**
- "Nobody's down. That's not luck at this point. That's a decade of learning exactly where to be standing."
- "I stopped replaying my calls after the fact years ago. I trust them. They've earned it."
- "Everyone's stable, and for once that sentence doesn't cost me anything to say. It's just true."

**Off Duty**
- "I'll play, and for once I'm not watching the room for injuries — I'm just here, with all of you, actually resting."
- "Drinks are on me tonight. I've spent years making sure you're all fine. Let me buy the round for once."

**Under Pressure**
- "I let people take care of me now. Learned it late. Learned it anyway."
- "You don't have to hide it from me. I've built this whole life around noticing exactly this. Let me in."

**Close Call**
- "I've stopped needing to say it three times before I believe it. One look, and I know. That's what all this practice was for."

---

## 9. SHARK — ambition

Reads as: driven, competitive, measuring themselves against a bar. Arc: **raw, slightly abrasive ambition that hasn't earned results yet → tempered by real cost, more calculating → matured into drive that lifts the squad, not just the self.**

### Stage 1 — Green

**Hangar**
- "I'm going to be the best pilot on this ship. Not being modest about it. Watch the board."
- "I clock everyone's kill count. Don't take it personally. I clock my own harder."
- "Give me the hard mission. I want the one people remember."

**After Action**
- "I got the most kills today. I know that's not the point. I'm still going to mention it."
- "I pushed harder than I needed to. Nearly cost me. Worth it for the numbers, probably."
- "Next time I want the lead position. I've earned it. I think I've earned it."

**Off Duty**
- "Poker. I'm playing to win, obviously. What else would I be playing for?"
- "One drink, and yes I'm still thinking about tomorrow's board standings. Sue me."

**Under Pressure**
- "I don't like losing. To the Bloom, to a hand of cards, to anyone. I know that's a problem. Working on it."
- "Tell me I'm still on track. I need to hear it more than I'd like to admit."

**Close Call**
- "Glad you're fine. Also, that's going to mess up the squad's numbers if it happens again, so — glad you're fine, mostly."

### Stage 2 — Blooded

**Hangar**
- "I stopped chasing the kill count after watching what chasing it almost cost someone. Still competitive. Aimed it somewhere better."
- "I still want to be the best on this ship. I've just learned that includes making everyone around me better too."
- "Give me the hard mission. I've earned it for real this time, not just on paper."

**After Action**
- "I didn't push past the line today. Learned that lesson the expensive way once already. Not doing it twice."
- "Everyone's numbers looked good today, mine included. I've started meaning that plural on purpose."
- "I wanted the lead position and I got it and it cost more than I expected. I'm recalibrating what 'winning' actually means out here."

**Off Duty**
- "Fletchers. I'm still playing to win. I've just stopped needing you to lose badly for it to count."
- "One drink. I'll admit the board standings mattered less to me tonight than just being here did."

**Under Pressure**
- "I still hate losing. I've learned which losses are actually about me and which ones I need to let go of."
- "Tell me I'm still on track. I mean it differently now — less about the score, more about whether I'm still someone worth following."

**Close Call**
- "That would've cost the squad someone good. I'm allowed to care about that as its own thing, not just the math."

### Stage 3 — Command

**Hangar**
- "I stopped measuring myself against the board a while back. Now I measure myself against whether the people under me are getting better. Harder bar. Better one."
- "Ambition got me here. What keeps me here is making sure it's not just mine anymore."
- "Give me the hard mission — for the squad's sake this time, not the scoreboard's."

**After Action**
- "I don't chase the numbers anymore. I chase everyone walking back with a number attached to their name at all. Different math."
- "I held the line instead of pushing for the kill. Old me would've pushed. Old me got someone hurt once doing that. I remember."
- "Every one of you is sharper than when you started under me. That's the only score I actually track these days."

**Off Duty**
- "Poker night. I'll still win, probably. I've started enjoying watching the rest of you get good enough to actually threaten that."
- "Drinks on me. I've spent a long time chasing being the best. Turns out the actual prize was building people who could take my place."

**Under Pressure**
- "I still don't love losing. I've learned some things are worth losing for. That took most of a career to learn."
- "Tell me the squad's still on track. That's the only scoreboard that's mattered to me in years."

**Close Call**
- "I built rank chasing being the best pilot on this ship. Losing you would've cost more than any board position ever could. I mean that."

---

## 10. Named-pilot voice keys (canon-sourced, for the roster that already exists)

Every named pilot below already has a rank, a mek track, and a personality note on record in the Canon Pass and the Amaranth Reckoning doc. This section assigns each one a catalyst read (a proposal, not locked — same "your call" status the Character Editor gives the animal-label system generally) and gives 2-3 signature lines pulled from the generic bank above, adjusted to their actual voice and callsign. **These aren't a separate 300 — they're a demonstration of the generator actually producing usable, in-character output**, so this doc proves the system works against real content, not just the abstract bank.

### Warden Company (Amaranth Reckoning — the built campaign, Act I live in-engine)

- **2nd Lt. Dessa Rourke "Lark"** — Shark leaning Wolf as she promotes. Stage 1 now (2nd Lt., campaign start), scripted to reach Stage 2 at Capt. (Mission 12) and Stage 3 at Maj. (Mission 24) — her whole arc is this bank's Shark→Wolf progression made literal, on schedule, matching "Growth arc: learning patience" already on record.
  - *(Hangar, Stage 1, Shark)* "I'm going to be the best pilot in this company. Not being modest about it. Watch the board."
  - *(After Action, Stage 1, Shark)* "I pushed harder than I needed to out there. Nearly cost me. Worth it for the numbers, probably."
  - *(Promotion beat, Stage 1→2 transition — new line, not in the generic bank, since a rank-up moment for a named lead deserves one)* "Captain. Huh. I keep waiting to feel like I earned it and mostly I just feel like I don't want to lose anyone finding out I haven't."

- **M.Sgt. Halvard Bosk "Anvil"** — Dog, Stage 2 (veteran NCO, the mentor, pre-Mission 12).
  - *(Hangar, Stage 2, Dog)* "I choose who I stand next to now. It's not automatic anymore. It's better because it's not."
  - *(Under Pressure, Stage 2, Dog)* "Ask me how I'm holding up. I'll actually tell you now instead of saying 'fine.'"

- **Pvt. Tegan Iyari "Foxfire"** — Fox, Stage 1 (young, competitive, per her callsign and the rivalry with Rourke already on record).
  - *(Hangar, Stage 1, Fox)* "Watch — I bet I can talk my way past that duty roster before end of shift."
  - *(After Action, Stage 1, Fox)* "That feint was mostly improvised. Don't tell command it was mostly improvised."

- **Cpl. Priya Anand "Farsight"** — Bear leaning Raven as she steps into Bosk's mentor role. Stage 1 now, arc toward Raven mirrors "becomes the company's real mentor once Bosk is gone" already on record.
  - *(Hangar, Stage 1, Bear)* "I don't know how to small-talk. I know how to watch a room. That's what I've got right now."
  - *(After Action, Stage 1, Bear)* "I hung back and covered the angle nobody else was watching. That's just where I end up."

- **Spec. Corin Lask "Patch"** — Rabbit, Stage 1 (matches "the fragile centre everyone organizes around" directly).
  - *(Hangar, Stage 1, Rabbit)* "I keep a mental list of everyone's HP even when we're not in a fight. I don't know how to turn that off."
  - *(Close Call, Stage 1, Rabbit)* "I got there in time. I got there in time. I need to say that a few more times before my hands stop shaking."

### Team One (the base 4-mission slice — frozen at Stage 1, all lost or newly promoted by Mission 3)

- **Fracrals Thyns** (Hiopi, Tank, squad CO) — Wolf, Stage 1. *"Just tell me where you need me and I'll be there. That's the whole plan, right? Stick together?"*
- **Derek Barasj** (Munti, loyal, energetic) — Rabbit leaning Dog, Stage 1. *"Tell me if something hurts. Please. I'd rather know too early than too late."*
- **Hiro Nagori** (Meeps, conspiracy-theorist flavor) — Crow, Stage 1. *"Okay but hear me out — what if the Bloom isn't random, what if there's a pattern, I've been tracking it—"*
- **Yren Tourignie** (Reeps, joins mid-Mission 1 as reinforcement) — Wolf, Stage 1. *"First mission and I already know who I'm not leaving behind. That was fast."*
- **Trav** (Meeps, player-facing lead) — Bear, Stage 1, per his own established book-canon voice (reserved, quiet, non-reflective, warms slowly). *"I don't know how to be useful to people I haven't fought next to yet."*

### Team Two & bench (roster-depth pilots, Canon Pass §H — not wired into any mission yet)

- **Bram Solvig** (Osnian, Munti, CO, family-oriented) — Dog, Stage 2. *"I choose who I stand next to now. It's not automatic anymore."*
- **Frida Green** (human, Munti, orphan, hardass, no humor) — Cat, Stage 1. *"I'm not here to make friends. I'm here to not die. If those overlap, great."*
- **Trahsin Hyrs** (Hiopi, Tank, massive gunlance) — Bear leaning Wolf, Stage 1. *"I'll take the corner table. Not because I dislike you. I just need the corner."*
- **Elodie Dufours** (human, Reeps, preppy, company trivia) — Raven, Stage 1. *"I know I sound like I've done this for years. I have not. I've just read everything."*
- **Naomi Castell** (human, Reeps, extreme long range, stays where the enemy can't reach) — Bear, Stage 2 (the isolation reads as earned professional posture, matching her fluff directly). *"I still take the corner table. Nobody questions it anymore."*
- **Suki Arnesen** (human, Reeps, close-range, never stops moving) — Fox, Stage 1. *"I like knowing something you don't. It's not personal. It's just fun."*

---

## 11. The template multiplication layer — how this actually gets to thousands

Maxime, mid-build: *"300 is prolly not enough, add a few 0s to that number lol."* Fair — and worth being straight about rather than just cranking out volume: literally hand-writing 3,000 or 30,000 individual lines would mean either weeks of work or the same handful of sentence shapes wearing thin fast, which is worse for "alive-feeling NPCs" than 300 good lines, not better. A real crew-banter *generator* gets to thousands the way this project's own Reaction Engine formula already does it — a small set of authored pieces, recombined by rule — not by brute-force authoring every possible output by hand. This section is that layer: fill-in slots pulled from data this project already has, applied on top of a real chunk of the bank above, multiplying the true output count into the thousands honestly.

### How it works

Take a line already in the bank and replace one fixed detail with a slot:

- Before *(Wolf, Stage 1, Under Pressure)*: "Talk to me like I'm one of the team having a bad day, not like I'm about to break."
- With one slot: "Talk to me like I'm one of the team having a bad day, not like I'm about to break — same as you would for {SQUADMATE}."

At runtime, `{SQUADMATE}` resolves to any other living pilot currently in the roster. A 5-pilot lance gives 4 valid fills; a 20-pilot battalion roster (Act III scale, per the campaign doc's own squad-scaling table) gives up to 19. One authored line, up to 19 distinct deliverable strings, zero extra writing.

### The slot vocabulary — nothing invented here, all pulled from data this project already tracks

| Slot | Fills from | Typical count |
| --- | --- | --- |
| `{SQUADMATE}` | Any other living pilot on the current roster | 4 (Act I lance) – 19 (Act III battalion) |
| `{CLASS}` | Meeps / Tank / Reeps / Munti | 4 |
| `{LOADOUT}` | The speaker's current gear-tier display name (Stocklance → Stormblade, per path — Canon Pass §D) | 7 per path |
| `{ENEMY}` | Most recently fought Bloom archetype (Crawlmass, Splitfang, Undertow, Sporethrower, Gallcyst, Sirenmaw, The Heartwood) or a named hostile mech | 7+ |
| `{MISSION}` | The mission just completed, by name — all 36 Amaranth Reckoning missions are already named in that doc | up to 36 |
| `{ROOM}` | Hangar Deck / the Workshop / the Vault / Berths / CIC | 5 |
| `{SHIP}` | Providence / "the Antfarm" | 2 |

### What this actually buys, honestly counted

Not every one of the 319 authored lines takes a slot naturally — forcing one in would hurt more lines than it helps, so this is deliberately partial. A realistic pass: roughly **120 of the 319 lines** (the After Action, Hangar, and Close Call lines especially — the ones already gesturing at "someone," "that fight," "the mission" — are the natural candidates) take exactly one slot each, most often `{SQUADMATE}` or `{MISSION}`.

120 lines × an average of ~10 valid fills each (a mid-campaign roster/mission-list size, not the Act III maximum) = **roughly 1,200 additional unique deliverable strings**, on top of the 319 the roster already had, without writing a single new sentence. Stack a second slot on the highest-value lines (a `{SQUADMATE}` *and* an `{ENEMY}` in the same line, say) and the honest ceiling climbs past **3,000** at Act III roster size — genuinely "a few zeros" past 300, and every one of them still reads like a specific person saying a specific thing, which is the actual goal here, not the number for its own sake.

**What this doesn't do: become an infinite generator.** Slots run dry once every combination's been seen enough times, same as any templated system — worth flagging honestly rather than overselling it as unlimited. The fix, if it's ever needed, is the same one this bank already uses: author more seed lines per catalyst/stage/context, not stack more slots onto the ones that exist.

---

## 12. What this doc doesn't decide

- The actual data schema this would load into (`HubScene` isn't the right shape for this — see the Hub doc's own §7 gap flag — a new `AmbientLinePool` type, keyed by catalyst/stage/context, is the obvious next step whenever this gets built).
- Whether Stage transitions fire automatically off rank/tier changes or need a scene attached (the Vault's mandatory Mission 12 scene is the one precedent for "this needs a real beat," everything else here defaults to ambient).
- The exact rank/tier boundary numbers — "2nd Lt./G-F" etc. above are this bank's own working definition, not a re-lock of anything; easy to retune once real playtesting says a stage feels early or late.
- Whether every pilot gets a second, secondary catalyst read (the Character Editor's own open question, §7 of that doc) — this bank is written single-catalyst throughout; a two-catalyst pilot would just draw from two of these nine pools instead of one, no format change needed.
- Line count: **297 generic lines (9 catalysts × 3 stages × 11 lines) plus 22 named-pilot demonstration lines = 319 authored, plus a template layer (§11) that turns a real subset of those into roughly 1,200-3,000+ unique deliverable strings** depending on roster size, without writing more prose. Weighted toward the reusable generic bank on purpose, since that's what actually scales across a rotating roster instead of five fixed voices — and it's also what makes the multiplication layer possible at all: a slot on a named pilot's one-off line only pays off once, a slot on a catalyst-level line pays off every time any pilot carrying that catalyst says it.
- The template layer's exact slot list (§11) is a first pass, not final — easy to add more slots (a Favorability-tier flavor word, a Stress-level flavor word) once those systems have real numbers behind them, per this doc's own "shape now, math later" discipline.
