'use strict';

const fs = require('fs');
const path = require('path');

// Records per-column card counts bucketed by time, so the app can show how
// each column changes over regular intervals (a lightweight cumulative flow).
//
// Snapshot shape: { t: <ISO timestamp>, bucket: <bucketKey>, counts: { "<listName>": <n> } }
//
// Bucketing guarantees a REGULAR cadence: at most one point per bucket
// (per day by default). Refreshing many times within the same day just
// updates that day's point to the latest counts — it never adds extra points.
// Days when the app never ran are simply absent (a desktop app can't record
// while closed), and the line spans across the gap.

const MAX_ENTRIES_PER_BOARD = 730; // ~2 years of daily points

// Granularity: 'day' (default) or 'hour'. Configurable via HISTORY_BUCKET.
function bucketGranularity() {
  const v = String(process.env.HISTORY_BUCKET || 'day').toLowerCase();
  return v === 'hour' ? 'hour' : 'day';
}

// Compute a stable bucket key for a given time.
//   day  -> "2026-09-12"
//   hour -> "2026-09-12T14"
function bucketKeyFor(date, granularity) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (granularity === 'hour') {
    const h = String(d.getHours()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}`;
  }
  return `${y}-${m}-${day}`;
}

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
 * Record a snapshot for a board. Keeps at most one entry per time bucket:
 * within the same bucket the entry is overwritten with the latest counts,
 * which is what produces a clean, regularly-spaced series.
 */
function record(board, stats) {
  if (!board || !board.id || !stats) return;

  const counts = {};
  for (const item of stats.cardsPerList || []) {
    counts[item.listName] = item.count;
  }

  const granularity = bucketGranularity();
  const now = new Date();
  const bucket = bucketKeyFor(now, granularity);

  const all = readAll();
  const key = board.id;
  const list = all[key] || [];

  const entry = { t: now.toISOString(), bucket, counts };
  const last = list[list.length - 1];

  if (last && last.bucket === bucket) {
    // Same bucket (e.g. same day) -> update it to the latest counts.
    list[list.length - 1] = entry;
  } else {
    list.push(entry);
  }

  if (list.length > MAX_ENTRIES_PER_BOARD) {
    list.splice(0, list.length - MAX_ENTRIES_PER_BOARD);
  }

  all[key] = list;
  writeAll(all);
}

/**
 * Return the recorded history for a board as:
 * { granularity, times: [ISO...], series: [{ name, data: [n...] }] }
 */
function getSeries(boardId) {
  const all = readAll();
  const list = (boardId && all[boardId]) || [];
  const granularity = bucketGranularity();
  if (!list.length) return { granularity, times: [], series: [] };

  const times = list.map((e) => e.t);

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

  return { granularity, times, series };
}

/**
 * Seed a board with synthetic history if it has none yet (mock mode only),
 * so the "over time" chart is demonstrable immediately. Generates one point
 * per bucket going back N buckets, with cards flowing toward Done over time.
 */
function seedIfEmpty(board, stats) {
  if (!board || !board.id || !stats) return;
  const all = readAll();
  if (all[board.id] && all[board.id].length > 1) return; // already has history

  const granularity = bucketGranularity();
  const stepMs = granularity === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const POINTS = granularity === 'hour' ? 12 : 14; // 12 hours or 14 days

  const names = (stats.cardsPerList || []).map((x) => x.listName);
  const finalCounts = {};
  for (const x of stats.cardsPerList || []) finalCounts[x.listName] = x.count;

  const now = Date.now();
  const list = [];
  for (let i = 0; i < POINTS; i++) {
    const frac = i / (POINTS - 1); // 0 -> 1
    const counts = {};
    names.forEach((name, idx) => {
      const target = finalCounts[name] || 0;
      const isLate = idx >= names.length / 2;
      let val;
      if (isLate) {
        val = Math.round(target * frac); // later lists fill up
      } else {
        val = Math.round(target + target * 0.8 * (1 - frac)); // early lists drain
      }
      counts[name] = Math.max(val, 0);
    });
    const when = new Date(now - (POINTS - 1 - i) * stepMs);
    list.push({ t: when.toISOString(), bucket: bucketKeyFor(when, granularity), counts });
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
