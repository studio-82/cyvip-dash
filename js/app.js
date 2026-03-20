/* ========================================
   CyVIP Dashboard - App Controller
   Email list with preference filter + CSV export
   ======================================== */

var dashboard = (function () {
  var state = {
    submissions: [],
    currentFilter: 'all',
    listScrollY: 0,
    loading: false,
    lastRefresh: null
  };

  var STATE_FILE = 'sessionState.json';

  // --- Init ---
  function init() {
    bindLoginEvents();

    var savedKey = sessionStorage.getItem('cyvip_dash_key');
    if (savedKey) {
      CyvipAPI.setKey(savedKey);
      showDashboard();
      restoreState();
      loadSubmissions();
    }
  }

  function bindLoginEvents() {
    var input = document.getElementById('key-input');
    var btn = document.getElementById('btn-login');
    btn.addEventListener('click', attemptLogin);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') attemptLogin();
    });
  }

  function attemptLogin() {
    var input = document.getElementById('key-input');
    var key = input.value.trim();
    var err = document.getElementById('login-error');
    if (!key) { err.textContent = 'enter a key'; return; }
    err.textContent = '';
    CyvipAPI.setKey(key);

    CyvipAPI.validateKey()
      .then(function () {
        sessionStorage.setItem('cyvip_dash_key', key);
        showDashboard();
        bindDashboardEvents();
        loadSubmissions();
      })
      .catch(function () {
        err.textContent = 'invalid key';
        input.value = '';
        input.focus();
      });
  }

  function showDashboard() {
    document.getElementById('login-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
    bindDashboardEvents();
  }

  function logout() {
    sessionStorage.removeItem('cyvip_dash_key');
    CyvipAPI.setKey('');
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('login-view').classList.add('active');
    document.getElementById('key-input').value = '';
  }

  var _bound = false;
  function bindDashboardEvents() {
    if (_bound) return;
    _bound = true;

    document.getElementById('btn-refresh').addEventListener('click', loadSubmissions);
    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('btn-export').addEventListener('click', exportCSV);

    document.querySelectorAll('.filter-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.filter-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        state.currentFilter = tab.dataset.filter;
        renderList();
        saveState();
      });
    });
  }

  // --- Data ---
  function loadSubmissions() {
    state.loading = true;
    CyvipAPI.fetchSubmissions()
      .then(function (data) {
        state.submissions = data;
        state.lastRefresh = new Date();
        state.loading = false;
        renderStats();
        renderList();
        updateRefreshTime();
      })
      .catch(function (e) {
        state.loading = false;
        showToast(e.message, true);
      });
  }

  // --- Get filtered list ---
  function getFiltered() {
    if (state.currentFilter === 'all') return state.submissions;
    return state.submissions.filter(function (s) {
      return s.preference === state.currentFilter;
    });
  }

  // --- Stats ---
  function renderStats() {
    var s = state.submissions;
    var preTea = 0, milkDrops = 0;
    s.forEach(function (sub) {
      if (sub.preference === 'pre-tea') preTea++;
      else if (sub.preference === 'milk-drops') milkDrops++;
    });

    document.getElementById('stats').innerHTML =
      '<div class="stat">' +
        '<span class="stat-num">' + s.length + '</span>' +
        '<span class="stat-label">Total Signups</span>' +
      '</div>' +
      '<div class="stat stat--pref-tea">' +
        '<span class="stat-num">' + preTea + '</span>' +
        '<span class="stat-label">Pre-Tea</span>' +
      '</div>' +
      '<div class="stat stat--pref-milk">' +
        '<span class="stat-num">' + milkDrops + '</span>' +
        '<span class="stat-label">Milk Drops</span>' +
      '</div>';
  }

  // --- Email List ---
  function renderList() {
    var filtered = getFiltered();
    var listEl = document.getElementById('submissions-list');
    var emptyEl = document.getElementById('empty-msg');

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    var html = '';
    filtered.forEach(function (sub, i) {
      var num = String(i + 1).padStart(2, '0');
      var prefLabel = sub.preference === 'pre-tea' ? 'Pre-Tea' : 'Milk Drops';
      var prefClass = sub.preference === 'pre-tea' ? 'pref--tea' : 'pref--milk';

      html += '<div class="sub-row" data-id="' + sub.id + '" style="animation-delay:' + (i * 0.03) + 's">' +
        '<span class="sub-num">' + num + '</span>' +
        '<span class="sub-email">' + escHtml(sub.email) + '</span>' +
        '<span class="sub-pref ' + prefClass + '">' + prefLabel + '</span>' +
        '<button class="sub-delete" data-id="' + sub.id + '" title="Delete">&times;</button>' +
      '</div>';
    });

    listEl.innerHTML = html;

    // Bind delete buttons with confirm-on-second-click
    listEl.querySelectorAll('.sub-delete').forEach(function (btn) {
      var timer = null;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btn.classList.contains('confirming')) {
          clearTimeout(timer);
          btn.disabled = true;
          btn.textContent = '...';
          CyvipAPI.deleteSubmission(btn.dataset.id)
            .then(function () {
              showToast('Deleted');
              loadSubmissions();
            })
            .catch(function (err) { showToast(err.message, true); });
        } else {
          btn.classList.add('confirming');
          btn.textContent = '?';
          timer = setTimeout(function () {
            btn.classList.remove('confirming');
            btn.textContent = '\u00D7';
          }, 2500);
        }
      });
    });
  }

  // --- CSV Export ---
  function exportCSV() {
    var filtered = getFiltered();
    if (filtered.length === 0) {
      showToast('Nothing to export', true);
      return;
    }

    var filterLabel = state.currentFilter === 'all' ? 'all' :
      (state.currentFilter === 'pre-tea' ? 'pre-tea' : 'milk-drops');

    var lines = ['email,preference'];
    filtered.forEach(function (sub) {
      lines.push(escCSV(sub.email) + ',' + escCSV(sub.preference));
    });

    var csv = lines.join('\n');
    var a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'yummy-delights-waitlist-' + filterLabel + '.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('Exported ' + filtered.length + ' emails (' + filterLabel + ')');
  }

  function escCSV(s) {
    s = String(s || '');
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  // --- Toast ---
  function showToast(msg, isError) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' toast--error' : '');
    setTimeout(function () { t.className = 'toast'; }, 3500);
  }

  // --- Refresh Time ---
  function updateRefreshTime() {
    var el = document.getElementById('refresh-time');
    if (!state.lastRefresh) return;
    el.textContent = 'updated ' + state.lastRefresh.toLocaleTimeString();
  }
  setInterval(updateRefreshTime, 15000);

  // --- State ---
  function saveState() {
    if (!window.AgentBrowserStorage) return;
    AgentBrowserStorage.write(STATE_FILE, {
      currentFilter: state.currentFilter,
      listScrollY: state.listScrollY
    }).catch(function () {});
  }

  function restoreState() {
    if (!window.AgentBrowserStorage) return;
    AgentBrowserStorage.read(STATE_FILE).then(function (s) {
      if (!s) return;
      state.currentFilter = s.currentFilter || 'all';
      document.querySelectorAll('.filter-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.filter === state.currentFilter);
      });
    }).catch(function () {});
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {};
})();
