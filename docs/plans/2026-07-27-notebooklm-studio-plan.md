# NotebookLM Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn five separate NotebookLM files into one offline-capable, keyboard-driven web page that gets the right prompt onto Jo's clipboard, with her topic merged in, in under five seconds.

**Architecture:** A static page with no build step and no framework. Content is extracted once by a Node script into plain JavaScript data files that assign onto a `NLM` global, so the page works identically over `https://` and by double-clicking the file from the H: drive. All logic lives in pure functions in `assets/lib.js` that take data and return strings, so every one of them is unit-testable under Node's built-in test runner. The DOM layer does nothing but insert those strings and wire events.

**Tech Stack:** Vanilla HTML, CSS and JavaScript. Node 24 (built-in `node:test` and `node:assert`) for tooling and tests only, never shipped. Python 3.13 `http.server` for local browser verification. No npm, no package.json, no dependencies.

## Global Constraints

- British English throughout, in code comments, UI copy and commit messages.
- No em dashes anywhere in any output. Use commas, full stops, colons or brackets.
- No CDN, no external fonts, no analytics, no network requests of any kind at runtime.
- No build step, no bundler, no package manager. The repository is the deployable artefact.
- The page must work fully when opened as `file:///.../index.html` with networking disabled. This is why data files are JavaScript assigning to a global, never JSON fetched at runtime.
- Node is a development dependency only. Nothing under `tools/` or `tests/` ships in the runtime path.
- No native Node modules. Jo's machine is ARM64 Snapdragon with no compiler, so anything requiring `node-gyp` will fail.
- Source content lives at `H:\My Drive\Surface Laptop Folders Synch\Documents\Claude\Projects\NotebookLM\`. Read from there, never write to it.
- Repository working copy: `C:\Users\jolav\notebooklm-studio`. Never place a git repository inside a Google Drive synced folder.
- Every data record carries `id`, `name`, `body`, `context` and `tags`. One render path serves all prompt kinds.
- Git identity for this repository: `Bobojojo72` / `basslavene@gmail.com`.

## File Structure

| Path | Responsibility |
|---|---|
| `tools/parse.js` | Pure markdown parsing functions. Exported via CommonJS, used only by `extract.js` and tests. |
| `tools/extract.js` | One-off script: reads the five source files, writes the six data files. Run by hand, output is committed. |
| `data/styles.js` | The 50 full specifications, each with an added `id` and `vibes` array. |
| `data/quick-styles.js` | Style names with descriptions: NotebookLM built-in presets, Jo's Google Keep styles, and the expanded library. |
| `data/chat-prompts.js` | Chat prompts, deduped across the old page and `Prompt_Library.md`. |
| `data/studio-prompts.js` | Studio output prompts grouped by output type. |
| `data/workflows.js` | Multi-step workflow chains. |
| `data/tips.js` | Reference sections for the Tips tab. |
| `assets/lib.js` | All pure logic: composition, bracket fields, vibes, search, and every render function. Returns strings, touches no DOM. |
| `assets/app.js` | The only file that touches the DOM: mounts strings, wires events, reads and writes `localStorage`. |
| `assets/app.css` | All styling, both themes, both densities, print rules. |
| `index.html` | Document skeleton, tab bar, toolbar, mount points, script tags in dependency order. |
| `tests/*.test.js` | Node test files, one per logic area. |
| `sw.js`, `manifest.webmanifest` | Offline and installability. |
| `.claude/launch.json` | Local static server definition for browser verification. |

`lib.js` is deliberately the largest file, but every function in it is pure and independently tested. If it passes 600 lines during Task 6, split it into `lib.core.js` (composition, fields, search) and `lib.render.js` (HTML builders), keeping both on the same global.

---

### Task 1: Markdown block parser

Builds the pure parsing functions the extractor needs. No files are read yet, so this task is entirely deterministic and fast to test.

**Files:**
- Create: `tools/parse.js`
- Create: `tests/parse.test.js`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `unescapeMd(text: string) => string`
  - `parseBlocks(markdown: string) => Array<{section: string, name: string, body: string}>`
  - `contextFor(section: string) => 'sales' | 'wisdom' | 'learning' | 'general'`
  - `slug(text: string) => string`

- [ ] **Step 1: Create the gitignore**

Create `.gitignore`:

```
node_modules/
.DS_Store
Thumbs.db
*.log
```

- [ ] **Step 2: Write the failing tests**

Create `tests/parse.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { unescapeMd, parseBlocks, contextFor, slug } = require('../tools/parse.js');

test('unescapeMd strips the escaped brackets the source files use', () => {
  assert.equal(unescapeMd('about \\\\\\[TOPIC] now'), 'about [TOPIC] now');
});

test('unescapeMd strips escaped asterisks and horizontal rules', () => {
  assert.equal(unescapeMd('\\\\\\*\\\\\\*bold\\\\\\*\\\\\\*'), '**bold**');
  assert.equal(unescapeMd('\\---'), '---');
});

test('parseBlocks reads a named block followed by a blockquote', () => {
  const md = [
    '## PART 1: INFOGRAPHIC PROMPTS',
    '',
    '### INFOGRAPHIC PROMPTS — PACKAGING / SALES USE',
    '',
    '**Prospect Industry Overview:**',
    '',
    '> Create a bold infographic about \\\\\\[INDUSTRY].',
    ''
  ].join('\n');
  const blocks = parseBlocks(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].section, 'INFOGRAPHIC PROMPTS — PACKAGING / SALES USE');
  assert.equal(blocks[0].name, 'Prospect Industry Overview');
  assert.equal(blocks[0].body, 'Create a bold infographic about [INDUSTRY].');
});

test('parseBlocks takes the heading as the name when a starred block has no bold label', () => {
  const md = [
    '### ⭐ FINAL EXAM (from Google Keep)',
    '',
    '> Test me like tomorrow is the exam.',
    ''
  ].join('\n');
  const blocks = parseBlocks(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].name, 'Final exam');
  assert.equal(blocks[0].body, 'Test me like tomorrow is the exam.');
});

test('parseBlocks joins a blockquote that wraps over several lines', () => {
  const md = ['**Two liner:**', '', '> first line', '> second line', ''].join('\n');
  assert.equal(parseBlocks(md)[0].body, 'first line second line');
});

test('parseBlocks ignores blockquotes that are notes rather than prompts', () => {
  const md = ['## HOW TO USE THESE', '', '> 💡 Strategic tip: choose by goal.', ''].join('\n');
  assert.equal(parseBlocks(md).length, 0);
});

test('contextFor maps section headings to a context', () => {
  assert.equal(contextFor('SLIDE DECK — PACKAGING / SALES'), 'sales');
  assert.equal(contextFor('AUDIO OVERVIEW — WISDOM BYTES'), 'wisdom');
  assert.equal(contextFor('STUDY GUIDE — PERSONAL LEARNING'), 'learning');
  assert.equal(contextFor('PART 6: MIND MAP PROMPTS'), 'general');
});

test('slug makes a stable id', () => {
  assert.equal(slug('Prospect Industry Overview'), 'prospect-industry-overview');
  assert.equal(slug('⭐ 7-DAY STUDY PLAN (from Google Keep)'), '7-day-study-plan-from-google-keep');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tests/parse.test.js`
Expected: FAIL with `Cannot find module '../tools/parse.js'`

- [ ] **Step 4: Write the implementation**

Create `tools/parse.js`:

```js
'use strict';

// The source markdown was exported with backslash escaping. Strip it back to plain text.
function unescapeMd(text) {
  return String(text)
    .replace(/\\{1,3}\\?\\?([[\]*_`])/g, '$1')
    .replace(/\\+([[\]*_`])/g, '$1')
    .replace(/^\\-{3}$/gm, '---')
    .replace(/\u00a0/g, ' ')
    .trim();
}

const NOTE_MARKERS = ['💡', '📌', 'Strategic tip', 'Power move'];

function isNote(body) {
  return NOTE_MARKERS.some(m => body.startsWith(m) || body.includes(m));
}

function titleCaseHeading(heading) {
  const cleaned = heading.replace(/[⭐*]/g, '').trim();
  const lower = cleaned.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function parseBlocks(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const blocks = [];
  let section = '';
  let heading = '';
  let pendingName = '';
  let quote = [];

  function flush() {
    if (!quote.length) return;
    const body = unescapeMd(quote.join(' ').replace(/\s+/g, ' '));
    quote = [];
    if (!body || isNote(body)) return;
    const name = pendingName || (heading ? titleCaseHeading(heading) : '');
    pendingName = '';
    if (!name) return;
    blocks.push({ section: section || heading, name, body });
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    const h = line.match(/^#{2,4}\s+(.*)$/);
    if (h) {
      flush();
      heading = unescapeMd(h[1]);
      if (/^#{2,3}\s/.test(line)) section = heading;
      pendingName = '';
      continue;
    }

    const bold = line.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (bold) {
      flush();
      pendingName = unescapeMd(bold[1]).replace(/:$/, '').trim();
      continue;
    }

    if (line.startsWith('>')) {
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }

    if (line === '') continue;
    flush();
  }
  flush();
  return blocks;
}

function contextFor(section) {
  const s = String(section).toUpperCase();
  if (s.includes('PACKAGING') || s.includes('SALES')) return 'sales';
  if (s.includes('WISDOM BYTES')) return 'wisdom';
  if (s.includes('PERSONAL LEARNING') || s.includes('LEARNING')) return 'learning';
  return 'general';
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { unescapeMd, parseBlocks, contextFor, slug, isNote };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/parse.test.js`
Expected: PASS, 8 tests

If the escaping test fails, print the real bytes with `node -e "console.log(JSON.stringify(require('fs').readFileSync('H:/My Drive/Surface Laptop Folders Synch/Documents/Claude/Projects/NotebookLM/Prompt_Library.md','utf8').slice(300,600)))"` and widen the regex to match what is actually there. Do not change the test expectations, change the implementation.

- [ ] **Step 6: Commit**

```bash
git add .gitignore tools/parse.js tests/parse.test.js
git commit -m "Add markdown block parser for source extraction"
```

---

### Task 2: Extract all source content into data files

Reads the five source files once and writes six committed data files. After this task the source markdown is never read again at runtime.

**Files:**
- Create: `tools/extract.js`
- Create: `tests/data.test.js`
- Create (generated): `data/styles.js`, `data/quick-styles.js`, `data/chat-prompts.js`, `data/studio-prompts.js`, `data/workflows.js`, `data/tips.js`

**Interfaces:**
- Consumes: `tools/parse.js` exports from Task 1.
- Produces: the `NLM` global namespace, with these arrays available to browser and Node alike:
  - `NLM.styles: Array<{id, name, tone, bg, tx, ac, sec: string[], img: object, typo: object, tags: string[], fmt: 'full'|'flat', also?: string}>`
  - `NLM.quickStyles: Array<{id, name, body, group: 'built-in'|'jo'|'expanded', family?: string, context: string, tags: string[]}>`
  - `NLM.chatPrompts: Array<{id, name, why, body, section, context, tags: string[]}>`
  - `NLM.studioPrompts: Array<{id, name, body, output: string, section, context, tags: string[]}>`
  - `NLM.workflows: Array<{id, name, why, steps: string[], context, tags: string[]}>`
  - `NLM.tips: Array<{id, title, html}>`

Every data file follows this exact wrapper so it loads in both environments:

```js
(globalThis.NLM = globalThis.NLM || {}).styles = [ /* ... */ ];
```

- [ ] **Step 1: Write the failing data tests**

Create `tests/data.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
for (const f of ['styles', 'quick-styles', 'chat-prompts', 'studio-prompts', 'workflows', 'tips']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, 'data', f + '.js'), 'utf8'), { filename: f });
}
const NLM = globalThis.NLM;

test('all six collections loaded and are non-empty', () => {
  for (const k of ['styles', 'quickStyles', 'chatPrompts', 'studioPrompts', 'workflows', 'tips']) {
    assert.ok(Array.isArray(NLM[k]), k + ' is an array');
    assert.ok(NLM[k].length > 0, k + ' is not empty');
  }
});

test('there are exactly 50 full style specifications', () => {
  assert.equal(NLM.styles.length, 50);
});

test('every style has a complete palette and an id', () => {
  for (const s of NLM.styles) {
    assert.match(s.bg, /^#[0-9A-Fa-f]{6}$/, s.name + ' background');
    assert.match(s.tx, /^#[0-9A-Fa-f]{6}$/, s.name + ' text');
    assert.match(s.ac, /^#[0-9A-Fa-f]{6}$/, s.name + ' accent');
    assert.ok(s.id && s.name && s.tone, s.name + ' has id, name and tone');
    assert.ok(Array.isArray(s.tags) && s.tags.length, s.name + ' has tags');
  }
});

test('no record anywhere still carries escaping or an em dash in its body', () => {
  const bodies = [
    ...NLM.chatPrompts.map(p => p.body),
    ...NLM.studioPrompts.map(p => p.body),
    ...NLM.quickStyles.map(p => p.body),
    ...NLM.workflows.flatMap(w => w.steps)
  ];
  for (const b of bodies) {
    assert.ok(!b.includes('\\['), 'escaped bracket left in: ' + b.slice(0, 60));
    assert.ok(!b.includes('\\*'), 'escaped asterisk left in: ' + b.slice(0, 60));
  }
});

test('every id is unique within its collection', () => {
  for (const k of ['styles', 'quickStyles', 'chatPrompts', 'studioPrompts', 'workflows', 'tips']) {
    const ids = NLM[k].map(r => r.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate id in ' + k);
  }
});

test('everything shown on the Styles tab carries at least one vibe', () => {
  for (const s of [...NLM.styles, ...NLM.quickStyles]) {
    assert.ok(Array.isArray(s.vibes) && s.vibes.length, s.name + ' has no vibe');
  }
});

test('every prompt carries a known context', () => {
  const ok = new Set(['sales', 'wisdom', 'learning', 'general']);
  for (const p of [...NLM.chatPrompts, ...NLM.studioPrompts, ...NLM.workflows]) {
    assert.ok(ok.has(p.context), p.name + ' has context ' + p.context);
  }
});

test('chat prompts are deduplicated', () => {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 100);
  const seen = new Set();
  for (const p of NLM.chatPrompts) {
    const k = norm(p.body);
    assert.ok(!seen.has(k), 'duplicate chat prompt: ' + p.name);
    seen.add(k);
  }
});

test('workflows have at least three steps each', () => {
  for (const w of NLM.workflows) {
    assert.ok(w.steps.length >= 3, w.name + ' has ' + w.steps.length + ' steps');
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/data.test.js`
Expected: FAIL, `ENOENT` on `data/styles.js`

- [ ] **Step 3: Write the extractor**

Create `tools/extract.js`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseBlocks, contextFor, slug, unescapeMd } = require('./parse.js');

const SRC = 'H:/My Drive/Surface Laptop Folders Synch/Documents/Claude/Projects/NotebookLM';
const OUT = path.join(__dirname, '..', 'data');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

function write(name, key, value) {
  const body = JSON.stringify(value, null, 1);
  const js = '(globalThis.NLM = globalThis.NLM || {}).' + key + ' = ' + body + ';\n';
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), js, 'utf8');
  console.log(name.padEnd(20), key.padEnd(15), Array.isArray(value) ? value.length : 1);
}

// ---------- 1. styles and the original 20 prompts, lifted out of the old page ----------
function sliceLiteral(src, start, end) {
  const a = src.indexOf(start);
  if (a < 0) throw new Error('marker not found: ' + start);
  const b = src.indexOf(end, a);
  if (b < 0) throw new Error('end marker not found after: ' + start);
  return src.slice(a, b + end.length);
}

const html = read('NotebookLM_Infographic_Style_Library.html');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(sliceLiteral(html, 'const STYLES = [', '\n];'), sandbox);
vm.runInContext(sliceLiteral(html, 'const PROMPTS = [', '\n];'), sandbox);

const VIBE_RULES = [
  ['editorial', /editorial|newspaper|magazine|broadsheet|swiss|minimal|clean|corporate|professional/i],
  ['retro', /retro|vintage|70s|80s|90s|y2k|nostalg|pop art|deco|memphis|risograph|synthwave|vaporwave/i],
  ['technical', /technical|blueprint|schematic|engineering|scientific|isometric|data|diagram|industrial/i],
  ['hand-drawn', /sketch|hand|doodle|marker|chalk|whiteboard|watercolour|watercolor|ink|paper|craft/i],
  ['playful', /playful|kawaii|cute|whimsical|comic|anime|manga|game|claymation|bubble|maximalist/i],
  ['luxe', /luxe|luxury|gold|elegant|premium|noir|art deco|marble|glossy/i],
  ['sci-fi', /cyber|sci-fi|holograph|neon|futur|space|glitch|terminal|matrix/i]
];

function vibesFor(style) {
  const hay = [style.name, style.tone, (style.tags || []).join(' ')].join(' ');
  const hits = VIBE_RULES.filter(([, re]) => re.test(hay)).map(([v]) => v);
  return hits.length ? hits : ['editorial'];
}

const styles = sandbox.STYLES.map(s => {
  const out = Object.assign({}, s, { id: slug(s.name), vibes: vibesFor(s) });
  delete out.s;
  delete out.where;
  return out;
});
write('styles.js', 'styles', styles);

// ---------- 2. chat prompts: page 20 merged with Prompt_Library.md ----------
const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 100);

const fromPage = sandbox.PROMPTS.map(p => ({
  id: slug(p.n), name: p.n, why: p.why, body: p.t,
  section: 'Core 20', context: 'general', tags: ['core']
}));

const fromLibrary = parseBlocks(read('Prompt_Library.md'))
  .filter(b => /^CATEGORY/i.test(b.section))
  .map(b => ({
    id: slug(b.name), name: b.name, why: b.section.replace(/^CATEGORY \d+:\s*/i, ''),
    body: b.body.replace(/^"|"$/g, ''), section: b.section,
    context: contextFor(b.section), tags: ['library']
  }));

const chat = [];
const seenChat = new Set();
for (const p of [...fromPage, ...fromLibrary]) {
  const k = norm(p.body);
  const existing = chat.find(c => norm(c.body) === k);
  if (existing) {
    if (p.body.length > existing.body.length) existing.body = p.body;
    continue;
  }
  if (seenChat.has(p.id)) p.id = p.id + '-2';
  seenChat.add(p.id);
  chat.push(p);
}
write('chat-prompts.js', 'chatPrompts', chat);

// ---------- 3. studio prompts and Jo's quick styles from Studio_Prompts.md ----------
const studioMd = read('Studio_Prompts.md');
const studioBlocks = parseBlocks(studioMd);

const OUTPUT_FOR = [
  [/INFOGRAPHIC/i, 'Infographic'],
  [/AUDIO/i, 'Audio overview'],
  [/BRIEFING/i, 'Briefing doc'],
  [/STUDY GUIDE|WEAK POINT|STUDY PLAN|FINAL EXAM|LEARNING ROADMAP|PERSONAL TUTOR/i, 'Study guide'],
  [/SLIDE DECK|BEGINNER DECK/i, 'Slide deck'],
  [/MIND MAP/i, 'Mind map'],
  [/FAQ/i, 'FAQ'],
  [/TIMELINE/i, 'Timeline'],
  [/SOURCE DISCOVERY/i, 'Source discovery']
];
const outputFor = section => (OUTPUT_FOR.find(([re]) => re.test(section)) || [null, 'Infographic'])[1];

const isJoQuickStyle = b => /JO'S STYLE COLLECTION/i.test(b.section);

const studio = studioBlocks
  .filter(b => !isJoQuickStyle(b))
  .filter(b => !/QUICK PICK|GROUP [A-D]|HOW TO COMBINE|ORIENTATION/i.test(b.section))
  .map(b => ({
    id: slug(outputFor(b.section) + '-' + b.name), name: b.name, body: b.body,
    output: outputFor(b.section), section: b.section,
    context: contextFor(b.section), tags: [slug(outputFor(b.section))]
  }));
write('studio-prompts.js', 'studioPrompts', studio);

// ---------- 4. quick styles: Jo's Keep styles plus the cheat-sheet tables ----------
// Walks the cheat-sheet tables. An h3 opens or closes a group, an h4 names a family
// within the open group, and any bold-first-cell table row inside becomes a record.
function tableRows(md, headingRe) {
  const lines = md.split(/\r?\n/);
  const rows = [];
  let live = false;
  let family = '';
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      const title = unescapeMd(h3[1]);
      live = headingRe.test(title);
      family = live ? title : '';
      continue;
    }
    const h4 = line.match(/^####\s+(.*)$/);
    if (h4) {
      if (live) family = unescapeMd(h4[1]);
      continue;
    }
    if (!live) continue;
    const m = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|(.+?)\|?\s*$/);
    if (m) {
      rows.push({
        name: unescapeMd(m[1]),
        cells: m[2].split('|').map(c => unescapeMd(c)).filter(Boolean),
        family
      });
    }
  }
  return rows;
}

const quick = [];
for (const b of studioBlocks.filter(isJoQuickStyle)) {
  quick.push({
    id: slug('jo-' + b.name), name: b.name, body: b.body, group: 'jo',
    family: "Jo's proven styles", context: 'general', tags: ['jo', 'keep']
  });
}
for (const r of tableRows(studioMd, /GROUP A/i)) {
  quick.push({
    id: slug('builtin-' + r.name), name: r.name,
    body: 'Style: ' + r.name + '. Best for ' + r.cells[0].toLowerCase() + '.',
    group: 'built-in', family: 'NotebookLM built-in presets',
    context: 'general', tags: ['built-in']
  });
}
for (const r of tableRows(studioMd, /GROUP C/i)) {
  quick.push({
    id: slug('expanded-' + r.name), name: r.name,
    body: 'Style: ' + r.name + '. ' + r.cells[0],
    group: 'expanded', family: r.family, context: 'general', tags: ['expanded']
  });
}
const seenQuick = new Set();
write('quick-styles.js', 'quickStyles', quick
  .filter(q => {
    if (seenQuick.has(q.id)) return false;
    seenQuick.add(q.id);
    return true;
  })
  // Quick styles share the Styles tab with the full specs, so they need vibes too
  // or the vibe chips would silently hide them.
  .map(q => Object.assign(q, { vibes: vibesFor({ name: q.name, tone: q.body, tags: q.tags }) })));

// ---------- 5. workflows from Tips_and_Tricks.md and Prompt_Library.md ----------
function parseWorkflows(md, sectionRe) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let live = false;
  let current = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) { if (current) out.push(current); current = null; live = sectionRe.test(unescapeMd(h2[1])); continue; }
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3 && live) {
      if (current) out.push(current);
      const name = unescapeMd(h3[1]);
      current = { id: slug(name), name, why: '', steps: [], context: contextFor(name), tags: ['workflow'] };
      continue;
    }
    if (!current) continue;
    const meta = line.match(/^\*\*(.+?):?\*\*\s*(.*)$/);
    if (meta) { current.why = unescapeMd(meta[1] + (meta[2] ? ': ' + meta[2] : '')); continue; }
    const step = line.match(/^\d+\.\s+(.*)$/);
    if (step) current.steps.push(unescapeMd(step[1]).replace(/^\*|\*$/g, ''));
  }
  if (current) out.push(current);
  return out.filter(w => w.steps.length >= 3);
}

const workflows = [
  ...parseWorkflows(read('Tips_and_Tricks.md'), /WORKFLOW TEMPLATES/i),
  ...parseWorkflows(read('Prompt_Library.md'), /POWER COMBOS/i)
];
const seenWf = new Set();
write('workflows.js', 'workflows', workflows.filter(w => {
  if (seenWf.has(w.id)) return false;
  seenWf.add(w.id);
  return true;
}));

// ---------- 6. tips: whole sections rendered as simple HTML ----------
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function sectionsToHtml(md, wanted) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let current = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      if (current) out.push(current);
      const title = unescapeMd(h2[1]);
      current = wanted.test(title) ? { id: slug(title), title, html: '' } : null;
      continue;
    }
    if (!current) continue;
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { current.html += '<h3>' + esc(unescapeMd(h3[1])) + '</h3>'; continue; }
    if (line.startsWith('|')) { current.html += '<p class="row">' + esc(unescapeMd(line)) + '</p>'; continue; }
    const li = line.match(/^[-*]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
    if (li) { current.html += '<li>' + esc(unescapeMd(li[1])) + '</li>'; continue; }
    if (line.trim()) current.html += '<p>' + esc(unescapeMd(line.replace(/^>\s?/, ''))) + '</p>';
  }
  if (current) out.push(current);
  return out.filter(s => s.html);
}

const tips = [
  ...sectionsToHtml(read('Tips_and_Tricks.md'), /FUNDAMENTALS|SOURCE STRATEGY|PROMPTING TECHNIQUES|AUDIO OVERVIEW TRICKS|LESSER-KNOWN|COMMON MISTAKES/i),
  ...sectionsToHtml(studioMd, /HOW TO USE THESE|QUICK PICK/i)
];
write('tips.js', 'tips', tips);

console.log('\nExtraction complete.');
```

- [ ] **Step 4: Run the extractor**

Run: `node tools/extract.js`
Expected: six lines of output naming each file, its key and its record count, then `Extraction complete.`

Write the reported counts into the commit message. If `styles.js` does not report exactly 50, the slicing markers have drifted and must be fixed before continuing.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/data.test.js`
Expected: PASS, 8 tests

Common failure and fix: if the escaping test fails, the regex in `unescapeMd` needs widening for a pattern the fixtures did not cover. Fix `tools/parse.js`, re-run `node tools/extract.js`, then re-run the tests. Never hand-edit a generated data file, because the next extraction run would silently discard the edit.

- [ ] **Step 6: Commit**

```bash
git add tools/extract.js tests/data.test.js data/
git commit -m "Extract all NotebookLM source content into data files"
```

---

### Task 3: Core logic library

Every pure function the page needs. No DOM, no globals beyond the one namespace, fully tested under Node.

**Files:**
- Create: `assets/lib.js`
- Create: `tests/lib.test.js`

**Interfaces:**
- Consumes: nothing at test time. At runtime it reads `NLM.*` collections but takes them as arguments, never reaches for them.
- Produces `globalThis.NLMLib` with:
  - `composePrompt(topic: string, body: string) => string`
  - `composeStyle(topic: string, specText: string) => string`
  - `specText(style: object) => string`
  - `fieldsIn(body: string) => string[]`
  - `applyFields(body: string, values: object) => string`
  - `luminance(hex: string) => number`
  - `searchScore(record: object, query: string) => number`
  - `matches(record: object, filters: object) => boolean`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'lib.js'), 'utf8'), { filename: 'lib.js' });
const lib = globalThis.NLMLib;

test('composePrompt returns the body unchanged when there is no topic', () => {
  assert.equal(lib.composePrompt('', 'Summarise this source.'), 'Summarise this source.');
  assert.equal(lib.composePrompt('   ', 'Summarise this source.'), 'Summarise this source.');
});

test('composePrompt substitutes a topic-like bracket field when one exists', () => {
  assert.equal(
    lib.composePrompt('corrugated costs', 'Explain [TOPIC] simply.'),
    'Explain corrugated costs simply.'
  );
  assert.equal(
    lib.composePrompt('3PL sector', 'Overview of [INDUSTRY/SECTOR] please.'),
    'Overview of 3PL sector please.'
  );
});

test('composePrompt prefixes when there is no topic-like field', () => {
  assert.equal(
    lib.composePrompt('corrugated costs', 'Give me the 5 key points.'),
    'Topic: corrugated costs\n\nGive me the 5 key points.'
  );
});

test('composePrompt leaves unrelated bracket fields alone', () => {
  assert.equal(
    lib.composePrompt('exam revision', 'Here are my answers: [paste your answers]. Grade me.'),
    'Topic: exam revision\n\nHere are my answers: [paste your answers]. Grade me.'
  );
});

test('composeStyle puts the topic instruction above the specification', () => {
  assert.equal(
    lib.composeStyle('warehouse safety', 'Overall Tone: bold'),
    'Create an infographic about warehouse safety.\n\nOverall Tone: bold'
  );
  assert.equal(lib.composeStyle('', 'Overall Tone: bold'), 'Overall Tone: bold');
});

test('specText renders the full format exactly as NotebookLM expects', () => {
  const style = {
    name: 'Test', fmt: 'full', tone: 'Bold, clear', bg: '#000000', tx: '#FFFFFF', ac: '#FF0000',
    sec: ['#00FF00'], img: { Features: 'Big shapes' }, typo: { Heading: 'Bold sans' }, tags: ['Bold']
  };
  const out = lib.specText(style);
  assert.ok(out.startsWith('Overall Design Settings:'));
  assert.ok(out.includes('Tone: "Bold, clear"'));
  assert.ok(out.includes('Background Color: "#000000"'));
  assert.ok(out.includes('Secondary Colors: ["#00FF00"]'));
  assert.ok(out.includes('Features: "Big shapes"'));
  assert.ok(out.includes('Tags: ["Bold"]'));
});

test('specText renders the flat format when fmt is flat', () => {
  const style = {
    name: 'Flat one', fmt: 'flat', tone: 'Calm', bg: '#FFFFFF', tx: '#000000', ac: '#123456',
    sec: [], img: { Texture: 'Matte' }, typo: { Heading: 'Serif' }, tags: ['Calm']
  };
  const out = lib.specText(style);
  assert.ok(out.startsWith('Overall Tone: Calm'));
  assert.ok(out.includes('Colors: Background #FFFFFF, Text #000000, Accent #123456'));
  assert.ok(out.includes('visual DNA of "Flat one"'));
});

test('fieldsIn finds every bracket token once', () => {
  assert.deepEqual(lib.fieldsIn('Meeting with [person] at [company] about [person].'), ['person', 'company']);
  assert.deepEqual(lib.fieldsIn('No fields here.'), []);
});

test('applyFields substitutes filled values and leaves blanks intact', () => {
  assert.equal(
    lib.applyFields('Meeting with [person] at [company].', { person: 'Sam', company: '' }),
    'Meeting with Sam at [company].'
  );
});

test('luminance separates dark from light backgrounds', () => {
  assert.ok(lib.luminance('#000000') < 0.1);
  assert.ok(lib.luminance('#FFFFFF') > 0.9);
  assert.ok(lib.luminance('#1a0f1f') < 0.45);
});

test('searchScore ranks a name match above a body match and misses score zero', () => {
  const rec = { name: 'Executive briefing', body: 'Condense the sources for a decision maker.', tags: ['core'] };
  assert.ok(lib.searchScore(rec, 'executive') > lib.searchScore(rec, 'condense'));
  assert.ok(lib.searchScore(rec, 'condense') > 0);
  assert.equal(lib.searchScore(rec, 'zebra'), 0);
});

test('searchScore is case insensitive and matches hex codes in styles', () => {
  const style = { name: 'Denim', body: '', tone: 'Tactile', bg: '#223C63', tags: ['Craft'] };
  assert.ok(lib.searchScore(style, '#223c63') > 0);
  assert.ok(lib.searchScore(style, 'CRAFT') > 0);
});

test('matches applies context and vibe filters together', () => {
  const rec = { context: 'sales', vibes: ['technical'], tags: ['infographic'] };
  assert.equal(lib.matches(rec, { context: 'sales', vibe: 'technical' }), true);
  assert.equal(lib.matches(rec, { context: 'wisdom', vibe: 'technical' }), false);
  assert.equal(lib.matches(rec, { context: '', vibe: '' }), true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/lib.test.js`
Expected: FAIL, `ENOENT` on `assets/lib.js`

- [ ] **Step 3: Write the implementation**

Create `assets/lib.js`:

```js
(function (root) {
  'use strict';

  var lib = {};

  var TOPIC_FIELD = /^(topic|subject|industry|sector|industry\/sector|company|company\/sector|process|method|tool|ai topic|ai tool)/i;

  lib.fieldsIn = function (body) {
    var out = [];
    var re = /\[([^\[\]\n]{1,60})\]/g;
    var m;
    while ((m = re.exec(String(body)))) {
      if (out.indexOf(m[1]) === -1) out.push(m[1]);
    }
    return out;
  };

  lib.applyFields = function (body, values) {
    values = values || {};
    return String(body).replace(/\[([^\[\]\n]{1,60})\]/g, function (whole, key) {
      var v = values[key];
      return v && String(v).trim() ? String(v).trim() : whole;
    });
  };

  lib.composePrompt = function (topic, body) {
    var t = String(topic || '').trim();
    if (!t) return body;
    var target = lib.fieldsIn(body).filter(function (f) { return TOPIC_FIELD.test(f); })[0];
    if (target) {
      var values = {};
      values[target] = t;
      return lib.applyFields(body, values);
    }
    return 'Topic: ' + t + '\n\n' + body;
  };

  lib.composeStyle = function (topic, spec) {
    var t = String(topic || '').trim();
    if (!t) return spec;
    return 'Create an infographic about ' + t + '.\n\n' + spec;
  };

  lib.specText = function (d) {
    var out = [];
    var k;
    if (d.fmt === 'flat') {
      out.push('Overall Tone: ' + d.tone, '');
      out.push('Colors: Background ' + d.bg + ', Text ' + d.tx + ', Accent ' + d.ac, '');
      for (k in d.img) { out.push(k + ': ' + d.img[k], ''); }
      for (k in d.typo) { out.push(k + ': ' + d.typo[k], ''); }
      out.push('Categories: ' + d.tags.join(', '), '');
      out.push('Instruction: Create a high-fidelity infographic matching the visual DNA of "' + d.name + '".');
      out.push('Reference extracted metadata for exact aesthetic and structural adherence.');
    } else {
      out.push('Overall Design Settings:');
      out.push('Tone: "' + d.tone + '"', '');
      out.push('Visual Identity:');
      out.push('Background Color: "' + d.bg + '"');
      out.push('Text Color: "' + d.tx + '"');
      out.push('Accent Color: "' + d.ac + '"');
      if (d.sec && d.sec.length) out.push('Secondary Colors: ["' + d.sec.join('", "') + '"]');
      out.push('', 'Image Style:');
      for (k in d.img) out.push(k + ': "' + d.img[k] + '"');
      out.push('', 'Typography:');
      for (k in d.typo) out.push(k + ': "' + d.typo[k] + '"');
      out.push('', 'Categories:');
      out.push('Tags: ["' + d.tags.join('", "') + '"]');
    }
    return out.join('\n');
  };

  lib.luminance = function (hex) {
    var h = String(hex).replace('#', '');
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };

  function haystack(rec) {
    return [
      rec.name, rec.tone, rec.why, rec.body, rec.section, rec.output, rec.family,
      rec.bg, rec.tx, rec.ac,
      (rec.sec || []).join(' '), (rec.tags || []).join(' '), (rec.vibes || []).join(' '),
      (rec.steps || []).join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
  }

  lib.searchScore = function (rec, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return 1;
    var name = String(rec.name || '').toLowerCase();
    if (name === q) return 100;
    if (name.indexOf(q) === 0) return 60;
    if (name.indexOf(q) > -1) return 40;
    return haystack(rec).indexOf(q) > -1 ? 10 : 0;
  };

  lib.matches = function (rec, filters) {
    filters = filters || {};
    if (filters.context && rec.context !== filters.context) return false;
    if (filters.vibe && (rec.vibes || []).indexOf(filters.vibe) === -1) return false;
    if (filters.tag && (rec.tags || []).indexOf(filters.tag) === -1) return false;
    if (filters.mood) {
      if (!rec.bg) return false;
      var dark = lib.luminance(rec.bg) < 0.45;
      if (filters.mood === 'dark' && !dark) return false;
      if (filters.mood === 'light' && dark) return false;
    }
    return true;
  };

  root.NLMLib = lib;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/lib.test.js`
Expected: PASS, 13 tests

- [ ] **Step 5: Run the whole suite**

Run: `node --test tests/`
Expected: PASS, 30 tests across three files (8 parse, 9 data, 13 lib)

- [ ] **Step 6: Commit**

```bash
git add assets/lib.js tests/lib.test.js
git commit -m "Add pure logic library for composition, fields, search and filtering"
```

---

### Task 4: Render functions

Every piece of HTML the page shows is built by a pure function returning a string. This keeps the whole visual layer testable before any browser is opened.

**Files:**
- Modify: `assets/lib.js` (append the render section before the `root.NLMLib = lib;` line)
- Create: `tests/render.test.js`

**Interfaces:**
- Consumes: `lib.specText`, `lib.luminance`, `lib.fieldsIn` from Task 3.
- Produces, all on `NLMLib`:
  - `esc(text: string) => string`
  - `thumbHTML(style: object) => string`
  - `styleCard(style: object) => string`
  - `promptCard(record: object, kind: string) => string`
  - `workflowCard(workflow: object) => string`
  - `tipSection(tip: object) => string`
  - `paletteHTML(style: object) => string`

Every card root element carries `data-id` and `data-kind` so one delegated click handler in `app.js` can serve the whole page.

- [ ] **Step 1: Write the failing tests**

Create `tests/render.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'lib.js'), 'utf8'), { filename: 'lib.js' });
const lib = globalThis.NLMLib;

const style = {
  id: 'textured-denim-craft', name: 'Textured Denim Craft', fmt: 'full',
  tone: 'Tactile, instructional, durable', bg: '#223C63', tx: '#FFFFFF', ac: '#DCB35C',
  sec: ['#A83232', '#4D6D91'], img: { Features: 'Denim' }, typo: { Heading: 'Bold' },
  tags: ['Craft', 'Denim'], vibes: ['hand-drawn']
};

test('esc neutralises HTML in user-visible content', () => {
  assert.equal(lib.esc('<script>&"'), '&lt;script&gt;&amp;&quot;');
});

test('thumbHTML paints the style palette and never loads an image', () => {
  const html = lib.thumbHTML(style);
  assert.ok(html.includes('#223C63'), 'uses the background');
  assert.ok(html.includes('#DCB35C'), 'uses the accent');
  assert.ok(html.includes('#A83232'), 'uses a secondary');
  assert.ok(!html.includes('<img'), 'no image tag');
  assert.ok(!html.includes('http'), 'no network reference');
});

test('styleCard carries the identifiers the click handler needs', () => {
  const html = lib.styleCard(style);
  assert.ok(html.includes('data-id="textured-denim-craft"'));
  assert.ok(html.includes('data-kind="style"'));
  assert.ok(html.includes('data-act="copy"'));
  assert.ok(html.includes('data-act="preview"'));
  assert.ok(html.includes('data-act="pin"'));
});

test('styleCard shows name, tone and tags, and no source link', () => {
  const html = lib.styleCard(style);
  assert.ok(html.includes('Textured Denim Craft'));
  assert.ok(html.includes('Tactile, instructional, durable'));
  assert.ok(html.includes('Craft'));
  assert.ok(!/reddit/i.test(html), 'no reddit link on the card');
  assert.ok(!/Source/i.test(html), 'no source button on the card');
});

test('paletteHTML makes every hex individually copyable', () => {
  const html = lib.paletteHTML(style);
  assert.ok(html.includes('data-act="copyhex"'));
  assert.ok(html.includes('data-hex="#223C63"'));
  assert.ok(html.includes('data-hex="#A83232"'));
});

test('promptCard turns bracket tokens into input fields', () => {
  const rec = { id: 'meeting-prep', name: 'Meeting prep', why: 'Before a call', body: 'Meeting with [person] soon.', context: 'sales', tags: ['library'] };
  const html = lib.promptCard(rec, 'chat');
  assert.ok(html.includes('data-kind="chat"'));
  assert.ok(html.includes('data-field="person"'));
  assert.ok(html.includes('<input'));
});

test('promptCard escapes content rather than trusting it', () => {
  const rec = { id: 'x', name: '<b>hi</b>', why: '', body: 'plain', context: 'general', tags: [] };
  assert.ok(lib.promptCard(rec, 'chat').includes('&lt;b&gt;hi&lt;/b&gt;'));
});

test('workflowCard numbers the steps and gives each one a copy button', () => {
  const wf = { id: 'doc-review', name: 'Document review', why: 'For contracts', steps: ['Upload it', 'Add a note', 'Ask for risks'], context: 'sales', tags: ['workflow'] };
  const html = lib.workflowCard(wf);
  assert.ok(html.includes('data-step="0"'));
  assert.ok(html.includes('data-step="2"'));
  assert.ok(html.includes('data-act="copyall"'));
  assert.ok(html.includes('Ask for risks'));
});

test('tipSection renders the stored html inside a titled panel', () => {
  const html = lib.tipSection({ id: 'basics', title: 'The fundamentals', html: '<h3>One</h3><p>Two</p>' });
  assert.ok(html.includes('The fundamentals'));
  assert.ok(html.includes('<h3>One</h3>'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/render.test.js`
Expected: FAIL, `lib.esc is not a function`

- [ ] **Step 3: Append the render functions to `assets/lib.js`**

Insert immediately before the final `root.NLMLib = lib;` line:

```js
  lib.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  function tagList(tags) {
    return (tags || []).map(function (t) {
      return '<span class="tag">' + lib.esc(t) + '</span>';
    }).join('');
  }

  lib.thumbHTML = function (d) {
    var bars = (d.sec && d.sec.length ? d.sec : [d.ac]).slice(0, 3);
    var heights = [62, 100, 45];
    var barHTML = bars.map(function (c, i) {
      return '<i style="height:' + heights[i % 3] + '%;background:' + lib.esc(c) + '"></i>';
    }).join('');
    return '<div class="thumb" style="background:' + lib.esc(d.bg) + '">' +
      '<span class="t-title" style="background:' + lib.esc(d.tx) + '"></span>' +
      '<span class="t-rule" style="background:' + lib.esc(d.ac) + '"></span>' +
      '<span class="t-bars">' + barHTML +
      '<em class="t-ring" style="border-color:' + lib.esc(d.ac) + '"></em></span>' +
      '</div>';
  };

  lib.paletteHTML = function (d) {
    var all = [['bg', d.bg], ['text', d.tx], ['accent', d.ac]]
      .concat((d.sec || []).map(function (c) { return ['', c]; }));
    return '<div class="palette">' + all.map(function (pair) {
      return '<button class="hex" data-act="copyhex" data-hex="' + lib.esc(pair[1]) + '" ' +
        'title="Copy ' + lib.esc(pair[1]) + '">' +
        '<b style="background:' + lib.esc(pair[1]) + '"></b>' +
        (pair[0] ? lib.esc(pair[0]) + ' ' : '') + lib.esc(pair[1]) + '</button>';
    }).join('') + '</div>';
  };

  function specDl(obj) {
    var out = '';
    for (var k in obj) out += '<dt>' + lib.esc(k) + '</dt><dd>' + lib.esc(obj[k]) + '</dd>';
    return '<dl>' + out + '</dl>';
  }

  lib.styleCard = function (d) {
    return '<article class="card" data-id="' + lib.esc(d.id) + '" data-kind="style">' +
      lib.thumbHTML(d) +
      '<div class="cardhead">' +
        '<h3>' + lib.esc(d.name) + '</h3>' +
        '<p class="tone">' + lib.esc(d.tone) + '</p>' +
        '<div class="tags">' + tagList(d.tags) + '</div>' +
      '</div>' +
      lib.paletteHTML(d) +
      '<details class="spec"><summary>Full specification</summary><div class="specbody">' +
        '<div class="speclabel">Image style</div>' + specDl(d.img) +
        '<div class="speclabel">Typography</div>' + specDl(d.typo) +
        (d.also ? '<div class="speclabel">Note</div><p class="note">' + lib.esc(d.also) + '</p>' : '') +
      '</div></details>' +
      '<div class="actions">' +
        '<button class="copy" data-act="copy">Copy</button>' +
        '<button class="ghost" data-act="preview">Preview</button>' +
        '<button class="ghost pin" data-act="pin" aria-label="Pin this style">★</button>' +
      '</div>' +
    '</article>';
  };

  lib.promptCard = function (rec, kind) {
    var fields = lib.fieldsIn(rec.body);
    var fieldHTML = fields.length
      ? '<div class="fields">' + fields.map(function (f) {
          return '<label class="field"><span>' + lib.esc(f) + '</span>' +
            '<input type="text" data-field="' + lib.esc(f) + '" placeholder="' + lib.esc(f) + '"></label>';
        }).join('') + '</div>'
      : '';
    var label = rec.output || rec.section || '';
    return '<article class="pcard" data-id="' + lib.esc(rec.id) + '" data-kind="' + lib.esc(kind) + '">' +
      (label ? '<p class="plabel">' + lib.esc(label) + '</p>' : '') +
      '<h4>' + lib.esc(rec.name) + '</h4>' +
      (rec.why ? '<p class="pwhy">' + lib.esc(rec.why) + '</p>' : '') +
      '<p class="ptext">' + lib.esc(rec.body) + '</p>' +
      fieldHTML +
      '<div class="actions">' +
        '<button class="copy" data-act="copy">Copy</button>' +
        '<button class="ghost pin" data-act="pin" aria-label="Pin this prompt">★</button>' +
      '</div>' +
    '</article>';
  };

  lib.workflowCard = function (w) {
    var steps = (w.steps || []).map(function (s, i) {
      return '<li><span>' + lib.esc(s) + '</span>' +
        '<button class="ghost" data-act="copystep" data-step="' + i + '">Copy</button></li>';
    }).join('');
    return '<article class="wcard" data-id="' + lib.esc(w.id) + '" data-kind="workflow">' +
      '<h4>' + lib.esc(w.name) + '</h4>' +
      (w.why ? '<p class="pwhy">' + lib.esc(w.why) + '</p>' : '') +
      '<ol class="wsteps">' + steps + '</ol>' +
      '<div class="actions">' +
        '<button class="copy" data-act="copyall">Copy all steps</button>' +
        '<button class="ghost pin" data-act="pin" aria-label="Pin this workflow">★</button>' +
      '</div>' +
    '</article>';
  };

  lib.tipSection = function (t) {
    return '<section class="panel" data-id="' + lib.esc(t.id) + '">' +
      '<h2>' + lib.esc(t.title) + '</h2>' + t.html + '</section>';
  };
```

Note on `tipSection`: `t.html` is inserted unescaped by design, because the extractor built it and already escaped every value that came from the source files. Nothing user-supplied ever reaches it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/render.test.js`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add assets/lib.js tests/render.test.js
git commit -m "Add pure render functions for cards, thumbnails and panels"
```

---

### Task 5: Page shell, styling and tab routing

The first task that produces something to look at. All five tabs render their real content.

**Files:**
- Create: `index.html`
- Create: `assets/app.css`
- Create: `assets/app.js`
- Create: `.claude/launch.json`
- Create: `tests/usecase.test.js`
- Modify: `assets/lib.js` (append `useCases` and `useCase`)

**Interfaces:**
- Consumes: every `NLMLib` render function from Task 4, every `NLM.*` collection from Task 2.
- Produces: `window.App` with `App.state`, `App.render()`, `App.setTab(name)`. Task 7 extends this same object.

- [ ] **Step 1: Create the local server definition**

Create `.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "notebooklm-studio",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8123"],
      "port": 8123
    }
  ]
}
```

- [ ] **Step 2: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en-GB" data-theme="dark" data-density="comfortable">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NotebookLM Studio</title>
<meta name="description" content="Jo's NotebookLM control panel: styles, prompts and workflows in one place.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="stylesheet" href="assets/app.css">
</head>
<body>

<header class="hero">
  <div class="wrap">
    <p class="kicker">NotebookLM control panel</p>
    <h1>Styles, prompts and workflows<em>, one keystroke away</em></h1>
  </div>
</header>

<div class="toolbar">
  <div class="wrap">
    <label class="topic">
      <span class="topiclabel">Your topic</span>
      <input id="topic" type="text" placeholder="What is this notebook about?" autocomplete="off">
    </label>
    <label class="search">
      <input id="q" type="search" placeholder="Search everything" autocomplete="off">
    </label>
    <select id="context" aria-label="Filter by context">
      <option value="">Any context</option>
      <option value="sales">Sales</option>
      <option value="wisdom">Wisdom Bytes</option>
      <option value="learning">Learning</option>
      <option value="general">General</option>
    </select>
    <button class="btn" id="palettebtn" title="Open the command palette">Search all (Ctrl K)</button>
    <button class="btn" id="theme" aria-label="Switch theme">Theme</button>
    <button class="btn" id="density" aria-label="Switch density">Density</button>
    <a class="btn" id="opennlm" href="https://notebooklm.google.com" target="_blank" rel="noopener">Open NotebookLM</a>
  </div>
</div>

<nav class="tabs" role="tablist">
  <div class="wrap">
    <button role="tab" data-tab="styles" aria-selected="true">Styles</button>
    <button role="tab" data-tab="chat" aria-selected="false">Chat prompts</button>
    <button role="tab" data-tab="studio" aria-selected="false">Studio prompts</button>
    <button role="tab" data-tab="workflows" aria-selected="false">Workflows</button>
    <button role="tab" data-tab="tips" aria-selected="false">Tips</button>
  </div>
</nav>

<main class="wrap">
  <section id="rail" class="rail" hidden></section>
  <section id="filters" class="filters"></section>
  <p id="count" class="count"></p>
  <div id="view"></div>
  <p id="empty" class="empty" hidden>Nothing matches. Clear the search or pick another filter.</p>
</main>

<footer>
  <div class="wrap">
    <p>Style specifications by u/Paolo-Cortez on r/notebooklm. Everything else assembled from Jo's own NotebookLM notes.</p>
  </div>
</footer>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script src="data/styles.js"></script>
<script src="data/quick-styles.js"></script>
<script src="data/chat-prompts.js"></script>
<script src="data/studio-prompts.js"></script>
<script src="data/workflows.js"></script>
<script src="data/tips.js"></script>
<script src="assets/lib.js"></script>
<script src="assets/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `assets/app.css`**

```css
:root{
  --bg:#0d0f14; --bg2:#141821; --bg3:#1b202c;
  --ink:#e8eaf0; --ink2:#9aa3b5; --ink3:#6b7488;
  --line:#262c3a; --line2:#333b4d;
  --hi:#7cf0d2; --hi2:#ffb84d; --on-hi:#08130f;
  --radius:14px; --pad:18px; --gap:18px;
  --mono:ui-monospace,"Cascadia Mono",Consolas,monospace;
  --sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
}
html[data-theme="light"]{
  --bg:#f7f6f3; --bg2:#ffffff; --bg3:#f0eeea;
  --ink:#191b20; --ink2:#5c6373; --ink3:#8b91a0;
  --line:#e2e0da; --line2:#cfcdc6;
  --hi:#0a7f66; --hi2:#a35c00; --on-hi:#ffffff;
}
html[data-density="compact"]{ --pad:12px; --gap:12px; --radius:10px; }

*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.55}
.wrap{max-width:1400px;margin:0 auto;padding:0 24px}
h1{font-size:clamp(28px,4vw,44px);line-height:1.05;margin:0;font-weight:800;letter-spacing:-.025em}
h1 em{font-style:normal;color:var(--ink3)}
.kicker{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--hi);margin:0 0 10px}
.hero{border-bottom:1px solid var(--line);background:var(--bg2);padding:34px 0 26px}

.toolbar{position:sticky;top:0;z-index:40;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 0}
.toolbar .wrap{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.topic{flex:1 1 320px;display:flex;align-items:center;gap:9px;background:var(--bg2);border:1px solid var(--hi);border-radius:10px;padding:0 12px}
.topiclabel{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--hi);white-space:nowrap}
.search{flex:1 1 220px;display:flex;background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:0 12px}
.topic input,.search input{flex:1;background:none;border:0;outline:none;color:var(--ink);font:inherit;font-size:14px;padding:10px 0;min-width:0}
select,.btn{background:var(--bg2);border:1px solid var(--line2);color:var(--ink);border-radius:10px;padding:10px 12px;font:inherit;font-size:13px;cursor:pointer;text-decoration:none}
select:hover,.btn:hover{border-color:var(--hi)}
:focus-visible{outline:2px solid var(--hi);outline-offset:2px}

.tabs{border-bottom:1px solid var(--line);background:var(--bg)}
.tabs .wrap{display:flex;gap:4px;overflow-x:auto}
.tabs button{background:none;border:0;border-bottom:2px solid transparent;color:var(--ink2);padding:13px 16px;font:inherit;font-size:14px;cursor:pointer;white-space:nowrap}
.tabs button:hover{color:var(--ink)}
.tabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--hi);font-weight:600}

main{padding:22px 0 70px}
.filters{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}
.chip{background:var(--bg2);border:1px solid var(--line);color:var(--ink2);border-radius:999px;padding:6px 13px;font-family:var(--mono);font-size:12.5px;cursor:pointer}
.chip:hover{color:var(--ink);border-color:var(--line2)}
.chip[aria-pressed="true"]{background:var(--hi);border-color:var(--hi);color:var(--on-hi);font-weight:600}
.chiprow{display:flex;flex-wrap:wrap;gap:7px;width:100%;margin-top:4px;padding-top:10px;border-top:1px dashed var(--line)}
.chip.usecase{font-family:var(--sans);border-style:dashed}
.chip.usecase[aria-pressed="true"]{background:var(--hi2);border-color:var(--hi2);border-style:solid;color:var(--on-hi)}
.count{font-family:var(--mono);font-size:12px;color:var(--ink3);margin:0 0 14px}

.rail{border:1px dashed var(--line2);border-radius:var(--radius);padding:var(--pad);margin:0 0 18px}
.rail h2{margin:0 0 10px;font-size:12px;font-family:var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
.grid{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}

.card,.pcard,.wcard{background:var(--bg2);border:1px solid var(--line);border-radius:var(--radius);display:flex;flex-direction:column;overflow:hidden}
.card:hover,.pcard:hover,.wcard:hover{border-color:var(--line2)}
.pcard,.wcard{padding:var(--pad);gap:10px}

.thumb{padding:14px 14px 16px;display:flex;flex-direction:column;gap:7px}
.t-title{display:block;height:8px;width:62%;border-radius:2px}
.t-rule{display:block;height:4px;width:82%;border-radius:2px;opacity:.9}
.t-bars{display:flex;gap:5px;align-items:flex-end;height:34px;margin-top:4px}
.t-bars i{display:block;width:14px;border-radius:2px}
.t-ring{display:block;width:26px;height:26px;border-radius:50%;border:2px solid;margin-left:auto}

.cardhead{padding:14px var(--pad) 10px}
.cardhead h3{margin:0 0 6px;font-size:18px;font-weight:700;letter-spacing:-.015em}
.tone{color:var(--ink2);font-size:13.5px;margin:0 0 10px}
.tags{display:flex;flex-wrap:wrap;gap:5px}
.tag{font-size:11px;font-family:var(--mono);background:var(--bg3);border:1px solid var(--line);border-radius:5px;padding:3px 7px;color:var(--ink2)}

.palette{display:flex;flex-wrap:wrap;gap:6px;padding:0 var(--pad) 12px}
.hex{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10.5px;color:var(--ink3);background:var(--bg3);border:1px solid var(--line);border-radius:5px;padding:3px 7px 3px 4px;cursor:pointer}
.hex:hover{color:var(--ink);border-color:var(--hi)}
.hex b{width:12px;height:12px;border-radius:3px;display:inline-block;border:1px solid rgba(127,127,127,.35)}

details.spec{border-top:1px solid var(--line);margin-top:auto}
details.spec summary{padding:11px var(--pad);cursor:pointer;font-family:var(--mono);font-size:12px;color:var(--ink2)}
details.spec summary:hover{color:var(--ink)}
.specbody{padding:0 var(--pad) 14px}
.speclabel{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--hi);margin:12px 0 6px}
dl{margin:0;font-size:13px}
dt{font-weight:700;font-size:12px;margin-top:8px}
dd{margin:2px 0 0;color:var(--ink2)}

.plabel{margin:0;font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--hi)}
.pcard h4,.wcard h4{margin:0;font-size:16px;font-weight:700}
.pwhy{margin:0;color:var(--ink3);font-size:12.5px}
.ptext{background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-family:var(--mono);font-size:12px;line-height:1.6;color:var(--ink2);white-space:pre-wrap;margin:0;flex:1}
.fields{display:flex;flex-wrap:wrap;gap:8px}
.field{display:flex;flex-direction:column;gap:3px;flex:1 1 140px}
.field span{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.field input{background:var(--bg3);border:1px solid var(--line2);border-radius:8px;color:var(--ink);font:inherit;font-size:13px;padding:7px 9px;min-width:0}
.wsteps{margin:0;padding-left:20px;color:var(--ink2);font-size:13.5px}
.wsteps li{margin:8px 0;display:flex;gap:10px;align-items:flex-start}
.wsteps li span{flex:1}

.actions{display:flex;gap:8px;padding:0 var(--pad) var(--pad);margin-top:auto;flex-wrap:wrap}
.pcard .actions,.wcard .actions{padding:0}
.copy{flex:1;min-width:120px;background:var(--bg3);border:1px solid var(--line2);color:var(--ink);border-radius:9px;padding:9px 12px;font-family:var(--mono);font-size:12.5px;cursor:pointer}
.copy:hover,.copy.done{background:var(--hi);color:var(--on-hi);border-color:var(--hi)}
.ghost{background:none;border:1px solid var(--line2);color:var(--ink2);border-radius:9px;padding:9px 12px;font-family:var(--mono);font-size:12.5px;cursor:pointer}
.ghost:hover{border-color:var(--hi);color:var(--hi)}
.pin[aria-pressed="true"]{color:var(--hi2);border-color:var(--hi2)}

.panel{background:var(--bg2);border:1px solid var(--line);border-radius:var(--radius);padding:24px var(--pad);margin:0 0 18px}
.panel h2{margin:0 0 12px;font-size:21px;letter-spacing:-.02em}
.panel h3{margin:18px 0 6px;font-size:15px}
.panel p,.panel li{color:var(--ink2);margin:6px 0}
.panel .row{font-family:var(--mono);font-size:12px}
.empty{text-align:center;padding:60px 20px;color:var(--ink3)}
footer{border-top:1px solid var(--line);padding:24px 0 46px;color:var(--ink3);font-size:13px}

.toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,80px);background:var(--hi);color:var(--on-hi);padding:11px 20px;border-radius:10px;font-family:var(--mono);font-size:13px;font-weight:600;opacity:0;transition:.22s;pointer-events:none;z-index:99}
.toast.show{transform:translate(-50%,0);opacity:1}

@media(max-width:640px){
  .wrap{padding:0 16px}
  .grid{grid-template-columns:1fr}
  .toolbar .wrap{gap:8px}
  .topic,.search{flex:1 1 100%}
}
@media print{
  .toolbar,.tabs,.actions,.rail,.filters,footer,.toast{display:none}
  .card,.pcard,.wcard{break-inside:avoid;border-color:#ccc}
  details.spec{display:block}
  details.spec .specbody{display:block !important}
}
```

- [ ] **Step 4: Add use-case matching to the logic library**

The spec calls for a second filter row offering use-case shortcuts. Basing these on curated
lists of style names would break the moment a style is renamed, so they are predicates over
vibes and background luminance instead.

Create `tests/usecase.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'lib.js'), 'utf8'), { filename: 'lib.js' });
const lib = globalThis.NLMLib;

test('useCases lists the four shortcuts in a stable order', () => {
  assert.deepEqual(lib.useCases.map(u => u.key), ['prospect', 'wisdom', 'report', 'study']);
});

test('a clean light editorial style suits a prospect one-pager', () => {
  const rec = { vibes: ['editorial'], bg: '#F7F4EE' };
  assert.equal(lib.useCase(rec, 'prospect'), true);
  assert.equal(lib.useCase(rec, 'wisdom'), false);
});

test('a playful style suits a Wisdom Bytes explainer', () => {
  assert.equal(lib.useCase({ vibes: ['playful'], bg: '#FFF9C4' }, 'wisdom'), true);
});

test('a dark neon style suits none of the four', () => {
  const rec = { vibes: ['sci-fi'], bg: '#0a0a12' };
  assert.equal(lib.useCases.some(u => lib.useCase(rec, u.key)), false);
});

test('a record with no background is never excluded on luminance alone', () => {
  assert.equal(lib.useCase({ vibes: ['playful'] }, 'wisdom'), true);
});

test('an unknown key matches nothing', () => {
  assert.equal(lib.useCase({ vibes: ['editorial'], bg: '#ffffff' }, 'nonsense'), false);
});
```

Run: `node --test tests/usecase.test.js`
Expected: FAIL, `lib.useCases is not iterable`

Append to `assets/lib.js`, before the final `root.NLMLib = lib;` line:

```js
  lib.useCases = [
    { key: 'prospect', label: 'Prospect one-pager', vibes: ['editorial', 'technical'], light: true },
    { key: 'wisdom', label: 'Wisdom Bytes explainer', vibes: ['playful', 'hand-drawn'], light: null },
    { key: 'report', label: 'Monthly report', vibes: ['editorial', 'luxe'], light: true },
    { key: 'study', label: 'Study aid', vibes: ['hand-drawn', 'technical'], light: null }
  ];

  lib.useCase = function (rec, key) {
    var uc = lib.useCases.filter(function (u) { return u.key === key; })[0];
    if (!uc) return false;
    var vibes = rec.vibes || [];
    var hit = uc.vibes.some(function (v) { return vibes.indexOf(v) > -1; });
    if (!hit) return false;
    if (uc.light === null || !rec.bg) return true;
    return (lib.luminance(rec.bg) >= 0.45) === uc.light;
  };
```

Run: `node --test tests/usecase.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Create `assets/app.js`**

```js
(function () {
  'use strict';

  var lib = window.NLMLib;
  var data = window.NLM;

  var VIBES = ['editorial', 'retro', 'technical', 'hand-drawn', 'playful', 'luxe', 'sci-fi'];

  var App = {
    state: {
      tab: 'styles',
      q: '',
      context: '',
      vibe: '',
      mood: '',
      useCase: '',
      topic: ''
    }
  };

  var $ = function (id) { return document.getElementById(id); };
  var view = $('view');

  function collection(tab) {
    if (tab === 'styles') return data.styles.concat(data.quickStyles);
    if (tab === 'chat') return data.chatPrompts;
    if (tab === 'studio') return data.studioPrompts;
    if (tab === 'workflows') return data.workflows;
    return data.tips;
  }

  function cardFor(rec, tab) {
    if (tab === 'styles') return rec.img ? lib.styleCard(rec) : lib.promptCard(rec, 'quickstyle');
    if (tab === 'workflows') return lib.workflowCard(rec);
    return lib.promptCard(rec, tab === 'studio' ? 'studio' : 'chat');
  }

  function filtered() {
    var s = App.state;
    if (s.tab === 'tips') return data.tips;
    return collection(s.tab)
      .map(function (r) { return { r: r, score: lib.searchScore(r, s.q) }; })
      .filter(function (x) {
        if (x.score === 0 || !lib.matches(x.r, s)) return false;
        return !s.useCase || lib.useCase(x.r, s.useCase);
      })
      .sort(function (a, b) { return b.score - a.score || a.r.name.localeCompare(b.r.name); })
      .map(function (x) { return x.r; });
  }

  function renderFilters() {
    var box = $('filters');
    if (App.state.tab !== 'styles') { box.innerHTML = ''; return; }
    box.innerHTML = '<button class="chip" data-vibe="" aria-pressed="' + (!App.state.vibe) + '">All</button>' +
      VIBES.map(function (v) {
        return '<button class="chip" data-vibe="' + v + '" aria-pressed="' +
          (App.state.vibe === v) + '">' + v + '</button>';
      }).join('') +
      '<button class="chip" data-mood="dark" aria-pressed="' + (App.state.mood === 'dark') + '">dark bg</button>' +
      '<button class="chip" data-mood="light" aria-pressed="' + (App.state.mood === 'light') + '">light bg</button>' +
      '<span class="chiprow">' + lib.useCases.map(function (u) {
        return '<button class="chip usecase" data-uc="' + u.key + '" aria-pressed="' +
          (App.state.useCase === u.key) + '">' + lib.esc(u.label) + '</button>';
      }).join('') + '</span>';
  }

  App.render = function () {
    var rows = filtered();
    renderFilters();
    if (App.state.tab === 'tips') {
      view.innerHTML = rows.map(lib.tipSection).join('');
    } else {
      view.innerHTML = '<div class="grid">' +
        rows.map(function (r) { return cardFor(r, App.state.tab); }).join('') + '</div>';
    }
    $('count').textContent = rows.length + (rows.length === 1 ? ' item' : ' items');
    $('empty').hidden = rows.length > 0;
    if (App.restorePins) App.restorePins();
  };

  App.setTab = function (name) {
    App.state.tab = name;
    Array.prototype.forEach.call(document.querySelectorAll('[role="tab"]'), function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === name));
    });
    App.render();
  };

  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[role="tab"]');
    if (b) App.setTab(b.dataset.tab);
  });

  $('filters').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    if ('vibe' in b.dataset) App.state.vibe = b.dataset.vibe;
    if ('mood' in b.dataset) App.state.mood = App.state.mood === b.dataset.mood ? '' : b.dataset.mood;
    if ('uc' in b.dataset) App.state.useCase = App.state.useCase === b.dataset.uc ? '' : b.dataset.uc;
    App.render();
  });

  $('q').addEventListener('input', function (e) { App.state.q = e.target.value; App.render(); });
  $('context').addEventListener('change', function (e) { App.state.context = e.target.value; App.render(); });

  var root = document.documentElement;
  root.dataset.theme = localStorage.getItem('nlm-theme') || 'dark';
  root.dataset.density = localStorage.getItem('nlm-density') || 'comfortable';
  $('theme').addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('nlm-theme', root.dataset.theme);
  });
  $('density').addEventListener('click', function () {
    root.dataset.density = root.dataset.density === 'compact' ? 'comfortable' : 'compact';
    localStorage.setItem('nlm-density', root.dataset.density);
  });

  window.App = App;
  App.render();
})();
```

- [ ] **Step 6: Start the preview and check every tab**

Start the server with the `preview_start` tool using `{name: "notebooklm-studio"}`, then navigate to `http://localhost:8123/`.

Verify with `read_page` and `read_console_messages`:
- Zero console errors.
- The Styles tab shows a grid of cards, each with a coloured thumbnail.
- Clicking each of the five tabs swaps the content and the item count changes.
- Typing in the search box narrows the grid.
- The theme and density buttons visibly change the page and survive a reload.
- The four use-case chips each narrow the Styles grid, and clicking an active one clears it.

Take a screenshot with `computer {action: "screenshot"}` and check the thumbnails actually look like miniature infographics rather than flat blocks.

- [ ] **Step 7: Commit**

```bash
git add index.html assets/app.css assets/app.js assets/lib.js .claude/launch.json tests/usecase.test.js
git commit -m "Add page shell, styling, tab routing and use-case filters"
```

---

### Task 6: Grab mechanics

The topic bar, copying, bracket fields, pinning and recents. This is the task that delivers the actual time saving.

**Files:**
- Modify: `assets/app.js`
- Create: `tests/store.test.js`
- Modify: `assets/lib.js` (append the store helpers before `root.NLMLib = lib;`)

**Interfaces:**
- Consumes: `lib.composePrompt`, `lib.composeStyle`, `lib.specText`, `lib.applyFields` from Task 3.
- Produces on `NLMLib`: `bodyFor(record: object, kind: string, topic: string, fieldValues: object) => string`
- Produces on `App`: `App.copy(text, label)`, `App.togglePin(id)`, `App.restorePins()`, `App.pins: string[]`, `App.recents: string[]`

- [ ] **Step 1: Write the failing test**

Create `tests/store.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'lib.js'), 'utf8'), { filename: 'lib.js' });
const lib = globalThis.NLMLib;

const style = {
  id: 's1', name: 'Denim', fmt: 'full', tone: 'Tactile', bg: '#223C63', tx: '#FFFFFF',
  ac: '#DCB35C', sec: [], img: { Features: 'Denim' }, typo: { Heading: 'Bold' }, tags: ['Craft']
};

test('bodyFor a style composes the topic instruction above the full spec', () => {
  const out = lib.bodyFor(style, 'style', 'pallet wrapping', {});
  assert.ok(out.startsWith('Create an infographic about pallet wrapping.\n\nOverall Design Settings:'));
});

test('bodyFor a style with no topic returns the bare spec', () => {
  assert.ok(lib.bodyFor(style, 'style', '', {}).startsWith('Overall Design Settings:'));
});

test('bodyFor a prompt applies field values before topic composition', () => {
  const rec = { id: 'p1', name: 'Meeting', body: 'Meeting with [person] about [TOPIC].' };
  const out = lib.bodyFor(rec, 'chat', 'new packaging line', { person: 'Sam' });
  assert.equal(out, 'Meeting with Sam about new packaging line.');
});

test('bodyFor a prompt with an unfilled field keeps the bracket', () => {
  const rec = { id: 'p2', name: 'Grade', body: 'Here are my answers: [paste your answers].' };
  const out = lib.bodyFor(rec, 'chat', '', {});
  assert.equal(out, 'Here are my answers: [paste your answers].');
});

test('bodyFor a workflow joins numbered steps', () => {
  const wf = { id: 'w1', name: 'Review', steps: ['Upload it', 'Ask for risks', 'Ask what to question'] };
  const out = lib.bodyFor(wf, 'workflow', '', {});
  assert.equal(out, '1. Upload it\n2. Ask for risks\n3. Ask what to question');
});

test('bodyFor a workflow prefixes the topic once, not per step', () => {
  const wf = { id: 'w2', name: 'Review', steps: ['One', 'Two', 'Three'] };
  const out = lib.bodyFor(wf, 'workflow', 'supplier audit', {});
  assert.equal(out, 'Topic: supplier audit\n\n1. One\n2. Two\n3. Three');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/store.test.js`
Expected: FAIL, `lib.bodyFor is not a function`

- [ ] **Step 3: Append `bodyFor` to `assets/lib.js`**

Insert before the final `root.NLMLib = lib;` line:

```js
  lib.bodyFor = function (rec, kind, topic, values) {
    if (kind === 'style') return lib.composeStyle(topic, lib.specText(rec));
    if (kind === 'workflow') {
      var numbered = (rec.steps || []).map(function (s, i) {
        return (i + 1) + '. ' + s;
      }).join('\n');
      return lib.composePrompt(topic, numbered);
    }
    return lib.composePrompt(topic, lib.applyFields(rec.body, values));
  };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/store.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Wire the mechanics into `assets/app.js`**

Insert immediately before the closing `window.App = App;` line:

```js
  // ---------- persistence ----------
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  App.pins = load('nlm-pins', []);
  App.recents = load('nlm-recents', []);
  App.fieldValues = {};

  var topicInput = $('topic');
  App.state.topic = localStorage.getItem('nlm-topic') || '';
  topicInput.value = App.state.topic;
  topicInput.addEventListener('input', function (e) {
    App.state.topic = e.target.value;
    localStorage.setItem('nlm-topic', App.state.topic);
  });

  // ---------- record lookup ----------
  function findRecord(id) {
    var all = data.styles.concat(data.quickStyles, data.chatPrompts, data.studioPrompts, data.workflows);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function kindOf(rec) {
    if (rec.img) return 'style';
    if (rec.steps) return 'workflow';
    return 'chat';
  }

  // ---------- copying ----------
  var toast = $('toast');
  var toastTimer = null;
  App.copy = function (text, label) {
    function done() {
      toast.textContent = 'Copied ' + label;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallbackCopy);
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* nothing more we can do */ }
      document.body.removeChild(ta);
      done();
    }
  };

  function remember(id) {
    App.recents = [id].concat(App.recents.filter(function (r) { return r !== id; })).slice(0, 5);
    localStorage.setItem('nlm-recents', JSON.stringify(App.recents));
    renderRail();
  }

  // ---------- pins and recents rail ----------
  App.togglePin = function (id) {
    var i = App.pins.indexOf(id);
    if (i > -1) App.pins.splice(i, 1); else App.pins.push(id);
    localStorage.setItem('nlm-pins', JSON.stringify(App.pins));
    App.restorePins();
    renderRail();
  };

  App.restorePins = function () {
    Array.prototype.forEach.call(view.querySelectorAll('[data-act="pin"]'), function (btn) {
      var card = btn.closest('[data-id]');
      btn.setAttribute('aria-pressed', String(App.pins.indexOf(card.dataset.id) > -1));
    });
  };

  function renderRail() {
    var rail = $('rail');
    var ids = App.pins.concat(App.recents.filter(function (r) { return App.pins.indexOf(r) === -1; }));
    if (!ids.length) { rail.hidden = true; rail.innerHTML = ''; return; }
    rail.hidden = false;
    rail.innerHTML = '<h2>Pinned and recent</h2><div class="filters">' + ids.map(function (id) {
      var rec = findRecord(id);
      if (!rec) return '';
      var pinned = App.pins.indexOf(id) > -1;
      return '<button class="chip" data-quick="' + lib.esc(id) + '">' +
        (pinned ? '★ ' : '') + lib.esc(rec.name) + '</button>';
    }).join('') + '</div>';
  }

  $('rail').addEventListener('click', function (e) {
    var b = e.target.closest('[data-quick]');
    if (!b) return;
    var rec = findRecord(b.dataset.quick);
    if (!rec) return;
    App.copy(lib.bodyFor(rec, kindOf(rec), App.state.topic, App.fieldValues[rec.id] || {}), rec.name);
    remember(rec.id);
  });

  // ---------- one delegated handler for every card ----------
  view.addEventListener('input', function (e) {
    var input = e.target.closest('[data-field]');
    if (!input) return;
    var card = input.closest('[data-id]');
    var store = App.fieldValues[card.dataset.id] || (App.fieldValues[card.dataset.id] = {});
    store[input.dataset.field] = input.value;
  });

  view.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var card = btn.closest('[data-id]');
    var act = btn.dataset.act;

    if (act === 'copyhex') {
      App.copy(btn.dataset.hex, btn.dataset.hex);
      return;
    }
    if (!card) return;
    var rec = findRecord(card.dataset.id);
    if (!rec) return;
    var values = App.fieldValues[rec.id] || {};

    if (act === 'pin') { App.togglePin(rec.id); return; }

    if (act === 'copystep') {
      App.copy(rec.steps[Number(btn.dataset.step)], 'step ' + (Number(btn.dataset.step) + 1));
      remember(rec.id);
      return;
    }
    if (act === 'preview') { App.preview(rec); return; }

    App.copy(lib.bodyFor(rec, kindOf(rec), App.state.topic, values), rec.name);
    btn.classList.add('done');
    setTimeout(function () { btn.classList.remove('done'); }, 900);
    remember(rec.id);
  });

  // ---------- preview modal ----------
  App.preview = function (rec) {
    var box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = '<div class="modalbox" role="dialog" aria-modal="true" aria-label="' +
      lib.esc(rec.name) + ' preview"><div class="modalthumb">' + lib.thumbHTML(rec) + '</div>' +
      '<h3>' + lib.esc(rec.name) + '</h3><p class="tone">' + lib.esc(rec.tone) + '</p>' +
      lib.paletteHTML(rec) +
      '<div class="actions"><button class="copy" data-act="copy">Copy this style</button>' +
      '<button class="ghost" data-act="close">Close</button></div></div>';
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.dataset.act === 'close') { box.remove(); return; }
      if (e.target.dataset.act === 'copy') {
        App.copy(lib.bodyFor(rec, 'style', App.state.topic, {}), rec.name);
        remember(rec.id);
      }
      if (e.target.dataset.act === 'copyhex') App.copy(e.target.dataset.hex, e.target.dataset.hex);
    });
    document.addEventListener('keydown', function esc(ev) {
      if (ev.key === 'Escape') { box.remove(); document.removeEventListener('keydown', esc); }
    });
    document.body.appendChild(box);
  };

  // ---------- command palette ----------
  App.openPalette = function () {
    var all = data.styles.concat(data.quickStyles, data.chatPrompts, data.studioPrompts, data.workflows);
    var box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = '<div class="modalbox palettebox" role="dialog" aria-modal="true" aria-label="Search everything">' +
      '<input id="pq" type="text" placeholder="Search all prompts and styles" autocomplete="off">' +
      '<ul id="presults" role="listbox"></ul></div>';
    document.body.appendChild(box);
    var input = box.querySelector('#pq');
    var list = box.querySelector('#presults');
    var rows = [];
    var sel = 0;

    function draw() {
      var q = input.value;
      rows = all.map(function (r) { return { r: r, s: lib.searchScore(r, q) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 12).map(function (x) { return x.r; });
      sel = 0;
      paint();
    }
    function paint() {
      list.innerHTML = rows.map(function (r, i) {
        return '<li role="option" aria-selected="' + (i === sel) + '"' +
          (i === sel ? ' class="on"' : '') + '>' + lib.esc(r.name) +
          '<em>' + lib.esc(r.output || r.section || r.family || 'style') + '</em></li>';
      }).join('');
    }
    function choose() {
      var rec = rows[sel];
      if (!rec) return;
      App.copy(lib.bodyFor(rec, kindOf(rec), App.state.topic, App.fieldValues[rec.id] || {}), rec.name);
      remember(rec.id);
      close();
    }
    function close() { box.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, rows.length - 1); paint(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); paint(); e.preventDefault(); }
      if (e.key === 'Enter') { choose(); e.preventDefault(); }
    }
    input.addEventListener('input', draw);
    document.addEventListener('keydown', onKey);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('li');
      if (!li) return;
      sel = Array.prototype.indexOf.call(list.children, li);
      choose();
    });
    draw();
    input.focus();
  };

  $('palettebtn').addEventListener('click', App.openPalette);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); App.openPalette(); }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('q').focus(); }
  });

  renderRail();
```

- [ ] **Step 6: Add the modal styles to `assets/app.css`**

Append:

```css
.modal{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;padding:8vh 20px;z-index:80}
.modalbox{background:var(--bg2);border:1px solid var(--line2);border-radius:var(--radius);padding:var(--pad);max-width:560px;width:100%;max-height:80vh;overflow:auto}
.modalbox h3{margin:14px 0 6px;font-size:20px}
.modalthumb .thumb{padding:28px;border-radius:10px}
.modalthumb .t-title{height:14px}
.modalthumb .t-rule{height:7px}
.modalthumb .t-bars{height:70px}
.modalthumb .t-bars i{width:26px}
.modalthumb .t-ring{width:52px;height:52px;border-width:3px}
.palettebox{padding:0}
.palettebox input{width:100%;background:var(--bg2);border:0;border-bottom:1px solid var(--line);color:var(--ink);font:inherit;font-size:16px;padding:16px 18px;outline:none}
#presults{list-style:none;margin:0;padding:6px}
#presults li{padding:10px 12px;border-radius:8px;cursor:pointer;display:flex;justify-content:space-between;gap:12px;font-size:14px}
#presults li em{font-style:normal;font-family:var(--mono);font-size:11px;color:var(--ink3)}
#presults li.on{background:var(--hi);color:var(--on-hi)}
#presults li.on em{color:var(--on-hi)}
```

- [ ] **Step 7: Verify in the browser**

Reload `http://localhost:8123/` and check:
- Typing a topic then pressing Copy on a style gives `Create an infographic about <topic>.` followed by the spec. Paste into the search box to inspect it, then clear.
- Copy with the topic box empty gives the bare spec.
- A prompt card with brackets shows input fields, and filling one changes what Copy produces.
- `Ctrl K` opens the palette, arrows move the highlight, Enter copies and closes, Escape closes.
- Starring a card fills the star, adds it to the rail, and survives a reload.
- Clicking a hex chip copies just that hex.
- `read_console_messages` shows no errors.

- [ ] **Step 8: Commit**

```bash
git add assets/lib.js assets/app.js assets/app.css tests/store.test.js
git commit -m "Add topic composition, bracket fields, palette, pinning and recents"
```

---

### Task 7: Offline, installable and accessible

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `.nojekyll`
- Create: `README.md`
- Modify: `index.html` (register the service worker)

**Interfaces:**
- Consumes: the complete file list from Tasks 5 and 6.
- Produces: nothing other code calls.

- [ ] **Step 1: Create `manifest.webmanifest`**

```json
{
  "name": "NotebookLM Studio",
  "short_name": "NLM Studio",
  "description": "Jo's NotebookLM control panel: styles, prompts and workflows.",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#0d0f14",
  "theme_color": "#0d0f14",
  "icons": [
    {
      "src": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' fill='%230d0f14'/%3E%3Crect x='34' y='46' width='90' height='14' fill='%23e8eaf0'/%3E%3Crect x='34' y='72' width='124' height='8' fill='%237cf0d2'/%3E%3Crect x='34' y='100' width='22' height='46' fill='%237cf0d2'/%3E%3Crect x='66' y='114' width='22' height='32' fill='%23ffb84d'/%3E%3Crect x='98' y='92' width='22' height='54' fill='%23e8eaf0'/%3E%3C/svg%3E",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

- [ ] **Step 2: Create `sw.js`**

```js
var CACHE = 'nlm-studio-v1';
var ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './assets/app.css', './assets/app.js', './assets/lib.js',
  './data/styles.js', './data/quick-styles.js', './data/chat-prompts.js',
  './data/studio-prompts.js', './data/workflows.js', './data/tips.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    return hit || fetch(e.request);
  }));
});
```

- [ ] **Step 3: Register the worker in `index.html`**

Insert immediately before `</body>`:

```html
<script>
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode simply unavailable */ });
  });
}
</script>
```

The protocol guard matters: registering a service worker over `file://` throws, and the page must stay silent when Jo opens it straight from the H: drive.

- [ ] **Step 4: Create `.nojekyll` and `README.md`**

`.nojekyll` is an empty file. It stops GitHub Pages running Jekyll, which would otherwise ignore files and folders beginning with an underscore.

Create `README.md`:

```markdown
# NotebookLM Studio

Jo's NotebookLM control panel. Styles, chat prompts, Studio prompts, workflows and tips in one page.

Live: https://bobojojo72.github.io/notebooklm-studio/

## Using it

Type your topic in the box at the top. Every Copy button then hands you your topic and the prompt together, ready to paste into NotebookLM. Press Ctrl K to search everything at once, arrow keys to move, Enter to copy.

## Editing content

Never edit anything in `data/` by hand. Those files are generated. Change the source markdown in the NotebookLM project folder, then run:

    node tools/extract.js
    node --test tests/

## Working on the code

There is no build step and no dependencies. Open `index.html` in a browser, or serve the folder:

    python -m http.server 8123

Run the tests with:

    node --test tests/

## Important

GitHub is the master copy of this repository. Pull before editing. The copy on the H: drive is a convenience mirror for offline use and must never be pushed over the top of this one.

Style specifications by u/Paolo-Cortez on r/notebooklm.
```

- [ ] **Step 5: Add accessibility attributes to `index.html`**

Add `aria-controls="view"` to each `[role="tab"]` button, and add `role="tabpanel"` plus `tabindex="0"` to `<div id="view">`.

- [ ] **Step 6: Verify offline behaviour**

With the server running, load the page, then use `preview_stop` to kill the server and reload the tab. The page must still render fully from the service worker cache. Restart the server afterwards.

Separately, open `C:\Users\jolav\notebooklm-studio\index.html` directly as a `file://` URL and confirm all five tabs render with no console errors, proving the no-fetch data design works.

- [ ] **Step 7: Commit**

```bash
git add manifest.webmanifest sw.js .nojekyll README.md index.html
git commit -m "Add offline support, installability and accessibility attributes"
```

---

### Task 8: Full verification and publish

**Files:**
- Modify: none, unless verification finds a defect.

**Interfaces:**
- Consumes: everything.
- Produces: the live site.

- [ ] **Step 1: Run the full test suite**

Run: `node --test tests/`
Expected: PASS, all files, zero failures.

- [ ] **Step 2: Work the manual checklist**

With the preview running, verify every line and record the result:

- Every tab renders, and the item count matches the count `tools/extract.js` reported.
- Copy with an empty topic returns the prompt alone.
- Copy with a topic composes correctly for a style, a chat prompt, a studio prompt and a workflow.
- Bracket substitution works, and an untouched field keeps its bracket.
- `Ctrl K` opens, filters, copies on Enter, closes on Escape.
- Pins and recents survive a reload.
- Both themes and both densities render every tab correctly.
- The page works from `file://` with the network disabled.
- At a 390 px viewport there is one column and no horizontal scrolling. Check with `resize_window {preset: "mobile"}`.
- No card anywhere shows a Source button or links to Reddit. Confirm with `read_page` and a search for "reddit".
- The footer credit line to u/Paolo-Cortez is present.

Fix anything that fails, then re-run this step from the top.

- [ ] **Step 3: Show Jo the page and wait**

Screenshot the Styles tab and the command palette. Post both, and wait for Jo's approval before any push. Do not create the repository before she has said yes.

- [ ] **Step 4: Create the repository and push**

```bash
gh repo create notebooklm-studio --public --source=. --remote=origin --description "Jo's NotebookLM control panel: styles, prompts and workflows"
git push -u origin main
```

- [ ] **Step 5: Enable Pages and verify the live site**

```bash
gh api -X POST repos/Bobojojo72/notebooklm-studio/pages -f "source[branch]=main" -f "source[path]=/"
```

Wait for the first build, then load `https://bobojojo72.github.io/notebooklm-studio/` in the preview browser. Confirm the page renders, the console is clean, and the service worker registers.

- [ ] **Step 6: Mirror to the H: drive**

```bash
robocopy "C:\Users\jolav\notebooklm-studio" "H:\My Drive\Surface Laptop Folders Synch\Documents\Claude\Projects\NotebookLM\notebooklm-studio" /MIR /XD .git .claude node_modules /XF *.log
```

`robocopy` returns exit code 1 on a successful copy, which is normal and not a failure.

- [ ] **Step 7: Retire the old page**

Rename the original file so nobody opens it by mistake:

```bash
mv "H:/My Drive/Surface Laptop Folders Synch/Documents/Claude/Projects/NotebookLM/NotebookLM_Infographic_Style_Library.html" "H:/My Drive/Surface Laptop Folders Synch/Documents/Claude/Projects/NotebookLM/NotebookLM_Infographic_Style_Library.superseded.html"
```

Leave the older copy in `MY_NOTEBOOKLM_FILES` alone and tell Jo it is there, rather than deleting anything on her behalf.

- [ ] **Step 8: Final commit and report**

```bash
git add -A
git commit -m "Verify and publish NotebookLM Studio"
git push
```

Report to Jo: the live URL, the real item count per tab, and the location of the offline mirror.

---

## Notes for whoever executes this

- The estimates in the spec (roughly 59 styles, 55 chat prompts, 50 studio prompts) are estimates. Task 2 prints the real numbers. Use those everywhere afterwards, including in what you tell Jo, and never repeat an estimate as though it were a count.
- Task 2 also pulls in the expanded style library from the cheat sheet tables, which the spec did not anticipate. That is a deliberate improvement and makes the Styles tab considerably richer than the spec's estimate. Flag the final number to Jo.
- If `tools/extract.js` throws `marker not found`, the old HTML has been edited. Print the surrounding text and adjust the marker rather than loosening the slice.
- Never hand-edit a file in `data/`. Change the parser or the extractor and re-run.
