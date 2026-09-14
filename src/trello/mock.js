'use strict';

// Deterministic-ish mock data shaped like normalized Trello output.
// Lets the whole UI run before any real API credentials exist.

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const MOCK_BOARDS = [
  { id: 'mock-board-1', name: 'Product Roadmap (Mock)' },
  { id: 'mock-board-2', name: 'Personal Tasks (Mock)' },
];

const MOCK_BOARD = {
  id: 'mock-board-1',
  name: 'Product Roadmap (Mock)',
  lists: [
    { id: 'list-backlog', name: 'Backlog' },
    { id: 'list-todo', name: 'To Do' },
    { id: 'list-doing', name: 'In Progress' },
    { id: 'list-review', name: 'Review' },
    { id: 'list-done', name: 'Done' },
  ],
  cards: [
    { id: 'c1', name: 'Research translucency APIs', idList: 'list-done', due: daysFromNow(-3), dueComplete: true, labels: [{ name: 'research', color: 'purple' }] },
    { id: 'c2', name: 'Design gadget window', idList: 'list-done', due: null, dueComplete: false, labels: [{ name: 'design', color: 'blue' }] },
    { id: 'c3', name: 'Build Trello client', idList: 'list-doing', due: daysFromNow(1), dueComplete: false, labels: [{ name: 'backend', color: 'green' }] },
    { id: 'c4', name: 'Wire up charts', idList: 'list-doing', due: daysFromNow(2), dueComplete: false, labels: [{ name: 'frontend', color: 'green' }] },
    { id: 'c5', name: 'Column dropdown selector', idList: 'list-review', due: daysFromNow(-1), dueComplete: false, labels: [{ name: 'frontend', color: 'green' }] },
    { id: 'c6', name: 'Settings panel', idList: 'list-todo', due: daysFromNow(5), dueComplete: false, labels: [] },
    { id: 'c7', name: 'Persist window position', idList: 'list-todo', due: null, dueComplete: false, labels: [{ name: 'nice-to-have', color: 'yellow' }] },
    { id: 'c8', name: 'Auto-start on login', idList: 'list-backlog', due: null, dueComplete: false, labels: [] },
    { id: 'c9', name: 'Multi-board support', idList: 'list-backlog', due: null, dueComplete: false, labels: [{ name: 'stretch', color: 'red' }] },
    { id: 'c10', name: 'Dark/light theme', idList: 'list-backlog', due: daysFromNow(10), dueComplete: false, labels: [{ name: 'design', color: 'blue' }] },
    { id: 'c11', name: 'Cycle-time metric', idList: 'list-todo', due: daysFromNow(-2), dueComplete: false, labels: [{ name: 'stretch', color: 'red' }] },
  ],
};

// Mock checklists keyed by card id. Each card may have several checklists,
// each with check items { id, name, state: 'complete'|'incomplete' }.
const MOCK_CHECKLISTS = {
  c3: [
    {
      id: 'cl-c3-1',
      name: 'Implementation',
      checkItems: [
        { id: 'ci-1', name: 'Auth with API key + token', state: 'complete' },
        { id: 'ci-2', name: 'Fetch board / lists / cards', state: 'complete' },
        { id: 'ci-3', name: 'Normalize response', state: 'incomplete' },
        { id: 'ci-4', name: 'Error handling', state: 'incomplete' },
      ],
    },
    {
      id: 'cl-c3-2',
      name: 'Testing',
      checkItems: [
        { id: 'ci-5', name: 'Mock-mode smoke test', state: 'complete' },
        { id: 'ci-6', name: 'Live board test', state: 'incomplete' },
      ],
    },
  ],
  c6: [
    {
      id: 'cl-c6-1',
      name: 'Settings fields',
      checkItems: [
        { id: 'ci-7', name: 'API key input', state: 'complete' },
        { id: 'ci-8', name: 'Token input', state: 'complete' },
        { id: 'ci-9', name: 'Theme picker', state: 'incomplete' },
      ],
    },
  ],
};

function getMockBoards() {
  return MOCK_BOARDS;
}

function getMockBoard() {
  // Return a deep copy so callers can't mutate the source.
  return JSON.parse(JSON.stringify(MOCK_BOARD));
}

// Mutate the source mock so edits persist across getMockBoard() calls
// (lets the "mark complete" toggle be tested offline).
function setMockCardComplete(cardId, value) {
  const card = MOCK_BOARD.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`Mock card not found: ${cardId}`);
  card.dueComplete = Boolean(value);
  return { id: card.id, dueComplete: card.dueComplete };
}

// Update editable fields (name/desc/due) on a mock card.
function updateMockCard(cardId, fields) {
  const card = MOCK_BOARD.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`Mock card not found: ${cardId}`);
  if (fields.name != null) card.name = fields.name;
  if (fields.desc != null) card.desc = fields.desc;
  if (fields.due !== undefined) card.due = fields.due || null;
  return JSON.parse(JSON.stringify(card));
}

let mockSeq = 100;
// Create a new mock card in a given list.
function createMockCard(fields) {
  if (!fields || !fields.idList) throw new Error('createMockCard: idList required');
  if (!MOCK_BOARD.lists.some((l) => l.id === fields.idList)) {
    throw new Error(`Mock list not found: ${fields.idList}`);
  }
  const card = {
    id: 'm' + ++mockSeq,
    name: fields.name || 'New card',
    idList: fields.idList,
    due: fields.due || null,
    dueComplete: false,
    desc: fields.desc || '',
    labels: [],
  };
  MOCK_BOARD.cards.push(card);
  return JSON.parse(JSON.stringify(card));
}

// ---- Mock checklist helpers ----
function getMockChecklists(cardId) {
  return JSON.parse(JSON.stringify(MOCK_CHECKLISTS[cardId] || []));
}

function findMockItem(cardId, itemId) {
  for (const cl of MOCK_CHECKLISTS[cardId] || []) {
    const item = cl.checkItems.find((i) => i.id === itemId);
    if (item) return { cl, item };
  }
  return null;
}

function setMockCheckItemState(cardId, itemId, state) {
  const hit = findMockItem(cardId, itemId);
  if (!hit) throw new Error(`Mock check item not found: ${itemId}`);
  hit.item.state = state === 'complete' ? 'complete' : 'incomplete';
  return JSON.parse(JSON.stringify(hit.item));
}

function renameMockCheckItem(cardId, itemId, name) {
  const hit = findMockItem(cardId, itemId);
  if (!hit) throw new Error(`Mock check item not found: ${itemId}`);
  hit.item.name = name;
  return JSON.parse(JSON.stringify(hit.item));
}

function addMockCheckItem(cardId, checklistId, name) {
  const cl = (MOCK_CHECKLISTS[cardId] || []).find((c) => c.id === checklistId);
  if (!cl) throw new Error(`Mock checklist not found: ${checklistId}`);
  const item = { id: 'ci' + ++mockSeq, name: name || 'New item', state: 'incomplete' };
  cl.checkItems.push(item);
  return JSON.parse(JSON.stringify(item));
}

function deleteMockCheckItem(cardId, checklistId, itemId) {
  const cl = (MOCK_CHECKLISTS[cardId] || []).find((c) => c.id === checklistId);
  if (!cl) throw new Error(`Mock checklist not found: ${checklistId}`);
  cl.checkItems = cl.checkItems.filter((i) => i.id !== itemId);
  return { id: itemId, deleted: true };
}

module.exports = {
  getMockBoards,
  getMockBoard,
  setMockCardComplete,
  updateMockCard,
  createMockCard,
  getMockChecklists,
  setMockCheckItemState,
  renameMockCheckItem,
  addMockCheckItem,
  deleteMockCheckItem,
};
