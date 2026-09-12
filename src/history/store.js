'use strict';

const fs = require('fs');
const path = require('path');

// Records timestamped snapshots of per-column card counts so the app can
// show how each column changes over time (a lightweight cumulative flow).
//
// Snapshot shape: { t: <ISO timestamp>, boardId: <id>, counts: { "<listName>": <n> } }

const MAX_ENTRIES_PER_BOARD = 500; // cap file growth
const MIN_GAP_MS = 30 * 1000; // don't record snapshots closer than 30s apart

let historyFilePath = null;

function init(userDataDir) {
  historyFilePath = path.join(userDataDir, 'card-history.json');
}

function readAll() {
  if (!historyFilePath) return {};
  try {
    if (!fs.existsSync(historyFilePath)) return {};
    const raw = fs.readFileSync(historyFilePath, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (_e) {
    return {};
  }
}

function writeAll(data) {
  if (!historyFilePath) return;
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(data), 'utf8');
  } catch (_e) {
    /* best-effort; history is non-critical */
  }
}

/**
 * Append a snapshot for a board from a normalized board + computed stats.
 * De-duplicates rapid successive calls and caps history length.
 */
function record(board, stats) {
  if (!board || !board.id || !stats) return;

  const counts = {};
  for (const item of stats.cardsPerList || []) {
    counts[item.listName] = item.count;
  }

  const all = readAll();
  const key = board.id;
  const list = all[key] || [];

  const nowMs = Date.now();
  const last = list[list.length - 1];
  if (last && nowMs - new Date(last.t).getTime() < MIN_GAP_MS) {
    // Too soon since the last snapshot — overwrite it instead of stacking.
    list[list.length - 1] = { t: new Date(nowMs).toISOString(), boardId: key, counts };
  } else {
    list.push({ t: new Date(nowMs).toISOString(), boardId: key, counts });
  }

  // Cap length (keep most recent).
  if (list.length > MAX_ENTRIES_PER_BOARD) {
    list.splice(0, list.length - MAX_ENTRIES_PER_BOARD);
  }

  all[key] = list;
  writeAll(all);
}

/**
 * Return the recorded history for a board as:
 * { times: [ISO...], series: [{ name, data: [n...] }] }
 * Columns that appear at any point are represented across all timestamps
 * (missing points filled with null so lines connect sensibly).
 */
function getSeries(boardId) {
  const all = readAll();
  const list = (boardId && all[boardId]) || [];
  if (!list.length) return { times: [], series: [] };

  const times = list.map((e) => e.t);

  // Union of all column names seen, preserving first-seen order.
  const names = [];
  for (const entry of list) {
    for (const name of Object.keys(entry.counts || {})) {
      if (!names.includes(name)) names.push(name);
    }
  }

  const series = names.map((name) => ({
    name,
    data: list.map((entry) =>
      entry.counts && Object.prototype.hasOwnProperty.call(entry.counts, name)
        ? entry.counts[name]
        : null
    ),
  }));

  return { times, series };
}

/**
 * Seed a board with synthetic history if it has none yet. Used in mock mode
 * so the "over time" chart is demonstrable immediately. Generates a gentle
 * trend: cards flow from Backlog/To Do toward Done over the last N points.
 */
function seedIfEmpty(board, stats) {
  if (!board || !board.id || !stats) return;
  const all = readAll();
  if (all[board.id] && all[board.id].length > 1) return; // already has history

  const names = (stats.cardsPerList || []).map((x) => x.listName);
  const finalCounts = {};
  for (const x of stats.cardsPerList || []) finalCounts[x.listName] = x.count;

  const POINTS = 8;
  const now = Date.now();
  const list = [];
  for (let i = 0; i < POINTS; i++) {
    const frac = i / (POINTS - 1); // 0 -> 1
    const counts = {};
    names.forEach((name, idx) => {
      const target = finalCounts[name] || 0;
      // Earlier lists start higher and drain; later lists (e.g. Done) fill up.
      const isLate = idx >= names.length / 2;
      let val;
      if (isLate) {
        val = Math.round(target * frac);
      } else {
        val = Math.round(target + (target * 0.8) * (1 - frac));
      }
      counts[name] = Math.max(val, 0);
    });
    const t = new Date(now - (POINTS - 1 - i) * 60 * 60 * 1000).toISOString(); // hourly back
    list.push({ t, boardId: board.id, counts });
  }
  all[board.id] = list;
  writeAll(all);
}

function clear(boardId) {
  const all = readAll();
  if (boardId) {
    delete all[boardId];
  } else {
    for (const k of Object.keys(all)) delete all[k];
  }
  writeAll(all);
}

module.exports = { init, record, getSeries, seedIfEmpty, clear };
