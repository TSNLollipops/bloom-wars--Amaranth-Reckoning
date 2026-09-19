// src/data/discordLink.ts
// Business Plan v1 (claude/Bloom_Wars_Business_Plan_v1_11Sep2026.md) §12
// decision 6, §13 — the "JOIN THE DISCORD" row on the Options screen.
// Same "empty string ships nothing" idiom as DEMO_STORE_URL (data/demoCap.ts):
// scenes/Options.ts only draws the button when this is non-empty, and falls
// back to the original two-button BACK/CREDITS row when it's blank, so this
// file was safe to land even before the invite existed.
//
// Filled in 18 Sep 2026 with the real invite Maxime posted in the Discord's
// own server settings. Opened with a plain window.open() in Options.ts, same
// call MapSelect.ts's own GET THE FULL GAME button already makes for
// DEMO_STORE_URL — electron/main.cjs's will-navigate guard and
// setWindowOpenHandler (added for that same button) already redirect any
// window.open() to the system browser via shell.openExternal, so no
// Electron-specific branch is needed here.
export const DISCORD_INVITE_URL = "https://discord.gg/3KwYbynG9";
