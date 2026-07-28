(function (root) {
  'use strict';

  var lib = {};

  // Bracket fields whose name reads like the subject of the notebook. When the topic
  // box is filled, one of these is substituted rather than a "Topic:" line being bolted on.
  var TOPIC_FIELD = /^(topic|subject|industry|sector|industry\/sector|company|company\/sector|process|method|tool|ai topic|ai tool|thing a|thing b)/i;

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
