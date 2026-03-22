# sync-games | GameSyncD

Lightweight backend + modern frontend for fetching and viewing owned games from Steam, Epic (Legendary), and GOG.

## Stack

- Backend: Node.js (`backend/server.mjs`, `backend/sync_games_node.mjs`)
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

## Render deployment

This repo can be deployed to Render as a single Node web service.

Files involved:

- [render.yaml](/Users/markpereira/Desktop/My_Files/My Projects/sync-games/render.yaml)
- [backend/server.mjs](/Users/markpereira/Desktop/My_Files/My Projects/sync-games/backend/server.mjs)
- [backend/sync_games_node.mjs](/Users/markpereira/Desktop/My_Files/My Projects/sync-games/backend/sync_games_node.mjs)

### Recommended Render shape

- One `Web Service`
- Build command:
  ```bash
  npm --prefix frontend install && npm --prefix frontend run build
  ```
- Start command:
  ```bash
  node backend/server.mjs
  ```

`backend/server.mjs` will serve the built React app from `frontend/dist` in production.

### Environment variables to set in Render

- `STEAM_API_KEY`
- `STEAM_ID`
- `GOG_COOKIE`
- `OUTPUT_DIR=data`
- optional: `LEGENDARY_BIN`

### Important limitation

Render web services do not give you durable local app storage by default. This app currently stores synced JSON in local files under `data/`, so:

- synced data can be lost on redeploy or instance restart
- you may need to trigger `Sync` again after deployment/restart

For personal use, this is usually acceptable. If you want durable server-side storage later, move `data/` to object storage or a database.

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

Credential refresh steps are documented in [REFRESH-CREDS.md](/Users/markpereira/Desktop/My_Files/My Projects/sync-games/REFRESH-CREDS.md).

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
- `epic_games_fallback.json`
- `epic_games_fallback.bkp.json`

The sync process always overwrites the same latest files and keeps backup copies.
If a write fails, it restores from rollback and preserves the previous valid data.

## Epic fallback behavior

Epic uses `legendary` when available locally. When a live Epic fetch succeeds, the sync also refreshes:

- `data/epic_games_fallback.json`
- `data/epic_games_fallback.bkp.json`

If `legendary` is unavailable in a hosted environment, the sync reuses that fallback snapshot instead of dropping Epic from the combined library.

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

- `backend/sync_games_node.mjs`: sync job (Steam + Epic + GOG)
- `backend/server.mjs`: API server
- `frontend/`: Vite React UI
- `run.local.sh`: one-command sync + backend + frontend
- `env.example`: template env
- `env.sh`: local env
- `sync_games.py`: legacy Python sync
