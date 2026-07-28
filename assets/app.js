(function () {
  'use strict';

  var lib = window.NLMLib;
  var data = window.NLM;

  var VIBES = ['editorial', 'retro', 'technical', 'hand-drawn', 'playful', 'luxe', 'sci-fi'];

  var App = {
    state: {
      tab: 'styles',
      q: '',
      context: '',
      vibe: '',
      mood: '',
      useCase: '',
      topic: ''
    }
  };

  var $ = function (id) { return document.getElementById(id); };
  var view = $('view');

  function collection(tab) {
    if (tab === 'styles') return data.styles.concat(data.quickStyles);
    if (tab === 'chat') return data.chatPrompts;
    if (tab === 'studio') return data.studioPrompts;
    if (tab === 'workflows') return data.workflows;
    return data.tips;
  }

  function cardFor(rec, tab) {
    if (tab === 'styles') return rec.img ? lib.styleCard(rec) : lib.promptCard(rec, 'quickstyle');
    if (tab === 'workflows') return lib.workflowCard(rec);
    return lib.promptCard(rec, tab === 'studio' ? 'studio' : 'chat');
  }

  function filtered() {
    var s = App.state;
    if (s.tab === 'tips') return data.tips;
    // Vibe, background and use-case only exist on the Styles tab. Applying them
    // elsewhere would silently empty a tab whose records carry no vibes.
    var onStyles = s.tab === 'styles';
    var filters = {
      context: s.context,
      vibe: onStyles ? s.vibe : '',
      mood: onStyles ? s.mood : ''
    };
    var useCase = onStyles ? s.useCase : '';
    return collection(s.tab)
      .map(function (r) { return { r: r, score: lib.searchScore(r, s.q) }; })
      .filter(function (x) {
        if (x.score === 0 || !lib.matches(x.r, filters)) return false;
        return !useCase || lib.useCase(x.r, useCase);
      })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        // Full specifications come before the shorter quick styles.
        var af = a.r.img ? 0 : 1;
        var bf = b.r.img ? 0 : 1;
        if (af !== bf) return af - bf;
        return String(a.r.name).localeCompare(String(b.r.name));
      })
      .map(function (x) { return x.r; });
  }

  function renderFilters() {
    var box = $('filters');
    if (App.state.tab !== 'styles') { box.innerHTML = ''; return; }
    box.innerHTML = '<button class="chip" data-vibe="" aria-pressed="' + (!App.state.vibe) + '">All</button>' +
      VIBES.map(function (v) {
        return '<button class="chip" data-vibe="' + v + '" aria-pressed="' +
          (App.state.vibe === v) + '">' + v + '</button>';
      }).join('') +
      '<button class="chip" data-mood="dark" aria-pressed="' + (App.state.mood === 'dark') + '">dark bg</button>' +
      '<button class="chip" data-mood="light" aria-pressed="' + (App.state.mood === 'light') + '">light bg</button>' +
      '<span class="chiprow">' + lib.useCases.map(function (u) {
        return '<button class="chip usecase" data-uc="' + u.key + '" aria-pressed="' +
          (App.state.useCase === u.key) + '">' + lib.esc(u.label) + '</button>';
      }).join('') + '</span>';
  }

  App.render = function () {
    var rows = filtered();
    renderFilters();
    if (App.state.tab === 'tips') {
      view.innerHTML = rows.map(lib.tipSection).join('');
    } else {
      view.innerHTML = '<div class="grid">' +
        rows.map(function (r) { return cardFor(r, App.state.tab); }).join('') + '</div>';
    }
    $('count').textContent = rows.length + (rows.length === 1 ? ' item' : ' items');
    $('empty').hidden = rows.length > 0;
    if (App.restorePins) App.restorePins();
  };

  App.setTab = function (name) {
    App.state.tab = name;
    Array.prototype.forEach.call(document.querySelectorAll('[role="tab"]'), function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === name));
    });
    App.render();
  };

  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[role="tab"]');
    if (b) App.setTab(b.dataset.tab);
  });

  $('filters').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    // Clicking the active vibe again clears it, so there is always a way back
    // without hunting for the All chip.
    if ('vibe' in b.dataset) {
      App.state.vibe = App.state.vibe === b.dataset.vibe ? '' : b.dataset.vibe;
    }
    if ('mood' in b.dataset) App.state.mood = App.state.mood === b.dataset.mood ? '' : b.dataset.mood;
    if ('uc' in b.dataset) App.state.useCase = App.state.useCase === b.dataset.uc ? '' : b.dataset.uc;
    App.render();
  });

  $('q').addEventListener('input', function (e) { App.state.q = e.target.value; App.render(); });
  $('context').addEventListener('change', function (e) { App.state.context = e.target.value; App.render(); });

  var root = document.documentElement;
  root.dataset.theme = localStorage.getItem('nlm-theme') || 'dark';
  root.dataset.density = localStorage.getItem('nlm-density') || 'comfortable';
  $('theme').addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('nlm-theme', root.dataset.theme);
  });
  $('density').addEventListener('click', function () {
    root.dataset.density = root.dataset.density === 'compact' ? 'comfortable' : 'compact';
    localStorage.setItem('nlm-density', root.dataset.density);
  });

  // ---------- persistence ----------
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  App.pins = load('nlm-pins', []);
  App.recents = load('nlm-recents', []);
  App.fieldValues = {};

  var topicInput = $('topic');
  App.state.topic = localStorage.getItem('nlm-topic') || '';
  topicInput.value = App.state.topic;
  topicInput.addEventListener('input', function (e) {
    App.state.topic = e.target.value;
    localStorage.setItem('nlm-topic', App.state.topic);
  });

  // ---------- record lookup ----------
  var index = {};
  data.styles.concat(data.quickStyles, data.chatPrompts, data.studioPrompts, data.workflows)
    .forEach(function (r) { if (!index[r.id]) index[r.id] = r; });

  function findRecord(id) { return index[id] || null; }

  function kindOf(rec) {
    if (rec.img) return 'style';
    if (rec.steps) return 'workflow';
    return 'chat';
  }

  function textFor(rec) {
    return lib.bodyFor(rec, kindOf(rec), App.state.topic, App.fieldValues[rec.id] || {});
  }

  // ---------- copying ----------
  var toast = $('toast');
  var toastTimer = null;

  function announce(label) {
    toast.textContent = 'Copied ' + label;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1600);
  }

  function fallbackCopy(text, label) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing more we can do */ }
    document.body.removeChild(ta);
    announce(label);
  }

  App.copy = function (text, label) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { announce(label); }, function () {
        fallbackCopy(text, label);
      });
    } else {
      fallbackCopy(text, label);
    }
  };

  function remember(id) {
    App.recents = [id].concat(App.recents.filter(function (r) { return r !== id; })).slice(0, 5);
    localStorage.setItem('nlm-recents', JSON.stringify(App.recents));
    renderRail();
  }

  // ---------- pins and recents rail ----------
  App.togglePin = function (id) {
    var i = App.pins.indexOf(id);
    if (i > -1) App.pins.splice(i, 1); else App.pins.push(id);
    localStorage.setItem('nlm-pins', JSON.stringify(App.pins));
    App.restorePins();
    renderRail();
  };

  App.restorePins = function () {
    Array.prototype.forEach.call(view.querySelectorAll('[data-act="pin"]'), function (btn) {
      var card = btn.closest('[data-id]');
      if (card) btn.setAttribute('aria-pressed', String(App.pins.indexOf(card.dataset.id) > -1));
    });
  };

  function renderRail() {
    var rail = $('rail');
    var ids = App.pins.concat(App.recents.filter(function (r) { return App.pins.indexOf(r) === -1; }));
    if (!ids.length) { rail.hidden = true; rail.innerHTML = ''; return; }
    rail.hidden = false;
    rail.innerHTML = '<h2>Pinned and recent</h2><div class="filters">' + ids.map(function (id) {
      var rec = findRecord(id);
      if (!rec) return '';
      var pinned = App.pins.indexOf(id) > -1;
      return '<button class="chip" data-quick="' + lib.esc(id) + '" title="Copy ' + lib.esc(rec.name) + '">' +
        (pinned ? '★ ' : '') + lib.esc(rec.name) + '</button>';
    }).join('') + '</div>';
  }

  $('rail').addEventListener('click', function (e) {
    var b = e.target.closest('[data-quick]');
    if (!b) return;
    var rec = findRecord(b.dataset.quick);
    if (!rec) return;
    App.copy(textFor(rec), rec.name);
    remember(rec.id);
  });

  // ---------- one delegated handler for every card ----------
  view.addEventListener('input', function (e) {
    var input = e.target.closest('[data-field]');
    if (!input) return;
    var card = input.closest('[data-id]');
    if (!card) return;
    var store = App.fieldValues[card.dataset.id] || (App.fieldValues[card.dataset.id] = {});
    store[input.dataset.field] = input.value;
  });

  view.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.dataset.act;

    if (act === 'copyhex') { App.copy(btn.dataset.hex, btn.dataset.hex); return; }

    var card = btn.closest('[data-id]');
    if (!card) return;
    var rec = findRecord(card.dataset.id);
    if (!rec) return;

    if (act === 'pin') { App.togglePin(rec.id); return; }

    if (act === 'copystep') {
      App.copy(rec.steps[Number(btn.dataset.step)], 'step ' + (Number(btn.dataset.step) + 1));
      remember(rec.id);
      return;
    }
    if (act === 'preview') { App.preview(rec); return; }

    App.copy(textFor(rec), rec.name);
    btn.classList.add('done');
    setTimeout(function () { btn.classList.remove('done'); }, 900);
    remember(rec.id);
  });

  // ---------- preview modal ----------
  App.preview = function (rec) {
    var box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = '<div class="modalbox" role="dialog" aria-modal="true" aria-label="' +
      lib.esc(rec.name) + ' preview"><div class="modalthumb">' + lib.thumbHTML(rec) + '</div>' +
      '<h3>' + lib.esc(rec.name) + '</h3><p class="tone">' + lib.esc(rec.tone) + '</p>' +
      lib.paletteHTML(rec) +
      '<div class="actions"><button class="copy" data-act="copy">Copy this style</button>' +
      '<button class="ghost" data-act="close">Close</button></div></div>';

    function close() { box.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev) { if (ev.key === 'Escape') close(); }

    box.addEventListener('click', function (e) {
      var act = e.target.dataset ? e.target.dataset.act : '';
      if (e.target === box || act === 'close') { close(); return; }
      if (act === 'copy') { App.copy(lib.bodyFor(rec, 'style', App.state.topic, {}), rec.name); remember(rec.id); }
      var hexBtn = e.target.closest('[data-act="copyhex"]');
      if (hexBtn) App.copy(hexBtn.dataset.hex, hexBtn.dataset.hex);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
    box.querySelector('.copy').focus();
  };

  // ---------- command palette ----------
  App.openPalette = function () {
    var all = data.styles.concat(data.quickStyles, data.chatPrompts, data.studioPrompts, data.workflows);
    var box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = '<div class="modalbox palettebox" role="dialog" aria-modal="true" aria-label="Search everything">' +
      '<input id="pq" type="text" placeholder="Search all prompts and styles" autocomplete="off">' +
      '<ul id="presults" role="listbox"></ul></div>';
    document.body.appendChild(box);

    var input = box.querySelector('#pq');
    var list = box.querySelector('#presults');
    var rows = [];
    var sel = 0;

    function paint() {
      list.innerHTML = rows.map(function (r, i) {
        return '<li role="option" aria-selected="' + (i === sel) + '"' +
          (i === sel ? ' class="on"' : '') + '>' + lib.esc(r.name) +
          '<em>' + lib.esc(r.output || r.family || r.section || 'style') + '</em></li>';
      }).join('');
    }
    function draw() {
      var q = input.value;
      rows = all.map(function (r) { return { r: r, s: lib.searchScore(r, q) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 12).map(function (x) { return x.r; });
      sel = 0;
      paint();
    }
    function close() { box.remove(); document.removeEventListener('keydown', onKey); }
    function choose() {
      var rec = rows[sel];
      if (!rec) return;
      App.copy(textFor(rec), rec.name);
      remember(rec.id);
      close();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, rows.length - 1); paint(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); paint(); e.preventDefault(); }
      if (e.key === 'Enter') { choose(); e.preventDefault(); }
    }

    input.addEventListener('input', draw);
    document.addEventListener('keydown', onKey);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('li');
      if (!li) return;
      sel = Array.prototype.indexOf.call(list.children, li);
      choose();
    });
    draw();
    input.focus();
  };

  $('palettebtn').addEventListener('click', App.openPalette);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); App.openPalette(); }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && !document.querySelector('.modal')) {
      e.preventDefault();
      $('q').focus();
    }
  });

  renderRail();

  window.App = App;
  App.render();
})();
