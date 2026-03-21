import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Gamepad2, Library, Search, Users2 } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { uiTheme } from './theme';

function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
    return window.location.origin;
  }

  return '';
}

const API_BASE = resolveApiBase();

async function requestJson(path, init) {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return response.json();
}

function useRoute() {
  const [route, setRoute] = useState(window.location.pathname || '/');

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (to) => {
    if (to === route) return;
    window.history.pushState({}, '', to);
    setRoute(to);
  };

  return { route, navigate };
}

function normalizeImageUrl(url) {
  if (!url) return null;
  const value = String(url);
  if (value.startsWith('//')) return `https:${value}`;
  return value;
}

function proxiedImageUrl(url) {
  const safe = normalizeImageUrl(url);
  if (!safe) return null;
  return `${API_BASE}/api/image?url=${encodeURIComponent(safe)}`;
}

function buildCoverCandidates(game, src) {
  const candidates = [];
  if (src) candidates.push(src);

  const meta = game?.metadata || {};
  if (Array.isArray(meta.image_candidates)) {
    candidates.push(...meta.image_candidates);
  }

  const platform = String(game?.platform || '').toLowerCase();
  const id = String(game?.id || '');

  if (platform === 'steam' && id) {
    const base = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}`;
    candidates.push(
      `${base}/library_600x900_2x.jpg`,
      `${base}/library_600x900.jpg`,
      `${base}/capsule_616x353.jpg`,
      `${base}/header.jpg`,
    );
  }

  if (platform === 'gog') {
    const gogImage = normalizeImageUrl(meta.image || game?.image_url);
    if (gogImage?.includes('{formatter}')) {
      candidates.push(
        gogImage.replace('{formatter}', 'product_tile_196'),
        gogImage.replace('{formatter}', 'product_card_v2_mobile_slider_639'),
        gogImage.replace('{formatter}', 'product_card_v2_mobile_slider_432'),
      );
    }
    if (gogImage && !gogImage.includes('{formatter}')) {
      const hasExt = /\.[a-zA-Z0-9]+($|\?)/.test(gogImage);
      const base = gogImage.replace(/\?.*$/, '');
      if (!hasExt) {
        candidates.push(
          `${base}.jpg`,
          `${base}.png`,
          `${base}_product_tile_196.jpg`,
          `${base}_product_card_v2_mobile_slider_639.jpg`,
          `${base}_product_card_v2_mobile_slider_432.jpg`,
        );
      }
    }
  }

  const normalized = [...new Set(candidates.map((x) => normalizeImageUrl(x)).filter(Boolean))];
  if (platform === 'gog') {
    return normalized.flatMap((u) => [proxiedImageUrl(u), u]).filter(Boolean);
  }
  return normalized;
}

function GameCover({ game, src, alt }) {
  const [index, setIndex] = useState(0);
  const candidates = useMemo(() => buildCoverCandidates(game, src), [game, src]);
  const activeSrc = candidates[index];

  useEffect(() => {
    setIndex(0);
  }, [src, game?.id, game?.platform]);

  return (
    <img
      src={activeSrc || '/no-image.svg'}
      alt={alt}
      onError={() => setIndex((prev) => prev + 1)}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  );
}

function LibraryPage({ games, accounts, syncing, onSync }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [onlyPlayed, setOnlyPlayed] = useState(false);

  const platforms = useMemo(() => {
    return [...new Set(games.map((g) => String(g.platform || '').toLowerCase()).filter(Boolean))].sort();
  }, [games]);

  useEffect(() => {
    setSelectedPlatforms(platforms);
  }, [platforms.join('|')]);

  const platformCounts = useMemo(() => {
    const map = new Map();
    for (const game of games) {
      const p = String(game.platform || 'unknown').toLowerCase();
      map.set(p, (map.get(p) || 0) + 1);
    }
    return map;
  }, [games]);

  const allPlatformsSelected =
    platforms.length > 0 && selectedPlatforms.length === platforms.length;

  const filteredSortedGames = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = games.filter((game) => {
      const platform = String(game.platform || '').toLowerCase();
      const name = String(game.name || '').toLowerCase();
      const passesPlatform = selectedPlatforms.includes(platform);
      const passesSearch = !q || name.includes(q) || platform.includes(q);
      const passesPlayed = !onlyPlayed || Number(game.playtime_minutes || 0) > 0;
      return passesPlatform && passesSearch && passesPlayed;
    });

    const list = [...filtered];
    switch (sortBy) {
      case 'name_desc':
        list.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
        break;
      case 'playtime_desc':
        list.sort((a, b) => Number(b.playtime_minutes || 0) - Number(a.playtime_minutes || 0));
        break;
      case 'playtime_asc':
        list.sort((a, b) => Number(a.playtime_minutes || 0) - Number(b.playtime_minutes || 0));
        break;
      case 'platform':
        list.sort((a, b) => String(a.platform || '').localeCompare(String(b.platform || '')));
        break;
      case 'name_asc':
      default:
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }
    return list;
  }, [games, onlyPlayed, search, selectedPlatforms, sortBy]);

  const togglePlatform = (platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  };

  const toggleAllPlatforms = () => {
    setSelectedPlatforms((prev) => {
      if (prev.length === platforms.length) return [];
      return [...platforms];
    });
  };

  return (
    <main className="mx-auto flex h-full min-h-0 w-[96vw] max-w-[1880px] gap-4 py-4">
      <aside className="surface-soft hidden w-[280px] shrink-0 select-none border border-border/70 bg-card p-4 lg:block">
        <p className="tech-label mb-3 text-muted-foreground">Filters</p>

        <div className="space-y-3">
          <p className="font-display text-sm uppercase tracking-[0.05em]">Platforms</p>
          <button
            type="button"
            onClick={toggleAllPlatforms}
            className="flex w-full items-center gap-2 rounded-md border border-border/80 bg-secondary px-3 py-2 text-left text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[transform,background-color,border-color] hover:-translate-y-px hover:bg-muted"
          >
            <span
              className={`inline-flex h-4 w-4 items-center justify-center border ${allPlatformsSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-transparent'}`}
            >
              <Check className="h-3 w-3" />
            </span>
            <span className="font-medium">Show all platforms</span>
          </button>
          <div className="space-y-1.5">
            {platforms.map((platform) => {
              const active = selectedPlatforms.includes(platform);
              return (
                <button
                  type="button"
                  key={platform}
                  onClick={() => togglePlatform(platform)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-[transform,background-color,border-color] hover:-translate-y-px ${active ? 'border-primary/40 bg-secondary text-foreground' : 'border-border/70 bg-muted text-muted-foreground hover:bg-secondary'}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center border ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-transparent'}`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="capitalize">{platform}</span>
                  </span>
                  <span className="rounded-full bg-background px-2 py-0.5 font-display text-[0.6875rem] uppercase">{platformCounts.get(platform) || 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <p className="font-display text-sm uppercase tracking-[0.05em]">Options</p>
          <button
            type="button"
            onClick={() => setOnlyPlayed((prev) => !prev)}
            className="flex w-full items-center gap-2 rounded-md border border-border/80 bg-secondary px-3 py-2 text-left text-sm text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[transform,background-color,border-color] hover:-translate-y-px hover:bg-muted"
          >
            <span
              className={`inline-flex h-4 w-4 items-center justify-center border ${onlyPlayed ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-transparent'}`}
            >
              <Check className="h-3 w-3" />
            </span>
            Show only played games
          </button>
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col border border-border/70 bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3">
          <div className="relative min-w-[230px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search games"
              className="border-border/80 bg-background/80 pl-9"
            />
          </div>

          <div className="w-[190px]">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="border-border/90 bg-secondary">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Name A-Z</SelectItem>
                <SelectItem value="name_desc">Name Z-A</SelectItem>
                <SelectItem value="playtime_desc">Playtime High-Low</SelectItem>
                <SelectItem value="playtime_asc">Playtime Low-High</SelectItem>
                <SelectItem value="platform">Platform</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={onSync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>

          <p className="select-none text-sm text-muted-foreground">{filteredSortedGames.length} games</p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {filteredSortedGames.map((game) => (
              <div key={`${game.platform}-${game.id}`} className="group select-none">
                <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border/70 bg-black/30 shadow-[0_10px_22px_rgba(0,0,0,0.2)] transition-transform duration-150 group-hover:-translate-y-0.5">
                    <GameCover game={game} src={game.image_url || game.metadata?.image_url} alt={game.name || 'game cover'} />
                </div>
                <div className="mt-2 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground">{game.name}</p>
                  <p className="text-xs uppercase text-muted-foreground">{String(game.platform || 'unknown')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function HomeDashboard({ games, accounts, syncing, onSync, onOpenLibrary }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [showPlayedOnly, setShowPlayedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('playtime_desc');
  const [pageSizeOption, setPageSizeOption] = useState('10');
  const [pageIndex, setPageIndex] = useState(0);

  const totalGames = games.length;
  const totalAccounts = accounts.length;
  const totalPlaytimeMinutes = games.reduce((sum, g) => sum + Number(g.playtime_minutes || 0), 0);
  const playedGames = games.filter((g) => Number(g.playtime_minutes || 0) > 0).length;

  const platformOptions = useMemo(
    () => ['all', ...new Set(games.map((g) => String(g.platform || '').toLowerCase()).filter(Boolean)).values()],
    [games],
  );

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return games.filter((game) => {
      const name = String(game.name || '').toLowerCase();
      const platform = String(game.platform || '').toLowerCase();
      const matchSearch = !q || name.includes(q) || platform.includes(q);
      const matchPlatform = platformFilter === 'all' || platform === platformFilter;
      const matchPlayed = !showPlayedOnly || Number(game.playtime_minutes || 0) > 0;
      return matchSearch && matchPlatform && matchPlayed;
    });
  }, [games, platformFilter, searchQuery, showPlayedOnly]);

  const sortedGames = useMemo(() => {
    const list = [...filteredGames];
    switch (sortBy) {
      case 'name_asc':
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        break;
      case 'name_desc':
        list.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
        break;
      case 'playtime_asc':
        list.sort((a, b) => Number(a.playtime_minutes || 0) - Number(b.playtime_minutes || 0));
        break;
      case 'platform':
        list.sort((a, b) => String(a.platform || '').localeCompare(String(b.platform || '')));
        break;
      case 'playtime_desc':
      default:
        list.sort((a, b) => Number(b.playtime_minutes || 0) - Number(a.playtime_minutes || 0));
    }
    return list;
  }, [filteredGames, sortBy]);

  const pageSize = pageSizeOption === 'all' ? Math.max(sortedGames.length, 1) : Number(pageSizeOption);
  const pageCount = Math.max(1, Math.ceil(sortedGames.length / pageSize));

  useEffect(() => {
    setPageIndex(0);
  }, [searchQuery, platformFilter, showPlayedOnly, sortBy, pageSizeOption]);

  useEffect(() => {
    if (pageIndex > pageCount - 1) setPageIndex(0);
  }, [pageCount, pageIndex]);

  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const pagedGames = sortedGames.slice(start, end);

  return (
    <main className="mx-auto flex h-full min-h-0 w-[96vw] max-w-[1880px] flex-col gap-4 py-4">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="h-full min-h-0">
          <CardHeader className="pb-2">
            <CardDescription className="tech-label">Total Games</CardDescription>
            <CardTitle className="text-3xl">{totalGames}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Owned titles across all synced platforms.</CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardDescription className="tech-label">Total Accounts</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Users2 className="h-6 w-6 text-primary" />
              {totalAccounts}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Steam, Epic, and GOG account sources.</CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardDescription className="tech-label">Played Titles</CardDescription>
            <CardTitle className="text-3xl">{playedGames}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Games with playtime greater than zero.</CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardDescription className="tech-label">Total Playtime</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Clock3 className="h-6 w-6 text-primary" />
              {(totalPlaytimeMinutes / 60).toFixed(1)}h
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Cumulative tracked hours across all games.</CardContent>
        </Card>
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Accounts Overview</CardTitle>
            <CardDescription>Connected platform accounts and totals.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={`${account.platform}-${account.account_ref}`} className="select-none rounded-lg border border-border/70 bg-muted p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_10px_20px_rgba(0,0,0,0.08)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium capitalize">{account.platform}</p>
                    <span className="rounded-full bg-background px-2 py-0.5 font-display text-[0.6875rem] uppercase text-muted-foreground">
                      {account.total_games} games
                    </span>
                  </div>
                  <p className="truncate pt-1 text-xs text-muted-foreground">{account.account_ref}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated flex h-full min-h-0 flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xl">My Games</CardTitle>
                <CardDescription>Your unified library with filters, search, and pagination.</CardDescription>
              </div>
              <Button onClick={onSync} disabled={syncing} variant="secondary">
                {syncing ? 'Syncing...' : 'Sync'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in My Games"
                  className="h-10 bg-background/80 pl-9"
                />
              </div>
              <div className="w-[200px]">
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="h-10 bg-secondary">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {platformOptions.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform === 'all' ? 'All platforms' : platform.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[200px]">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-10 bg-secondary">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="playtime_desc">Playtime High-Low</SelectItem>
                    <SelectItem value="playtime_asc">Playtime Low-High</SelectItem>
                    <SelectItem value="name_asc">Name A-Z</SelectItem>
                    <SelectItem value="name_desc">Name Z-A</SelectItem>
                    <SelectItem value="platform">Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto pr-1">
              <div className="space-y-2">
                {pagedGames.map((game) => (
                  <button
                  key={`${game.platform}-${game.id}`}
                  type="button"
                  onClick={onOpenLibrary}
                  className="flex w-full select-none items-center gap-3 rounded-xl border border-border/70 bg-muted p-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-[transform,background-color,border-color,box-shadow] hover:-translate-y-px hover:bg-secondary hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_12px_22px_rgba(0,0,0,0.14)]"
                >
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md border border-border/70 bg-black/30 shadow-[0_8px_18px_rgba(0,0,0,0.16)]">
                      <GameCover game={game} src={game.image_url || game.metadata?.image_url} alt={game.name || 'game cover'} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{game.name}</p>
                      <p className="text-xs uppercase text-muted-foreground">
                        {String(game.platform || 'unknown')} · {(Number(game.playtime_minutes || 0) / 60).toFixed(1)}h
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2 text-sm">
              <p className="text-muted-foreground">
                Showing {sortedGames.length === 0 ? 0 : start + 1}-{Math.min(end, sortedGames.length)} of {sortedGames.length}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rows</span>
                <div className="w-[110px]">
                  <Select value={pageSizeOption} onValueChange={setPageSizeOption}>
                    <SelectTrigger className="h-8 bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" variant="outline" disabled={pageIndex === 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
                  Prev
                </Button>
                <span className="text-muted-foreground">
                  {pageIndex + 1}/{pageCount}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export default function App() {
  const { route, navigate } = useRoute();
  const [games, setGames] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [gamesData, accountsData] = await Promise.all([
        requestJson('/api/games/latest'),
        requestJson('/api/accounts/latest'),
      ]);
      setGames(Array.isArray(gamesData) ? gamesData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
    } catch (e) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const syncNow = async () => {
    setSyncing(true);
    setError('');
    try {
      await requestJson('/api/sync', { method: 'POST' });
      await loadData();
    } catch (e) {
      setError(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-hero-gradient flex h-screen flex-col overflow-hidden">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-[96vw] max-w-[1880px] items-center justify-between py-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex select-none items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-secondary/55"
          >
            <img src="/app-icon.svg" alt="GameSyncD icon" className="logo-mono h-9 w-9 rounded-md" />
            <div>
              <p className="font-display text-lg font-semibold uppercase tracking-[0.05em]">{uiTheme.appName}</p>
              <p className="text-xs text-muted-foreground">{uiTheme.tagline}</p>
            </div>
          </button>

          <nav className="surface-soft flex select-none items-center gap-1 border border-border/80 bg-card p-1">
            <button
              type="button"
              onClick={() => navigate('/')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm uppercase tracking-[0.05em] transition-[transform,background-color,box-shadow] ${route === '/' ? 'bg-primary text-primary-foreground shadow-[0_10px_18px_rgba(0,0,0,0.16)]' : 'text-muted-foreground hover:-translate-y-px hover:bg-secondary'}`}
            >
              <Gamepad2 className="h-4 w-4" />
              Home
            </button>
            <button
              type="button"
              onClick={() => navigate('/library')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm uppercase tracking-[0.05em] transition-[transform,background-color,box-shadow] ${route === '/library' ? 'bg-primary text-primary-foreground shadow-[0_10px_18px_rgba(0,0,0,0.16)]' : 'text-muted-foreground hover:-translate-y-px hover:bg-secondary'}`}
            >
              <Library className="h-4 w-4" />
              Library
            </button>
          </nav>
        </div>
      </header>

      {error ? (
        <div className="mx-auto w-[96vw] max-w-[1880px] pt-3">
          <p className="rounded-md border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading library...</div>
      ) : route === '/library' ? (
        <LibraryPage games={games} accounts={accounts} syncing={syncing} onSync={syncNow} />
      ) : (
        <HomeDashboard
          games={games}
          accounts={accounts}
          syncing={syncing}
          onSync={syncNow}
          onOpenLibrary={() => navigate('/library')}
        />
      )}
    </div>
  );
}
