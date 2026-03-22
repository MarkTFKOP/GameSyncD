import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 8787);
const OUTPUT_DIR = (process.env.OUTPUT_DIR || 'data').trim() || 'data';
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '*').trim() || '*';
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const FRONTEND_DIST_DIR = path.join(ROOT_DIR, 'frontend', 'dist');

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readJsonWithBackup(primaryPath, backupPath) {
  const primary = await readJsonSafe(primaryPath);
  if (primary) return primary;
  return readJsonSafe(backupPath);
}

function runSync() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'sync_games_node.mjs')], {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      const t = d.toString();
      stdout += t;
      process.stdout.write(t);
    });

    child.stderr.on('data', (d) => {
      const t = d.toString();
      stderr += t;
      process.stderr.write(t);
    });

    child.on('close', (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

async function serveFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === '.html'
        ? 'text/html; charset=utf-8'
        : ext === '.css'
          ? 'text/css; charset=utf-8'
          : ext === '.js'
            ? 'application/javascript; charset=utf-8'
            : ext === '.svg'
              ? 'image/svg+xml'
              : ext === '.json'
                ? 'application/json; charset=utf-8'
            : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveStaticDir() {
  if (await fileExists(path.join(FRONTEND_DIST_DIR, 'index.html'))) {
    return FRONTEND_DIST_DIR;
  }
  return PUBLIC_DIR;
}

function isSafeImageUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (url.pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'sync-games-node' });
  }

  if (url.pathname === '/api/games/latest') {
    const data = await readJsonWithBackup(
      path.join(ROOT_DIR, OUTPUT_DIR, 'games_latest.json'),
      path.join(ROOT_DIR, OUTPUT_DIR, 'games_latest.bkp.json'),
    );
    if (!data) return json(res, 404, { ok: false, error: 'games_latest(.bkp).json not found' });
    return json(res, 200, data);
  }

  if (url.pathname === '/api/accounts/latest') {
    const data = await readJsonWithBackup(
      path.join(ROOT_DIR, OUTPUT_DIR, 'game_accounts_latest.json'),
      path.join(ROOT_DIR, OUTPUT_DIR, 'game_accounts_latest.bkp.json'),
    );
    if (!data) return json(res, 404, { ok: false, error: 'game_accounts_latest(.bkp).json not found' });
    return json(res, 200, data);
  }

  if (url.pathname === '/api/sync' && req.method === 'POST') {
    const result = await runSync();
    if (!result.ok) {
      return json(res, 500, { ok: false, message: 'Sync failed', exit_code: result.code });
    }
    return json(res, 200, { ok: true, message: 'Sync complete' });
  }

  if (url.pathname === '/api/image' && req.method === 'GET') {
    const target = url.searchParams.get('url') || '';
    if (!target || !isSafeImageUrl(target)) {
      return json(res, 400, { ok: false, error: 'Invalid image url' });
    }

    try {
      const upstream = await fetch(target, {
        headers: {
          'user-agent': 'Mozilla/5.0',
          referer: 'https://www.gog.com/',
        },
      });

      if (!upstream.ok) {
        return json(res, upstream.status, { ok: false, error: 'Upstream image fetch failed' });
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });
      return res.end(buffer);
    } catch {
      return json(res, 502, { ok: false, error: 'Image proxy failed' });
    }
  }

  const staticDir = await resolveStaticDir();
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const absoluteStaticPath = path.join(staticDir, requestedPath);

  if (await fileExists(absoluteStaticPath)) {
    return serveFile(res, absoluteStaticPath);
  }

  if (staticDir === FRONTEND_DIST_DIR) {
    return serveFile(res, path.join(FRONTEND_DIST_DIR, 'index.html'));
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }

  return serveFile(res, path.join(PUBLIC_DIR, url.pathname));
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
