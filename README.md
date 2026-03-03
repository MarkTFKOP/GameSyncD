# sync-games

Fetch owned games from Steam, Epic (Legendary), and GOG into unified JSON output.

## Quick start

1. Create local env file:
   ```bash
   cp env.example env.sh
   ```
2. Fill `env.sh` values.
3. Run:
   ```bash
   ./run.local.sh
   ```

## Required setup

- Python 3.10+
- Epic login for Legendary:
  ```bash
  source venv/bin/activate
  legendary auth
  ```
- Steam:
  - `STEAM_API_KEY` (Steam Web API key)
  - `STEAM_ID` (numeric SteamID64)
- GOG:
  - `GOG_COOKIE` as raw cookie header from an authenticated request

## Output

By default, all generated files are saved in `data/`:

- `games_YYYYMMDD_HHMMSS.json`
- `games_latest.json`
- `game_accounts_YYYYMMDD_HHMMSS.json`
- `game_accounts_latest.json` (array of account/platform summaries with `games_csv`)

You can change folder using `OUTPUT_DIR` in `env.sh`.

## Files

- `sync_games.py`: fetch + normalize + write output
- `run.local.sh`: one-command local run
- `env.example`: template env file
- `env.sh`: local env values
