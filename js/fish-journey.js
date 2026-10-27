/** 小鱼旅程：从 Worker 读取真实巡游记录。 */
(function () {
  const SESSION_ENDPOINT = '/api/fish/sessions';
  const DAY_MS = 86400000;
  const state = { period: 'week', offset: 0, sessions: [], daily: new Map(), hourly: new Map(), updatedAt: null };

  function apiUrl() { return (window.BlogConfig?.apiBase || '') + SESSION_ENDPOINT; }
  function parts(date) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce(function (out, p) { out[p.type] = p.value; return out; }, {});
  }
  function today() {
    const p = parts(new Date());
    return new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
  }
  function key(date) {
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(date.getUTCDate()).padStart(2, '0');
  }
  function dateKeyFromTimestamp(value) {
    const p = parts(new Date(value));
    return p.year + '-' + p.month + '-' + p.day;
  }
  function fromKey(value) {
    const p = value.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }
  function addDays(date, count) { return new Date(date.getTime() + count * DAY_MS); }
  function weekStart(date) { return addDays(date, -((date.getUTCDay() + 6) % 7)); }
  function shortDate(date) { return (date.getUTCMonth() + 1) + '/' + date.getUTCDate(); }
  function rangeText(a, b) { return shortDate(a) + ' – ' + shortDate(b); }
  function metersText(value) {
    const valueMeters = Number(value) || 0;
    return valueMeters >= 1000
      ? (valueMeters / 1000).toFixed(2) + ' <small>千米</small>'
      : valueMeters.toFixed(1) + ' <small>米</small>';
  }
  function shortMeters(value) {
    const valueMeters = Number(value) || 0;
    return valueMeters >= 1000 ? (valueMeters / 1000).toFixed(2) + ' 千米' : valueMeters.toFixed(1) + ' 米';
  }
  function durationText(seconds) {
    const minutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
    const hours = Math.floor(minutes / 60), remainder = minutes % 60;
    if (hours && remainder) return hours + ' 小时 ' + remainder + ' 分钟';
    if (hours) return hours + ' 小时';
    return minutes + ' 分钟';
  }
  function formatDateTime(value) {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date(value));
  }
  function formatSyncTime(value) {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date(value));
  }
  function sumDays(start, end) {
    let total = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) total += state.daily.get(key(d)) || 0;
    return total;
  }

  function trendData() {
    const now = today();
    if (state.period === 'day') {
      const date = addDays(now, state.offset), dateId = key(date);
      const labels = ['00–04', '04–08', '08–12', '12–16', '16–20', '20–24'];
      const values = labels.map(function (_, index) {
        let total = 0;
        for (let h = index * 4; h < index * 4 + 4; h += 1) {
          total += state.hourly.get(dateId + 'T' + String(h).padStart(2, '0')) || 0;
        }
        return total;
      });
      return { labels: labels, values: values, caption: state.offset === 0 ? '今天 · ' + shortDate(date) : shortDate(date) };
    }
    if (state.period === 'week') {
      const start = addDays(weekStart(now), state.offset * 7), end = addDays(start, 6);
      const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const labels = Array.from({ length: 7 }, function (_, i) { return names[addDays(start, i).getUTCDay()]; });
      const values = labels.map(function (_, i) { return state.daily.get(key(addDays(start, i))) || 0; });
      return { labels: labels, values: values, caption: state.offset === 0 ? '本周' : rangeText(start, end) };
    }
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + state.offset, 1));
    const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const days = [1, 8, 15, 22, 29].filter(function (day) { return day <= monthEnd.getUTCDate(); });
    const labels = days.map(function (day) { return day + '–' + Math.min(day + 6, monthEnd.getUTCDate()) + ' 日'; });
    const values = days.map(function (day) {
      return sumDays(
        new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day)),
        new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), Math.min(day + 6, monthEnd.getUTCDate())))
      );
    });
    return {
      labels: labels, values: values,
      caption: state.offset === 0 ? '本月 · ' + (start.getUTCMonth() + 1) + ' 月' :
        start.getUTCFullYear() + ' 年 ' + (start.getUTCMonth() + 1) + ' 月'
    };
  }

  function renderTrend(root) {
    const trend = trendData(), chart = root.querySelector('#fish-chart');
    const max = Math.max.apply(null, trend.values.concat([1]));
    chart.style.gridTemplateColumns = 'repeat(' + trend.values.length + ', minmax(0, 1fr))';
    chart.setAttribute('aria-label', trend.caption + '巡游里程图');
    chart.innerHTML = trend.values.map(function (value, index) {
      const height = value === 0 ? 0 : Math.max(5, value / max * 100);
      return '<div class="fish-bar-col"><span class="fish-bar-value">' + value.toFixed(1) +
        '</span><div class="fish-bar-track"><div class="fish-bar" style="height:' + height +
        '%"></div></div><span class="fish-bar-label">' + trend.labels[index] + '</span></div>';
    }).join('');
    root.querySelector('#fish-trend-caption').textContent = trend.caption;
    root.querySelector('#fish-trend-next').disabled = state.offset >= 0;
  }

  function renderSummary(root) {
    const hasData = state.sessions.length > 0, now = today(), todayKey = key(now);
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const total = state.sessions.reduce(function (sum, session) { return sum + (Number(session.distanceMeters) || 0); }, 0);
    root.querySelector('#fish-stat-today').innerHTML = hasData ? metersText(state.daily.get(todayKey) || 0) : '—';
    root.querySelector('#fish-stat-week').innerHTML = hasData ? metersText(sumDays(weekStart(now), now)) : '—';
    root.querySelector('#fish-stat-month').innerHTML = hasData ? metersText(sumDays(thisMonth, now)) : '—';
    root.querySelector('#fish-stat-total').innerHTML = hasData ? metersText(total) : '—';
    root.querySelector('#fish-last-sync').textContent = state.updatedAt ? formatSyncTime(state.updatedAt) : '未同步';
  }

  function renderHeatmap(root) {
    const grid = root.querySelector('#fish-heatmap'), scroll = root.querySelector('#fish-heatmap-scroll');
    const dates = Array.from({ length: 30 }, function (_, index) { return addDays(today(), index - 29); });
    const max = Math.max.apply(null, dates.map(function (date) { return state.daily.get(key(date)) || 0; }).concat([1]));
    grid.innerHTML = dates.map(function (date) {
      const id = key(date), meters = state.daily.get(id) || 0;
      const level = meters ? Math.min(4, Math.max(1, Math.ceil(meters / max * 4))) : 0;
      const title = shortDate(date) + ' · ' + meters.toFixed(1) + ' 米';
      return '<button type=\"button\" class=\"fish-heatmap-cell level-' + level + '\" data-date=\"' + id +
        '\" title=\"' + title + '\" aria-label=\"' + title + '\">' + date.getUTCDate() + '</button>';
    }).join('');
    grid.querySelectorAll('.fish-heatmap-cell').forEach(function (cell) {
      cell.addEventListener('click', function () {
        root.querySelector('#fish-record-date').value = cell.dataset.date;
        renderSessions(root);
        root.querySelector('#fish-recent-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
    scroll.addEventListener('wheel', function (event) {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        scroll.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    }, { passive: false });
  }

  function normalizeSessions(records) {
    return records.map(function (session) {
      const daily = session.dailyMeters && typeof session.dailyMeters === 'object' ? session.dailyMeters : {};
      if (!Object.keys(daily).length && session.startedAt) daily[dateKeyFromTimestamp(session.startedAt)] = Number(session.distanceMeters) || 0;
      return Object.assign({}, session, {
        dailyMeters: daily,
        hourlyMeters: session.hourlyMeters && typeof session.hourlyMeters === 'object' ? session.hourlyMeters : {}
      });
    }).sort(function (a, b) { return Date.parse(b.endedAt) - Date.parse(a.endedAt); });
  }

  function renderAchievements(root) {
    const total = state.sessions.reduce(function (sum, session) { return sum + (Number(session.distanceMeters) || 0); }, 0);
    let streak = 0, cursor = today();
    if (!(state.daily.get(key(cursor)) > 0)) cursor = addDays(cursor, -1);
    while (state.daily.get(key(cursor)) > 0 && streak < 3650) { streak += 1; cursor = addDays(cursor, -1); }
    const items = [
      ['🐟', '初次出发', '累计游过 10 米', total, 10],
      ['💧', '百米小鱼', '累计游过 100 米', total, 100],
      ['🌊', '小小航海家', '累计游过 1 千米', total, 1000],
      ['🐚', '海岸漫游者', '累计游过 5 千米', total, 5000],
      ['🫧', '深海漫游', '累计游过 10 千米', total, 10000],
      ['✨', '常来看看', '连续 7 天都有巡游记录', streak, 7]
    ];
    root.querySelector('#fish-achievements').innerHTML = items.map(function (item) {
      const earned = item[3] >= item[4], progress = Math.min(100, Math.floor(item[3] / item[4] * 100));
      return '<article class=\"fish-achievement' + (earned ? ' is-earned' : '') + '\"><span class=\"fish-achievement-icon\">' +
        item[0] + '</span><div><strong>' + item[1] + '</strong><small>' + item[2] +
        '</small></div><b>' + (earned ? '已达成' : progress + '%') + '</b></article>';
    }).join('');
  }

  function renderSessions(root) {
    const selectedDate = root.querySelector('#fish-record-date').value;
    const records = selectedDate
      ? state.sessions.filter(function (session) {
        return Number(session.dailyMeters[selectedDate]) > 0 ||
          (session.startedAt && dateKeyFromTimestamp(session.startedAt) === selectedDate);
      })
      : state.sessions.slice(0, 3);
    const list = root.querySelector('#fish-session-list');
    if (!records.length) { list.innerHTML = '<p class=\"fish-session-empty\">暂无记录</p>'; return; }
    list.innerHTML = records.map(function (session) {
      const mode = session.mode === 'focus' ? '专注巡游' : '桌面巡游';
      const active = session.isActive ? ' · 进行中' : '';
      return '<button type=\"button\" class=\"fish-session-row\" data-session-id=\"' + session.sessionId +
        '\"><span class=\"fish-session-dot\" aria-hidden=\"true\"></span><span class=\"fish-session-main\"><strong>' +
        formatDateTime(session.startedAt) + '</strong><small>' + mode + ' · ' + durationText(session.durationSeconds) +
        active + '</small></span><b>' + shortMeters(session.distanceMeters) + '</b></button>';
    }).join('');
    list.querySelectorAll('.fish-session-row').forEach(function (row) {
      row.addEventListener('click', function () {
        const found = state.sessions.find(function (session) { return session.sessionId === row.dataset.sessionId; });
        if (found) openSession(root, found);
      });
    });
  }

  function openSession(root, session) {
    const dialog = root.querySelector('#fish-session-dialog');
    const mode = session.mode === 'focus' ? '专注巡游' : '桌面巡游';
    root.querySelector('#fish-session-dialog-title').textContent = formatDateTime(session.startedAt) + ' 的巡游';
    root.querySelector('#fish-session-detail').innerHTML =
      '<div><span>开始时间</span><strong>' + formatDateTime(session.startedAt) + '</strong></div>' +
      '<div><span>巡游时长</span><strong>' + durationText(session.durationSeconds) +
      (session.isActive ? ' · 进行中' : '') + '</strong></div>' +
      '<div><span>游过距离</span><strong>' + shortMeters(session.distanceMeters) + '</strong></div>' +
      '<div><span>巡游方式</span><strong>' + mode + '</strong></div>';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function rebuildBuckets() {
    state.daily = new Map();
    state.hourly = new Map();
    state.sessions.forEach(function (session) {
      Object.entries(session.dailyMeters || {}).forEach(function (entry) {
        state.daily.set(entry[0], (state.daily.get(entry[0]) || 0) + (Number(entry[1]) || 0));
      });
      Object.entries(session.hourlyMeters || {}).forEach(function (entry) {
        state.hourly.set(entry[0], (state.hourly.get(entry[0]) || 0) + (Number(entry[1]) || 0));
      });
    });
  }

  function renderAll(root) {
    renderSummary(root);
    renderTrend(root);
    renderHeatmap(root);
    renderSessions(root);
    renderAchievements(root);
  }

  async function loadSessions(root) {
    root.querySelector('#fish-last-sync').textContent = '读取中…';
    try {
      const response = await fetch(apiUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const payload = await response.json();
      state.sessions = normalizeSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
      state.updatedAt = payload.updatedAt || null;
      rebuildBuckets();
      renderAll(root);
    } catch (_) {
      state.sessions = [];
      state.updatedAt = null;
      rebuildBuckets();
      renderAll(root);
      root.querySelector('#fish-last-sync').textContent = '连接失败';
    }
  }

  async function initializeFishJourney() {
    const root = document.getElementById('fish-journey');
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';
    root.querySelectorAll('#fish-period-tabs button').forEach(function (button) {
      button.addEventListener('click', function () {
        state.period = button.dataset.period;
        state.offset = 0;
        root.querySelectorAll('#fish-period-tabs button').forEach(function (tab) {
          const active = tab === button;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-selected', String(active));
        });
        renderTrend(root);
      });
    });
    root.querySelector('#fish-trend-prev').addEventListener('click', function () { state.offset -= 1; renderTrend(root); });
    root.querySelector('#fish-trend-next').addEventListener('click', function () {
      state.offset = Math.min(0, state.offset + 1);
      renderTrend(root);
    });
    root.querySelector('#fish-record-date').addEventListener('change', function () { renderSessions(root); });
    root.querySelector('#fish-session-close').addEventListener('click', function () {
      const dialog = root.querySelector('#fish-session-dialog');
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    });
    const dialog = root.querySelector('#fish-session-dialog');
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog && typeof dialog.close === 'function') dialog.close();
    });
    await loadSessions(root);
  }

  if (window.BlogApp && window.BlogApp.register) window.BlogApp.register('fish-journey', initializeFishJourney);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeFishJourney, { once: true });
  else initializeFishJourney();
})();
