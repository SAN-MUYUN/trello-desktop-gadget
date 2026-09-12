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

module.exports = { getMockBoards, getMockBoard, setMockCardComplete };
