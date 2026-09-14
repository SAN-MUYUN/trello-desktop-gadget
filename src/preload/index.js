'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe API to the renderer. No Node access leaks through.
contextBridge.exposeInMainWorld('gadget', {
  // Data
  getBoard: (boardId) => ipcRenderer.invoke('board:get', boardId),
  listBoards: () => ipcRenderer.invoke('boards:list'),
  getHistory: (boardId) => ipcRenderer.invoke('history:get', boardId),
  clearHistory: (boardId) => ipcRenderer.invoke('history:clear', boardId),
  setCardComplete: (cardId, value) => ipcRenderer.invoke('card:setComplete', cardId, value),
  updateCard: (cardId, fields) => ipcRenderer.invoke('card:update', cardId, fields),
  createCard: (fields) => ipcRenderer.invoke('card:create', fields),

  // Checklists
  getChecklists: (cardId) => ipcRenderer.invoke('checklist:get', cardId),
  setCheckItemState: (cardId, itemId, complete) =>
    ipcRenderer.invoke('checklist:setItemState', cardId, itemId, complete),
  renameCheckItem: (cardId, itemId, name) =>
    ipcRenderer.invoke('checklist:renameItem', cardId, itemId, name),
  addCheckItem: (cardId, checklistId, name) =>
    ipcRenderer.invoke('checklist:addItem', cardId, checklistId, name),
  deleteCheckItem: (cardId, checklistId, itemId) =>
    ipcRenderer.invoke('checklist:deleteItem', cardId, checklistId, itemId),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  testSettings: (payload) => ipcRenderer.invoke('settings:test', payload),
  clearSettings: () => ipcRenderer.invoke('settings:clear'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Live updates pushed from the main process (polling).
  onBoardUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('board:update', handler);
    return () => ipcRenderer.removeListener('board:update', handler);
  },
  onBoardError: (callback) => {
    const handler = (_event, message) => callback(message);
    ipcRenderer.on('board:error', handler);
    return () => ipcRenderer.removeListener('board:error', handler);
  },

  // Window controls
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:setAlwaysOnTop', value),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  expandWindow: (pad) => ipcRenderer.invoke('window:expand', pad),
  restoreWindow: () => ipcRenderer.invoke('window:restore'),
});
