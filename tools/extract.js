'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseBlocks, contextFor, slug, unescapeMd } = require('./parse.js');

const SRC = 'H:/My Drive/Surface Laptop Folders Synch/Documents/Claude/Projects/NotebookLM';
const OUT = path.join(__dirname, '..', 'data');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

// Jo's house rule is no em dashes. Applied to text this script composes or displays,
// never to the author's style specifications or to prompt bodies meant to be pasted verbatim.
const tidy = s => String(s).replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();

// Headings like "PART 9: SOURCE DISCOVERY PROMPTS 3" make useless card titles.
// Build a readable name from the opening words of the prompt instead.
function nameFromBody(body) {
  const words = body.replace(/^["']|["']$/g, '').split(/\s+/).slice(0, 6).join(' ');
  const trimmed = words.replace(/[.,;:]$/, '');
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

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
// `const` inside a vm context stays lexical and never lands on the sandbox object,
// so the declarations are rewritten to `var` before they are run.
const asVar = src => src.replace(/^const /, 'var ');
vm.runInContext(asVar(sliceLiteral(html, 'const STYLES = [', '\n];')), sandbox);
vm.runInContext(asVar(sliceLiteral(html, 'const PROMPTS = [', '\n];')), sandbox);

const VIBE_RULES = [
  ['editorial', /editorial|newspaper|magazine|broadsheet|swiss|minimal|clean|corporate|professional|bauhaus|nordic|scandinav|flat design/i],
  ['retro', /retro|vintage|70s|80s|90s|y2k|nostalg|pop art|deco|memphis|risograph|synthwave|vaporwave|linocut|woodblock|comic|diner|americana/i],
  ['technical', /technical|blueprint|schematic|engineering|scientific|isometric|data|diagram|industrial|workbench|architectur|terminal|ascii/i],
  ['hand-drawn', /sketch|hand|doodle|marker|chalk|whiteboard|watercolour|watercolor|ink|paper|craft|collage|denim|linen|cottagecore|paper cut|tactile/i],
  ['playful', /playful|kawaii|cute|whimsical|comic|anime|manga|game|clay|bubble|maximalist|ghibli|psychedelic|flower power|arcade|versus/i],
  ['luxe', /luxe|luxury|gold|elegant|premium|noir|art deco|marble|glossy|brass|velvet/i],
  ['sci-fi', /cyber|sci-fi|holograph|neon|futur|space|glitch|synthwave|matrix|steampunk|solarpunk|hud/i]
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
  while (seenChat.has(p.id)) p.id = p.id + '-2';
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

const studio = [];
const seenStudio = new Set();
for (const b of studioBlocks) {
  if (isJoQuickStyle(b)) continue;
  if (/QUICK PICK|GROUP [A-D]|HOW TO COMBINE|ORIENTATION/i.test(b.section)) continue;
  const output = outputFor(b.section);
  const name = /^part \d/i.test(b.name) ? nameFromBody(b.body) : tidy(b.name);
  const rec = {
    id: slug(output + '-' + name), name: name, body: b.body,
    output: output, section: tidy(b.section),
    context: contextFor(b.section), tags: [slug(output)]
  };
  while (seenStudio.has(rec.id)) rec.id = rec.id + '-2';
  seenStudio.add(rec.id);
  studio.push(rec);
}
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
    id: slug('builtin-' + r.name), name: tidy(r.name),
    body: tidy('Style: ' + r.name + '. Best for ' + (r.cells[0] || '').toLowerCase() + '.'),
    group: 'built-in', family: 'NotebookLM built-in presets',
    context: 'general', tags: ['built-in']
  });
}
for (const r of tableRows(studioMd, /GROUP C/i)) {
  quick.push({
    id: slug('expanded-' + r.name), name: tidy(r.name),
    body: tidy('Style: ' + r.name + '. ' + (r.cells[0] || '')),
    group: 'expanded', family: tidy(r.family), context: 'general', tags: ['expanded']
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
      // The source headings are shouted. Soften them for display.
      const softened = title.charAt(0) + title.slice(1).toLowerCase();
      const display = tidy(softened);
      current = wanted.test(title) ? { id: slug(title), title: display, html: '' } : null;
      continue;
    }
    if (!current) continue;
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { current.html += '<h3>' + esc(unescapeMd(h3[1])) + '</h3>'; continue; }
    if (line.startsWith('|')) {
      const cells = line.split('|').map(c => unescapeMd(c)).filter(Boolean);
      if (cells.every(c => /^-+$/.test(c))) continue;
      current.html += '<p class="row">' + esc(cells.join('  ·  ')) + '</p>';
      continue;
    }
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
