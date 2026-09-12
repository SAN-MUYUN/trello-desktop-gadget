'use strict';

// ---- State ----
let currentBoard = null;
let currentStats = null;
let selectedColumn = '__all__';
let selectedChart = 'cardsPerList';
let chartInstance = null;

// ---- Elements ----
const el = (id) => document.getElementById(id);
const boardTitle = el('boardTitle');
const status = el('status');
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
      c.className = 'card';

      const name = document.createElement('div');
      name.textContent = card.name;
      c.appendChild(name);

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

function renderChart() {
  if (!currentStats) return;

  if (!hasChart) {
    // Graceful fallback if Chart.js isn't installed yet.
    chartCanvas.hidden = true;
    chartFallback.hidden = false;
    chartFallback.textContent =
      'Chart.js not loaded. Run "npm install" to enable charts. Showing raw numbers in the summary above.';
    return;
  }

  chartCanvas.hidden = false;
  chartFallback.hidden = true;

  const cfg = chartConfig();
  cfg.options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#e6e6ea', font: { size: 10 } } } },
    scales:
      cfg.type === 'bar'
        ? {
            x: { ticks: { color: '#b9b9c0', font: { size: 9 } }, grid: { display: false } },
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
  try {
    const payload = await window.gadget.getBoard();
    applyData(payload);
  } catch (err) {
    status.textContent = 'Error: ' + (err && err.message ? err.message : err);
  }

  window.gadget.onBoardUpdate((payload) => applyData(payload));
  window.gadget.onBoardError((msg) => {
    status.textContent = 'Error: ' + msg;
  });
}

init();
