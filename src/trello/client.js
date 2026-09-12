'use strict';

const { getMockBoard, getMockBoards, setMockCardComplete } = require('./mock');

const API_BASE = 'https://api.trello.com/1';

function useMock() {
  // Default to mock unless explicitly disabled AND credentials are present.
  const flag = String(process.env.USE_MOCK || 'true').toLowerCase();
  if (flag === 'false') {
    return !(process.env.TRELLO_API_KEY && process.env.TRELLO_TOKEN);
  }
  return true;
}

function authParams() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  return `key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
}

async function trelloFetch(pathAndQuery, method = 'GET') {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    throw new Error(
      'Missing Trello credentials. Set TRELLO_API_KEY and TRELLO_TOKEN in .env (and USE_MOCK=false).'
    );
  }

  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const url = `${API_BASE}${pathAndQuery}${sep}${authParams()}`;

  // Abort if the network hangs, so the UI doesn't spin forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    // Surface the REAL reason behind Node's opaque "fetch failed".
    const cause = err && err.cause ? ` (${err.cause.code || err.cause.message || err.cause})` : '';
    if (err && err.name === 'AbortError') {
      throw new Error('Network timeout reaching api.trello.com (check internet/proxy/VPN).');
    }
    throw new Error(
      `Could not reach api.trello.com${cause}. Check your internet connection, proxy, or VPN/firewall.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch (_e) {
      /* ignore */
    }
    if (res.status === 401) {
      throw new Error('Trello 401 Unauthorized — your API key or token is invalid/expired.');
    }
    if (res.status === 403) {
      throw new Error("Trello 403 — can't save. Your token may be read-only; regenerate it with write access.");
    }
    if (res.status === 429) {
      throw new Error('Trello 429 — rate limited. Wait a moment and refresh again.');
    }
    throw new Error(`Trello API ${res.status}: ${res.statusText}${detail ? ' — ' + detail : ''}`);
  }
  return res.json();
}

/**
 * List the boards the authenticated user can see.
 * Returns [{ id, name }].
 */
async function getBoards() {
  if (useMock()) return getMockBoards();
  const boards = await trelloFetch('/members/me/boards?fields=name');
  return boards.map((b) => ({ id: b.id, name: b.name }));
}

/**
 * Fetch a board with its lists (columns) and cards, normalized to:
 * { id, name, lists: [{id,name}], cards: [{id,name,idList,due,dueComplete,labels}] }
 */
async function getBoardData(boardId) {
  if (useMock()) return getMockBoard();

  let id = boardId || process.env.TRELLO_BOARD_ID;

  // If no board was specified, fall back to the first board the user has.
  if (!id) {
    const boards = await getBoards();
    if (!boards.length) {
      throw new Error('No boards found for this Trello account.');
    }
    id = boards[0].id;
  }

  const [board, lists, cards] = await Promise.all([
    trelloFetch(`/boards/${id}?fields=name`),
    trelloFetch(`/boards/${id}/lists?fields=name`),
    trelloFetch(`/boards/${id}/cards?fields=name,idList,due,dueComplete,labels`),
  ]);

  return {
    id: board.id,
    name: board.name,
    lists: lists.map((l) => ({ id: l.id, name: l.name })),
    cards: cards.map((c) => ({
      id: c.id,
      name: c.name,
      idList: c.idList,
      due: c.due || null,
      dueComplete: Boolean(c.dueComplete),
      labels: Array.isArray(c.labels)
        ? c.labels.map((lb) => ({ name: lb.name, color: lb.color }))
        : [],
    })),
  };
}

/**
 * Mark a card complete/incomplete (Trello's `dueComplete` flag).
 * In mock mode, mutates the in-memory board so it's testable offline.
 * Returns { id, dueComplete }.
 */
async function setCardComplete(cardId, value) {
  if (!cardId) throw new Error('setCardComplete: missing cardId');
  const complete = Boolean(value);

  if (useMock()) {
    return setMockCardComplete(cardId, complete);
  }

  const res = await trelloFetch(
    `/cards/${cardId}?dueComplete=${complete ? 'true' : 'false'}`,
    'PUT'
  );
  return { id: res.id, dueComplete: Boolean(res.dueComplete) };
}

module.exports = { getBoards, getBoardData, setCardComplete, useMock };
