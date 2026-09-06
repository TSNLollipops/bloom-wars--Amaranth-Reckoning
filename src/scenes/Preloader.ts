// src/scenes/Preloader.ts
// B4 (portrait wiring), 5 Sep 2026 — the game's first-ever image-loading
// step. Every other scene in this game draws with Phaser Graphics/Text
// primitives (Boot.ts's own header used to say so outright); this is the
// one place that calls this.load.image(), so it's also the one place a
// missing or renamed file under public/portraits or public/splash would
// ever throw a load error.
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
    this.add.text(cx, cy - 30, "LOADING", { fontFamily: "monospace", fontSize: "13px", color: "#8a97a6" }).setOrigin(0.5);
    this.add.rectangle(cx, cy, barW, barH, 0x1a2028, 1).setStrokeStyle(1, 0x3a4552);
    const fill = this.add.rectangle(cx - barW / 2, cy, 1, barH - 4, 0x4a7a9a, 1).setOrigin(0, 0.5);

    this.load.on("progress", (frac: number) => {
      fill.width = Math.max(1, (barW - 4) * frac);
    });

    for (const asset of allPortraitAssets()) {
      this.load.image(asset.key, `/${asset.path}`);
    }
    for (const asset of SPLASH_ASSETS) {
      this.load.image(asset.key, `/${asset.path}`);
    }
  }

  create() {
    this.scene.start(this.nextScene);
  }
}
