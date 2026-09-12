# Trello Gadget

A small, translucent Windows 11 desktop gadget (Electron) that displays selected columns from a Trello board and shows simple statistics — all in one frameless, always-on-top window.

## Features

- 🪟 **Single translucent window** — frameless, always-on-top, draggable, with Windows 11 **Mica** background material (Acrylic fallback).
- 📋 **Gadget view** — compact cards for the columns you choose.
- 🔽 **Column dropdown** — pick which column(s) to display.
- 📊 **Stats view** — toggle in the same window; shows one chart at a time (cards per column, **cards per column over time**, status breakdown, cards per label).
- 📈 **History over time** — each refresh records a timestamped snapshot of per-column card counts to a local file, so the "over time" chart shows how columns change (a lightweight cumulative-flow view). History persists across restarts.
- 🔄 **On-demand refresh** — a ⟳ button fetches from Trello when *you* ask. Background auto-polling is off by default (opt-in via `POLL_INTERVAL_MS`).
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

1. Generate an **API Key** and **Token** at <https://trello.com/power-ups/admin>.
2. Copy `.env.example` to `.env`.
3. Fill in `TRELLO_API_KEY`, `TRELLO_TOKEN`, and (optionally) `TRELLO_BOARD_ID`.
4. Set `USE_MOCK=false`.
5. Restart the app.

> Your credentials live only in your local `.env` file. They are never committed (`.env` is gitignored).

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
