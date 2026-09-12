'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

// Load environment variables from .env (if present).
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (err) {
  // dotenv is optional at runtime; ignore if unavailable.
}

const { getBoardData, getBoards } = require('../trello/client');
const { computeStats } = require('../stats/compute');

const isDev = process.argv.includes('--dev');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {NodeJS.Timeout | null} */
let pollTimer = null;

// Default 0 = manual refresh only. Set a positive value (ms) in .env to
// re-enable automatic background polling.
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 0);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 480,
    minWidth: 280,
    minHeight: 320,
    // Gadget look: no OS chrome.
    frame: false,
    transparent: true,
    // Solid dark base so text stays readable; the renderer paints a
    // dark-blue Kiro-style panel on top. (Mica let the desktop bleed
    // through and killed contrast.)
    backgroundColor: '#0f1020',
    // Keep the gadget floating above other windows.
    alwaysOnTop: true,
    // Don't clutter the taskbar / alt-tab like a normal app.
    skipTaskbar: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Float above full-screen apps too.
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---- IPC handlers (renderer -> main) ----

ipcMain.handle('board:get', async () => {
  const board = await getBoardData();
  const stats = computeStats(board);
  return { board, stats };
});

ipcMain.handle('boards:list', async () => {
  return getBoards();
});

ipcMain.handle('window:setAlwaysOnTop', (_event, value) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(Boolean(value), 'screen-saver');
  }
  return Boolean(value);
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

// Optional periodic refresh. Disabled when POLL_INTERVAL_MS <= 0 (the
// default), so the app only refreshes on demand (Refresh button / actions).
function startPolling() {
  stopPolling();
  if (!Number.isFinite(POLL_INTERVAL_MS) || POLL_INTERVAL_MS <= 0) {
    return; // manual-refresh mode
  }
  pollTimer = setInterval(async () => {
    if (!mainWindow) return;
    try {
      const board = await getBoardData();
      const stats = computeStats(board);
      mainWindow.webContents.send('board:update', { board, stats });
    } catch (err) {
      mainWindow.webContents.send('board:error', String(err && err.message ? err.message : err));
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

app.whenReady().then(() => {
  createWindow();
  startPolling();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopPolling();
  if (process.platform !== 'darwin') app.quit();
});
