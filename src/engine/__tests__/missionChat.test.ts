// engine/missionChat.ts — mission chat's routing, Workstream 4 of the
// Mission Chat / Player Notes / Battle HUD Relayout plan, 12 Sep 2026. The
// addressing rules (selection default, squad broadcast, inline names, :t,
// fog of war, no Bloom channel, no broadcast verbs) are the design; this
// pins each one.
import { describe, it, expect } from "vitest";
import { resolveMissionChat, AIM_HINT, type ChatCandidate } from "../missionChat";

const bosk: ChatCandidate = { id: "u_bosk", pilotId: "pilot_bosk", displayName: "Sgt. Aldo Bosk — “Deadfall”", side: "player", kind: "pilot", able: true, visible: true };
const anand: ChatCandidate = { id: "u_anand", pilotId: "pilot_anand", displayName: "Cpl. Priya Anand — “Farsight”", side: "player", kind: "pilot", able: true, visible: true };
const lask: ChatCandidate = { id: "u_lask", pilotId: "pilot_lask", displayName: "Spec. Corin Lask — “Patch”", side: "player", kind: "pilot", able: false, visible: true };
const lancer: ChatCandidate = { id: "h_lancer", displayName: "House Lancer", side: "hostile", kind: "mech", able: true, visible: true };
const hiddenLancer: ChatCandidate = { id: "h_lancer2", displayName: "Amaranth Vanguard", side: "hostile", kind: "mech", able: true, visible: false };
const splitfang: ChatCandidate = { id: "b_1", displayName: "Splitfang", side: "hostile", kind: "bloom", able: true, visible: true };
const ALL = [bosk, anand, lask, lancer, hiddenLancer, splitfang];

describe("resolveMissionChat — commands", () => {
  it("hands :help / :notes / unknown to the scene as a command route", () => {
    expect(resolveMissionChat(":help", { candidates: ALL, selectedId: null })).toEqual({ kind: "command", command: { kind: "help" } });
    expect(resolveMissionChat(":notes hold the ridge", { candidates: ALL, selectedId: null })).toEqual({ kind: "command", command: { kind: "notes", text: "hold the ridge" } });
    expect(resolveMissionChat(":notse hold", { candidates: ALL, selectedId: null })).toEqual({ kind: "command", command: { kind: "unknown", name: "notse" } });
  });

  it("refuses empty input silently (no reason to show)", () => {
    expect(resolveMissionChat("   ", { candidates: ALL, selectedId: null })).toEqual({ kind: "refused", reason: "" });
  });
});

describe("resolveMissionChat — addressing without :t", () => {
  it("nothing selected: ordinary chatter and small talk broadcast to every able friendly pilot (downed ones excluded)", () => {
    const r = resolveMissionChat("hold together everyone", { candidates: ALL, selectedId: null });
    expect(r.kind).toBe("chatter");
    if (r.kind === "chatter") expect(r.targets.map((t) => t.id)).toEqual(["u_bosk", "u_anand"]);
    const g = resolveMissionChat("hello", { candidates: ALL, selectedId: null });
    expect(g.kind).toBe("smallTalk");
    if (g.kind === "smallTalk") {
      expect(g.smallTalk).toBe("greeting");
      expect(g.targets).toHaveLength(2);
    }
  });

  it("a selected friendly pilot is the default addressee", () => {
    const r = resolveMissionChat("hello", { candidates: ALL, selectedId: "u_anand" });
    expect(r.kind).toBe("smallTalk");
    if (r.kind === "smallTalk") expect(r.targets.map((t) => t.id)).toEqual(["u_anand"]);
  });

  it("a selected DOWNED pilot doesn't count as a selection — falls back to the squad", () => {
    const r = resolveMissionChat("hello", { candidates: ALL, selectedId: "u_lask" });
    if (r.kind === "smallTalk") expect(r.targets.map((t) => t.id)).toEqual(["u_bosk", "u_anand"]);
    else throw new Error(r.kind);
  });

  it("a selected HOSTILE doesn't count as a selection either — hostiles are :t only", () => {
    const r = resolveMissionChat("nice try", { candidates: ALL, selectedId: "h_lancer" });
    expect(r.kind).toBe("chatter");
    if (r.kind === "chatter") expect(r.targets.map((t) => t.id)).toEqual(["u_bosk", "u_anand"]);
  });

  it("an inline crew name beats the selection (the Hub's own named-target rule, reused)", () => {
    const r = resolveMissionChat("well done, bosk", { candidates: ALL, selectedId: "u_anand" });
    expect(r.kind).toBe("verb");
    if (r.kind === "verb") {
      expect(r.verb).toBe("praise");
      expect(r.target.id).toBe("u_bosk");
    }
  });

  it("an inline name never reaches a hostile or the Bloom — 'nice try, lancer' goes to the squad", () => {
    const r = resolveMissionChat("nice try, lancer", { candidates: ALL, selectedId: null });
    expect(r.kind).toBe("chatter");
    if (r.kind === "chatter") expect(r.targets.every((t) => t.side === "player")).toBe(true);
  });

  it("a social verb with a selection goes to that one pilot", () => {
    const r = resolveMissionChat("well done", { candidates: ALL, selectedId: "u_anand" });
    expect(r).toMatchObject({ kind: "verb", verb: "praise" });
    if (r.kind === "verb") expect(r.target.id).toBe("u_anand");
  });

  it("a social verb with NO selection and no name is refused with the aiming hint — no broadcast praise farming", () => {
    const r = resolveMissionChat("well done", { candidates: ALL, selectedId: null });
    expect(r).toEqual({ kind: "refused", reason: AIM_HINT });
  });

  it("with nobody able on the player side, ordinary text is refused plainly", () => {
    const r = resolveMissionChat("anyone?", { candidates: [lask, lancer], selectedId: null });
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason).toMatch(/Nobody on your side/);
  });
});

describe("resolveMissionChat — :t targeting, fog of war, the Bloom", () => {
  it(":t <crew name> <verb> routes the verb to that pilot", () => {
    const r = resolveMissionChat(":t anand well done", { candidates: ALL, selectedId: "u_bosk" });
    expect(r).toMatchObject({ kind: "verb", verb: "praise" });
    if (r.kind === "verb") expect(r.target.id).toBe("u_anand");
  });

  it(":t <crew name> <chatter> routes chatter to exactly that pilot", () => {
    const r = resolveMissionChat(":t bosk watch the left flank", { candidates: ALL, selectedId: null });
    expect(r.kind).toBe("chatter");
    if (r.kind === "chatter") {
      expect(r.targets.map((t) => t.id)).toEqual(["u_bosk"]);
      expect(r.text).toBe("watch the left flank");
    }
  });

  it(":t matches on a callsign too, and is case-insensitive", () => {
    const r = resolveMissionChat(":t FARSIGHT hello", { candidates: ALL, selectedId: null });
    if (r.kind === "smallTalk") expect(r.targets[0].id).toBe("u_anand");
    else throw new Error(r.kind);
  });

  it(":t a visible human-crewed hostile opens the hostile channel", () => {
    const r = resolveMissionChat(":t lancer come and get it", { candidates: ALL, selectedId: null });
    expect(r).toMatchObject({ kind: "hostile", text: "come and get it" });
    if (r.kind === "hostile") expect(r.target.id).toBe("h_lancer");
  });

  it(":t a hostile the player can't see is refused — fog of war applies to chat", () => {
    const r = resolveMissionChat(":t vanguard come out", { candidates: ALL, selectedId: null });
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason).toMatch(/can't see/);
  });

  it(":t a Bloom is a plain refusal — no channel, no eerie non-response", () => {
    const r = resolveMissionChat(":t splitfang boo", { candidates: ALL, selectedId: null });
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason).toMatch(/Bloom don't answer/);
  });

  it(":t a downed pilot is refused", () => {
    const r = resolveMissionChat(":t lask you ok?", { candidates: ALL, selectedId: null });
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.reason).toMatch(/down/);
  });

  it(":t an unknown name says so, and a :t with no text shows usage", () => {
    const r = resolveMissionChat(":t nobody hi", { candidates: ALL, selectedId: null });
    if (r.kind === "refused") expect(r.reason).toMatch(/"nobody"/);
    else throw new Error(r.kind);
    expect(resolveMissionChat(":t bosk", { candidates: ALL, selectedId: null })).toEqual({ kind: "refused", reason: "Usage: :t <name> <what to say>" });
  });

  it("a rank token is never a match — ':t sgt hello' does not resolve to whoever holds that rank (chatIntent's own rank-token rule)", () => {
    const r = resolveMissionChat(":t sgt hello", { candidates: ALL, selectedId: null });
    expect(r.kind).toBe("refused");
  });
});
