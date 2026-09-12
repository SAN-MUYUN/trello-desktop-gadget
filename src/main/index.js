'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');

// Load environment variables from .env (if present).
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (err) {
  // dotenv is optional at runtime; ignore if unavailable.
}

const client = require('../trello/client');
const { getBoardData, getBoards, setCardComplete, useMock } = client;
const { computeStats } = require('../stats/compute');
const history = require('../history/store');
const settings = require('../settings/store');

// Load credentials into the client with precedence: stored settings > .env.
// Works for both `npm start` (dev .env) and the packaged app (Settings panel).
function loadCredentials() {
  const stored = settings.load();
  const envForceMock = String(process.env.USE_MOCK || '').toLowerCase() === 'true';

  const apiKey = stored.apiKey || process.env.TRELLO_API_KEY || '';
  const token = stored.token || process.env.TRELLO_TOKEN || '';
  const boardId = stored.boardId || process.env.TRELLO_BOARD_ID || '';

  // Force mock only if the dev explicitly set USE_MOCK=true AND there are no
  // stored credentials (so a packaged user's saved creds always win).
  const forceMock = envForceMock && !stored.apiKey;

  client.setCredentials({ apiKey, token, boardId, forceMock });
}

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

ipcMain.handle('board:get', async (_event, boardId) => {
  const board = await getBoardData(boardId);
  const stats = computeStats(board);
  // In mock mode, seed synthetic history so the "over time" chart is
  // demonstrable immediately. Real mode builds history from actual refreshes.
  if (useMock()) {
    history.seedIfEmpty(board, stats);
  }
  // Record a timestamped snapshot so we can chart change over time.
  history.record(board, stats);
  return { board, stats };
});

ipcMain.handle('history:get', async (_event, boardId) => {
  return history.getSeries(boardId);
});

ipcMain.handle('history:clear', async (_event, boardId) => {
  history.clear(boardId);
  return true;
});

ipcMain.handle('boards:list', async () => {
  return getBoards();
});

ipcMain.handle('card:setComplete', async (_event, cardId, value) => {
  return setCardComplete(cardId, value);
});

// ---- Settings ----
ipcMain.handle('settings:get', async () => {
  const stored = settings.load();
  const { apiKey, token, boardId } = client.getCredentials();
  return {
    // Never send the full token back to the UI; indicate presence + a hint.
    hasApiKey: Boolean(apiKey),
    hasToken: Boolean(token),
    apiKey: apiKey || '',
    tokenHint: token ? `${token.slice(0, 4)}…${token.slice(-4)}` : '',
    boardId: boardId || '',
    usingMock: useMock(),
    source: stored.apiKey ? 'settings' : (process.env.TRELLO_API_KEY ? 'env' : 'none'),
  };
});

ipcMain.handle('settings:save', async (_event, payload) => {
  const current = settings.load();
  const next = {
    apiKey: (payload && payload.apiKey != null ? payload.apiKey : current.apiKey) || '',
    // Only overwrite the token if a new non-empty one was provided.
    token: (payload && payload.token ? payload.token : current.token) || '',
    boardId: (payload && payload.boardId != null ? payload.boardId : current.boardId) || '',
  };
  const ok = settings.save(next);
  loadCredentials();
  return { ok };
});

ipcMain.handle('settings:test', async (_event, payload) => {
  try {
    const res = await client.testConnection(
      payload && payload.apiKey,
      payload && payload.token
    );
    return { ok: true, member: res.member };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle('settings:clear', async () => {
  settings.clear();
  loadCredentials();
  return { ok: true };
});

ipcMain.handle('shell:openExternal', async (_event, url) => {
  if (typeof url === 'string' && /^https:\/\//i.test(url)) {
    await shell.openExternal(url);
    return true;
  }
  return false;
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
  settings.init(app.getPath('userData'));
  history.init(app.getPath('userData'));
  loadCredentials();
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
