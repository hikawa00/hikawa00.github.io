/**
 * 生活日历：公开浏览，密匙解锁后管理。
 * 所有日期统计按 Asia/Shanghai 口径计算。
 */
(function () {
  const API_PATH = '/api/life';
  const ADMIN_PATH = '/api/life/manage';
  const KEY_STORAGE = 'life_admin_key';
  const EMOJI_PICKER_VERSION = '1.29.1';
  const EMOJI_PICKER_MODULE = `https://cdn.jsdelivr.net/npm/emoji-picker-element@${EMOJI_PICKER_VERSION}/picker.js`;
  const EMOJI_PICKER_I18N = `https://cdn.jsdelivr.net/npm/emoji-picker-element@${EMOJI_PICKER_VERSION}/i18n/zh_CN.js`;
  const EMOJI_DATA_SOURCE = 'https://cdn.jsdelivr.net/npm/emoji-picker-element-data@1.8.0/zh/emojibase/data.json';
  let emojiPickerLoader;

  function apiUrl(path) {
    return `${window.BlogConfig?.apiBase || ''}${path}`;
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function getShanghaiParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
    return parts;
  }

  function todayString() {
    const parts = getShanghaiParts();
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function currentTimeString() {
    const parts = getShanghaiParts();
    return `${parts.hour}:${parts.minute}`;
  }

  function shiftTime(value, minutes) {
    const [hour, minute] = String(value || '00:00').split(':').map(Number);
    const total = ((hour * 60 + minute + minutes) % 1440 + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function parseDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  function dateString(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function addDays(value, amount) {
    const date = parseDate(value);
    date.setUTCDate(date.getUTCDate() + amount);
    return dateString(date);
  }

  function monthString(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function formatDay(value) {
    const date = parseDate(value);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 · 周${weekdays[date.getUTCDay()]}`;
  }

  function formatDuration(minutes) {
    const value = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    if (!hours) return `${rest} 分钟`;
    if (!rest) return `${hours} 小时`;
    return `${hours} 小时 ${rest} 分钟`;
  }

  function dueTimestamp(date, time) {
    return Date.parse(`${date}T${time}:00+08:00`);
  }

  function initializeLifeCalendar() {
    const root = document.getElementById('life-dashboard');
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    const elements = {
      loading: root.querySelector('#life-loading'), error: root.querySelector('#life-error'),
      content: root.querySelector('#life-content'), calendar: root.querySelector('#life-calendar-grid'),
      monthLabel: root.querySelector('#life-month-label'), selectedTitle: root.querySelector('#life-selected-title'),
      dayDetail: root.querySelector('#life-day-detail'), planMetrics: root.querySelector('#life-plan-metrics'),
      planSummaryTitle: root.querySelector('#life-plan-summary-title'), ranking: root.querySelector('#life-project-ranking'),
      periodCaption: root.querySelector('#life-period-caption'), totalTime: root.querySelector('#life-total-time'),
      adminToggle: root.querySelector('#life-admin-toggle'), addEntry: root.querySelector('#life-add-entry'),
      addProject: root.querySelector('#life-add-project'), periodTabs: root.querySelector('#life-period-tabs'),
      toast: root.querySelector('#life-toast'), entryMode: root.querySelector('#life-entry-mode')
    };

    let state = { projects: [], items: [] };
    let selectedDate = todayString();
    let displayedMonth = selectedDate.slice(0, 7);
    let period = 'month';
    let adminKey = '';
    let toastTimer;

    try { adminKey = sessionStorage.getItem(KEY_STORAGE) || ''; } catch {}

    const dialogs = Object.fromEntries(
      [...root.querySelectorAll('dialog')].map(dialog => [dialog.id, dialog])
    );

    function projectById(id) {
      return state.projects.find(project => project.id === id) || { name: '未知项目', emoji: '·' };
    }

    function isUnlocked() {
      return Boolean(adminKey);
    }

    function showToast(message, type = 'success') {
      clearTimeout(toastTimer);
      elements.toast.textContent = message;
      elements.toast.dataset.type = type;
      elements.toast.classList.add('show');
      toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2800);
    }

    function openDialog(dialog) {
      if (!dialog) return;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeDialog(dialog) {
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    function closeEmojiPickers(except) {
      root.querySelectorAll('.life-emoji-popover').forEach(picker => {
        if (picker === except) return;
        if (typeof picker.hidePopover === 'function') {
          try { picker.hidePopover(); } catch {}
        }
        picker.hidden = true;
      });
      root.querySelectorAll('.life-emoji-trigger').forEach(trigger => {
        const ownsExcept = except && trigger.closest('.life-emoji-picker')?.contains(except);
        trigger.setAttribute('aria-expanded', ownsExcept ? 'true' : 'false');
      });
    }

    function positionEmojiPicker(picker, trigger) {
      const margin = 12;
      const gap = 8;
      const triggerBox = trigger.closest('.life-emoji-picker').getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - margin * 2);
      const idealHeight = Math.min(390, window.innerHeight - margin * 2);
      const spaceAbove = triggerBox.top - margin - gap;
      const spaceBelow = window.innerHeight - triggerBox.bottom - margin - gap;
      const opensAbove = spaceAbove > spaceBelow;
      const availableHeight = Math.max(220, opensAbove ? spaceAbove : spaceBelow);
      const height = Math.min(idealHeight, availableHeight);
      const left = Math.min(
        window.innerWidth - width - margin,
        Math.max(margin, triggerBox.right - width)
      );
      const top = opensAbove
        ? Math.max(margin, triggerBox.top - height - gap)
        : Math.min(window.innerHeight - height - margin, triggerBox.bottom + gap);

      Object.assign(picker.style, {
        width: `${width}px`,
        height: `${height}px`,
        left: `${left}px`,
        top: `${top}px`
      });
    }

    async function getEmojiPicker(container) {
      const existing = container.querySelector('.life-emoji-popover');
      if (existing) return existing;

      let loading = container.querySelector('.life-emoji-loading');
      if (!loading) {
        loading = document.createElement('span');
        loading.className = 'life-emoji-loading';
        loading.textContent = '正在载入全部 Emoji…';
        container.appendChild(loading);
      }

      try {
        emojiPickerLoader ||= Promise.all([
          import(EMOJI_PICKER_MODULE),
          import(EMOJI_PICKER_I18N)
        ]);
        const [{ default: Picker }, { default: zhCN }] = await emojiPickerLoader;
        const picker = new Picker({
          locale: 'zh',
          dataSource: EMOJI_DATA_SOURCE,
          i18n: zhCN
        });
        picker.className = 'life-emoji-popover dark';
        picker.setAttribute('popover', 'manual');
        picker.hidden = true;
        picker.addEventListener('emoji-click', event => {
          const input = container.querySelector('input');
          input.value = event.detail.unicode;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          closeEmojiPickers();
          input.focus();
        });
        loading.remove();
        container.appendChild(picker);
        return picker;
      } catch (error) {
        loading.textContent = 'Emoji 面板加载失败，请检查网络后重试';
        emojiPickerLoader = null;
        throw error;
      }
    }

    async function fetchState() {
      const response = await fetch(apiUrl(API_PATH), { cache: 'no-store' });
      if (!response.ok) throw new Error(`读取失败（${response.status}）`);
      state = await response.json();
      state.projects ||= [];
      state.items ||= [];
    }

    async function manage(action, payload = {}) {
      const response = await fetch(apiUrl(ADMIN_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Life-Key': adminKey },
        body: JSON.stringify({ action, ...payload })
      });
      const result = await response.json().catch(() => ({ error: `请求失败（${response.status}）` }));
      if (!response.ok) {
        if (response.status === 401) lockAdmin();
        throw new Error(result.error || '操作失败');
      }
      if (result.state) state = result.state;
      return result;
    }

    function lockAdmin() {
      adminKey = '';
      try { sessionStorage.removeItem(KEY_STORAGE); } catch {}
      renderAdminState();
    }

    function renderAdminState() {
      root.classList.toggle('is-admin', isUnlocked());
      elements.adminToggle.innerHTML = isUnlocked()
        ? '<i class="fas fa-lock-open"></i>'
        : '<i class="fas fa-lock"></i>';
      elements.adminToggle.title = isUnlocked() ? '退出管理模式' : '管理生活日历';
      root.querySelectorAll('.life-admin-only').forEach(element => { element.hidden = !isUnlocked(); });
    }

    function actualItems() {
      return state.items.filter(item => item.status === 'record' || item.status === 'completed');
    }

    function renderCalendar() {
      const [year, month] = displayedMonth.split('-').map(Number);
      const first = new Date(Date.UTC(year, month - 1, 1));
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const leading = (first.getUTCDay() + 6) % 7;
      const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7;
      elements.monthLabel.textContent = `${year} 年 ${month} 月`;
      elements.calendar.innerHTML = '';

      for (let index = 0; index < cellCount; index += 1) {
        if (index < leading || index >= leading + daysInMonth) {
          const blank = document.createElement('div');
          blank.className = 'life-calendar-cell is-blank';
          elements.calendar.appendChild(blank);
          continue;
        }

        const day = index - leading + 1;
        const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const records = actualItems().filter(item => item.actualDate === value);
        const pendingPlans = state.items.filter(item => item.kind === 'plan' && item.status === 'pending' && item.plannedDate === value);
        const grouped = new Map();
        records.forEach(item => grouped.set(item.projectId, (grouped.get(item.projectId) || 0) + item.actualMinutes));
        const emoji = [...grouped.keys()].slice(0, 3).map(id => escapeHTML(projectById(id).emoji));
        const pendingEmoji = [...new Set(pendingPlans.map(item => item.projectId))]
          .filter(id => !grouped.has(id)).slice(0, Math.max(0, 3 - emoji.length))
          .map(id => `<span class="is-plan">${escapeHTML(projectById(id).emoji)}</span>`);
        const total = records.reduce((sum, item) => sum + item.actualMinutes, 0);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'life-calendar-cell';
        if (value === todayString()) button.classList.add('is-today');
        if (value === selectedDate) button.classList.add('is-selected');
        button.dataset.date = value;
        button.innerHTML = `
          <span class="life-cell-day">${day}</span>
          <span class="life-cell-emoji">${emoji.join('')}${pendingEmoji.join('')}</span>
          ${total ? `<span class="life-cell-time">${formatDuration(total)}</span>` : ''}
          ${pendingPlans.length ? `<span class="life-cell-plan-count">${pendingPlans.length} 项计划</span>` : ''}
        `;
        elements.calendar.appendChild(button);
      }
    }

    function actionButtonsForItem(item) {
      if (!isUnlocked()) return '';
      const deleteButton = `<button type="button" data-life-action="delete" data-item-id="${item.id}" title="删除"><i class="fas fa-trash"></i></button>`;
      if (item.status === 'record' || item.status === 'completed') {
        return `<button type="button" data-life-action="edit-record" data-item-id="${item.id}" title="修改"><i class="fas fa-pen"></i></button>${deleteButton}`;
      }
      if (item.status === 'cancelled') {
        return `<button type="button" data-life-action="reopen" data-item-id="${item.id}">恢复</button>${deleteButton}`;
      }
      if (item.status === 'pending' && Date.now() >= Date.parse(item.dueAt)) {
        return `<button type="button" class="is-check" data-life-action="complete" data-item-id="${item.id}"><i class="fas fa-check"></i></button>
          <button type="button" class="is-cross" data-life-action="cancel" data-item-id="${item.id}"><i class="fas fa-times"></i></button>${deleteButton}`;
      }
      if (item.status === 'pending') {
        return `<button type="button" data-life-action="edit-plan" data-item-id="${item.id}" title="修改"><i class="fas fa-pen"></i></button>${deleteButton}`;
      }
      return deleteButton;
    }

    function renderDayDetail() {
      elements.selectedTitle.textContent = formatDay(selectedDate);
      const records = actualItems().filter(item => item.actualDate === selectedDate);
      const plans = state.items.filter(item => item.kind === 'plan' && item.plannedDate === selectedDate);
      const groups = new Map();
      records.forEach(item => {
        if (!groups.has(item.projectId)) groups.set(item.projectId, []);
        groups.get(item.projectId).push(item);
      });

      const recordHTML = [...groups.entries()].map(([projectId, items]) => {
        const project = projectById(projectId);
        const total = items.reduce((sum, item) => sum + item.actualMinutes, 0);
        return `<div class="life-day-group">
          <div class="life-day-group-head">
            <span class="life-day-project"><span>${escapeHTML(project.emoji)}</span>${escapeHTML(project.name)}</span>
            <strong>${formatDuration(total)}</strong>
          </div>
          <div class="life-day-entries">${items.map(item => `
            <div class="life-day-entry">
              <span>${item.note ? escapeHTML(item.note) : '没有备注'}</span>
              <span class="life-day-entry-meta">${item.actualMinutes} 分钟${item.kind === 'plan' ? ` · ${item.completionType === 'late' ? '逾期完成' : '按时完成'}` : ''}</span>
              <span class="life-item-actions">${actionButtonsForItem(item)}</span>
            </div>`).join('')}</div>
        </div>`;
      }).join('');

      const planHTML = plans.length ? `<div class="life-plans-list">
        <h4>计划</h4>
        ${plans.sort((a, b) => a.reminderTime.localeCompare(b.reminderTime)).map(item => {
          const project = projectById(item.projectId);
          const overdue = item.status === 'pending' && Date.now() >= Date.parse(item.dueAt);
          const status = item.status === 'completed' ? (item.completionType === 'late' ? '逾期完成' : '按时完成')
            : item.status === 'cancelled' ? '已放弃' : overdue ? '待处理 · 已到点' : '等待提醒';
          return `<div class="life-plan-row is-${item.status}${overdue ? ' is-overdue' : ''}">
            <span class="life-plan-emoji">${escapeHTML(project.emoji)}</span>
            <span class="life-plan-info"><strong>${escapeHTML(project.name)}</strong>
              <small>${escapeHTML(item.reminderTime)} · 预计 ${item.plannedMinutes} 分钟${item.note ? ` · ${escapeHTML(item.note)}` : ''}</small></span>
            <span class="life-plan-status">${status}</span>
            <span class="life-item-actions">${actionButtonsForItem(item)}</span>
          </div>`;
        }).join('')}</div>` : '';

      elements.dayDetail.innerHTML = recordHTML || planHTML
        ? `${recordHTML}${planHTML}`
        : '<div class="life-empty"><span>○</span><p>这一天还是空白的</p></div>';
    }

    function renderPlanMetrics() {
      const range = weekRange(selectedDate);
      const plans = state.items.filter(item => {
        if (item.kind !== 'plan') return false;
        if (period === 'all') return true;
        if (period === 'month') return item.plannedDate?.startsWith(displayedMonth);
        if (period === 'year') return item.plannedDate?.startsWith(`${displayedMonth.slice(0, 4)}-`);
        return item.plannedDate >= range.start && item.plannedDate <= range.end;
      });
      const counts = {
        onTime: plans.filter(item => item.status === 'completed' && item.completionType === 'on_time').length,
        late: plans.filter(item => item.status === 'completed' && item.completionType === 'late').length,
        cancelled: plans.filter(item => item.status === 'cancelled').length,
        pending: plans.filter(item => item.status === 'pending').length,
        overdue: plans.filter(item => item.status === 'pending' && Date.now() >= Date.parse(item.dueAt)).length
      };
      const titles = { week: '本周计划', month: '本月计划', year: '本年计划', all: '全部计划' };
      elements.planSummaryTitle.textContent = titles[period];
      elements.planMetrics.innerHTML = `
        <div class="life-metric is-good"><strong>${counts.onTime}</strong><span>按时完成</span></div>
        <div class="life-metric is-late"><strong>${counts.late}</strong><span>逾期完成</span></div>
        <div class="life-metric is-cancelled"><strong>${counts.cancelled}</strong><span>已放弃</span></div>
        <div class="life-metric is-pending"><strong>${counts.pending}</strong><span>待处理${counts.overdue ? ` · ${counts.overdue} 项逾期` : ''}</span></div>`;
    }

    function weekRange(value) {
      const date = parseDate(value);
      const offset = (date.getUTCDay() + 6) % 7;
      const start = addDays(value, -offset);
      return { start, end: addDays(start, 6) };
    }

    function periodFilter(item) {
      if (period === 'all') return true;
      if (period === 'month') return item.actualDate?.startsWith(displayedMonth);
      if (period === 'year') return item.actualDate?.startsWith(`${displayedMonth.slice(0, 4)}-`);
      const range = weekRange(selectedDate);
      return item.actualDate >= range.start && item.actualDate <= range.end;
    }

    function renderRanking() {
      const totals = new Map(state.projects.map(project => [project.id, 0]));
      actualItems().filter(periodFilter).forEach(item => {
        totals.set(item.projectId, (totals.get(item.projectId) || 0) + item.actualMinutes);
      });
      const ranking = state.projects.map(project => ({ ...project, minutes: totals.get(project.id) || 0 }))
        .sort((a, b) => b.minutes - a.minutes || a.createdAt.localeCompare(b.createdAt));
      const maximum = Math.max(1, ...ranking.map(item => item.minutes));
      const total = ranking.reduce((sum, item) => sum + item.minutes, 0);
      const labels = {
        month: `${Number(displayedMonth.slice(5))} 月`, year: `${displayedMonth.slice(0, 4)} 年`, all: '全部历史'
      };
      const range = weekRange(selectedDate);
      elements.periodCaption.textContent = period === 'week'
        ? `${range.start.slice(5).replace('-', '.')} — ${range.end.slice(5).replace('-', '.')}`
        : labels[period];
      elements.totalTime.innerHTML = `<strong>${formatDuration(total)}</strong><span>累计投入</span>`;
      elements.ranking.innerHTML = ranking.length ? ranking.map((item, index) => `
        <div class="life-ranking-item" style="--rank-delay:${index * 65}ms;--rank-width:${(item.minutes / maximum) * 100}%">
          <div class="life-ranking-line">
            <span><b>${escapeHTML(item.emoji)}</b>${escapeHTML(item.name)}</span>
            <span class="life-ranking-value"><strong>${formatDuration(item.minutes)}</strong>
              ${isUnlocked() ? `<button type="button" class="life-project-edit" data-project-edit="${item.id}" title="编辑项目" aria-label="编辑项目 ${escapeHTML(item.name)}"><i class="fas fa-pen"></i></button>` : ''}
            </span>
          </div>
          <div class="life-ranking-track"><i></i></div>
        </div>`).join('') : '<div class="life-empty compact"><p>解锁后创建第一个项目吧</p></div>';
    }

    function render() {
      renderAdminState();
      renderCalendar();
      renderDayDetail();
      renderPlanMetrics();
      renderRanking();
    }

    function fillProjectSelect(select, selectedId) {
      select.innerHTML = state.projects.map(project =>
        `<option value="${project.id}"${project.id === selectedId ? ' selected' : ''}>${escapeHTML(project.emoji)} ${escapeHTML(project.name)}</option>`
      ).join('');
    }

    function updateEntryMode() {
      const form = root.querySelector('#life-entry-form');
      if (form.dataset.editing) {
        elements.entryMode.textContent = '正在修改未来计划';
        elements.entryMode.dataset.mode = 'plan';
        return;
      }
      const timestamp = dueTimestamp(form.elements.date.value, form.elements.reminderTime.value);
      const isPlan = timestamp > Date.now();
      elements.entryMode.textContent = isPlan ? '未来时间 · 将创建待办计划' : '过去时间 · 将补录为正式记录';
      elements.entryMode.dataset.mode = isPlan ? 'plan' : 'record';
      root.querySelector('#life-entry-form-title').textContent = isPlan ? '创建计划' : '补录记录';
    }

    function openEntryForm(item = null) {
      if (!state.projects.length) {
        showToast('请先在右侧创建一个项目', 'error');
        return;
      }
      const form = root.querySelector('#life-entry-form');
      form.reset();
      form.dataset.editing = item?.id || '';
      fillProjectSelect(form.elements.projectId, item?.projectId);
      form.elements.date.value = item?.plannedDate || selectedDate;
      form.elements.reminderTime.value = item?.reminderTime || currentTimeString();
      syncTimeParts(form.elements.reminderTime.value);
      form.elements.minutes.value = item?.plannedMinutes || 30;
      form.elements.note.value = item?.note || '';
      updateEntryMode();
      openDialog(dialogs['life-entry-dialog']);
    }

    function openCompleteForm(item) {
      const form = root.querySelector('#life-complete-form');
      form.elements.itemId.value = item.id;
      form.elements.actualDate.value = todayString();
      form.elements.actualDate.max = todayString();
      form.elements.actualMinutes.value = item.plannedMinutes;
      form.elements.note.value = item.note || '';
      openDialog(dialogs['life-complete-dialog']);
    }

    function openEditRecordForm(item) {
      const form = root.querySelector('#life-edit-record-form');
      form.elements.itemId.value = item.id;
      form.elements.actualDate.value = item.actualDate;
      form.elements.actualDate.max = todayString();
      form.elements.actualMinutes.value = item.actualMinutes;
      form.elements.note.value = item.note || '';
      openDialog(dialogs['life-edit-record-dialog']);
    }

    function openEditProjectForm(project) {
      const form = root.querySelector('#life-edit-project-form');
      form.reset();
      form.elements.projectId.value = project.id;
      form.elements.name.value = project.name;
      form.elements.emoji.value = project.emoji;
      const otherProjects = state.projects.filter(entry => entry.id !== project.id);
      root.querySelector('#life-merge-project-list').innerHTML = otherProjects.length
        ? otherProjects.map(entry => `
          <label>
            <input type="checkbox" name="mergeProjectIds" value="${entry.id}">
            <span>${escapeHTML(entry.emoji)} ${escapeHTML(entry.name)}</span>
          </label>`).join('')
        : '<span class="life-merge-empty">还没有其他项目可合并</span>';
      root.querySelector('#life-edit-project-title').textContent = `编辑 ${project.emoji} ${project.name}`;
      root.querySelector('#life-merge-panel').hidden = true;
      root.querySelector('#life-current-project-fields').hidden = false;
      root.querySelector('#life-new-project-fields').hidden = true;
      form.elements.name.required = true;
      form.elements.emoji.required = true;
      form.elements.newName.required = false;
      form.elements.newEmoji.required = false;
      root.querySelector('#life-project-save-button').textContent = '保存修改';
      openDialog(dialogs['life-edit-project-dialog']);
    }

    function selectedMergeProjectIds(form) {
      return [...form.querySelectorAll('input[name="mergeProjectIds"]:checked')].map(input => input.value);
    }

    function updateMergeDestinationFields() {
      const form = root.querySelector('#life-edit-project-form');
      const createsNew = form.elements.destinationType.value === 'new';
      root.querySelector('#life-new-project-fields').hidden = !createsNew;
      form.elements.destinationProjectId.disabled = createsNew;
      form.elements.newName.required = createsNew;
      form.elements.newEmoji.required = createsNew;
    }

    function updateMergePanel() {
      const form = root.querySelector('#life-edit-project-form');
      const current = projectById(form.elements.projectId.value);
      const selectedIds = selectedMergeProjectIds(form);
      const panel = root.querySelector('#life-merge-panel');
      const merging = selectedIds.length > 0;
      panel.hidden = !merging;
      root.querySelector('#life-current-project-fields').hidden = merging;
      form.elements.name.required = !merging;
      form.elements.emoji.required = !merging;
      root.querySelector('#life-project-save-button').textContent = merging
        ? `保存并合并 ${selectedIds.length + 1} 个项目`
        : '保存修改';
      if (!merging) {
        form.elements.newName.required = false;
        form.elements.newEmoji.required = false;
        return;
      }

      const destinations = [current, ...selectedIds.map(projectById)];
      const previousDestination = form.elements.destinationProjectId.value;
      form.elements.destinationProjectId.innerHTML = destinations.map(entry =>
        `<option value="${entry.id}">${escapeHTML(entry.emoji)} ${escapeHTML(entry.name)}</option>`
      ).join('');
      form.elements.destinationProjectId.value = destinations.some(entry => entry.id === previousDestination)
        ? previousDestination
        : current.id;
      updateMergeDestinationFields();
    }

    root.addEventListener('click', async event => {
      if (!event.target.closest('.life-emoji-picker')) closeEmojiPickers();
      const close = event.target.closest('[data-close-dialog]');
      if (close) { closeDialog(close.closest('dialog')); return; }

      const dayButton = event.target.closest('[data-date]');
      if (dayButton) {
        selectedDate = dayButton.dataset.date;
        render();
        return;
      }

      const nav = event.target.closest('[data-calendar-nav]');
      if (nav) {
        const [year, month] = displayedMonth.split('-').map(Number);
        const delta = nav.dataset.calendarNav === 'prev' ? -1 : 1;
        const next = new Date(Date.UTC(year, month - 1 + delta, 1));
        displayedMonth = monthString(next);
        selectedDate = `${displayedMonth}-01`;
        render();
        return;
      }

      const periodButton = event.target.closest('[data-period]');
      if (periodButton) {
        period = periodButton.dataset.period;
        elements.periodTabs.querySelectorAll('button').forEach(button => button.classList.toggle('active', button === periodButton));
        renderRanking();
        renderPlanMetrics();
        return;
      }

      const projectEditButton = event.target.closest('[data-project-edit]');
      if (projectEditButton) {
        openEditProjectForm(projectById(projectEditButton.dataset.projectEdit));
        return;
      }

      const actionButton = event.target.closest('[data-life-action]');
      if (!actionButton) return;
      const item = state.items.find(entry => entry.id === actionButton.dataset.itemId);
      if (!item) return;
      const action = actionButton.dataset.lifeAction;
      try {
        if (action === 'complete') openCompleteForm(item);
        else if (action === 'cancel') {
          const form = root.querySelector('#life-cancel-form');
          form.reset();
          form.elements.itemId.value = item.id;
          openDialog(dialogs['life-cancel-dialog']);
        } else if (action === 'edit-plan') openEntryForm(item);
        else if (action === 'edit-record') openEditRecordForm(item);
        else if (action === 'reopen') {
          await manage('reopenPlan', { itemId: item.id });
          showToast('计划已恢复');
          render();
        } else if (action === 'delete') {
          if (!window.confirm('确定删除这条内容吗？删除后无法恢复。')) return;
          await manage('deleteItem', { itemId: item.id });
          showToast('已删除');
          render();
        }
      } catch (error) { showToast(error.message, 'error'); }
    });

    elements.monthLabel.addEventListener('click', () => {
      selectedDate = todayString();
      displayedMonth = selectedDate.slice(0, 7);
      render();
    });

    elements.adminToggle.addEventListener('click', () => {
      if (isUnlocked()) {
        lockAdmin();
        render();
        showToast('已退出管理模式');
      } else {
        const form = root.querySelector('#life-unlock-form');
        form.reset();
        openDialog(dialogs['life-unlock-dialog']);
        setTimeout(() => form.elements.key.focus(), 50);
      }
    });

    elements.addProject.addEventListener('click', () => {
      root.querySelector('#life-project-form').reset();
      openDialog(dialogs['life-project-dialog']);
    });
    elements.addEntry.addEventListener('click', () => openEntryForm());

    root.querySelector('#life-entry-form').addEventListener('input', event => {
      if (event.target.name === 'date' || event.target.name === 'reminderTime') updateEntryMode();
    });

    const timeEditor = root.querySelector('#life-entry-form .life-time-spinner');
    const reminderTimeInput = timeEditor.querySelector('input[name="reminderTime"]');
    const hourInput = timeEditor.querySelector('input.life-time-part[data-time-part="hour"]');
    const minuteInput = timeEditor.querySelector('input.life-time-part[data-time-part="minute"]');

    function syncTimeParts(value) {
      const [hour, minute] = String(value || currentTimeString()).split(':');
      hourInput.value = String(Number(hour)).padStart(2, '0');
      minuteInput.value = String(Number(minute)).padStart(2, '0');
    }

    function syncReminderTime() {
      const hour = Math.min(23, Math.max(0, Number(hourInput.value.replace(/\D/g, '')) || 0));
      const minute = Math.min(59, Math.max(0, Number(minuteInput.value.replace(/\D/g, '')) || 0));
      reminderTimeInput.value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      reminderTimeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    timeEditor.addEventListener('input', event => {
      if (!event.target.classList.contains('life-time-part')) return;
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 2);
      syncReminderTime();
    });

    timeEditor.addEventListener('change', event => {
      if (!event.target.classList.contains('life-time-part')) return;
      syncReminderTime();
      syncTimeParts(reminderTimeInput.value);
    });

    timeEditor.addEventListener('wheel', event => {
      const part = event.target.closest('.life-time-part');
      if (!part) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      reminderTimeInput.value = shiftTime(
        reminderTimeInput.value || currentTimeString(),
        direction * (part.dataset.timePart === 'hour' ? 60 : 5)
      );
      syncTimeParts(reminderTimeInput.value);
      reminderTimeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }, { passive: false });

    timeEditor.addEventListener('click', event => {
      const stepButton = event.target.closest('.life-time-step');
      if (!stepButton) return;
      const step = Number(stepButton.dataset.timeStep);
      const part = stepButton.dataset.timePart;
      const minutes = step === 1 && part === 'hour' ? 60 : (step === -1 && part === 'hour' ? -60 : (step === 1 ? 5 : -5));
      reminderTimeInput.value = shiftTime(
        reminderTimeInput.value || currentTimeString(),
        minutes
      );
      syncTimeParts(reminderTimeInput.value);
      reminderTimeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    root.querySelector('#life-merge-project-list').addEventListener('change', event => {
      if (event.target.name === 'mergeProjectIds') updateMergePanel();
    });

    root.querySelector('#life-merge-panel').addEventListener('change', event => {
      if (event.target.name === 'destinationType') updateMergeDestinationFields();
    });

    root.addEventListener('click', async event => {
      const trigger = event.target.closest('.life-emoji-trigger');
      if (!trigger) return;
      event.stopPropagation();
      const container = trigger.closest('.life-emoji-picker');
      const wasOpen = container.querySelector('.life-emoji-popover:not([hidden])');
      closeEmojiPickers();
      if (wasOpen) return;
      try {
        const picker = await getEmojiPicker(container);
        closeEmojiPickers(picker);
        positionEmojiPicker(picker, trigger);
        picker.hidden = false;
        if (typeof picker.showPopover === 'function') {
          try { picker.showPopover(); } catch {}
        }
        trigger.setAttribute('aria-expanded', 'true');
      } catch {
        showToast('Emoji 面板加载失败', 'error');
      }
    });

    root.querySelector('#life-edit-project-delete').addEventListener('click', () => {
      const editForm = root.querySelector('#life-edit-project-form');
      const project = projectById(editForm.elements.projectId.value);
      const itemCount = state.items.filter(item => item.projectId === project.id).length;
      const deleteForm = root.querySelector('#life-delete-project-form');
      deleteForm.reset();
      deleteForm.elements.projectId.value = project.id;
      root.querySelector('#life-delete-project-message').textContent =
        `确定删除「${project.emoji} ${project.name}」吗？与它关联的 ${itemCount} 条记录和计划也会消失。`;
      closeDialog(dialogs['life-edit-project-dialog']);
      openDialog(dialogs['life-delete-project-dialog']);
      setTimeout(() => deleteForm.elements.confirmKey.focus(), 50);
    });

    root.querySelector('#life-unlock-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const candidate = form.elements.key.value;
      adminKey = candidate;
      try {
        await manage('authenticate');
        try { sessionStorage.setItem(KEY_STORAGE, candidate); } catch {}
        closeDialog(dialogs['life-unlock-dialog']);
        render();
        showToast('管理模式已解锁');
      } catch (error) {
        adminKey = '';
        showToast(error.message, 'error');
      }
    });

    root.querySelector('#life-project-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await manage('createProject', { name: form.elements.name.value, emoji: form.elements.emoji.value });
        closeDialog(dialogs['life-project-dialog']);
        showToast('项目创建成功');
        render();
      } catch (error) { showToast(error.message, 'error'); }
    });

    root.querySelector('#life-edit-project-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const current = projectById(form.elements.projectId.value);
      const mergeProjectIds = selectedMergeProjectIds(form);
      const destinationType = form.elements.destinationType.value;
      if (mergeProjectIds.length) {
        const selectedProjects = [current, ...mergeProjectIds.map(projectById)];
        const destination = destinationType === 'existing'
          ? projectById(form.elements.destinationProjectId.value)
          : { emoji: form.elements.newEmoji.value.trim(), name: form.elements.newName.value.trim() };
        const projectNames = selectedProjects.map(project => `「${project.name}」`).join('、');
        if (!window.confirm(`确定合并 ${projectNames} 吗？合并后将统一显示为「${destination.emoji} ${destination.name}」，原项目不能单独恢复。`)) return;
      }
      try {
        const result = await manage('updateProject', {
          projectId: current.id,
          mergeProjectIds,
          name: form.elements.name.value,
          emoji: form.elements.emoji.value,
          destinationType,
          destinationProjectId: form.elements.destinationProjectId.value,
          newName: form.elements.newName.value,
          newEmoji: form.elements.newEmoji.value
        });
        closeDialog(dialogs['life-edit-project-dialog']);
        showToast(mergeProjectIds.length
          ? `${mergeProjectIds.length + 1} 个项目已合并，迁移 ${result.mergedItems} 条记录和计划`
          : '项目已修改');
        render();
      } catch (error) { showToast(error.message, 'error'); }
    });

    root.querySelector('#life-entry-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        projectId: form.elements.projectId.value, date: form.elements.date.value,
        reminderTime: form.elements.reminderTime.value, minutes: Number(form.elements.minutes.value),
        note: form.elements.note.value
      };
      try {
        if (form.dataset.editing) await manage('updatePendingPlan', { itemId: form.dataset.editing, ...payload });
        else await manage('createEntry', payload);
        selectedDate = payload.date;
        displayedMonth = payload.date.slice(0, 7);
        closeDialog(dialogs['life-entry-dialog']);
        showToast(dueTimestamp(payload.date, payload.reminderTime) > Date.now() ? '计划已创建' : '记录已添加');
        render();
      } catch (error) { showToast(error.message, 'error'); }
    });

    root.querySelector('#life-complete-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await manage('completePlan', {
          itemId: form.elements.itemId.value, actualDate: form.elements.actualDate.value,
          actualMinutes: Number(form.elements.actualMinutes.value), note: form.elements.note.value
        });
        selectedDate = form.elements.actualDate.value;
        displayedMonth = selectedDate.slice(0, 7);
        closeDialog(dialogs['life-complete-dialog']);
        showToast('完成记录已保存');
        render();
      } catch (error) { showToast(error.message, 'error'); }
    });

    root.querySelector('#life-cancel-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await manage('cancelPlan', { itemId: form.elements.itemId.value, cancelReason: form.elements.cancelReason.value });
        closeDialog(dialogs['life-cancel-dialog']);
        showToast('计划已标记为放弃');
        render();
      } catch (error) { showToast(error.message, 'error'); }
    });

    root.querySelector('#life-edit-record-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        await manage('updateActual', {
          itemId: form.elements.itemId.value, actualDate: form.elements.actualDate.value,
          actualMinutes: Number(form.elements.actualMinutes.value), note: form.elements.note.value
        });
        selectedDate = form.elements.actualDate.value;
        displayedMonth = selectedDate.slice(0, 7);
        closeDialog(dialogs['life-edit-record-dialog']);
        showToast('记录已修改');
        render();
      } catch (error) { showToast(error.message, 'error'); }
    });

    root.querySelector('#life-delete-project-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const result = await manage('deleteProject', {
          projectId: form.elements.projectId.value,
          confirmKey: form.elements.confirmKey.value
        });
        closeDialog(dialogs['life-delete-project-dialog']);
        showToast(`项目已删除，同时移除 ${result.removedItems} 条记录和计划`);
        render();
      } catch (error) {
        showToast(error.message, 'error');
        form.elements.confirmKey.select();
      }
    });

    fetchState().then(async () => {
      if (adminKey) {
        try { await manage('authenticate'); }
        catch { lockAdmin(); }
      }
      elements.loading.hidden = true;
      elements.content.hidden = false;
      render();
    }).catch(error => {
      elements.loading.hidden = true;
      elements.error.hidden = false;
      elements.error.textContent = `${error.message}。请确认 Worker 已部署。`;
    });
  }

  window.BlogApp.register('lifeCalendar', initializeLifeCalendar);
})();
