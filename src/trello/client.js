'use strict';

const { getMockBoard, getMockBoards } = require('./mock');

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

async function trelloFetch(pathAndQuery) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const url = `${API_BASE}${pathAndQuery}${sep}${authParams()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Trello API ${res.status}: ${res.statusText}`);
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

  const id = boardId || process.env.TRELLO_BOARD_ID;
  if (!id) {
    throw new Error('No board selected. Set TRELLO_BOARD_ID or pass a board id.');
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

module.exports = { getBoards, getBoardData, useMock };
