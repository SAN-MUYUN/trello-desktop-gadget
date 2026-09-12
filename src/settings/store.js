'use strict';

const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

// Stores Trello credentials for the current OS user, encrypted at rest via
// Electron's safeStorage (Windows DPAPI / macOS Keychain). This lets the
// PACKAGED app obtain credentials without a .env file — each user enters
// their own key/token in the Settings panel.
//
// Precedence used elsewhere: stored settings > .env > mock.

let settingsFilePath = null;

function init(userDataDir) {
  settingsFilePath = path.join(userDataDir, 'settings.enc');
}

function load() {
  if (!settingsFilePath) return {};
  try {
    if (!fs.existsSync(settingsFilePath)) return {};
    const buf = fs.readFileSync(settingsFilePath);
    let json;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      json = safeStorage.decryptString(buf);
    } else {
      // Fallback: plain (base64) if OS encryption isn't available.
      json = Buffer.from(buf.toString('utf8'), 'base64').toString('utf8');
    }
    return JSON.parse(json) || {};
  } catch (_e) {
    return {};
  }
}

function save(settings) {
  if (!settingsFilePath) return false;
  const json = JSON.stringify(settings || {});
  try {
    let out;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      out = safeStorage.encryptString(json);
    } else {
      out = Buffer.from(Buffer.from(json, 'utf8').toString('base64'), 'utf8');
    }
    fs.writeFileSync(settingsFilePath, out);
    return true;
  } catch (_e) {
    return false;
  }
}

function clear() {
  try {
    if (settingsFilePath && fs.existsSync(settingsFilePath)) {
      fs.unlinkSync(settingsFilePath);
    }
  } catch (_e) {
    /* ignore */
  }
}

module.exports = { init, load, save, clear };
