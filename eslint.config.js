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
