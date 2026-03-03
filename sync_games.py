import datetime
import json
import os
import subprocess
from typing import Any, Dict, List

import requests

# ==========================
# CONFIG
# ==========================

STEAM_API_KEY = os.getenv("STEAM_API_KEY", "").strip()
STEAM_ID = os.getenv("STEAM_ID", "").strip()
# Full raw Cookie header string copied from browser network tab.
GOG_COOKIE = os.getenv("GOG_COOKIE", "").strip()
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "data").strip() or "data"

# ==========================
# HELPERS
# ==========================

def timestamp():
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def save_output(data: List[Dict[str, Any]]) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filename = f"games_{timestamp()}.json"
    timestamped_path = os.path.join(OUTPUT_DIR, filename)
    latest_path = os.path.join(OUTPUT_DIR, "games_latest.json")

    with open(timestamped_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"\nSaved: {timestamped_path}")
    print(f"Saved: {latest_path}")


def build_game_accounts(data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for game in data:
        platform = str(game.get("platform") or "unknown")
        grouped.setdefault(platform, []).append(game)

    accounts: List[Dict[str, Any]] = []
    generated_at = datetime.datetime.now().isoformat(timespec="seconds")
    account_ref_map = {
        "steam": STEAM_ID or "steam-account",
        "epic": "legendary-account",
        "gog": "gog-account",
    }

    for platform, games in sorted(grouped.items()):
        sorted_games = sorted(
            [g for g in games if isinstance(g, dict)],
            key=lambda x: (x.get("name") or "").lower(),
        )
        game_names = [str(g.get("name") or "").strip() for g in sorted_games]
        game_names = [name for name in game_names if name]
        unique_names = sorted(set(game_names), key=lambda x: x.lower())
        total_playtime = sum(int(g.get("playtime_minutes", 0) or 0) for g in sorted_games)

        accounts.append(
            {
                "platform": platform,
                "account_ref": account_ref_map.get(platform, f"{platform}-account"),
                "total_games": len(sorted_games),
                "unique_games": len(unique_names),
                "total_playtime_minutes": total_playtime,
                "games_csv": ", ".join(unique_names),
                "generated_at": generated_at,
            }
        )
    return accounts


def save_game_accounts(data: List[Dict[str, Any]]) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filename = f"game_accounts_{timestamp()}.json"
    timestamped_path = os.path.join(OUTPUT_DIR, filename)
    latest_path = os.path.join(OUTPUT_DIR, "game_accounts_latest.json")
    accounts = build_game_accounts(data)

    with open(timestamped_path, "w", encoding="utf-8") as f:
        json.dump(accounts, f, indent=2)
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(accounts, f, indent=2)

    print(f"Saved: {timestamped_path}")
    print(f"Saved: {latest_path}")


def parse_cookie_header(cookie_header: str) -> Dict[str, str]:
    cookies: Dict[str, str] = {}
    if not cookie_header:
        return cookies
    for pair in cookie_header.split(";"):
        pair = pair.strip()
        if "=" not in pair:
            continue
        key, value = pair.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key:
            cookies[key] = value
    return cookies


def normalize_game(
    platform: str,
    external_id: str,
    name: str,
    playtime_minutes: int = 0,
    metadata: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    return {
        "platform": platform,
        "id": external_id,  # backward-compatible field
        "name": name,
        "playtime_minutes": playtime_minutes,
        "platform_id": platform,
        "external_id": external_id,
        "metadata": metadata or {},
    }


# ==========================
# STEAM
# ==========================

def fetch_steam_games() -> List[Dict[str, Any]]:
    if not STEAM_API_KEY or not STEAM_ID:
        print("Steam skipped: missing STEAM_API_KEY or STEAM_ID")
        return []

    url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/"
    params = {
        "key": STEAM_API_KEY,
        "steamid": STEAM_ID,
        "include_appinfo": 1,
        "include_played_free_games": 1,
    }

    r = requests.get(url, params=params)
    r.raise_for_status()

    games = r.json().get("response", {}).get("games", [])

    return [
        normalize_game(
            platform="steam",
            external_id=str(g.get("appid", "")),
            name=g.get("name") or str(g.get("appid", "unknown")),
            playtime_minutes=int(g.get("playtime_forever", 0) or 0),
            metadata={
                "playtime_2weeks_minutes": int(g.get("playtime_2weeks", 0) or 0),
                "img_icon_url": g.get("img_icon_url"),
                "img_logo_url": g.get("img_logo_url"),
                "has_community_visible_stats": bool(
                    g.get("has_community_visible_stats", False)
                ),
            },
        )
        for g in games
        if g.get("appid") is not None
    ]


# ==========================
# EPIC (Legendary CLI)
# ==========================

def fetch_epic_games() -> List[Dict[str, Any]]:
    try:
        result = subprocess.run(
            ["legendary", "list-games", "--json"],
            capture_output=True,
            text=True,
            check=True,
        )

        games = json.loads(result.stdout)
        if not isinstance(games, list):
            print("Epic fetch failed: unexpected JSON format")
            return []

        cleaned: List[Dict[str, Any]] = []

        for g in games:
            if not isinstance(g, dict):
                continue
            name = g.get("app_title") or g.get("title") or g.get("app_name")
            external_id = str(g.get("app_name") or g.get("id") or "").strip()
            if not external_id:
                continue

            cleaned.append(
                normalize_game(
                    platform="epic",
                    external_id=external_id,
                    name=name or external_id,
                    metadata={
                        "namespace": g.get("namespace"),
                        "version": g.get("version"),
                        "is_dlc": bool(g.get("is_dlc", False)),
                    },
                )
            )

        return cleaned

    except Exception as e:
        print("Epic fetch failed:", e)
        return []
# ==========================
# GOG
# ==========================

def extract_gog_games(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if not isinstance(payload, dict):
        return []

    possible_keys = ("owned", "games", "products", "items")
    for key in possible_keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [x for x in value if isinstance(x, dict)]
        if isinstance(value, dict):
            nested_list = value.get("items")
            if isinstance(nested_list, list):
                return [x for x in nested_list if isinstance(x, dict)]
    return []


def fetch_gog_products_fallback(
    headers: Dict[str, str], cookies: Dict[str, str]
) -> List[Dict[str, Any]]:
    products: List[Dict[str, Any]] = []
    page = 1

    while True:
        url = "https://www.gog.com/account/getFilteredProducts"
        params = {
            "mediaType": "1",
            "sortBy": "title",
            "page": str(page),
        }
        r = requests.get(url, headers=headers, cookies=cookies, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()

        page_products = data.get("products", [])
        if not isinstance(page_products, list):
            break
        products.extend([x for x in page_products if isinstance(x, dict)])

        total_pages = int(data.get("totalPages", 1) or 1)
        if page >= total_pages:
            break
        page += 1

    return products


def fetch_gog_games() -> List[Dict[str, Any]]:
    if not GOG_COOKIE:
        print("GOG skipped: missing GOG_COOKIE")
        return []

    url = "https://embed.gog.com/user/data/games"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": "https://www.gog.com/account",
        "X-Requested-With": "XMLHttpRequest",
    }
    cookies = parse_cookie_header(GOG_COOKIE)

    try:
        games: List[Dict[str, Any]] = []

        # Primary endpoint.
        try:
            r = requests.get(url, headers=headers, cookies=cookies, timeout=30)
            r.raise_for_status()
            data = r.json()
            games = extract_gog_games(data)
        except Exception:
            pass

        # Fallback endpoint with pagination.
        if not games:
            games = fetch_gog_products_fallback(headers=headers, cookies=cookies)

        return [
            normalize_game(
                platform="gog",
                external_id=str(g.get("id") or g.get("game_id") or ""),
                name=str(g.get("title") or g.get("name") or "unknown"),
                metadata={
                    "url": g.get("url"),
                    "slug": g.get("slug"),
                    "image": g.get("image"),
                    "is_installed": g.get("isInstalled"),
                    "is_hidden": g.get("isHidden"),
                },
            )
            for g in games
            if (g.get("id") is not None or g.get("game_id") is not None)
        ]

    except Exception as e:
        print("GOG fetch failed:", e)
        print(
            "Hint: refresh GOG_COOKIE from a logged-in request to www.gog.com "
            "(include all cookie pairs exactly as sent)."
        )
        return []


# ==========================
# MAIN
# ==========================

def main():
    print("Fetching Steam...")
    steam_games = fetch_steam_games()

    print("Fetching Epic...")
    epic_games = fetch_epic_games()

    print("Fetching GOG...")
    gog_games = fetch_gog_games()

    all_games = steam_games + epic_games + gog_games
    all_games.sort(key=lambda x: (x.get("platform", ""), (x.get("name") or "").lower()))

    print(f"\nTotal games collected: {len(all_games)}")

    save_output(all_games)
    save_game_accounts(all_games)


if __name__ == "__main__":
    main()
