import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const STEAM_API_KEY = (process.env.STEAM_API_KEY || '').trim();
const STEAM_ID = (process.env.STEAM_ID || '').trim();
const GOG_COOKIE = (process.env.GOG_COOKIE || '').trim();
const OUTPUT_DIR = (process.env.OUTPUT_DIR || 'data').trim() || 'data';
const LEGENDARY_BIN = (process.env.LEGENDARY_BIN || '').trim();

function parseCookieHeader(raw) {
  const out = {};
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.includes('=')) continue;
    const i = trimmed.indexOf('=');
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function cookiesToHeader(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function normalizeGame(platform, externalId, name, playtimeMinutes = 0, metadata = {}) {
  return {
    platform,
    id: String(externalId),
    name: name || String(externalId),
    playtime_minutes: Number(playtimeMinutes) || 0,
    platform_id: platform,
    external_id: String(externalId),
    image_url: metadata?.image_url || null,
    metadata,
  };
}

function buildSteamImageFallbacks(appId, logoHash) {
  if (!appId) return [];
  const id = String(appId);
  const cdn = 'https://cdn.cloudflare.steamstatic.com/steam/apps';
  const fallbacks = [
    `${cdn}/${id}/library_600x900_2x.jpg`,
    `${cdn}/${id}/library_600x900.jpg`,
    `${cdn}/${id}/capsule_616x353.jpg`,
    `${cdn}/${id}/header.jpg`,
    `${cdn}/${id}/capsule_231x87.jpg`,
  ];
  if (logoHash) {
    fallbacks.unshift(`${cdn}/${id}/${logoHash}.jpg`);
  }
  return fallbacks;
}

function normalizeGogImage(image) {
  if (!image) return null;
  const raw = String(image);
  const prefixed = raw.startsWith('//') ? `https:${raw}` : raw;
  if (prefixed.includes('{formatter}')) {
    return prefixed.replace('{formatter}', 'product_tile_196');
  }
  return prefixed;
}

function buildGameAccounts(games) {
  const byPlatform = new Map();
  for (const g of games) {
    const p = g?.platform || 'unknown';
    if (!byPlatform.has(p)) byPlatform.set(p, []);
    byPlatform.get(p).push(g);
  }

  const accountRefMap = {
    steam: STEAM_ID || 'steam-account',
    epic: 'legendary-account',
    gog: 'gog-account',
  };

  const generatedAt = new Date().toISOString().slice(0, 19);
  return [...byPlatform.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([platform, list]) => {
      const names = list
        .map((x) => String(x?.name || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const uniqueNames = [...new Set(names)];
      const totalPlaytime = list.reduce((sum, x) => sum + (Number(x?.playtime_minutes) || 0), 0);
      return {
        platform,
        account_ref: accountRefMap[platform] || `${platform}-account`,
        total_games: list.length,
        unique_games: uniqueNames.length,
        total_playtime_minutes: totalPlaytime,
        games_csv: uniqueNames.join(', '),
        generated_at: generatedAt,
      };
    });
}

async function fetchSteamGames() {
  if (!STEAM_API_KEY || !STEAM_ID) {
    console.log('Steam skipped: missing STEAM_API_KEY or STEAM_ID');
    return [];
  }

  const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
  url.searchParams.set('key', STEAM_API_KEY);
  url.searchParams.set('steamid', STEAM_ID);
  url.searchParams.set('include_appinfo', '1');
  url.searchParams.set('include_played_free_games', '1');

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Steam fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const games = data?.response?.games || [];

  return games
    .filter((g) => g?.appid !== undefined && g?.appid !== null)
    .map((g) =>
      normalizeGame('steam', g.appid, g.name || String(g.appid), g.playtime_forever || 0, {
        playtime_2weeks_minutes: g.playtime_2weeks || 0,
        img_icon_url: g.img_icon_url || null,
        img_logo_url: g.img_logo_url || null,
        image_url: buildSteamImageFallbacks(g.appid, g.img_logo_url)[0] || null,
        image_candidates: buildSteamImageFallbacks(g.appid, g.img_logo_url),
        has_community_visible_stats: Boolean(g.has_community_visible_stats),
      }),
    );
}

async function fetchEpicGames() {
  const runCandidates = async () => {
    const candidates = [];
    if (LEGENDARY_BIN) candidates.push(LEGENDARY_BIN);
    candidates.push(path.join(process.cwd(), 'venv', 'bin', 'legendary'));
    candidates.push('legendary');

    let lastError;
    for (const bin of candidates) {
      try {
        return await execFileAsync(bin, ['list-games', '--json']);
      } catch (err) {
        lastError = err;
        if (err?.code === 'ENOENT') continue;
        throw err;
      }
    }
    throw lastError || new Error('legendary not found');
  };

  try {
    const { stdout } = await runCandidates();
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) {
      console.log('Epic fetch failed: unexpected JSON format');
      return { games: [], live: false };
    }

    const games = parsed
      .filter((g) => g && typeof g === 'object')
      .map((g) => {
        const externalId = String(g.app_name || g.id || '').trim();
        if (!externalId) return null;
        const name = g.app_title || g.title || g.app_name || externalId;
        const keyImages = Array.isArray(g.keyImages)
          ? g.keyImages
          : Array.isArray(g.metadata?.keyImages)
            ? g.metadata.keyImages
            : [];
        const imageUrl =
          keyImages.find((x) => x?.type === 'DieselGameBoxTall')?.url ||
          keyImages.find((x) => x?.type === 'OfferImageTall')?.url ||
          keyImages.find((x) => x?.url)?.url ||
          g.image ||
          g.thumbnail ||
          null;
        return normalizeGame('epic', externalId, name, 0, {
          namespace: g.namespace || null,
          version: g.version || null,
          is_dlc: Boolean(g.is_dlc),
          image_url: imageUrl,
        });
      })
      .filter(Boolean);

    return { games, live: true };
  } catch (err) {
    if (err?.code === 'ENOENT') {
      console.log(
        'Epic fetch failed: legendary not found. Set LEGENDARY_BIN or install/auth legendary.',
      );
    } else {
      console.log(`Epic fetch failed: ${err.message}`);
    }
    return { games: [], live: false };
  }
}

async function readFallbackJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function resolveEpicGames(outputDir) {
  const epicFallback = path.join(outputDir, 'epic_games_fallback.json');
  const epicFallbackBackup = path.join(outputDir, 'epic_games_fallback.bkp.json');
  const result = await fetchEpicGames();

  if (result.live) {
    await writeWithBackup(epicFallback, epicFallbackBackup, result.games);
    return result.games;
  }

  const primaryFallbackGames = await readFallbackJson(epicFallback);
  const backupFallbackGames = await readFallbackJson(epicFallbackBackup);
  const fallbackGames =
    primaryFallbackGames.length > 0 ? primaryFallbackGames : backupFallbackGames;

  if (fallbackGames.length) {
    console.log(`Epic fallback in use: ${fallbackGames.length} games from local snapshot.`);
  }

  return fallbackGames;
}

function extractGogGames(payload) {
  if (Array.isArray(payload)) {
    return payload.filter((x) => x && typeof x === 'object');
  }
  if (!payload || typeof payload !== 'object') return [];

  for (const key of ['owned', 'games', 'products', 'items']) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter((x) => x && typeof x === 'object');
    if (value && typeof value === 'object' && Array.isArray(value.items)) {
      return value.items.filter((x) => x && typeof x === 'object');
    }
  }
  return [];
}

async function fetchGogProductsFallback(headers) {
  const all = [];
  let page = 1;

  while (true) {
    const url = new URL('https://www.gog.com/account/getFilteredProducts');
    url.searchParams.set('mediaType', '1');
    url.searchParams.set('sortBy', 'title');
    url.searchParams.set('page', String(page));

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GOG fallback failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const products = Array.isArray(data?.products) ? data.products : [];
    all.push(...products.filter((x) => x && typeof x === 'object'));

    const totalPages = Number(data?.totalPages || 1);
    if (page >= totalPages) break;
    page += 1;
  }

  return all;
}

async function fetchGogGames() {
  if (!GOG_COOKIE) {
    console.log('GOG skipped: missing GOG_COOKIE');
    return [];
  }

  const cookies = parseCookieHeader(GOG_COOKIE);
  const headers = {
    'user-agent': 'Mozilla/5.0',
    accept: 'application/json',
    referer: 'https://www.gog.com/account',
    'x-requested-with': 'XMLHttpRequest',
    cookie: cookiesToHeader(cookies),
  };

  let games = [];
  try {
    const primary = await fetch('https://embed.gog.com/user/data/games', { headers });
    if (primary.ok) {
      games = extractGogGames(await primary.json());
    }
  } catch {
    // fallback below
  }

  if (!games.length) {
    try {
      games = await fetchGogProductsFallback(headers);
    } catch (err) {
      console.log(`GOG fetch failed: ${err.message}`);
      console.log('Hint: refresh GOG_COOKIE from logged-in www.gog.com request headers.');
      return [];
    }
  }

  return games
    .map((g) => {
      const externalId = g.id ?? g.game_id;
      if (externalId === undefined || externalId === null) return null;
      return normalizeGame('gog', externalId, g.title || g.name || String(externalId), 0, {
        url: g.url || null,
        slug: g.slug || null,
        image: g.image || null,
        image_url: normalizeGogImage(g.image),
        is_installed: g.isInstalled ?? null,
        is_hidden: g.isHidden ?? null,
      });
    })
    .filter(Boolean);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeWithBackup(targetPath, backupPath, data) {
  const dir = path.dirname(targetPath);
  const tempPath = path.join(dir, `.${path.basename(targetPath)}.tmp`);
  const rollbackPath = path.join(dir, `.${path.basename(targetPath)}.rollback`);

  const targetExists = await pathExists(targetPath);
  if (targetExists) {
    await fs.copyFile(targetPath, backupPath);
    await fs.rename(targetPath, rollbackPath);
  }

  try {
    await writeJson(tempPath, data);
    await fs.rename(tempPath, targetPath);
    if (targetExists && (await pathExists(rollbackPath))) {
      await fs.unlink(rollbackPath);
    }
  } catch (err) {
    if (await pathExists(tempPath)) {
      await fs.unlink(tempPath);
    }
    if (await pathExists(rollbackPath)) {
      await fs.rename(rollbackPath, targetPath);
    }
    throw err;
  }
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log('Fetching Steam...');
  const steam = await fetchSteamGames().catch((err) => {
    console.log(`Steam fetch failed: ${err.message}`);
    return [];
  });

  console.log('Fetching Epic...');
  const epic = await resolveEpicGames(OUTPUT_DIR);

  console.log('Fetching GOG...');
  const gog = await fetchGogGames();

  const games = [...steam, ...epic, ...gog].sort((a, b) => {
    const p = String(a.platform || '').localeCompare(String(b.platform || ''));
    if (p !== 0) return p;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const accounts = buildGameAccounts(games);
  const gamesLatest = path.join(OUTPUT_DIR, 'games_latest.json');
  const accountsLatest = path.join(OUTPUT_DIR, 'game_accounts_latest.json');
  const gamesBackup = path.join(OUTPUT_DIR, 'games_latest.bkp.json');
  const accountsBackup = path.join(OUTPUT_DIR, 'game_accounts_latest.bkp.json');

  await writeWithBackup(gamesLatest, gamesBackup, games);
  await writeWithBackup(accountsLatest, accountsBackup, accounts);

  console.log(`Total games collected: ${games.length}`);
  console.log(`Saved: ${gamesLatest}`);
  console.log(`Saved: ${accountsLatest}`);
  console.log(`Backup: ${gamesBackup}`);
  console.log(`Backup: ${accountsBackup}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
