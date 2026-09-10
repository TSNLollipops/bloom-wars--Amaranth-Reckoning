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

const { app, BrowserWindow, Menu, globalShortcut, protocol, net } = require("electron");
const path = require("node:path");
const url = require("node:url");

const DIST_DIR = path.join(__dirname, "..", "dist");

// Registers a custom "app://" scheme as privileged BEFORE the app is ready —
// Electron requires this call at this exact point, it can't be done later.
// "Privileged" means: behaves like a real web origin (fetch works, CORS
// applies, localStorage is stable) instead of Electron's locked-down
// default treatment of an unknown scheme.
//
// Why this exists: the game's own code references public/ assets with
// root-absolute paths, like "/audio/sfx_kill.ogg" — correct for a real
// browser, where "/" means the site root. Plain file:// loading has no
// concept of a site root, so "/audio/..." resolved against the whole
// filesystem drive instead of the dist/ folder, and every one of those
// loads 404'd (this is the "121 net::ERR_FILE_NOT_FOUND" wall you saw in
// the console, and the reason clicking did nothing — the click handler
// tried to play a sound that 404'd, threw, and never reached the actual
// menu transition). Rather than rewrite every asset path in the game's own
// source to work around a packaging quirk, this makes Electron serve
// dist/ as if it really were a web root, so paths that are already correct
// for the itch.io build stay correct here too, unchanged.
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
// the shortcut too. Re-registered below via globalShortcut instead, so
// DevTools stays reachable without bringing the menu bar back.
Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // The game's own logical canvas is 1074x640 (see
    // claude/Bloom_Wars_Screen_Resolution_Plan_v1.md) — never let the window
    // shrink below that, or the UI starts clipping.
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

  // TEMPORARY, 10 Sep 2026 — auto-opens DevTools every launch while tracking
  // down the "main menu buttons don't respond" bug. Remove this line once
  // that's confirmed fixed; the Ctrl+Shift+I shortcut below stays either
  // way, so DevTools is still reachable on demand without this auto-open.
  win.webContents.openDevTools({ mode: "detach" });

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
    if (!filePath.startsWith(DIST_DIR)) {
      return new Response("Forbidden", { status: 403 });
    }

    return net.fetch(url.pathToFileURL(filePath).toString());
  });

  createWindow();

  // Restores DevTools access now that the default menu (and its built-in
  // accelerator) is gone — see the comment above Menu.setApplicationMenu.
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.toggleDevTools();
  });

  app.on("activate", () => {
    // macOS convention (re-open a window when the dock icon is clicked with
    // no windows open). Harmless no-op on Windows, kept for portability.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
