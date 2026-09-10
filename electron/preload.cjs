// electron/preload.cjs — intentionally empty.
//
// The game is a self-contained web build (Phaser + localStorage for saves)
// and needs no access to Node.js or Electron APIs from inside the page.
// This file exists purely so contextIsolation can stay on (Electron's
// recommended safe default, set in main.cjs) without wiring up a bridge
// the game doesn't need yet. If a future feature needs to talk to the
// native side (e.g. a "reveal save file" button, or a real filesystem
// export), the bridge goes here via contextBridge.exposeInMainWorld.
