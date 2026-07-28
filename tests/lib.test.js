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

test('specText output matches what the original page produced', () => {
  const fsx = require('node:fs');
  const vmx = require('node:vm');
  for (const f of ['styles']) {
    vmx.runInThisContext(fsx.readFileSync(path.join(__dirname, '..', 'data', f + '.js'), 'utf8'));
  }
  const first = globalThis.NLM.styles[0];
  const out = lib.specText(first);
  assert.ok(out.includes('Background Color: "' + first.bg + '"'));
  assert.ok(out.split('\n').length > 8, 'a real spec runs to many lines');
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
