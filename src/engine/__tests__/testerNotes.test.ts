import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTesterNotes, setTesterNotes } from "../testerNotes";

// vitest's default environment here is plain Node (no jsdom configured —
// see vite.config.ts, and displayScale.test.ts's own header for the same
// note) — `localStorage` is genuinely undefined in this test run unless a
// test installs one itself, which is exactly what the two describe blocks
// below check for: the DOM-guarded fallback with nothing installed, and a
// real round-trip against a minimal in-memory Storage polyfill.
describe("testerNotes", () => {
  describe("DOM-guarded calls are safe with no localStorage present", () => {
    it("getTesterNotes falls back to an empty string without a real localStorage", () => {
      expect(getTesterNotes()).toBe("");
    });

    it("setTesterNotes does not throw without a real localStorage", () => {
      expect(() => setTesterNotes("some notes")).not.toThrow();
    });
  });

  describe("with a real localStorage present", () => {
    // A minimal in-memory Storage polyfill — just enough of the interface
    // (getItem/setItem) for this module's own two functions, installed and
    // torn down per test so it can't leak into any other test file's run.
    let store: Record<string, string>;

    beforeEach(() => {
      store = {};
      (globalThis as { localStorage?: unknown }).localStorage = {
        getItem: (key: string) => (key in store ? store[key] : null),
        setItem: (key: string, value: string) => {
          store[key] = String(value);
        },
      };
    });

    afterEach(() => {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    });

    it("returns an empty string when nothing has been saved yet", () => {
      expect(getTesterNotes()).toBe("");
    });

    it("round-trips whatever text is saved, including newlines", () => {
      setTesterNotes("bug: the workshop door doesn't open\nidea: let me name my ant's mek");
      expect(getTesterNotes()).toBe("bug: the workshop door doesn't open\nidea: let me name my ant's mek");
    });

    it("an empty string clears a previously saved note", () => {
      setTesterNotes("something");
      expect(getTesterNotes()).toBe("something");
      setTesterNotes("");
      expect(getTesterNotes()).toBe("");
    });

    it("a later save overwrites an earlier one rather than appending", () => {
      setTesterNotes("first draft");
      setTesterNotes("second draft");
      expect(getTesterNotes()).toBe("second draft");
    });
  });
});
