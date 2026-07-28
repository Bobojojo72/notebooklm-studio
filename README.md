# NotebookLM Studio

Jo's NotebookLM control panel. Styles, chat prompts, Studio prompts, workflows and tips in one page.

Live: https://bobojojo72.github.io/notebooklm-studio/

## Using it

Type your topic in the box at the top. Every Copy button then hands you your topic and the prompt together, ready to paste into NotebookLM. Press Ctrl K to search everything at once, arrow keys to move, Enter to copy. Press / to jump to the search box. Star anything to pin it to the top.

Prompts containing [square brackets] show a fill-in box on the card. Whatever you type is substituted when you copy. Leave one blank and the bracket comes through untouched.

## What is in it

| Tab | Contents |
|---|---|
| Styles | 50 full style specifications plus 49 named quick styles |
| Chat prompts | 62 prompts across 9 categories |
| Studio prompts | 57 prompts across 9 output types |
| Workflows | 7 multi-step routines |
| Tips | 8 reference sections |

## Editing content

Never edit anything in `data/` by hand. Those files are generated. Change the source markdown in the NotebookLM project folder, then run:

    node tools/extract.js
    node --test "tests/*.test.js"

## Working on the code

There is no build step and no dependencies. Open `index.html` in a browser, or serve the folder:

    python -m http.server 8123

Run the tests with:

    node --test "tests/*.test.js"

## Important

GitHub is the master copy of this repository. Pull before editing. The copy on the H: drive is a convenience mirror for offline use and must never be pushed over the top of this one.

Style specifications by u/Paolo-Cortez on r/notebooklm.
