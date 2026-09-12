// Non-negotiable #2 (Build Brief §2.2): no file under src/engine or
// src/data may import Phaser. This is what makes the headless sim
// harness possible and what keeps a future Godot port from being a
// rewrite. Enforced here as a rule, not a habit.
import tseslint from "typescript-eslint";

const noPhaserImport = {
  rules: {
    "no-restricted-imports": [
      "error",
      { paths: [{ name: "phaser", message: "src/engine and src/data are pure TypeScript — no Phaser dependency. See Build Brief §2.2." }] },
    ],
  },
};

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    // Codebase convention: a leading underscore marks a parameter kept on
    // purpose but not read by the current body — e.g. activeLanceIds(_state)
    // in campaignState.ts, kept so every existing call site (and a future
    // carrier type that might need it) still has it, even though today's
    // body doesn't read it. Without this, the rule can't tell "kept on
    // purpose, see the doc comment" from "forgot to remove it."
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // .cjs is Node's own "force CommonJS regardless of package.json's type
    // field" signal — see electron/main.cjs's own header comment for why
    // that file is .cjs at all. require() there isn't a style lapse this
    // rule should flag, it's the entire reason the extension is .cjs
    // instead of .ts in the first place.
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["src/engine/**/*.ts", "src/data/**/*.ts", "src/sim/**/*.ts"],
    ...noPhaserImport,
  },
  {
    files: ["src/data/**/*.ts"],
    rules: {
      // Build Brief §5.2: src/data is pure data. No imports except ./types.
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "phaser", message: "src/data is pure data — no Phaser dependency." }],
          patterns: [
            {
              group: ["../engine/*", "../scenes/*", "../ui/*", "../sim/*"],
              message: "src/data may only import from ./types — it must stay pure, hand-editable data.",
            },
          ],
        },
      ],
    },
  }
);
