// Automated UI text-geometry audit (3 Sep 2026) — cloud-sandbox-only, not
// shipped. Walks every ACTIVE scene's live Phaser display list and reports
// text that is drawn wrong in ways no unit test can see.
//
// WHY THIS EXISTS. On 3 Sep the Battle action bar was found to be rendering
// "6LAST RITES" — the hotkey digit fused into the label's L, scanning as
// "BAST RITES" — on the bar a player sees after spending a third of the
// campaign's Heirloom budget. It had been live since 2 Sep. `tsc`, `eslint`
// and 1965 unit tests were clean through every frame of it, because none of
// them can see pixels. It was found by taking one screenshot while looking
// at something else.
//
// That is not a bug you find by being careful. It is a bug you find by
// having a machine measure the boxes. So this measures the boxes, for every
// screen, on demand — the same three questions, asked everywhere:
//
//   OVERRUN  — a label wider than the button it sits on. What "BAST RITES"
//              was. Also catches a number growing a label past its box
//              (`SWEEP x3` is fine, `MISSILE x12` might not be).
//   COLLIDE  — two visible text objects whose boxes overlap. Catches the
//              digit-into-label case directly, plus any two labels that
//              drift into each other at a size nobody tested.
//   OFFSCREEN — text drawn partly or wholly outside the viewport that
//              actually renders it. Note "viewport", not "canvas": a scene's
//              main camera can be narrower than the canvas (Hub's stops at
//              DOCK_SPLIT_X so the OVERHEARD dock can own the rest), and
//              comparing against the canvas misses everything clipped in
//              between. Fixed 3 Sep 2026 — see the check itself.
//              Only checked for screen-pinned objects (scrollFactorX === 0),
//              because the Hub's world text is SUPPOSED to sit outside the
//              camera view most of the time.
//   PAINTEDOVER — the strongest check here, and the one that pays for the
//              whole file. A label can be visible, opaque, correctly
//              positioned, live-updating, and still never reach a single
//              pixel because something drew over it. Geometry cannot see
//              that; only the pixels can. So: screenshot, hide every
//              candidate label, screenshot again, and diff each label's own
//              box. A box that is pixel-identical with the label present
//              and absent was never drawn.
//
//              This found six invisible readouts in the Hub on the day it
//              was written — the room title, the controls line, THREAT,
//              the rank readout, the campaign-day counter and the DECK
//              indicator, all created at depth 0 and then painted over by
//              deck floors added later at the same depth. `Day N` is the
//              calendar economy's only on-screen output and had been
//              invisible for a day. checkHubCameraScroll.mjs had been
//              asserting some of those same labels' POSITIONS and passing
//              the whole time, because x/y is right whether or not
//              anything painted.
//
//              Cost: two screenshots per screen. Worth it.
//
// WHAT IT IS NOT. This is a lint, not an oracle. Overlapping text is
// sometimes deliberate (a label drawn over its own backing plate, a
// deliberately layered title). Every finding needs a human look — that is
// what the screenshots alongside are for. The value is that the list of
// things to look at is thirty items instead of every pixel of every screen.
//
// Usage: imported by sweepUi.mjs. `auditActiveScenes(page)` returns findings
// for whatever is on screen right now.

// ---------------------------------------------------------------------------
// A minimal PNG reader, so this harness adds no dependency to the project.
//
// The obvious move was `npm i -D pngjs`. It was reverted on purpose: running
// `npm ci` in a Linux sandbox and committing the regenerated
// package-lock.json back to a Windows machine rewrites 25 platform-specific
// optional dependency entries (rollup's linux builds, lightningcss's, and
// so on). That is a real way to break someone's `npm install` on their own
// machine, in service of a screenshot-diffing tool. Playwright emits 8-bit
// non-interlaced RGBA PNGs and Node ships zlib, so the whole need is about
// forty lines of unfiltering.
// ---------------------------------------------------------------------------
import { inflateSync } from "node:zlib";

/** Decode an 8-bit, non-interlaced PNG buffer to { width, height, data } RGBA. */
export function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8, width = 0, height = 0, channels = 4, bitDepth = 8;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      const colorType = body[9];
      if (bitDepth !== 8) throw new Error("only 8-bit PNGs: got " + bitDepth);
      if (body[12] !== 0) throw new Error("interlaced PNGs not supported");
      channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
      if (!channels) throw new Error("unsupported PNG color type " + colorType);
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  // Un-filter, per PNG spec §9: each scanline is prefixed with a filter byte
  // and is decoded relative to the pixel left of it (a) and the already
  // decoded scanline above it (b).
  let ip = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[ip++];
    const line = raw.subarray(ip, ip + stride);
    ip += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error("bad PNG filter " + filter);
      cur[x] = v & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

/**
 * How many pixels inside `box` differ between two decoded PNGs. Stops early
 * once `limit` differing pixels are seen — the callers only ever ask "did
 * anything at all draw here", so counting the rest is wasted work.
 */
export function changedPixelsIn(a, b, box, { threshold = 12, limit = 4 } = {}) {
  const x0 = Math.max(0, Math.floor(box.x)), y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(a.width, Math.ceil(box.x + box.w)), y1 = Math.min(a.height, Math.ceil(box.y + box.h));
  if (x1 <= x0 || y1 <= y0) return 0;
  let changed = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (a.width * y + x) * a.channels;
      const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (d > threshold && ++changed >= limit) return changed;
    }
  }
  return changed;
}

/**
 * The page-side walker, as a string of source. Injected with
 * page.evaluate rather than imported, because it runs inside the browser
 * against the live Phaser objects.
 */
export const AUDIT_FN = `(opts) => {
  const GAME_W = 1074, GAME_H = 640;
  // Widest/tallest an interactive rectangle can be and still be judged as a
  // button whose label must fit it. The real buttons in this game run
  // 70-280px wide and 22-44px tall.
  const MAX_BUTTON_W = 320, MAX_BUTTON_H = 60;
  const IGNORE_SCENES = new Set(opts.ignoreScenes || []);
  const out = [];

  // Every visible Text under a scene, with its world-space bounds. Phaser's
  // getBounds() already accounts for container transforms, origin and
  // scale, which is exactly why this walks objects rather than doing the
  // arithmetic by hand — reimplementing that is how an audit ends up
  // reporting bugs that aren't there.
  function collect(scene) {
    const texts = [], rects = [];
    // The Hub renders its OVERHEARD dock through a SECOND camera whose
    // viewport starts at DOCK_SPLIT_X, and every object inside it is
    // positioned in DOCK-LOCAL coordinates. Dock coordinates and world
    // coordinates are different spaces that happen to use the same small
    // numbers, so comparing across them produces confident nonsense: the
    // dock's MENU button sits at dock-local (12,9), which looks exactly
    // like the top-left of the canvas, and the audit duly reported the
    // Hub's rank readout as overrunning it on every single screen.
    const dockSet = scene.uiCameraObjects ? new Set(scene.uiCameraObjects) : null;
    // Inherited, not per-object: what gets pushed to uiCameraObjects is
    // usually the CONTAINER (the MENU button is a container of a rectangle
    // and a label), so asking only about the object itself marked the
    // container "dock" and its own rectangle "world". That one gap kept the
    // dock's MENU button in the world comparison set, where its dock-local
    // (12, 9) reads as the canvas's top-left corner — and the audit
    // reported the Hub's rank readout as overrunning it on every screen,
    // every run, for the whole sweep.
    const spaceOf = (o, inherited) => (inherited === "dock" || (dockSet && dockSet.has(o)) ? "dock" : "world");
    // A unique id per container instance. The first attempt keyed on the
    // container's NAME plus its depth, which is the same string for every
    // unnamed container at the same nesting level — i.e. still compared
    // across containers, and still buried the real findings.
    let groupSeq = 0;
    const groupIds = new Map();
    const groupOf = (c) => {
      if (!c) return "root";
      if (!groupIds.has(c)) groupIds.set(c, "g" + groupSeq++);
      return groupIds.get(c);
    };
    const visit = (obj, depth, parent, space) => {
      if (!obj || obj.visible === false) return;
      const mySpace = spaceOf(obj, space);
      if (obj.type === "Container") {
        for (const child of obj.list || []) visit(child, depth + 1, obj, mySpace);
        return;
      }
      if (obj.type === "Text") {
        const t = (obj.text || "").trim();
        if (!t) return;
        const b = obj.getBounds();
        if (b.width <= 0 || b.height <= 0) return;
        texts.push({
          text: t,
          x: b.x, y: b.y, w: b.width, h: b.height,
          alpha: obj.alpha,
          depth: obj.depth,
          pinned: obj.scrollFactorX === 0,
          fontSize: obj.style && obj.style.fontSize,
          wordWrap: !!(obj.style && obj.style.wordWrapWidth),
          // Which container this label lives in. COLLIDE only compares
          // siblings: the Hub draws its modal overlays ON TOP of a fully
          // populated room without hiding it, so every overlay label
          // "collides" with every room label underneath. That is the
          // design, not a bug, and comparing across containers buried the
          // real findings under ~2,400 of them on the first run.
          group: groupOf(parent),
          space: mySpace,
        });
        return;
      }
      if (obj.type === "Rectangle") {
        const b = obj.getBounds();
        if (b.width <= 0 || b.height <= 0) return;
        rects.push({ x: b.x, y: b.y, w: b.width, h: b.height, interactive: !!obj.input, depth: obj.depth, space: mySpace });
      }
    };
    for (const obj of scene.children.list) visit(obj, 0, null, "world");
    return { texts, rects };
  }

  const overlap = (a, b) => {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return ox > 0 && oy > 0 ? ox * oy : 0;
  };

  for (const scene of window.__bwGame.scene.getScenes(true)) {
    const key = scene.scene.key;
    if (IGNORE_SCENES.has(key)) continue;
    const { texts, rects } = collect(scene);

    // A scene's own MAIN camera viewport, which is not always the whole
    // canvas. Fixed 3 Sep 2026: this check used to compare every pinned
    // label against the 1074x640 CANVAS, and a viewport rectangle that
    // stops short of it clips content the audit then called fine.
    //
    // That is not hypothetical. It is exactly why the sweep could never
    // have caught the Hangar-Shop-clipped-by-the-dock bug Maxime found in
    // a phone photo on 4 Sep: Hub's main camera stops at DOCK_SPLIT_X
    // (838) because the OVERHEARD dock owns the rest, so the shop's
    // 900px-wide card layout was hard-cut at x=838 while every label in it
    // sat happily inside the canvas. The audit's own build log flagged the
    // blind spot and left it; this closes it.
    //
    // Dock-space objects are measured against the DOCK camera's viewport
    // instead, because their coordinates are dock-local — comparing them
    // to the main viewport is the same category error the space/dockSet
    // machinery above already exists to prevent.
    const mainCam = scene.cameras && scene.cameras.main;
    const dockCam = (scene.cameras && scene.cameras.cameras || []).find((c) => c !== mainCam) || null;
    const viewportFor = (space) => {
      const cam = space === "dock" ? dockCam : mainCam;
      if (!cam) return { w: GAME_W, h: GAME_H, label: "canvas " + GAME_W + "x" + GAME_H };
      // Dock objects are positioned in dock-local space, so their origin is
      // the viewport's own top-left, not the canvas's.
      return { w: cam.width, h: cam.height, label: (space === "dock" ? "dock viewport " : "main-camera viewport ") + Math.round(cam.width) + "x" + Math.round(cam.height) };
    };

    for (const t of texts) {
      // OFFSCREEN — pinned text only. 1px of tolerance: Phaser's bounds are
      // fractional and a label flush to an edge is not a bug.
      if (t.pinned) {
        const vp = viewportFor(t.space);
        if (t.x < -1 || t.y < -1 || t.x + t.w > vp.w + 1 || t.y + t.h > vp.h + 1) {
          out.push({ kind: "OFFSCREEN", scene: key, text: t.text,
            detail: \`box \${t.x.toFixed(0)},\${t.y.toFixed(0)} \${t.w.toFixed(0)}x\${t.h.toFixed(0)} vs \${vp.label}\` });
        }
      }

      // OVERRUN — the smallest interactive rectangle containing this
      // label's centre is treated as its button. Two limits, both learned
      // the hard way. Interactive only, because a full-screen backdrop
      // contains everything. And BUTTON-SIZED only: an overlay's own
      // 668x400 clickable panel is a panel, not a button, and any Hub NPC
      // who happened to walk their floating name across one got reported
      // as "spilling past a 668px button" — a finding that changed by a
      // pixel or two every run because the NPC was still walking.
      const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      let button = null;
      for (const r of rects) {
        if (!r.interactive) continue;
        if (r.space !== t.space) continue; // never across coordinate spaces — see spaceOf above
        if (r.w > MAX_BUTTON_W || r.h > MAX_BUTTON_H) continue; // a panel, not a button
        if (cx < r.x || cx > r.x + r.w || cy < r.y || cy > r.y + r.h) continue;
        if (!button || r.w * r.h < button.w * button.h) button = r;
      }
      if (button) {
        const spill = Math.max(button.x - t.x, t.x + t.w - (button.x + button.w));
        if (spill > 1) {
          out.push({ kind: "OVERRUN", scene: key, text: t.text,
            detail: \`label \${t.w.toFixed(0)}px wide spills \${spill.toFixed(1)}px past a \${button.w.toFixed(0)}px button\` });
        }
      }
    }

    // COLLIDE — pairwise, but only for text that is actually legible
    // (alpha > 0.5) and only reporting a real bite of overlap, not a
    // one-pixel graze between two adjacent labels.
    const legible = texts.filter((t) => t.alpha > 0.5);
    for (let i = 0; i < legible.length; i++) {
      for (let j = i + 1; j < legible.length; j++) {
        const a = legible[i], b = legible[j];
        if (a.group !== b.group) continue; // siblings only — see the group field above
        if (a.space !== b.space) continue;
        const area = overlap(a, b);
        if (area <= 4) continue;
        const smaller = Math.min(a.w * a.h, b.w * b.h);
        if (area / smaller < 0.06) continue; // a graze, not a collision
        out.push({ kind: "COLLIDE", scene: key,
          text: \`"\${a.text}" x "\${b.text}"\`,
          detail: \`\${area.toFixed(0)}px² overlap, \${((area / smaller) * 100).toFixed(0)}% of the smaller label\` });
      }
    }
  }
  return out;
}`;

/** Run the audit against whatever is on screen right now. */
export async function auditActiveScenes(page, { ignoreScenes = [] } = {}) {
  return page.evaluate(new Function("return " + AUDIT_FN)(), { ignoreScenes });
}

/**
 * The painted-over pass. Needs the page AND a screenshot function, because
 * it works in pixels: shoot, hide, shoot, diff.
 *
 * `dockSplitX` exists because the Hub renders its right-hand OVERHEARD dock
 * through a SECOND camera with its own viewport, so those objects' bounds
 * are dock-local and do not map onto canvas pixels. Rather than pretend
 * otherwise, labels at or past the split are skipped and reported as such —
 * an honest gap is better than a confident wrong answer, which is what this
 * check reported for OVERHEARD before the exclusion existed.
 */
export async function findPaintedOver(page, screenshot, { dockSplitX = 838 } = {}) {
  // ORDER MATTERS, and getting it wrong is silent. Collect the labels
  // FIRST, then pause. Phaser's getScenes(true) means "active scenes", and
  // a paused scene is not active — pausing first returns an empty list, so
  // the check dutifully examines zero labels and reports zero problems.
  // That is a green light that means nothing, which is worse than a red
  // one. The self-test (_selftest.mjs) exists because this exact mistake
  // passed a full sweep looking perfectly healthy.
  const boxes = await page.evaluate(() => {
    const out = [];
    window.__auditPaused = [];
    for (const scene of window.__bwGame.scene.getScenes(true)) {
      // A scene with a modal overlay open is SUPPOSED to have most of
      // itself covered — that is what the overlay is for. Asking "is
      // anything painted over" there answers "yes, everything," which is
      // true and useless. Hub.ts's own anyOverlayOpen() is the game's own
      // notion of that state, so this defers to it rather than guessing
      // from geometry.
      try {
        if (typeof scene.anyOverlayOpen === "function" && scene.anyOverlayOpen()) continue;
      } catch (e) { void e; }
      window.__auditPaused.push(scene.scene.key);
      scene.__auditHide = [];
      const dockSet = scene.uiCameraObjects ? new Set(scene.uiCameraObjects) : null;
      const visit = (o) => {
        if (!o || o.visible === false) return;
        if (o.type === "Container") { (o.list || []).forEach(visit); return; }
        if (o.type !== "Text") return;
        if (!(o.text || "").trim() || o.alpha <= 0.3) return;
        // Screen-pinned text only (scrollFactorX === 0). That is the HUD
        // layer, and it is where this bug class lives: a readout drawn at
        // the default depth while the world grows over it. World text
        // overlapping other world text is a different, much less
        // interesting question, and including it tripled the runtime for
        // noise.
        if (o.scrollFactorX !== 0) return;
        // Objects the Hub routes through its SECOND camera (this.uiCamera,
        // the OVERHEARD dock) are positioned in DOCK-LOCAL coordinates —
        // x=0 means DOCK_SPLIT_X on screen. Their bounds therefore do not
        // map onto canvas pixels at all, and comparing them against the
        // screenshot reported OVERHEARD and the chat log as invisible when
        // both are plainly on screen. Excluded by identity (the scene's own
        // uiCameraObjects list) rather than by an x threshold, because
        // dock-local x values are small and look like left-edge screen
        // coordinates — the threshold version got this wrong in both
        // directions.
        if (dockSet && dockSet.has(o)) return;
        const b = o.getBounds();
        if (b.width <= 0 || b.height <= 0) return;
        // getBounds() is WORLD space; the screenshot is SCREEN pixels. For
        // a pinned object the camera scroll cancels out, but the camera's
        // own viewport offset and zoom do not.
        const cam = scene.cameras.main;
        const sx = (b.x - cam.scrollX * o.scrollFactorX) * cam.zoom + cam.x;
        const sy = (b.y - cam.scrollY * o.scrollFactorY) * cam.zoom + cam.y;
        const sw = b.width * cam.zoom, sh = b.height * cam.zoom;
        if (sx + sw <= 0 || sy + sh <= 0) return; // off-screen is OFFSCREEN's job, not this one
        out.push({ scene: scene.scene.key, text: o.text.slice(0, 60), x: sx, y: sy, w: sw, h: sh });
        scene.__auditHide.push(o);
      };
      scene.children.list.forEach(visit);
    }
    return out;
  });

  // NOW pause. The Hub re-asserts .visible on its labels every frame via
  // refreshRoomVisibility(), so without this the hide is undone before the
  // second screenshot and every label looks painted-over. A paused scene
  // still renders; it just stops running update().
  await page.evaluate(() => {
    for (const key of window.__auditPaused || []) window.__bwGame.scene.getScene(key)?.scene.pause();
  });
  await page.waitForTimeout(140);

  const before = await screenshot();
  await page.evaluate(() => {
    for (const key of window.__auditPaused || []) (window.__bwGame.scene.getScene(key)?.__auditHide || []).forEach((o) => o.setVisible(false));
  });
  await page.waitForTimeout(140);
  const after = await screenshot();
  await page.evaluate(() => {
    for (const key of window.__auditPaused || []) {
      const sc = window.__bwGame.scene.getScene(key);
      (sc?.__auditHide || []).forEach((o) => o.setVisible(true));
      sc?.scene.resume();
    }
  });

  // The Hub's OVERHEARD dock renders through a SECOND camera with its own
  // viewport, so those objects' bounds are dock-local and do not map onto
  // canvas pixels. Skipping them and saying so beats a confident wrong
  // answer — which is what this reported for OVERHEARD before the skip.
  return {
    boxes: boxes.filter((b) => b.x < dockSplitX),
    skippedDock: boxes.filter((b) => b.x >= dockSplitX).length,
    before,
    after,
  };
}

/** Collapse duplicates across screens — the same MENU button appears on six of them. */
export function dedupe(findings) {
  const seen = new Map();
  for (const f of findings) {
    const key = `${f.kind}|${f.scene}|${f.text}|${f.detail}`;
    if (!seen.has(key)) seen.set(key, { ...f, screens: [f.screen] });
    else seen.get(key).screens.push(f.screen);
  }
  return [...seen.values()];
}
