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

  window.App = App;
  App.render();
})();
