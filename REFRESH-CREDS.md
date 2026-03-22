# Credentials Refresh Guide

This project depends on three credential sources:

- `STEAM_API_KEY`
- `STEAM_ID`
- `GOG_COOKIE`
- Epic auth state via `legendary`

Use this guide when a sync starts failing because access expired, accounts changed, or credentials were rotated.

## Where these are used

- [env.sh](/Users/markpereira/Desktop/My_Files/My Projects/sync-games/env.sh)
- [env.example](/Users/markpereira/Desktop/My_Files/My Projects/sync-games/env.example)
- [backend/sync_games_node.mjs](/Users/markpereira/Desktop/My_Files/My Projects/sync-games/backend/sync_games_node.mjs)

## Steam

### Refresh `STEAM_API_KEY`

1. Open:
   - `https://steamcommunity.com/dev/apikey`
2. Sign in to the Steam account you want to use.
3. Generate or view your Web API key.
4. Update `env.sh`:

```bash
export STEAM_API_KEY="your_steam_web_api_key"
```

### Refresh `STEAM_ID`

This must be the numeric SteamID64, not the vanity username.

1. Open your Steam profile in browser.
2. Copy the numeric account id if visible, or resolve it using a SteamID lookup tool.
3. Update `env.sh`:

```bash
export STEAM_ID="7656119xxxxxxxxxx"
```

### Validate Steam

Run:

```bash
node backend/sync_games_node.mjs
```

If Steam is configured correctly, `games_latest.json` should include `platform: "steam"` entries.

## GOG

`GOG_COOKIE` is the full raw `Cookie` request header from an authenticated GOG browser session.

### Refresh `GOG_COOKIE`

1. Log in to `https://www.gog.com/`.
2. Open browser DevTools.
3. Go to `Network`.
4. Refresh the page or open a GOG account/library page.
5. Click a request going to `www.gog.com`.
6. In request headers, copy the full `Cookie` header value exactly as sent.
7. Update `env.sh`:

```bash
export GOG_COOKIE="cookie1=value1; cookie2=value2; ..."
```

Notes:

- Copy the full header, not individual cookie keys unless you know exactly which ones are required.
- This is effectively a session token. Treat it as sensitive and rotate it when needed.

### Validate GOG

Run:

```bash
node backend/sync_games_node.mjs
```

If GOG is configured correctly, `games_latest.json` should include `platform: "gog"` entries.

## Epic

Epic integration uses `legendary`, not a manually stored API key in `env.sh`.

### Refresh Epic auth

Run:

```bash
legendary auth
```

If `legendary` is not on `PATH`, either:

- install it globally, or
- use the repo venv binary and set:

```bash
export LEGENDARY_BIN="/absolute/path/to/legendary"
```

### Validate Epic

Run:

```bash
legendary list-games --json
```

Then run:

```bash
node backend/sync_games_node.mjs
```

If Epic is configured correctly, `games_latest.json` should include `platform: "epic"` entries.

## After refreshing credentials

1. Update [env.sh](/Users/markpereira/Desktop/My_Files/My Projects/sync-games/env.sh)
2. Restart local run if needed:

```bash
./run.local.sh
```

3. Or re-run sync only:

```bash
node backend/sync_games_node.mjs
```

## Troubleshooting

### Steam returns nothing or fails

- Verify `STEAM_API_KEY` is valid.
- Verify `STEAM_ID` is numeric.
- Verify the Steam profile/library visibility allows owned games to be read.

### GOG images or data fail

- Refresh `GOG_COOKIE`.
- Re-copy the full raw cookie header from an active logged-in session.
- Run sync again.

### Epic returns zero games

- Re-run `legendary auth`
- Confirm `legendary list-games --json` works outside this app
- Set `LEGENDARY_BIN` if the binary path is custom
