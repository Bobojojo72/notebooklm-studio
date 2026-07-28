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

test('bodyFor never returns an empty string for any real record', () => {
  for (const f of ['styles', 'quick-styles', 'chat-prompts', 'studio-prompts', 'workflows']) {
    vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'data', f + '.js'), 'utf8'));
  }
  const NLM = globalThis.NLM;
  const check = (rec, kind) => {
    const bare = lib.bodyFor(rec, kind, '', {});
    const withTopic = lib.bodyFor(rec, kind, 'test topic', {});
    assert.ok(bare && bare.length > 5, kind + ' ' + rec.name + ' empty without topic');
    assert.ok(withTopic && withTopic.length >= bare.length - 20, kind + ' ' + rec.name + ' lost content with topic');
  };
  NLM.styles.forEach(r => check(r, 'style'));
  NLM.quickStyles.forEach(r => check(r, 'chat'));
  NLM.chatPrompts.forEach(r => check(r, 'chat'));
  NLM.studioPrompts.forEach(r => check(r, 'studio'));
  NLM.workflows.forEach(r => check(r, 'workflow'));
});
