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

test('parseBlocks splits separate blockquotes under one heading into separate blocks', () => {
  const md = [
    '## PART 9: SOURCE DISCOVERY PROMPTS',
    '',
    '> 📌 What sources am I missing?',
    '',
    '> 📌 Where are the gaps in my research?',
    ''
  ].join('\n');
  const blocks = parseBlocks(md);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].body, 'What sources am I missing?');
  assert.equal(blocks[1].body, 'Where are the gaps in my research?');
  assert.notEqual(blocks[0].name, blocks[1].name);
});

test('unescapeMd strips escaped ampersands used in table headings', () => {
  assert.equal(unescapeMd('Retro \\& Vintage'), 'Retro & Vintage');
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
