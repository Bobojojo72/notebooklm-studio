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

  // The single entry point the page uses for every copy action. Fields are applied
  // first so a filled [TOPIC] is not then duplicated by a "Topic:" prefix.
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

  // Shortcut filters for the Styles tab. Deliberately rules over vibe and background
  // brightness rather than hand-written lists of style names, which would rot on a rename.
  // light: true means a light background is required, null means either will do.
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

  // ---------- render: every function here returns a string and touches no DOM ----------

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

  // Full-bleed bands of the style's own palette, with the name sitting on the
  // background colour so the pairing of background, text and accent is visible at a glance.
  lib.thumbHTML = function (d) {
    var bands = [d.ac].concat(d.sec || []).slice(0, 6);
    var bandHTML = bands.map(function (c) {
      return '<i style="background:' + lib.esc(c) + '"></i>';
    }).join('');
    var label = String(d.name || '').split(' ')[0];
    return '<div class="thumb" style="background:' + lib.esc(d.bg) + '">' + bandHTML +
      '<div class="preview"><span style="background:' + lib.esc(d.bg) +
      ';color:' + lib.esc(d.tx) + ';border:1px solid ' + lib.esc(d.ac) + '">' +
      lib.esc(label) + '</span></div></div>';
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

  lib.styleCard = function (d, n) {
    var num = n ? '<p class="num">' + String(n).padStart(2, '0') + '</p>' : '';
    return '<article class="card" data-id="' + lib.esc(d.id) + '" data-kind="style">' +
      lib.thumbHTML(d) +
      '<div class="cardhead">' + num +
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
        '<button class="ghost pin" data-act="pin" aria-pressed="false" aria-label="Pin this style">&#9733;</button>' +
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
    var label = rec.output || rec.family || rec.section || '';
    return '<article class="pcard" data-id="' + lib.esc(rec.id) + '" data-kind="' + lib.esc(kind) + '">' +
      (label ? '<p class="plabel">' + lib.esc(label) + '</p>' : '') +
      '<h4>' + lib.esc(rec.name) + '</h4>' +
      (rec.why ? '<p class="pwhy">' + lib.esc(rec.why) + '</p>' : '') +
      '<p class="ptext">' + lib.esc(rec.body) + '</p>' +
      fieldHTML +
      '<div class="actions">' +
        '<button class="copy" data-act="copy">Copy</button>' +
        '<button class="ghost pin" data-act="pin" aria-pressed="false" aria-label="Pin this prompt">&#9733;</button>' +
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
        '<button class="ghost pin" data-act="pin" aria-pressed="false" aria-label="Pin this workflow">&#9733;</button>' +
      '</div>' +
    '</article>';
  };

  // t.html was built by tools/extract.js, which escapes every value taken from the
  // source files. Nothing user-supplied reaches this, so it is inserted as markup.
  lib.tipSection = function (t) {
    return '<section class="panel" data-id="' + lib.esc(t.id) + '">' +
      '<h2>' + lib.esc(t.title) + '</h2>' + t.html + '</section>';
  };

  root.NLMLib = lib;
})(typeof globalThis !== 'undefined' ? globalThis : this);
