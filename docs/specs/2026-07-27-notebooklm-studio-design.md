# NotebookLM Studio: design

Date: 27 July 2026
Owner: Jo
Status: approved, ready for implementation planning

## 1. What this is

Jo has a single 94 KB HTML page, `NotebookLM_Infographic_Style_Library.html`, holding 50 infographic style specifications and 20 chat prompts. Four markdown files sit beside it in the same project folder and are never surfaced anywhere: `Studio_Prompts.md`, `Prompt_Library.md`, `Tips_and_Tricks.md` and `NotebookLM_Mastery_Guide.md`.

This project turns those five files into one page: a NotebookLM control panel that Jo keeps open in a browser tab beside NotebookLM itself, published to GitHub Pages and usable offline.

The measure of success is time to paste. Jo should be able to go from opening the page to having the right prompt on her clipboard, with her topic already merged into it, in under five seconds.

## 2. Source material

All content comes from `H:\My Drive\Surface Laptop Folders Synch\Documents\Claude\Projects\NotebookLM\`. That copy is newer than the one in `H:\My Drive\MY_NOTEBOOKLM_FILES\` and is the one to use.

| File | What is taken from it |
|---|---|
| `NotebookLM_Infographic_Style_Library.html` | The `STYLES` array (50 specs) and the `PROMPTS` array (20 chat prompts) |
| `Studio_Prompts.md` | Jo's 9 Google Keep quick styles, plus roughly 50 studio prompts across 9 output types, plus the style-name cheat sheet |
| `Prompt_Library.md` | 42 chat prompts in 9 categories, plus 3 power combos |
| `Tips_and_Tricks.md` | 4 workflow templates, prompting techniques, common mistakes, lesser-known features |
| `NotebookLM_Mastery_Guide.md` | Reference material for the Tips tab |

Extraction notes:

- The markdown uses escaped characters, for example `\\\[TOPIC]` and `\---`. These must be unescaped during extraction.
- Prompt blocks follow the pattern `**Name:**` on one line, then a blockquote line starting `> ` holding the prompt text. Some starred Google Keep entries use `#### ` headings instead and must be handled separately.
- The 20 chat prompts on the page and the 42 in `Prompt_Library.md` overlap. Dedupe on normalised prompt text, keeping the longer version and the better title.
- Final counts per tab are only known after parsing. The build must report actual counts rather than assuming the estimates below.

## 3. Information architecture

Five tabs, one shared search box, one shared context filter.

1. **Styles** (~59). The 50 full specifications plus Jo's 9 quick styles. Full specs and quick styles are visually distinguished but live in the same grid.
2. **Chat prompts** (~55 after dedupe). Grouped by the 9 existing categories.
3. **Studio prompts** (~50). Grouped by output type: infographic, audio overview, briefing doc, study guide, slide deck, mind map, FAQ, timeline, source discovery.
4. **Workflows** (7). The power combos and workflow templates, each shown as an ordered chain of steps with a copy button per step and a copy-all.
5. **Tips**. Reference reading: how to use the customisation field, prompting techniques, common mistakes, lesser-known features, orientation guidance and the style-name cheat sheet.

Every item carries a context tag drawn from its source section: Sales, Wisdom Bytes, Learning, or General. A context filter in the toolbar narrows the entire page to one context at a time.

### Style filtering

The current page filters styles by which Reddit thread they came from. That grouping is removed. Styles are instead filtered by vibe, assigned from their existing `tags` array and tone line: Editorial, Retro, Technical, Hand-drawn, Playful, Luxe, Sci-fi, Corporate. A style may hold more than one vibe.

A second filter row offers use-case suggestions: Prospect one-pager, Wisdom Bytes explainer, Monthly report, Study aid. These are curated lists of style names, not computed.

Background filter (dark or light) and the existing tag dropdown are kept.

## 4. Grab mechanics

This is the core of the redesign.

**Topic bar.** A single text field pinned to the top of the page, persisting to `localStorage`. When it holds a value, every copy action composes the topic and the prompt or specification into one block, formatted as NotebookLM expects, and copies the whole thing. When it is empty, copy behaves as it does today and copies the prompt alone. The composed format for styles is the topic line first, then a blank line, then the full specification.

**Bracket fields.** Prompt text containing `[SQUARE BRACKETS]` renders those tokens as inline editable fields on the card. Values typed in are substituted at copy time and persist for the session. Any field left untouched copies through as the original bracket token so nothing is silently lost.

**Command palette.** `Ctrl K` (and `Cmd K`) opens a search overlay covering every item in every tab. Up and down arrows move the selection, Enter copies the selected item using the same composition rules as the card, Escape closes. Typing filters on name, tone, tags and prompt body.

**Pinning and recents.** A star on every card pins it. Pinned items appear in a rail above the grid on every tab. The last five copied items also appear there, labelled as recent. Both persist to `localStorage`.

**Feedback.** The existing toast is kept and fires on every copy, naming what was copied.

**Open NotebookLM.** A toolbar button opens `notebooklm.google.com` in a new tab. It does not copy anything; copying is always the card's job or the palette's job, so the clipboard is never overwritten by accident.

## 5. Cards and thumbnails

Style cards, top to bottom:

1. A generated preview block, 16:10, drawn in pure CSS from the style's own palette: a title bar in the text colour, a rule in the accent colour, three bars in the secondary colours at varying heights, and a ring in the accent colour. No image files, no network requests.
2. Name, tone line, vibe tags.
3. The palette as hex chips. Clicking a chip copies that hex value.
4. Action row: Copy as the primary action, then Preview, then the star.
5. The full specification inside a collapsible section, closed by default.

Preview opens a modal showing the same generated mock at full size with the palette and typography notes beside it, so Jo can judge a style before committing a generation to it.

Prompt cards (chat, studio) carry: category label, name, the one-line reason it exists, the prompt body with bracket fields inline, then Copy and the star.

Workflow cards carry: name, purpose, then numbered steps, each step with its own copy button, plus a copy-all that joins the steps.

## 6. Visual direction

The existing dark base with the teal accent is kept, and the light theme is kept. What changes:

- A deliberate type scale with real contrast between heading and body, tighter letter spacing on headings.
- Consistent spacing rhythm on a 4 px base.
- A density toggle offering comfortable and compact, persisted to `localStorage`.
- Focus rings on every interactive element, correct `aria` attributes on tabs, chips and the palette, and keyboard reachability throughout.
- Mobile: single column, topic bar and copy buttons within thumb reach, tabs become a horizontally scrolling row.
- The existing print stylesheet is kept and extended to the new tabs.

No external fonts, no CDN, no analytics. Everything ships in the repo.

## 7. File structure

```
notebooklm-studio/
  index.html
  assets/
    app.css
    app.js
  data/
    styles.js
    quick-styles.js
    chat-prompts.js
    studio-prompts.js
    workflows.js
    tips.js
  docs/
    specs/2026-07-27-notebooklm-studio-design.md
  manifest.webmanifest
  sw.js
  .nojekyll
  README.md
```

Data files are plain JavaScript that assign to a global, not JSON loaded by `fetch`. This is deliberate: `fetch` fails under the `file://` protocol, and the page must work when opened by double-clicking it from the H: drive with no internet connection.

Each data file is a flat array of objects with a shared shape so one render path serves all prompt tabs. Adding a prompt later means appending one object to one array, with no code change.

## 8. Repository and deployment

- Repository: `Bobojojo72/notebooklm-studio`, public.
- GitHub Pages served from `main`, live at `https://bobojojo72.github.io/notebooklm-studio/`.
- Local working clone: `C:\Users\jolav\notebooklm-studio`. This is deliberately outside the Google Drive mirrored folders, because a `.git` directory inside a synced folder causes corruption.
- After each push, the site files (not `.git`) are copied to `H:\My Drive\Surface Laptop Folders Synch\Documents\Claude\Projects\NotebookLM\notebooklm-studio\` so an offline copy exists on the master drive.
- From the first push onward, GitHub is the master copy for this repository, exactly as it is for `prompt-cockpit`. Pull before editing in any future session.
- A service worker and web manifest make the page installable and offline-capable, so it can be added to the Surface taskbar and to a phone home screen.

## 9. Attribution

Forty-nine of the 50 specifications were written and published by a Reddit author, u/Paolo-Cortez. The per-card "Source" buttons are removed, as are the source-post filter chips and the source-post table, because they are noise in Jo's workflow. A single credit line is kept in the footer naming the author and the subreddit. Jo approved keeping this line.

## 10. Testing

Manual verification before push, on the running page:

- Every tab renders and its item count matches the parsed data.
- Copy with an empty topic field returns the prompt alone. Copy with a topic returns topic and prompt composed correctly.
- Bracket substitution produces the right text, including when a field is left blank.
- `Ctrl K` opens, filters, copies with Enter and closes with Escape.
- Pin and recents survive a page reload.
- Both themes and both densities render every tab correctly.
- The page loads and functions from `file://` with the network disabled.
- Mobile viewport at 390 px wide shows one column with no horizontal scroll.

## 11. Build order

1. Extract and clean all source data into the six data files. Report actual counts.
2. Shell: `index.html`, tab routing, toolbar, theme and density.
3. Styles tab with generated thumbnails and the Preview modal.
4. Chat prompts, Studio prompts, Workflows and Tips tabs on the shared render path.
5. Grab mechanics: topic bar, bracket fields, command palette, pinning and recents.
6. Polish, accessibility, print, service worker and manifest.
7. Show Jo the page running locally.
8. On approval: create the repository, push, enable Pages, verify the live URL, copy to H:.

## 12. Out of scope

- Importing anything directly from Jo's NotebookLM notebook. The local markdown files are the content source for this build.
- Generating real infographic images for the 50 styles.
- Any server, build step, package manager or framework.
