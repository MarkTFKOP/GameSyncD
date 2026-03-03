# sync-games

Lightweight backend + modern frontend for fetching and viewing owned games from Steam, Epic (Legendary), and GOG.

## Stack

- Backend: Node.js (`server.mjs`, `sync_games_node.mjs`)
- Frontend: Vite + React + shadcn-style components + TanStack Table (`frontend/`)

## Quick start

1. Create local env:
   ```bash
   cp env.example env.sh
   ```
2. Fill `env.sh`.
3. Run all:
   ```bash
   ./run.local.sh
   ```
4. Open:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8787`

## Required setup

- Node.js 18+
- Epic auth (once):
  ```bash
  legendary auth
  ```
  If `legendary` is not on PATH, set `LEGENDARY_BIN` in `env.sh` or keep it at `./venv/bin/legendary`.
- Steam:
  - `STEAM_API_KEY`
  - `STEAM_ID` (numeric SteamID64)
- GOG:
  - `GOG_COOKIE` (full raw cookie header from logged-in `www.gog.com` request)

## API

- `GET /api/health`
- `GET /api/games/latest`
- `GET /api/accounts/latest`
- `POST /api/sync`

## Output files

Saved under `OUTPUT_DIR` (default `data/`):

- `games_latest.json`
- `game_accounts_latest.json`
- `games_latest.bkp.json`
- `game_accounts_latest.bkp.json`

The sync process always overwrites the same latest files and keeps backup copies.
If a write fails, it restores from rollback and preserves the previous valid data.

## Epic troubleshooting

If Epic returns zero games:

1. Re-authenticate:
   ```bash
   legendary auth
   ```
2. Verify CLI works:
   ```bash
   legendary list-games --json
   ```
3. If command not found, set:
   - `LEGENDARY_BIN=/absolute/path/to/legendary`

## Files

- `sync_games_node.mjs`: sync job (Steam + Epic + GOG)
- `server.mjs`: API server
- `frontend/`: Vite React UI
- `run.local.sh`: one-command sync + backend + frontend
- `env.example`: template env
- `env.sh`: local env
- `sync_games.py`: legacy Python sync
