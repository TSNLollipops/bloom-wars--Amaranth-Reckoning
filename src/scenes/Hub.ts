// src/scenes/Hub.ts
// The real, in-repo start of claude/Bloom_Wars_Walkable_Hub_Build_Plan_v1.md
// Phase 1 — "minimum walkable hub." Everything here was already proven out
// in an isolated canvas spike first (per that doc's own De-risking Note,
// §4) — this scene is that same proven shape (real-time WASD/arrow
// movement, room collision, sound-range Talk verb) rebuilt against the
// real engine's own conventions (Phaser Graphics/Text placeholders, GDD
// §12.2's circle+initials portrait rule, the muted blue-grey palette
// Boot/Hangar/TransporterPad already share) instead of the spike's
// throwaway plain-canvas code.
//
// Scope line, worth being explicit about (project's own "flag before
// growing scope" rule): this scene uses LOCAL, scene-only pilot state for
// Stress/Morale/drunk/catalyst and for Favorability — none of it reads
// from or writes to CampaignState/PilotRecord. Neither of those has a
// Stress/Morale/Favorability field yet (data/types.ts's own socialHook
// comment: that's explicitly still a stub, Antfarm §13.2). Wiring real,
// persistent Favorability into the engine is a separate decision this
// scene doesn't make — see AMBIENT/FAVORABILITY constants below, and
// ambientLines.ts's own header.
//
// Also Phase 1 scope, not yet Phase 2/3: one room, NPCs are stationary
// (no autonomous roaming/cliques — that's the Build Plan doc's §4
// addendum, explicitly Phase 3), Talk only (no Rec Room minigames, no
// Ask Out, no calendar cost).
import Phaser from "phaser";
import { WARDEN_PILOTS } from "../data/campaignAmaranth";
import { PATH_COLORS, pilotInitials } from "./TransporterPad";
import { pickAmbientLine, LINE_BANK, type AmbientPilotState, type Catalyst, type Echo } from "../data/ambientLines";
import { makeShopButton } from "./shop/ShopPanel";

const ROOM = { left: 130, right: 830, top: 108, bottom: 552 };
const PLAYER_SPEED = 190; // px/sec
const PLAYER_R = 15;
const NPC_R = 16;
const TALK_RADIUS = 130; // sound range — everyone inside reacts on their own, per the locked broadcast model
const APPROACH_RADIUS = 78; // Favorability becomes visible once you're this close

// Experimental, 25 Aug 2026 — Maxime: "can you check if its possible to get
// a single guy angry and have his answer trigger a wave of conversation
// across the hub as the npc play telephone with each other." Answering
// that by prototyping it rather than just describing it: click an NPC
// directly (not the room-wide Talk verb) to provoke them, then their
// reaction can ripple outward NPC-to-NPC, decaying and occasionally
// mutating in transit — an actual game of telephone, not a uniform
// broadcast. This is NOT part of Phase 1's locked spec (Build Plan §4) —
// it's an extra layer bolted onto the same sound-range machinery to prove
// the idea out cheaply, same spirit as the rest of this file's own
// De-risking Note. Not wired to Favorability/gossip in any way yet.
const PROPAGATION_RADIUS = 280; // NPC-to-NPC earshot — wider than TALK_RADIUS so a message can skip past whoever's out of the source's own direct range but still needs an intermediary to relay it
const PROPAGATION_MAX_HOPS = 5;
const PROPAGATION_CATCH_BASE = 0.75; // chance the next hop's listener actually reacts at all
const PROPAGATION_CATCH_DECAY = 0.82; // multiplied in per hop — the wave fizzles the farther it travels
const PROPAGATION_DISTORT_CHANCE = 0.3; // chance the passed-along echo mutates instead of staying true, per hop
const PROPAGATION_HOP_DELAY_MS = 700;
const DISTORT_MAP: Record<Echo, Echo> = { anger: "fear", fear: "anger", love: "sadness", sadness: "love" };

const PANEL_BG = 0x1a2028;
const PANEL_BORDER = 0x3a4552;
const TEXT_MAIN = "#e8e2d4";
const TEXT_DIM = "#8a97a6";
const ACCENT = "#4a7a9a";

type HubNpc = {
  pilotId: string;
  displayName: string;
  initials: string;
  color: number;
  x: number;
  y: number;
  ambient: AmbientPilotState;
  favorability: number; // local demo value — see file header
  circle: Phaser.GameObjects.Arc;
  root: Phaser.GameObjects.Container;
  favLabel: Phaser.GameObjects.Text;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleUntil: number;
};

// Placeholder catalyst/state picks for the two Rec Room NPCs — not a
// locked content decision, just enough to prove the state-driven ambient
// system out with real names instead of the spike's throwaway lines.
// Bosk = raven fits the mentor read already on record for him
// (data/campaignAmaranth.ts's own WARDEN_MEKS comment: "Bosk (the mentor,
// holds the line)"). Anand = wolf leans on "Farsight"/squad's-eyes framing
// — wolf's own line bank is built around watching over the pack. Flagged
// as a placeholder pick, worth a real pass whenever named-pilot catalysts
// get decided for real (Character Editor doc §1: "named pilots stay
// hand-assigned... still open").
// Third seat, added 25 Aug 2026 alongside the telephone-wave prototype so
// there's actually a chain to demonstrate (two NPCs can only ever be a
// direct broadcast, never a relay). Still within Phase 1's already-locked
// "2-3 NPCs" footprint (Build Plan §4) — not scope growth on its own.
// Iyari = crow leans on her "young, aggressive" read (data/campaignAmaranth.ts's
// own WARDEN_MEKS comment) — crow's bank is restless/impulsive, not a
// callback to her "Foxfire" callsign. Same placeholder-pick caveat as Bosk/Anand.
const NPC_SEED: { pilotId: string; catalyst: Catalyst; stress: number; morale: number; drunk: boolean; favorability: number }[] = [
  { pilotId: "pilot_bosk", catalyst: "raven", stress: 30, morale: 75, drunk: false, favorability: 35 },
  { pilotId: "pilot_anand", catalyst: "wolf", stress: 78, morale: 60, drunk: false, favorability: 10 },
  { pilotId: "pilot_iyari", catalyst: "crow", stress: 40, morale: 68, drunk: false, favorability: -5 },
];

export class Hub extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerX = 480;
  private playerY = 330;
  private npcs: HubNpc[] = [];
  private keys!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactPrompt!: Phaser.GameObjects.Text;
  private eKey?: Phaser.Input.Keyboard.Key;
  private npcClickConsumed = false;

  constructor() {
    super("Hub");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0c0f12");

    this.add.text(480, 20, "THE ANTFARM — REC ROOM (PROTOTYPE)", { fontFamily: "monospace", fontSize: "16px", color: TEXT_MAIN }).setOrigin(0.5);
    this.add
      .text(480, 42, "WASD / arrows to move — E or click room to talk. Click an NPC directly to provoke them.", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: TEXT_DIM,
      })
      .setOrigin(0.5);

    // Locked in Build Plan §4: "shipping it with zero signal... would read
    // as a rug-pull later." Cosmetic/inert here, on purpose — Phase 4 is
    // where a hub-goes-hot system actually reads this.
    this.add
      .text(818, 20, "THREAT: DISTANT", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a" })
      .setOrigin(1, 0.5);

    this.drawRoom();
    this.buildNpcs();
    this.buildPlayer();

    this.interactPrompt = this.add.text(480, ROOM.bottom + 20, "", { fontFamily: "monospace", fontSize: "11px", color: ACCENT }).setOrigin(0.5);

    const footer = this.add.container(0, 0);
    makeShopButton(this, footer, 90, 604, 140, 32, "BACK TO HANGAR", true, () => this.scene.start("Hangar"));

    // Explicit per-key binding rather than addKeys("W,A,S,D") — that batch
    // form keys its returned object by the exact string tokens passed in
    // (.W/.A/.S/.D), not the lowercased .w/.a/.s/.d this file reads; an `as`
    // cast there would have compiled fine and thrown at runtime on the
    // first press. Caught in review before it ever ran.
    const kb = this.input.keyboard!;
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.eKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.input.keyboard?.addCapture("W,A,S,D,E");

    this.input.on("pointerdown", () => {
      if (this.npcClickConsumed) {
        this.npcClickConsumed = false; // this click already provoked a specific NPC — don't also broadcast
        return;
      }
      this.speak();
    });
  }

  private drawRoom() {
    const g = this.add.graphics();
    g.fillStyle(0x14181c, 1);
    g.fillRect(ROOM.left, ROOM.top, ROOM.right - ROOM.left, ROOM.bottom - ROOM.top);
    g.lineStyle(2, PANEL_BORDER, 1);
    g.strokeRect(ROOM.left, ROOM.top, ROOM.right - ROOM.left, ROOM.bottom - ROOM.top);
  }

  private buildNpcs() {
    // Fixed layout inside the room — two seats at the Rec Room table.
    // Stationary on purpose (Phase 1 scope; autonomous roaming is Phase 3,
    // per the Build Plan doc's 25 Aug addendum).
    const positions = [
      { x: ROOM.left + 190, y: ROOM.top + 160 },
      { x: ROOM.right - 190, y: ROOM.top + 160 },
      { x: 480, y: ROOM.bottom - 90 },
    ];
    this.npcs = NPC_SEED.map((seed, i) => {
      const pilot = WARDEN_PILOTS.find((p) => p.id === seed.pilotId);
      const displayName = pilot?.displayName ?? seed.pilotId;
      const initials = pilotInitials(displayName);
      const color = PATH_COLORS[(pilot?.archetypeId.includes("tank") ? "tank" : pilot?.archetypeId.includes("reeps") ? "reeps" : "meeps") as keyof typeof PATH_COLORS];
      const pos = positions[i];

      const circle = this.add.circle(0, 0, NPC_R, color, 1).setStrokeStyle(2, 0xffffff, 0.25);
      const label = this.add.text(0, 0, initials, { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5);
      const nameTag = this.add
        .text(0, NPC_R + 12, displayName.split("—")[0].trim(), { fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM })
        .setOrigin(0.5);
      const root = this.add.container(pos.x, pos.y, [circle, label, nameTag]);

      const favLabel = this.add.text(pos.x, pos.y - NPC_R - 14, "", { fontFamily: "monospace", fontSize: "9px", color: "#facc15" }).setOrigin(0.5).setVisible(false);
      const bubbleContainer = this.add.container(pos.x, pos.y - NPC_R - 30).setVisible(false);

      return {
        pilotId: seed.pilotId,
        displayName,
        initials,
        color,
        x: pos.x,
        y: pos.y,
        ambient: { catalyst: seed.catalyst, stress: seed.stress, morale: seed.morale, drunk: seed.drunk },
        favorability: seed.favorability,
        circle,
        root,
        favLabel,
        bubbleContainer,
        bubbleUntil: 0,
      };
    });

    // Click an NPC directly (as opposed to clicking empty room space, which
    // triggers the ordinary broadcast Talk verb) to provoke them — the
    // telephone-wave prototype's entry point. npcClickConsumed stops the
    // scene-wide pointerdown handler from ALSO firing a broadcast Talk on
    // the same click.
    for (const npc of this.npcs) {
      npc.circle.setInteractive({ useHandCursor: true });
      npc.circle.on("pointerdown", () => {
        this.npcClickConsumed = true;
        this.provoke(npc);
      });
    }
  }

  private buildPlayer() {
    // Derived from the real WARDEN_PILOTS record rather than hardcoded —
    // caught in review, 25 Aug 2026: an earlier draft hardcoded "DR" here
    // while every NPC correctly derived initials from pilotInitials(). Same
    // convention as the NPCs, not a special case for the player.
    const rourke = WARDEN_PILOTS.find((p) => p.id === "pilot_rourke");
    const initials = rourke ? pilotInitials(rourke.displayName) : "??";

    const circle = this.add.circle(0, 0, PLAYER_R, PATH_COLORS.meeps, 1).setStrokeStyle(2, 0xffd166, 0.9);
    const label = this.add.text(0, 0, initials, { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5);
    this.player = this.add.container(this.playerX, this.playerY, [circle, label]);
  }

  update(_time: number, delta: number) {
    this.handleMovement(delta);
    this.updateProximity();
    this.updateBubbles();

    if (this.eKey && Phaser.Input.Keyboard.JustDown(this.eKey)) this.speak();
  }

  private handleMovement(delta: number) {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.keys.a.isDown || this.cursors?.left?.isDown) dx -= 1;
    if (this.keys.d.isDown || this.cursors?.right?.isDown) dx += 1;
    if (this.keys.w.isDown || this.cursors?.up?.isDown) dy -= 1;
    if (this.keys.s.isDown || this.cursors?.down?.isDown) dy += 1;
    if (dx === 0 && dy === 0) return;

    const len = Math.hypot(dx, dy) || 1;
    const stepX = (dx / len) * PLAYER_SPEED * dt;
    const stepY = (dy / len) * PLAYER_SPEED * dt;

    // Axis-separated movement so the player slides along a wall or an NPC
    // instead of sticking dead the instant one axis would collide.
    this.tryMove(stepX, 0);
    this.tryMove(0, stepY);

    this.player.setPosition(this.playerX, this.playerY);
  }

  private tryMove(dx: number, dy: number) {
    const nx = Phaser.Math.Clamp(this.playerX + dx, ROOM.left + PLAYER_R, ROOM.right - PLAYER_R);
    const ny = Phaser.Math.Clamp(this.playerY + dy, ROOM.top + PLAYER_R, ROOM.bottom - PLAYER_R);
    for (const npc of this.npcs) {
      if (Phaser.Math.Distance.Between(nx, ny, npc.x, npc.y) < PLAYER_R + NPC_R) return; // blocked, don't apply this axis
    }
    this.playerX = nx;
    this.playerY = ny;
  }

  private updateProximity() {
    let anyoneInRange = false;
    for (const npc of this.npcs) {
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      const close = dist <= APPROACH_RADIUS;
      if (close) anyoneInRange = true;
      npc.favLabel.setVisible(close);
      if (close) npc.favLabel.setText(favorabilityLabel(npc));
    }
    this.interactPrompt.setText(anyoneInRange ? "E — talk" : "");
  }

  private updateBubbles() {
    const now = this.time.now;
    for (const npc of this.npcs) {
      if (npc.bubbleUntil && now > npc.bubbleUntil) {
        npc.bubbleContainer.setVisible(false);
        npc.bubbleUntil = 0;
      }
    }
  }

  // Sound-range broadcast Talk verb — locked in Build Plan §4, 25 Aug 2026:
  // press once, everyone currently within TALK_RADIUS reacts on their own,
  // each pulling their own line. Not aimed at a single NPC.
  private speak() {
    const now = this.time.now;
    for (const npc of this.npcs) {
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist > TALK_RADIUS) continue;
      const { line } = pickAmbientLine(npc.ambient);
      this.showBubble(npc, line, now);
    }
  }

  // Telephone-wave prototype — see the PROPAGATION_* constants' own
  // comment for what this is answering. Provoking forces the clicked NPC's
  // echo to "anger" (a direct reading of "get a single guy angry"), shows
  // their line immediately, then hands off to propagate() for the ripple.
  private provoke(npc: HubNpc) {
    const now = this.time.now;
    const line = pickFromBank(npc.ambient.catalyst, "anger");
    this.showBubble(npc, line, now);
    this.time.delayedCall(PROPAGATION_HOP_DELAY_MS, () => {
      this.propagate(npc, "anger", new Set([npc.pilotId]), 1);
    });
  }

  private propagate(source: HubNpc, incomingEcho: Echo, visited: Set<string>, hop: number) {
    if (hop > PROPAGATION_MAX_HOPS) return;
    const catchChance = PROPAGATION_CATCH_BASE * Math.pow(PROPAGATION_CATCH_DECAY, hop - 1);

    for (const npc of this.npcs) {
      if (visited.has(npc.pilotId)) continue;
      const dist = Phaser.Math.Distance.Between(source.x, source.y, npc.x, npc.y);
      if (dist > PROPAGATION_RADIUS) continue;
      if (Math.random() > catchChance) continue; // heard about it, didn't actually react

      visited.add(npc.pilotId);
      const echo = Math.random() < PROPAGATION_DISTORT_CHANCE ? DISTORT_MAP[incomingEcho] : incomingEcho;
      const line = pickFromBank(npc.ambient.catalyst, echo);

      // Staggered per relay so the wave visibly travels across the room
      // instead of every catch popping in on the same frame.
      this.time.delayedCall(hop * PROPAGATION_HOP_DELAY_MS, () => {
        this.showBubble(npc, line, this.time.now);
      });
      this.time.delayedCall((hop + 1) * PROPAGATION_HOP_DELAY_MS, () => {
        this.propagate(npc, echo, visited, hop + 1);
      });
    }
  }

  private showBubble(npc: HubNpc, line: string, now: number) {
    npc.bubbleContainer.removeAll(true);
    const wrapWidth = 190;
    const text = this.add.text(0, 0, line, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: TEXT_MAIN,
      wordWrap: { width: wrapWidth - 16 },
      align: "left",
    });
    text.setOrigin(0.5, 1);
    const bounds = text.getBounds();
    const bg = this.add
      .rectangle(0, 0, Math.max(bounds.width + 16, 60), bounds.height + 12, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER)
      .setOrigin(0.5, 1);
    text.setPosition(0, -6);
    bg.setPosition(0, 0);
    npc.bubbleContainer.add([bg, text]);
    npc.bubbleContainer.setVisible(true);

    const duration = Math.min(6000, 2600 + line.length * 30);
    npc.bubbleUntil = now + duration;
  }
}

function pickFromBank(catalyst: Catalyst, echo: Echo): string {
  const bank = LINE_BANK[catalyst][echo];
  return bank[Math.floor(Math.random() * bank.length)];
}

function favorabilityLabel(npc: HubNpc): string {
  const sign = npc.favorability >= 0 ? "+" : "";
  return `${npc.displayName.split("—")[0].trim()}  ${sign}${npc.favorability} (demo)`;
}
