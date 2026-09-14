# Trello Gadget

A small, translucent Windows 11 desktop gadget (Electron) that displays selected columns from a Trello board and shows simple statistics — all in one frameless, always-on-top window.

## Features

- 🪟 **Single translucent window** — frameless, always-on-top, draggable, with Windows 11 **Mica** background material (Acrylic fallback).
- 📋 **Gadget view** — compact cards for the columns you choose.
- 🔽 **Column dropdown** — pick which column(s) to display.
- 📊 **Stats view** — toggle in the same window; shows one chart at a time (cards per column, **cards per column over time**, status breakdown, cards per label).
- 📈 **History over time** — the app records per-column card counts to a local file, **bucketed by day** (configurable to hourly via `HISTORY_BUCKET`). Each refresh updates the current bucket, so you get one clean, regularly-spaced point per day regardless of how often you refresh. The "over time" chart plots these as a lightweight cumulative-flow view; history persists across restarts.
- 🔄 **On-demand refresh** — a ⟳ button fetches from Trello when *you* ask. Background auto-polling is off by default (opt-in via `POLL_INTERVAL_MS`).
- 🖥️ **Taskbar + system tray** — shows in the taskbar so it minimizes/restores normally, and a tray icon lets you show/quit the gadget anytime.
- ✅ **Mark cards complete** — a checkbox on each card toggles its complete state and saves it back to Trello (`PUT /1/cards/{id}` `dueComplete`). Optimistic UI with rollback on failure. *(Requires a token with **write** scope; a read-only token returns a clear 403 message.)*
- 🥧 **Radial (pie) menu** — click a card and a ring of actions **fans out** (Edit / Complete / Due). The ring stays within the panel and auto-positions near edges so it never clips or glitches. Center **✕**, click-outside, or **Esc** closes it.
- ✏️ **Edit cards** — from the radial menu, **Edit** opens an editor for **title, description, and due date** (`PUT /1/cards/{id}`). The complete checkbox has its own click zone.
- ☑️ **Edit checklists** — the card editor shows **all checklists** on a card (collapsible, with `done/total` progress). Toggle, rename, add, and delete items — synced to Trello (`/checkItem`, `/checklists/{id}/checkItems`).
- ➕ **Add cards** — each column has a **+ Add card** button; pick the column, enter title (and optional description/due), and it's created via `POST /1/cards`.
- 🎨 **Theme presets** — pick from contrast-safe color schemes (Kiro Dark Blue, Midnight, Slate, Forest, Light, **Apple Light**, **Apple Dark**) in Settings; applied live and remembered.
- 🧪 **Mock data included** — the app runs and looks right *before* you add any Trello credentials.

## Requirements

- **Windows 11** (Mica material is Windows 11 only; the app still runs elsewhere with a plain translucent background).
- **Node.js 18+** and npm.

## Getting started

```bash
# 1. Install dependencies (needs internet on your machine)
npm install

# 2. Run the gadget (uses mock data by default)
npm start
```

The gadget launches with **mock Trello data** so you can see it working immediately.

## Connecting real Trello data

### In the app (works for the packaged .exe too) — recommended

1. Launch the app and click the **⚙ Settings** button in the title bar (it opens automatically on first run).
2. Click **Get API key** to open Trello's page and copy your **API Key**.
3. Click **Generate token** to authorize the app (requests read+write) and copy the **Token**.
4. Paste both in, optionally set a **Board ID**, click **Test connection**, then **Save**.

Credentials are stored **encrypted on your computer** (Electron `safeStorage` / Windows DPAPI) in the per-user app-data folder — nothing sensitive is bundled in the app or committed to git.

### Via `.env` (developer convenience for `npm start` only)

1. Copy `.env.example` to `.env`, fill in `TRELLO_API_KEY` / `TRELLO_TOKEN` (and optionally `TRELLO_BOARD_ID`), set `USE_MOCK=false`, restart.

> **Why the packaged app showed mock data:** the built `.exe` does **not** read your project `.env` (it isn't bundled, by design — that would ship your secret token). Use the in-app **Settings** panel for the packaged app. Precedence is: **saved settings > `.env` > mock**.

## Project structure

```
trello-gadget/
├── package.json
├── .env.example
├── src/
│   ├── main/          # Electron main process (window, Mica, always-on-top, IPC)
│   ├── preload/       # secure context bridge
│   ├── renderer/      # UI: gadget + stats toggle, column dropdown, charts
│   ├── trello/        # Trello REST client + mock data
│   └── stats/         # statistics computation
```

## Packaging into a runnable app (Windows)

Run these on your **Windows** machine (packaging must happen on Windows to produce a `.exe`):

```bash
npm install

# Option A: single portable .exe (no install, just double-click to run)
npm run build:portable
#  -> dist/TrelloGadget-portable.exe

# Option B: installer
npm run build:installer
#  -> dist/TrelloGadget-Setup.exe

# Or build both:
npm run build
```

The **portable** build is the easiest: it produces one `TrelloGadget-portable.exe` in `dist/` that you can double-click to launch — no installation needed.
