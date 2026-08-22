# The spoiler lock

Build Brief §2.1 requires one reserved term (the book series' working title)
to never appear anywhere in this repo — code, comments, filenames, commit
messages, UI strings. `tools/lint-spoiler.mjs` enforces it, wired into
`pretest` and `prebuild`.

The term itself is deliberately **not** written anywhere in this repo,
including in the lint tool. To activate the check:

1. Create a file named `.env.local` in the project root (already covered by
   `.gitignore` via the `*.local` pattern — it will never be committed).
2. Add one line: `BW_RESERVED_TERM=<the term>`
3. Run `npm run lint` — it should now fail if the term appears anywhere,
   and pass when it doesn't.

Until `.env.local` is set, the lint script prints a warning and exits
clean rather than failing the build — that's intentional so the rest of
the toolchain isn't blocked on a secret this session was never given.

The design documents (GDD, Data Pack, Build Brief, Canon Pass) live in the
Claude project "The Bloom Wars," not duplicated into this repo, to avoid
two copies drifting apart. Ask Claude to pull the latest version of any of
them into `design/` if you want a local copy to reference offline.
