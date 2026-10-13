/* BP555 operator kit. Turns <kbd>24</kbd>-style markup into real keycaps, draws the full keypad,
   numbers the slides and adds a full-screen present mode to the decks. Pages still read correctly
   without it: every <kbd> carries its own label text. */
(function () {
  'use strict';

  // Keycap definitions. Labels match the printed keys in the manual (Figure 25).
  var PRESETS = ['6', '9', '12', '15', '18', '21', '24', '27', '30', '33', '36', '39', '42', '45'];
  var SPECIAL = {
    '+': { cls: 'k-plus', html: '+', name: 'plus' },
    '-': { cls: 'k-minus', html: '−', name: 'minus' },
    '2x': { cls: 'k-2x', html: '2x', name: '2x' },
    'A': { cls: 'k-a', html: 'A', name: 'A' },
    'REPEAT START': { cls: 'k-rs', html: '<b>REPEAT</b><small>START</small>', name: 'REPEAT START' },
    'REPEAT 2 ENTER': { cls: 'k-r2', html: '<b>REPEAT 2</b><small>ENTER</small>', name: 'REPEAT 2 ENTER' },
    'Random': { cls: 'k-rand', html: '<i class="ms" aria-hidden="true">vertical_align_bottom</i><span class="sr">Random</span>', name: 'Random' }
  };

  function keyInfo(label) {
    label = String(label).trim();
    if (SPECIAL[label]) return SPECIAL[label];
    if (PRESETS.indexOf(label) !== -1) return { cls: 'k-' + label, html: label, name: label };
    return null;
  }

  function dressKey(el) {
    var info = keyInfo(el.textContent);
    if (!info) return;
    el.classList.add('k', info.cls);
    el.innerHTML = info.html;
    el.setAttribute('title', info.name);
  }

  function dressSequences(root) {
    var seqs = root.querySelectorAll('.seq');
    for (var i = 0; i < seqs.length; i++) {
      var keys = seqs[i].querySelectorAll('kbd');
      for (var j = 1; j < keys.length; j++) {
        var t = document.createElement('span');
        t.className = 'then';
        t.innerHTML = '<span aria-hidden="true">→</span><span class="sr"> then </span>';
        keys[j].parentNode.insertBefore(t, keys[j]);
      }
    }
  }

  // Full keypad. data-on="+ 24" highlights keys, data-badges="+:4 A:5" numbers them,
  // data-model="standard" hides the automatic-only keys, class "auto-on" lights the red lamp.
  function buildKeypad(host) {
    var on = (host.getAttribute('data-on') || '').split(/\s*,\s*/).filter(Boolean);
    var badges = {};
    (host.getAttribute('data-badges') || '').split(/\s*,\s*/).filter(Boolean).forEach(function (pair) {
      var i = pair.lastIndexOf(':');
      badges[pair.slice(0, i)] = pair.slice(i + 1);
    });
    if (host.getAttribute('data-model') === 'standard') host.classList.add('standard');
    if (on.length) host.classList.add('dim');

    function key(label, extra) {
      var info = keyInfo(label);
      var cls = 'k ' + info.cls + (extra ? ' ' + extra : '') + (on.indexOf(label) !== -1 ? ' on' : '');
      var b = badges[label] ? '<span class="badge">' + badges[label] + '</span>' : '';
      var light = label === 'A' ? '<span class="light" aria-hidden="true"></span>' : '';
      return '<span class="' + cls + '" title="' + info.name + '">' + light + info.html + b + '</span>';
    }
    var left = ['42', '36', '30', '24', '18', '12', '6'];
    var right = ['45', '39', '33', '27', '21', '15', '9', 'Random'];
    host.innerHTML =
      '<div class="kp-row">' + key('+') + key('A', 'auto-only') + '</div>' +
      '<div class="kp-row">' + key('-') + key('2x') + '</div>' +
      '<div class="kp-cols"><div class="kp-col left">' + left.map(function (l) { return key(l); }).join('') +
      '</div><div class="kp-col right">' + right.map(function (l) { return key(l); }).join('') + '</div></div>' +
      '<div class="kp-row kp-bottom">' + key('REPEAT START') + key('REPEAT 2 ENTER', 'auto-only') + '</div>';
    host.setAttribute('role', 'img');
    if (!host.getAttribute('aria-label')) host.setAttribute('aria-label', 'BP555 keypad');
  }

  // Slide footers and present mode.
  function setupDeck() {
    var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    if (!slides.length) return;
    var name = document.body.getAttribute('data-deck') || '';
    slides.forEach(function (s, i) {
      var f = document.createElement('div');
      f.className = 's-foot';
      f.innerHTML = '<span>' + name + '</span><span>Slide ' + (i + 1) + ' of ' + slides.length + '</span>';
      s.appendChild(f);
    });

    var current = 0;
    var hint = document.createElement('div');
    hint.className = 'present-hint';
    hint.textContent = 'Arrow keys or click to move. Esc to exit.';
    document.body.appendChild(hint);

    function show(i) {
      current = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (s, j) { s.classList.toggle('current', j === current); });
    }
    function start() {
      var top = 0;
      for (var i = 0; i < slides.length; i++) { if (slides[i].getBoundingClientRect().bottom > 80) { top = i; break; } }
      document.body.classList.add('presenting');
      show(top);
      var el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
    }
    function stop() {
      document.body.classList.remove('presenting');
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      slides[current].scrollIntoView({ block: 'start' });
    }
    var btn = document.querySelector('[data-present]');
    if (btn) btn.addEventListener('click', start);
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement && document.body.classList.contains('presenting')) {
        document.body.classList.remove('presenting');
        slides[current].scrollIntoView({ block: 'start' });
      }
    });
    document.addEventListener('keydown', function (e) {
      if (!document.body.classList.contains('presenting')) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].indexOf(e.key) !== -1) { e.preventDefault(); show(current + 1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].indexOf(e.key) !== -1) { e.preventDefault(); show(current - 1); }
      else if (e.key === 'Home') show(0);
      else if (e.key === 'End') show(slides.length - 1);
      else if (e.key === 'Escape') stop();
    });
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('presenting')) return;
      show(current + (e.clientX > window.innerWidth / 3 ? 1 : -1));
    });
  }

  // PDF links only make sense where the PDFs are served (GitHub Pages, local copy).
  function pdfLinks() {
    if (/claude|claudeusercontent/.test(location.hostname)) {
      var links = document.querySelectorAll('.pdf-link');
      for (var i = 0; i < links.length; i++) links[i].hidden = true;
    }
  }

  function init() {
    var kps = document.querySelectorAll('.keypad');
    for (var i = 0; i < kps.length; i++) buildKeypad(kps[i]);
    var keys = document.querySelectorAll('kbd');
    for (var j = 0; j < keys.length; j++) dressKey(keys[j]);
    dressSequences(document);
    setupDeck();
    pdfLinks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
