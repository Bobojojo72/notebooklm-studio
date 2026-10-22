/* PaperJet operator kit. Draws the hand control panel diagram, numbers the slides and adds a
   full-screen present mode to the decks. Pages still read correctly without it. */
(function () {
  'use strict';

  // Hand control panel, laid out as in the manual (Fig. 64): five mode keys above the display,
  // then Esc, the turn/push knob and the hand button. data-on="1 knob" highlights parts,
  // data-badges="1:1 knob:2" puts step numbers on them.
  var PARTS = [
    ['1', 'Length', 'mode'], ['2', 'Removal', 'mode'], ['3', 'Manual', 'mode'],
    ['4', 'Series', 'mode'], ['5', 'Preset 1–3', 'mode']
  ];
  function buildPanel(host) {
    var on = (host.getAttribute('data-on') || '').split(/\s+/).filter(Boolean);
    var badges = {};
    (host.getAttribute('data-badges') || '').split(/\s+/).filter(Boolean).forEach(function (pair) {
      var i = pair.lastIndexOf(':');
      badges[pair.slice(0, i)] = pair.slice(i + 1);
    });
    if (on.length) host.classList.add('dim');
    function part(id, cls, inner) {
      var b = badges[id] ? '<span class="badge">' + badges[id] + '</span>' : '';
      return '<span class="pp ' + cls + (on.indexOf(id) !== -1 ? ' on' : '') + '" data-part="' + id + '">' + inner + b + '</span>';
    }
    var modes = PARTS.map(function (p) {
      return part(p[0], 'pp-mode', '<span class="led" aria-hidden="true"></span><b>' + p[0] + '</b><small>' + p[1] + '</small>');
    }).join('');
    host.innerHTML =
      '<div class="pp-modes">' + modes + '</div>' +
      part('display', 'pp-display', '<span class="lcd">' + (host.getAttribute('data-screen') || 'Length&nbsp;&nbsp;120 cm') + '</span>') +
      '<div class="pp-controls">' +
        part('esc', 'pp-esc', 'Esc') +
        part('knob', 'pp-knob', '<span class="dial" aria-hidden="true"></span><small>Turn / push</small>') +
        part('hand', 'pp-hand', '<span class="go" aria-hidden="true"></span><small>Hand button</small>') +
      '</div>';
    host.setAttribute('role', 'img');
    if (!host.getAttribute('aria-label')) host.setAttribute('aria-label', 'PaperJet hand control panel diagram');
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
    var panels = document.querySelectorAll('.panel-pj');
    for (var i = 0; i < panels.length; i++) buildPanel(panels[i]);
    setupDeck();
    pdfLinks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
