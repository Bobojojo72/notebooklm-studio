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

test('each use case actually selects some of the real styles', () => {
  for (const f of ['styles', 'quick-styles']) {
    vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'data', f + '.js'), 'utf8'));
  }
  const all = globalThis.NLM.styles.concat(globalThis.NLM.quickStyles);
  for (const u of lib.useCases) {
    const hits = all.filter(r => lib.useCase(r, u.key)).length;
    assert.ok(hits >= 3, u.key + ' only matched ' + hits + ' styles');
  }
});
