// src/scenes/Preloader.ts
// B4 (portrait wiring), 5 Sep 2026 — the game's first-ever image-loading
// step. Every other scene in this game draws with Phaser Graphics/Text
// primitives (Boot.ts's own header used to say so outright); this is the
// one place that calls this.load.image() (or, since A6 below, this.load.
// audio()), so it's also the one place a missing or renamed file under
// public/portraits, public/splash, or public/audio would ever throw a
// load error.
//
// Audio, "enough for EA" scope (A6, 9 Sep 2026) — added the eight files
// under public/audio/ to this same up-front load via
// scenes/audio/AudioManager.ts's own preloadAudio(). See that file's
// header for the full manager and engine/audioSettings.ts for the two
// volume sliders' own persistence.
//
// Sits between Boot and wherever Boot was already going (MainMenu on a
// fresh/ordinary load, or baseSceneKeyFor(state) off the recall notice's
// RETURN TO BASE button) — Boot.ts now hands off here with
// `this.scene.start("Preloader", { next: <key> })` on both paths, since
// Hub's own NPCs need these textures in the cache just as much as
// MainMenu's art eventually might. See engine/portraits.ts for the full
// list this loads and why — that module is the only place that knows how
// a pilot id maps to a portrait file; this scene just loads every file it
// names, once, up front, rather than lazily per-scene. Total payload is
// ~2.7MB (27 portraits + 4 splash images, all pre-shrunk — see the B4
// asset-prep pass) against a ~2MB JS bundle, so a single up-front load is
// simpler and not meaningfully worse than trying to stagger it.
import Phaser from "phaser";
import { allPortraitAssets, SPLASH_ASSETS } from "../engine/portraits";
import { preloadAudio } from "./audio/AudioManager";

export interface PreloaderData {
  /** Scene key to start once loading finishes. Defaults to "MainMenu". */
  next?: string;
}

export class Preloader extends Phaser.Scene {
  private nextScene = "MainMenu";

  constructor() {
    super("Preloader");
  }

  init(data: PreloaderData) {
    this.nextScene = data?.next ?? "MainMenu";
  }

  preload() {
    this.cameras.main.setBackgroundColor("#0c0f12");

    // A plain Graphics/Text loading bar — deliberately not the
    // loading_screen.jpg splash image itself, since that file is one of
    // the things still loading. Wiring loading_screen.jpg in as this
    // scene's own backdrop is future work if the bare bar reads as too
    // thin; not attempted here since it'd need to load ahead of
    // everything else in its own earlier step for no real gain tonight.
    const cx = 480;
    const cy = 320;
    const barW = 320;
    const barH = 18;
    const label = this.add.text(cx, cy - 30, "LOADING", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" }).setOrigin(0.5);
    this.add.rectangle(cx, cy, barW, barH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552);
    const fill = this.add.rectangle(cx - barW / 2, cy, 1, barH - 4, 0x4a7a9a, 1).setOrigin(0, 0.5);

    this.load.on("progress", (frac: number) => {
      fill.width = Math.max(1, (barW - 4) * frac);
    });
    // Ship audit, 16 Sep 2026 (§4) — Phaser's loader carries on past a 404
    // (the game still runs, portraits just draw as the missing-texture
    // green), which is exactly why the 15 Sep itch.io path bug was
    // invisible on this screen. Now every failed file is counted on the
    // bar and named in the console, so the next regression is diagnosable
    // from a screenshot and a bug report.
    let failed = 0;
    this.load.on("loaderror", (file: { key?: string; src?: string }) => {
      failed++;
      label.setText(`LOADING — ${failed} file${failed === 1 ? "" : "s"} failed to load`).setColor("#f59e0b");
      console.warn(`Preloader: failed to load ${file?.key ?? "?"} (${file?.src ?? "?"})`);
    });

    // itch.io asset-path fix, 16 Sep 2026 — these used to be `/${asset.path}`
    // (root-absolute). itch.io serves an HTML5 game from a per-project
    // SUBFOLDER on its CDN, never from the domain root, so "/portraits/x.png"
    // went looking at the CDN's real root and 404'd — every portrait and
    // splash image on the live demo page. A plain relative path resolves
    // against wherever index.html actually lives instead, which is correct
    // in all three places this game runs: the Vite dev server (index.html at
    // "/"), Electron (index.html at app://bloomwars/index.html — see
    // electron/main.cjs, whose app:// handler maps pathnames straight onto
    // dist/, so "portraits/x.png" requests the exact same URL the old "/"
    // form did), and itch.io's subfolder. vite.config.ts's `base: "./"`
    // doesn't cover this on its own: it only rewrites paths Vite sees at
    // build time, and these are plain runtime strings pointing into
    // public/, which Vite copies through untouched. Same fix, same reason,
    // in scenes/audio/AudioManager.ts's preloadAudio().
    for (const asset of allPortraitAssets()) {
      this.load.image(asset.key, asset.path);
    }
    for (const asset of SPLASH_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
    // Audio, "enough for EA" scope (A6, 9 Sep 2026) — the eight files under
    // public/audio/, same up-front-load idiom as the portraits/splash art
    // right above rather than lazy per-scene loading. All eight together
    // are well under 150KB, nowhere near enough to justify staggering.
    preloadAudio(this);
  }

  create() {
    this.scene.start(this.nextScene);
  }
}
