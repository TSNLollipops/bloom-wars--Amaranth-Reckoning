// Self-test for the UI audit (3 Sep 2026) — cloud-sandbox-only, not shipped.
//
// A clean sweep report is only worth something if the checks that produced
// it are capable of failing. This file earns that, by breaking the game on
// purpose, one bug at a time, and failing if the audit does not notice.
//
// It is here because the audit reported all-clear three separate times
// while being broken: once comparing world coordinates against screen
// pixels, once with a grouping key that was not unique so nothing was ever
// compared, and once — the worst — after pausing the scenes BEFORE
// enumerating them, which meant Phaser's getScenes(true) returned nothing
// and the check dutifully examined zero labels and reported zero problems.
// Every one of those looked exactly like success.
//
// Run it whenever auditUiText.mjs changes. A green sweep with a red
// self-test means nothing at all.
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { auditActiveScenes, findPaintedOver, readPng, changedPixelsIn } from "./auditUiText.mjs";

const save = readFileSync(new URL("./actionbar_save.json", import.meta.url).pathname, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1800);
await page.evaluate(() => window.__bwGame.scene.start("Hub"));
await page.waitForTimeout(2500);

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

async function paintedOver() {
  const po = await findPaintedOver(page, () => page.screenshot());
  const a = readPng(po.before), b = readPng(po.after);
  const bad = [];
  for (const box of po.boxes) {
    if (changedPixelsIn(a, b, box) <= 3) bad.push(box.text);
  }
  return { bad, checked: po.boxes.length };
}

const cleanup = [];
const inject = async (fn) => {
  const id = await page.evaluate(fn);
  cleanup.push(id);
  await page.waitForTimeout(250);
};
const undoAll = async () => {
  await page.evaluate(() => {
    const h = window.__bwGame.scene.getScene("Hub");
    (h.__selftest || []).forEach((o) => o.destroy());
    h.__selftest = [];
  });
  await page.waitForTimeout(250);
};

console.log("\n1. baseline — the Hub as it ships");
const base = await paintedOver();
const baseFindings = await auditActiveScenes(page);
check("PAINTEDOVER examines a non-zero number of labels", base.checked > 0, `${base.checked} checked`);
check("PAINTEDOVER is clean", base.bad.length === 0, base.bad.join(", "));
check("geometry audit is clean", baseFindings.length === 0, JSON.stringify(baseFindings.slice(0, 3)));

console.log("\n2. break it: cover a HUD readout with an opaque rectangle");
await inject(() => {
  const h = window.__bwGame.scene.getScene("Hub");
  h.__selftest = h.__selftest || [];
  const b = h.deckIndicatorText.getBounds();
  h.__selftest.push(
    h.add.rectangle(b.x - 4, b.y - 4, b.width + 8, b.height + 8, 0x101418).setOrigin(0, 0).setScrollFactor(0).setDepth(50),
  );
});
const covered = await paintedOver();
check("PAINTEDOVER catches a covered readout", covered.bad.some((t) => t.startsWith("DECK:")), covered.bad.join(", "));
await undoAll();

console.log("\n3. break it: a label wider than its own button");
await inject(() => {
  const h = window.__bwGame.scene.getScene("Hub");
  h.__selftest = h.__selftest || [];
  const btn = h.add.rectangle(300, 300, 80, 24, 0x2e5c7a).setScrollFactor(0).setDepth(70).setInteractive();
  const lbl = h.add
    .text(300, 300, "A LABEL FAR TOO WIDE FOR THIS BUTTON", { fontFamily: "monospace", fontSize: "12px", color: "#fff" })
    .setOrigin(0.5).setScrollFactor(0).setDepth(71);
  h.__selftest.push(btn, lbl);
});
const over = await auditActiveScenes(page);
check("OVERRUN catches a label wider than its button",
  over.some((f) => f.kind === "OVERRUN" && f.text.includes("FAR TOO WIDE")),
  JSON.stringify(over.filter((f) => f.kind === "OVERRUN").slice(0, 2)));
await undoAll();

console.log("\n4. break it: two sibling labels drawn on top of each other");
await inject(() => {
  const h = window.__bwGame.scene.getScene("Hub");
  h.__selftest = h.__selftest || [];
  const c = h.add.container(0, 0).setScrollFactor(0).setDepth(70);
  c.add(h.add.text(400, 200, "OVERLAPPING ALPHA", { fontFamily: "monospace", fontSize: "14px", color: "#fff" }));
  c.add(h.add.text(404, 202, "OVERLAPPING BETA", { fontFamily: "monospace", fontSize: "14px", color: "#fff" }));
  h.__selftest.push(c);
});
const coll = await auditActiveScenes(page);
check("COLLIDE catches two overlapping siblings",
  coll.some((f) => f.kind === "COLLIDE" && f.text.includes("OVERLAPPING")),
  JSON.stringify(coll.filter((f) => f.kind === "COLLIDE").slice(0, 2)));
await undoAll();

console.log("\n5. break it: a pinned label pushed off the canvas");
await inject(() => {
  const h = window.__bwGame.scene.getScene("Hub");
  h.__selftest = h.__selftest || [];
  h.__selftest.push(
    h.add.text(1020, 300, "OFF THE RIGHT EDGE", { fontFamily: "monospace", fontSize: "14px", color: "#fff" })
      .setScrollFactor(0).setDepth(70),
  );
});
const off = await auditActiveScenes(page);
check("OFFSCREEN catches a pinned label past the canvas edge",
  off.some((f) => f.kind === "OFFSCREEN" && f.text.includes("OFF THE RIGHT EDGE")),
  JSON.stringify(off.filter((f) => f.kind === "OFFSCREEN").slice(0, 2)));
await undoAll();

// 5b is the case that actually distinguishes the fixed rule from the old
// one, and it is the whole reason this step exists.
//
// Until 3 Sep 2026 OFFSCREEN compared against the 1074x640 CANVAS. Hub's
// MAIN camera is only 838 wide — the OVERHEARD dock owns everything past
// DOCK_SPLIT_X on a second camera — so a label sitting at x=900 is drawn
// nowhere at all and the old rule called it fine, because 900 is comfortably
// inside 1074. That is precisely the class of bug Maxime found by phone
// photo on 4 Sep (the Hangar Shop's 900px-wide card layout hard-cut at 838),
// and precisely what the sweep could not see.
//
// Step 5 above does NOT prove the fix: x=1020 with a 152px label runs past
// 1074 as well, so the old canvas rule would have caught that one too. This
// one is inside the canvas and outside the viewport, so it can only be
// caught by measuring the right rectangle.
console.log("\n5b. break it: a pinned label inside the canvas but outside the main camera's viewport");
await inject(() => {
  const h = window.__bwGame.scene.getScene("Hub");
  h.__selftest = h.__selftest || [];
  h.__selftest.push(
    h.add.text(900, 340, "PAST THE DOCK SPLIT", { fontFamily: "monospace", fontSize: "14px", color: "#fff" })
      .setScrollFactor(0).setDepth(70),
  );
});
const offVp = await auditActiveScenes(page);
check("OFFSCREEN catches a label the canvas rule would have passed",
  offVp.some((f) => f.kind === "OFFSCREEN" && f.text.includes("PAST THE DOCK SPLIT")),
  JSON.stringify(offVp.filter((f) => f.kind === "OFFSCREEN").slice(0, 2)));
await undoAll();

console.log("\n6. back to baseline — every injected bug is gone again");
const after = await auditActiveScenes(page);
const afterPo = await paintedOver();
check("geometry audit clean again", after.length === 0, JSON.stringify(after.slice(0, 3)));
check("PAINTEDOVER clean again", afterPo.bad.length === 0, afterPo.bad.join(", "));

console.log(`\nRESULT: ${failures === 0 ? "PASSED — every check can turn red, and is green on the real game" : `FAILED (${failures})`}`);
process.exitCode = failures === 0 ? 0 : 1;
await browser.close();
