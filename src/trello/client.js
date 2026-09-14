'use strict';

const {
  getMockBoard,
  getMockBoards,
  setMockCardComplete,
  updateMockCard,
  createMockCard,
  getMockChecklists,
  setMockCheckItemState,
  renameMockCheckItem,
  addMockCheckItem,
  deleteMockCheckItem,
} = require('./mock');

const API_BASE = 'https://api.trello.com/1';

// Runtime credentials. Populated by the main process from stored settings
// (Settings panel) or .env — so both `npm start` and the packaged app work.
let creds = {
  apiKey: '',
  token: '',
  boardId: '',
  forceMock: false, // set true when USE_MOCK=true in dev
};

function setCredentials({ apiKey, token, boardId, forceMock } = {}) {
  creds = {
    apiKey: apiKey || '',
    token: token || '',
    boardId: boardId || '',
    forceMock: Boolean(forceMock),
  };
}

function getCredentials() {
  return { ...creds };
}

function hasCredentials() {
  return Boolean(creds.apiKey && creds.token);
}

function useMock() {
  // Use mock if explicitly forced, or if we simply don't have credentials.
  if (creds.forceMock) return true;
  return !hasCredentials();
}

function authParams() {
  return `key=${encodeURIComponent(creds.apiKey)}&token=${encodeURIComponent(creds.token)}`;
}

async function trelloFetch(pathAndQuery, method = 'GET') {
  if (!hasCredentials()) {
    throw new Error(
      'Missing Trello credentials. Open Settings (⚙) and enter your API key and token.'
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

  let id = boardId || creds.boardId;

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
    trelloFetch(`/boards/${id}/cards?fields=name,idList,due,dueComplete,desc,labels`),
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
      desc: c.desc || '',
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

// Build a query string from field params (only include provided fields).
function encodeParams(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * Edit a card's title/description/due date.
 * fields: { name?, desc?, due? }  (due: ISO string or '' to clear)
 * Returns the normalized updated card.
 */
async function updateCard(cardId, fields = {}) {
  if (!cardId) throw new Error('updateCard: missing cardId');

  const params = {};
  if (fields.name != null) params.name = fields.name;
  if (fields.desc != null) params.desc = fields.desc;
  if (fields.due !== undefined) params.due = fields.due || ''; // '' clears the due date

  if (useMock()) {
    return updateMockCard(cardId, fields);
  }

  const qs = encodeParams(params);
  const res = await trelloFetch(`/cards/${cardId}?${qs}`, 'PUT');
  return {
    id: res.id,
    name: res.name,
    idList: res.idList,
    due: res.due || null,
    dueComplete: Boolean(res.dueComplete),
    desc: res.desc || '',
  };
}

/**
 * Create a new card in a list.
 * fields: { name, idList, desc?, due? }
 * Returns the normalized new card.
 */
async function createCard(fields = {}) {
  if (!fields.idList) throw new Error('createCard: idList (column) is required');
  if (!fields.name) throw new Error('createCard: name is required');

  if (useMock()) {
    return createMockCard(fields);
  }

  const params = { name: fields.name, idList: fields.idList };
  if (fields.desc) params.desc = fields.desc;
  if (fields.due) params.due = fields.due;

  const qs = encodeParams(params);
  const res = await trelloFetch(`/cards?${qs}`, 'POST');
  return {
    id: res.id,
    name: res.name,
    idList: res.idList,
    due: res.due || null,
    dueComplete: Boolean(res.dueComplete),
    desc: res.desc || '',
    labels: [],
  };
}

// ---- Checklists ----

/**
 * Get all checklists (with items) for a card, normalized to:
 * [{ id, name, items: [{ id, name, complete }] }]
 */
async function getChecklists(cardId) {
  if (!cardId) throw new Error('getChecklists: missing cardId');

  if (useMock()) {
    return getMockChecklists(cardId).map((cl) => ({
      id: cl.id,
      name: cl.name,
      items: cl.checkItems.map((i) => ({
        id: i.id,
        name: i.name,
        complete: i.state === 'complete',
      })),
    }));
  }

  const lists = await trelloFetch(
    `/cards/${cardId}/checklists?fields=name&checkItem_fields=name,state`
  );
  return (lists || []).map((cl) => ({
    id: cl.id,
    name: cl.name,
    items: (cl.checkItems || []).map((i) => ({
      id: i.id,
      name: i.name,
      complete: i.state === 'complete',
    })),
  }));
}

/** Toggle a check item's complete state. */
async function setCheckItemState(cardId, itemId, complete) {
  const state = complete ? 'complete' : 'incomplete';
  if (useMock()) {
    const it = setMockCheckItemState(cardId, itemId, state);
    return { id: it.id, name: it.name, complete: it.state === 'complete' };
  }
  const res = await trelloFetch(`/cards/${cardId}/checkItem/${itemId}?state=${state}`, 'PUT');
  return { id: res.id, name: res.name, complete: res.state === 'complete' };
}

/** Rename a check item. */
async function renameCheckItem(cardId, itemId, name) {
  if (useMock()) {
    const it = renameMockCheckItem(cardId, itemId, name);
    return { id: it.id, name: it.name, complete: it.state === 'complete' };
  }
  const res = await trelloFetch(
    `/cards/${cardId}/checkItem/${itemId}?name=${encodeURIComponent(name)}`,
    'PUT'
  );
  return { id: res.id, name: res.name, complete: res.state === 'complete' };
}

/** Add a new check item to a checklist. */
async function addCheckItem(cardId, checklistId, name) {
  if (!name) throw new Error('addCheckItem: name required');
  if (useMock()) {
    const it = addMockCheckItem(cardId, checklistId, name);
    return { id: it.id, name: it.name, complete: it.state === 'complete' };
  }
  const res = await trelloFetch(
    `/checklists/${checklistId}/checkItems?name=${encodeURIComponent(name)}`,
    'POST'
  );
  return { id: res.id, name: res.name, complete: res.state === 'complete' };
}

/** Delete a check item. */
async function deleteCheckItem(cardId, checklistId, itemId) {
  if (useMock()) {
    return deleteMockCheckItem(cardId, checklistId, itemId);
  }
  await trelloFetch(`/checklists/${checklistId}/checkItems/${itemId}`, 'DELETE');
  return { id: itemId, deleted: true };
}

/**
 * Test the given (or current) credentials against Trello.
 * Returns { ok, member, canWrite } or throws with a descriptive error.
 */
async function testConnection(apiKey, token) {
  const useKey = apiKey || creds.apiKey;
  const useToken = token || creds.token;
  if (!useKey || !useToken) {
    throw new Error('Enter both an API key and a token first.');
  }
  const url = `${API_BASE}/members/me?fields=fullName,username&key=${encodeURIComponent(
    useKey
  )}&token=${encodeURIComponent(useToken)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    const cause = err && err.cause ? ` (${err.cause.code || err.cause.message || err.cause})` : '';
    throw new Error(`Could not reach api.trello.com${cause}.`);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) throw new Error('Invalid API key or token (401).');
  if (!res.ok) throw new Error(`Trello API ${res.status}: ${res.statusText}`);
  const member = await res.json();
  return { ok: true, member: { fullName: member.fullName, username: member.username } };
}

module.exports = {
  getBoards,
  getBoardData,
  setCardComplete,
  updateCard,
  createCard,
  getChecklists,
  setCheckItemState,
  renameCheckItem,
  addCheckItem,
  deleteCheckItem,
  testConnection,
  setCredentials,
  getCredentials,
  hasCredentials,
  useMock,
};
