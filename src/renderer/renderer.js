'use strict';

// ---- State ----
let currentBoard = null;
let currentStats = null;
let selectedColumn = '__all__';
let selectedChart = 'cardsPerList';
let selectedBoardId = ''; // '' = let the app pick your first board
let boardsLoaded = false;

// A palette for the over-time multi-line chart (one color per column).
const SERIES_COLORS = [
  '#a78bfa', '#4fdda3', '#5aa9e6', '#ffb454', '#ff6b81',
  '#e6c84f', '#7ee787', '#f78fb3', '#63c5da', '#c792ea',
];
let chartInstance = null;

// ---- Elements ----
const el = (id) => document.getElementById(id);
const boardTitle = el('boardTitle');
const status = el('status');
const boardSelect = el('boardSelect');
const columnSelect = el('columnSelect');
const columnsEl = el('columns');
const chartSelect = el('chartSelect');
const summaryEl = el('summary');
const chartCanvas = el('chart');
const chartFallback = el('chartFallback');

const hasChart = typeof window.Chart !== 'undefined';

// ---- View switching ----
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const view = tab.dataset.view;
    el('viewGadget').classList.toggle('active', view === 'gadget');
    el('viewStats').classList.toggle('active', view === 'stats');
    if (view === 'stats') renderChart();
  });
});

// ---- Window controls ----
let pinned = true;
el('pinBtn').classList.add('pinned');
el('pinBtn').addEventListener('click', async () => {
  pinned = !pinned;
  await window.gadget.setAlwaysOnTop(pinned);
  el('pinBtn').classList.toggle('pinned', pinned);
});
el('minBtn').addEventListener('click', () => window.gadget.minimize());
el('closeBtn').addEventListener('click', () => window.gadget.close());

// ---- Manual refresh ----
const refreshBtn = el('refreshBtn');
let refreshing = false;

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  refreshBtn.classList.add('spinning');
  refreshBtn.disabled = true;
  status.textContent = 'Refreshing…';
  try {
    // Load the list of boards once (for the picker).
    if (!boardsLoaded) {
      await loadBoards();
    }
    const payload = await window.gadget.getBoard(selectedBoardId || undefined);
    applyData(payload);
    // Sync picker to whatever board actually loaded.
    if (payload.board && payload.board.id) {
      selectedBoardId = payload.board.id;
      if (boardSelect.querySelector(`option[value="${payload.board.id}"]`)) {
        boardSelect.value = payload.board.id;
      }
    }
  } catch (err) {
    status.textContent = 'Error: ' + (err && err.message ? err.message : err);
  } finally {
    refreshing = false;
    refreshBtn.classList.remove('spinning');
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', refresh);

// ---- Board picker ----
async function loadBoards() {
  try {
    const boards = await window.gadget.listBoards();
    boardSelect.innerHTML = '';
    if (!boards || !boards.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No boards';
      boardSelect.appendChild(opt);
    } else {
      for (const b of boards) {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        boardSelect.appendChild(opt);
      }
    }
    boardsLoaded = true;
  } catch (err) {
    // Non-fatal: the board itself may still load via fallback.
    boardSelect.innerHTML = '<option value="">(couldn\'t list boards)</option>';
  }
}

boardSelect.addEventListener('change', (e) => {
  selectedBoardId = e.target.value;
  refresh();
});

// ---- Selectors ----
columnSelect.addEventListener('change', (e) => {
  selectedColumn = e.target.value;
  renderColumns();
});
chartSelect.addEventListener('change', (e) => {
  selectedChart = e.target.value;
  renderChart();
});

// ---- Data application ----
function applyData(payload) {
  if (!payload) return;
  currentBoard = payload.board;
  currentStats = payload.stats;
  boardTitle.textContent = currentBoard.name || 'Trello Gadget';
  populateColumnSelect();
  renderColumns();
  renderSummary();
  if (el('viewStats').classList.contains('active')) renderChart();
  status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

function populateColumnSelect() {
  const existing = selectedColumn;
  columnSelect.innerHTML = '<option value="__all__">All columns</option>';
  for (const list of currentBoard.lists) {
    const opt = document.createElement('option');
    opt.value = list.id;
    opt.textContent = list.name;
    columnSelect.appendChild(opt);
  }
  // Preserve selection if still valid.
  const stillValid =
    existing === '__all__' || currentBoard.lists.some((l) => l.id === existing);
  selectedColumn = stillValid ? existing : '__all__';
  columnSelect.value = selectedColumn;
}

// ---- Gadget view rendering ----
function renderColumns() {
  if (!currentBoard) return;
  columnsEl.innerHTML = '';

  const lists =
    selectedColumn === '__all__'
      ? currentBoard.lists
      : currentBoard.lists.filter((l) => l.id === selectedColumn);

  const now = Date.now();

  for (const list of lists) {
    const cards = currentBoard.cards.filter((c) => c.idList === list.id);
    const col = document.createElement('div');
    col.className = 'column';

    const h = document.createElement('h3');
    h.innerHTML = `<span>${escapeHtml(list.name)}</span><span class="count">${cards.length}</span>`;
    col.appendChild(h);

    if (cards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No cards';
      col.appendChild(empty);
    }

    for (const card of cards) {
      const c = document.createElement('div');
      c.className = 'card' + (card.dueComplete ? ' completed' : '');

      // Header row: complete-toggle + card name.
      const head = document.createElement('div');
      head.className = 'card-head';

      const toggle = document.createElement('button');
      toggle.className = 'complete-toggle' + (card.dueComplete ? ' on' : '');
      toggle.type = 'button';
      toggle.title = card.dueComplete ? 'Mark incomplete' : 'Mark complete';
      toggle.setAttribute('aria-label', toggle.title);
      toggle.textContent = card.dueComplete ? '✓' : '';
      toggle.addEventListener('click', () => onToggleComplete(card, c, toggle));
      head.appendChild(toggle);

      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = card.name;
      head.appendChild(name);

      c.appendChild(head);

      const meta = document.createElement('div');
      meta.className = 'meta';

      if (card.dueComplete) {
        meta.appendChild(badge('done', 'Done'));
      } else if (card.due && new Date(card.due).getTime() < now) {
        meta.appendChild(badge('overdue', 'Overdue'));
      } else if (card.due) {
        meta.appendChild(badge('', `Due ${new Date(card.due).toLocaleDateString()}`));
      }

      for (const label of card.labels || []) {
        if (!label.name) continue;
        meta.appendChild(badge('', label.name));
      }

      if (meta.childNodes.length) c.appendChild(meta);
      col.appendChild(c);
    }

    columnsEl.appendChild(col);
  }
}

function badge(kind, text) {
  const b = document.createElement('span');
  b.className = 'badge' + (kind ? ' ' + kind : '');
  b.textContent = text;
  return b;
}

// Toggle a card's complete state with an optimistic UI update.
async function onToggleComplete(card, cardEl, toggleEl) {
  if (toggleEl.disabled) return;
  const previous = card.dueComplete;
  const next = !previous;

  // Optimistic: update local model + UI immediately.
  card.dueComplete = next;
  toggleEl.disabled = true;
  toggleEl.classList.toggle('on', next);
  toggleEl.textContent = next ? '✓' : '';
  cardEl.classList.toggle('completed', next);
  status.textContent = 'Saving…';

  try {
    await window.gadget.setCardComplete(card.id, next);
    // Recompute stats/badges from the mutated model without a full re-fetch.
    recomputeStatsFromBoard();
    renderColumns();
    renderSummary();
    if (el('viewStats').classList.contains('active')) renderChart();
    status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    // Roll back on failure.
    card.dueComplete = previous;
    toggleEl.classList.toggle('on', previous);
    toggleEl.textContent = previous ? '✓' : '';
    cardEl.classList.toggle('completed', previous);
    status.textContent = 'Error: ' + (err && err.message ? err.message : err);
  } finally {
    toggleEl.disabled = false;
  }
}

// Recompute the "Done"/"Overdue"/totals locally after an edit, so the
// summary + status chart stay in sync without a network round-trip.
function recomputeStatsFromBoard() {
  if (!currentBoard || !currentStats) return;
  const now = Date.now();
  let completed = 0;
  let overdue = 0;
  for (const c of currentBoard.cards) {
    if (c.dueComplete) completed += 1;
    else if (c.due && new Date(c.due).getTime() < now) overdue += 1;
  }
  currentStats.completed = completed;
  currentStats.overdue = overdue;
}

// ---- Stats rendering ----
function renderSummary() {
  if (!currentStats) return;
  const s = currentStats;
  summaryEl.innerHTML = '';
  const items = [
    { num: s.totalCards, cap: 'Cards' },
    { num: s.completed, cap: 'Done' },
    { num: s.overdue, cap: 'Overdue' },
  ];
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'stat';
    d.innerHTML = `<div class="num">${it.num}</div><div class="cap">${it.cap}</div>`;
    summaryEl.appendChild(d);
  }
}

function chartConfig() {
  const s = currentStats;
  if (selectedChart === 'cardsPerList') {
    return {
      type: 'bar',
      data: {
        labels: s.cardsPerList.map((x) => x.listName),
        datasets: [{ label: 'Cards', data: s.cardsPerList.map((x) => x.count) }],
      },
    };
  }
  if (selectedChart === 'statusBreakdown') {
    const active = s.totalCards - s.completed - s.overdue;
    return {
      type: 'doughnut',
      data: {
        labels: ['Done', 'Overdue', 'Active'],
        datasets: [{ data: [s.completed, s.overdue, Math.max(active, 0)] }],
      },
    };
  }
  // labels
  return {
    type: 'bar',
    data: {
      labels: s.labelCounts.map((x) => x.label),
      datasets: [{ label: 'Cards', data: s.labelCounts.map((x) => x.count) }],
    },
  };
}

// Build the "cards per column over time" line chart from recorded history.
async function buildOverTimeConfig() {
  const boardId = (currentBoard && currentBoard.id) || selectedBoardId;
  const hist = await window.gadget.getHistory(boardId);

  if (!hist || !hist.times || hist.times.length === 0) {
    return null; // no history yet
  }

  const labels = hist.times.map((t) => {
    const d = new Date(t);
    // Daily buckets -> date only; hourly -> date + hour.
    return hist.granularity === 'hour'
      ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  });

  const datasets = hist.series.map((s, i) => {
    const color = SERIES_COLORS[i % SERIES_COLORS.length];
    return {
      label: s.name,
      data: s.data,
      borderColor: color,
      backgroundColor: color,
      tension: 0.25,
      spanGaps: true,
      pointRadius: 2,
      borderWidth: 2,
    };
  });

  return { type: 'line', data: { labels, datasets }, __isTime: true };
}

async function renderChart() {
  if (!currentStats) return;

  if (!hasChart) {
    // Graceful fallback if Chart.js isn't installed yet.
    chartCanvas.hidden = true;
    chartFallback.hidden = false;
    chartFallback.textContent =
      'Chart.js not loaded. Run "npm install" to enable charts. Showing raw numbers in the summary above.';
    return;
  }

  let cfg;
  if (selectedChart === 'overTime') {
    cfg = await buildOverTimeConfig();
    if (!cfg) {
      // Not enough history recorded yet.
      chartCanvas.hidden = true;
      chartFallback.hidden = false;
      chartFallback.textContent =
        'No history yet. This chart fills in as you refresh over time — each refresh records a snapshot of the card counts per column.';
      return;
    }
  } else {
    cfg = chartConfig();
  }

  chartCanvas.hidden = false;
  chartFallback.hidden = true;

  const usesAxes = cfg.type === 'bar' || cfg.type === 'line';
  cfg.options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: cfg.__isTime ? { mode: 'index', intersect: false } : undefined,
    plugins: {
      legend: {
        display: cfg.type !== 'bar', // bar charts have a single series
        labels: { color: '#e6e6ea', font: { size: 10 }, boxWidth: 12 },
        position: cfg.__isTime ? 'bottom' : 'top',
      },
    },
    scales: usesAxes
      ? {
          x: { ticks: { color: '#b9b9c0', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 5 }, grid: { display: false } },
          y: { ticks: { color: '#b9b9c0', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.08)' }, beginAtZero: true },
        }
      : {},
  };

  if (chartInstance) chartInstance.destroy();
  chartInstance = new window.Chart(chartCanvas.getContext('2d'), cfg);
}

// ---- Utils ----
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

// ---- Bootstrap ----
async function init() {
  // Initial load so the window isn't empty on open.
  await refresh();

  // If auto-polling is enabled in .env, the main process will push updates.
  window.gadget.onBoardUpdate((payload) => applyData(payload));
  window.gadget.onBoardError((msg) => {
    status.textContent = 'Error: ' + msg;
  });
}

init();
