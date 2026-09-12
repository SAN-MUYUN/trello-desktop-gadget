'use strict';

/**
 * Compute simple statistics from a normalized board object.
 *
 * @param {{lists: Array, cards: Array}} board
 * @returns {{
 *   totalCards: number,
 *   cardsPerList: Array<{listId:string,listName:string,count:number}>,
 *   overdue: number,
 *   completed: number,
 *   labelCounts: Array<{label:string,count:number}>
 * }}
 */
function computeStats(board) {
  const lists = (board && board.lists) || [];
  const cards = (board && board.cards) || [];
  const now = Date.now();

  const countByList = new Map();
  for (const list of lists) countByList.set(list.id, 0);

  let overdue = 0;
  let completed = 0;
  const labelCounts = new Map();

  for (const card of cards) {
    if (countByList.has(card.idList)) {
      countByList.set(card.idList, countByList.get(card.idList) + 1);
    }

    if (card.dueComplete) {
      completed += 1;
    } else if (card.due && new Date(card.due).getTime() < now) {
      overdue += 1;
    }

    for (const label of card.labels || []) {
      const key = label.name || label.color || 'unlabeled';
      labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
    }
  }

  const cardsPerList = lists.map((list) => ({
    listId: list.id,
    listName: list.name,
    count: countByList.get(list.id) || 0,
  }));

  const labelCountsArr = Array.from(labelCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCards: cards.length,
    cardsPerList,
    overdue,
    completed,
    labelCounts: labelCountsArr,
  };
}

module.exports = { computeStats };
