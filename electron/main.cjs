// electron/main.cjs — The Bloom Wars, Electron main process.
//
// This wraps the existing Vite web build (dist/) in a native window. It does
// not touch, import, or duplicate any game code — it loads the same built
// game a browser would, through a local protocol handler instead of raw
// file:// access. If the browser (itch.io) build ever changes, this file
// needs zero updates; it only cares that dist/index.html exists after
// `npm run build`.
//
// Plain CommonJS (.cjs) on purpose: package.json sets "type": "module" for
// the game's own source, and mixing that with Electron's main process adds
// avoidable friction for a first packaging pass. .cjs sidesteps it entirely.

const { app, BrowserWindow, Menu, protocol, net, shell } = require("electron");
const path = require("node:path");
const url = require("node:url");

const DIST_DIR = path.join(__dirname, "..", "dist");

// Registers a custom "app://" scheme as privileged BEFORE the app is ready —
// Electron requires this call at this exact point, it can't be done later.
// "Privileged" means: behaves like a real web origin (fetch works, CORS
// applies, localStorage is stable) instead of Electron's locked-down
// default treatment of an unknown scheme.
//
// Why this exists: plain file:// loading has no concept of a site root, so
// asset paths resolved against the whole filesystem drive instead of the
// dist/ folder and every load 404'd (the "121 net::ERR_FILE_NOT_FOUND"
// wall of 10 Sep 2026 — the click handler tried to play a sound that
// 404'd, threw, and never reached the menu transition). Serving dist/ as a
// real web origin fixes that for good. 16 Sep 2026: the game's asset paths
// are RELATIVE now ("audio/x.ogg", for itch.io's subfolder hosting — see
// scenes/Preloader.ts); under app://bloomwars/index.html they resolve to
// app://bloomwars/audio/x.ogg, the same request as before, so nothing here
// changed for that fix.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// No File/Edit/View menu bar — this is a game, not a document editor, and
// the default Electron menu has no purpose here. Side effect worth knowing:
// Electron's Ctrl+Shift+I / F12 DevTools toggle lives on that default menu's
// accelerators, not independent of it, so removing the menu silently removed
// the shortcut too. Re-registered in createWindow via before-input-event
// (scoped to THIS window) — the 11 Sep globalShortcut version was OS-wide
// and swallowed Ctrl+Shift+I in every other app while the game ran (ship
// audit, 16 Sep 2026). F11 toggles fullscreen the same way.
Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // The game's own logical canvas is 1074x640 (see
    // claude/Bloom_Wars_Screen_Resolution_Plan_v1.md) — never let the window
    // shrink below that. useContentSize makes these CONTENT sizes (16 Sep
    // 2026): without it they were outer sizes including the title bar, so
    // the "minimum" gave ~1058x601 of content and FIT scaled the game down.
    useContentSize: true,
    minWidth: 1074,
    minHeight: 640,
    backgroundColor: "#0c0f12", // matches index.html's own background, avoids a white flash on load
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Loaded through the app:// handler registered below, not loadFile — see
  // the big comment above for why.
  win.loadURL("app://bloomwars/index.html");

  // Ship audit, 16 Sep 2026 — three guards a shipped window needs:
  // 1. Never navigate away from the game. Without this, dragging any file
  //    onto the window navigated the renderer to file://… and the game
  //    vanished. Any future in-game link (the itch page, the Discord)
  //    opens in the player's real browser instead.
  win.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith("app://")) {
      event.preventDefault();
      if (/^https?:/.test(target)) shell.openExternal(target);
    }
  });
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });
  // 2. Ctrl+Shift+I / F12 for DevTools and F11 for fullscreen, scoped to
  //    this window only (see the Menu comment above).
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const devtools = (input.control || input.meta) && input.shift && input.key.toUpperCase() === "I";
    if (devtools || input.key === "F12") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  // 3. Start maximised — a 1280x800 window on a 1080p monitor left the
  //    game well under the 150% cap most players will keep.
  win.maximize();

  // The 10 Sep 2026 auto-open-DevTools-every-launch debug line lived here
  // temporarily while tracking down the "main menu buttons don't respond"
  // bug. Removed, 11 Sep 2026, per the EA Dev-Cleanup Checklist — a real
  // release build should never pop a detached DevTools window on launch.
  // Ctrl+Shift+I / F12 (the before-input-event handler above) still opens
  // it on demand.

  return win;
}

app.whenReady().then(() => {
  // Serves dist/ over the app:// scheme registered above. "bloomwars" is
  // just the host part of the URL (app://bloomwars/...) — an arbitrary
  // label, not a network address. Nothing here touches the network; every
  // request is answered from a local file under dist/.
  protocol.handle("app", (request) => {
    const requestUrl = new URL(request.url);
    // request.url looks like "app://bloomwars/index.html" or
    // "app://bloomwars/audio/sfx_kill.ogg" — pathname is "/index.html",
    // "/audio/sfx_kill.ogg", etc.
    let relativePath = decodeURIComponent(requestUrl.pathname);
    if (relativePath === "" || relativePath === "/") relativePath = "/index.html";

    const filePath = path.normalize(path.join(DIST_DIR, relativePath));

    // Guard against a request path escaping dist/ (e.g. via "..") — nothing
    // on the game side ever generates such a path, so this should never
    // trigger, but it costs nothing to keep the handler from ever serving
    // files outside dist/ if it somehow did.
    if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
      return new Response("Forbidden", { status: 403 });
    }

    return net.fetch(url.pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on("activate", () => {
    // macOS convention (re-open a window when the dock icon is clicked with
    // no windows open). Harmless no-op on Windows, kept for portability.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
