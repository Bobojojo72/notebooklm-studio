'use strict';

// The source markdown was exported with backslash escaping, for example \\\[TOPIC].
// Strip the backslashes back off so the prompts read as plain text.
function unescapeMd(text) {
  return String(text)
    .replace(/\\+([[\]*_`~()#+\-.!])/g, '$1')
    .replace(/ /g, ' ')
    .trim();
}

// 💡 marks a tip and "Strategic tip" / "Power move" mark commentary. 📌 marks a real
// prompt, so it is deliberately not in this list.
const NOTE_MARKERS = ['💡', 'Strategic tip', 'Power move'];

function isNote(body) {
  return NOTE_MARKERS.some(m => body.includes(m));
}

function titleCaseHeading(heading) {
  const cleaned = heading
    .replace(/[⭐*]/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  const lower = cleaned.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function parseBlocks(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const blocks = [];
  let section = '';
  let heading = '';
  let pendingName = '';
  let headingUses = 0;
  let quote = [];

  function flush() {
    if (!quote.length) return;
    const body = unescapeMd(quote.join(' ').replace(/\s+/g, ' ')).replace(/^📌\s*/, '');
    quote = [];
    if (!body || isNote(body)) return;

    let name = pendingName;
    pendingName = '';
    if (!name && heading) {
      // Several bare blockquotes can sit under one heading. Number them so each
      // still ends up with a unique, readable name.
      headingUses += 1;
      name = titleCaseHeading(heading) + (headingUses > 1 ? ' ' + headingUses : '');
    }
    if (!name) return;
    blocks.push({ section: section || heading, name, body });
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      flush();
      heading = unescapeMd(h[2]);
      if (h[1].length <= 3) section = heading;
      pendingName = '';
      headingUses = 0;
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
