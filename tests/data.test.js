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

test('no record anywhere still carries escaping in its body', () => {
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
