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

test('thumbHTML is a banner of full-bleed palette bands with a name pill', () => {
  const html = lib.thumbHTML(style);
  assert.ok(html.includes('class="thumb" style="background:#223C63"'), 'banner is the background colour');
  const bands = html.match(/<i style="background:#[0-9A-Fa-f]{6}"><\/i>/g) || [];
  assert.equal(bands.length, 3, 'accent plus both secondaries become bands');
  assert.ok(html.indexOf('#DCB35C') < html.indexOf('#A83232'), 'accent band comes first');
  assert.ok(html.includes('<div class="preview">'), 'has the name overlay');
  assert.ok(html.includes('>Textured<'), 'pill shows the first word of the name');
  assert.ok(html.includes('color:#FFFFFF'), 'pill uses the style text colour');
  assert.ok(html.includes('border:1px solid #DCB35C'), 'pill is outlined in the accent');
});

test('styleCard numbers the card only when given a position', () => {
  assert.ok(!lib.styleCard(style).includes('class="num"'));
  assert.ok(lib.styleCard(style, 7).includes('>07<'));
  assert.ok(lib.styleCard(style, 12).includes('>12<'));
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
  assert.ok(!/>\s*Source/i.test(html), 'no source button on the card');
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

test('every real style and quick style renders without throwing', () => {
  for (const f of ['styles', 'quick-styles', 'chat-prompts', 'studio-prompts', 'workflows', 'tips']) {
    vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'data', f + '.js'), 'utf8'));
  }
  const NLM = globalThis.NLM;
  for (const s of NLM.styles) assert.ok(lib.styleCard(s).length > 100, s.name);
  for (const q of NLM.quickStyles) assert.ok(lib.promptCard(q, 'quickstyle').length > 50, q.name);
  for (const p of NLM.chatPrompts) assert.ok(lib.promptCard(p, 'chat').length > 50, p.name);
  for (const p of NLM.studioPrompts) assert.ok(lib.promptCard(p, 'studio').length > 50, p.name);
  for (const w of NLM.workflows) assert.ok(lib.workflowCard(w).length > 50, w.name);
  for (const t of NLM.tips) assert.ok(lib.tipSection(t).length > 50, t.title);
});
