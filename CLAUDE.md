# NotebookLM Studio: no-build web app on GitHub Pages
- Never edit data/ by hand: it's generated. Change the source markdown, then run
  `node tools/extract.js`.
- Tests: `node --test "tests/*.test.js"`. Run them before every commit.
- Preview: `python -m http.server 8123`.
- data/styles.js is 70KB: grep, don't read whole.
- GitHub is the master copy. The H: drive copy is a mirror and must never be pushed over it.
- Answer directly. Don't restate your reasoning in the reply.
- Read TASKS.md at the start of a session and keep it current (rule inside).
