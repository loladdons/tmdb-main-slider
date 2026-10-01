/**
 * TMDB Main Slider — addon de función (mainSlider) para Nuvio Light
 *
 * Exports: getHome(ctx, config)
 * Respuesta normalizada:
 *   { title, items: [ { id, title, poster, backdrop, type, tmdbId, imdbId?, overview?, year?, rating? } ] }
 *
 * Config: api_key (obligatoria), language, media (all|movie|tv), limit
 */

const IMG = 'https://image.tmdb.org/t/p';
const BASE = 'https://api.themoviedb.org/3';

/** Clave del propio addon (la app no guarda API keys). */
const DEFAULT_API_KEY = 'a2d9bbed370d9f678e34006f8750a5a5';

function cfg(config, key, fallback) {
  if (!config) return fallback;
  const v = config[key];
  if (v == null || String(v).trim() === '') return fallback;
  return String(v).trim();
}

function posterUrl(path, size) {
  if (!path) return null;
  if (String(path).startsWith('http')) return String(path);
  return `${IMG}/${size || 'w500'}${path}`;
}

function backdropUrl(path) {
  if (!path) return null;
  if (String(path).startsWith('http')) return String(path);
  return `${IMG}/w1280${path}`;
}

function yearOf(item) {
  const d = item.release_date || item.first_air_date || '';
  return d ? String(d).slice(0, 4) : null;
}

function normalizeItem(item, mediaHint) {
  const mt = (item.media_type || mediaHint || 'movie').toString().toLowerCase();
  const isTv = mt === 'tv' || mt === 'series';
  const type = isTv ? 'series' : 'movie';
  const tmdbId = item.id != null ? String(item.id) : '';
  const title = (item.title || item.name || item.original_title || item.original_name || '').toString();
  if (!tmdbId || !title) return null;

  return {
    id: `tmdb:${type}:${tmdbId}`,
    title: title,
    type: type,
    poster: posterUrl(item.poster_path, 'w500'),
    backdrop: backdropUrl(item.backdrop_path) || posterUrl(item.poster_path, 'w780'),
    overview: item.overview ? String(item.overview) : null,
    year: yearOf(item),
    rating: typeof item.vote_average === 'number' ? item.vote_average : null,
    tmdbId: tmdbId,
    tmdb_id: tmdbId,
    media_type: isTv ? 'tv' : 'movie',
  };
}

/**
 * getHome(ctx, config) — usado por FunctionService si hay entry JS
 */
async function getHome(ctx, config) {
  // Prioridad: config del addon → clave embebida en este index.js
  const apiKey =
    cfg(config, 'api_key', '') ||
    cfg(config, 'apiKey', '') ||
    DEFAULT_API_KEY;
  if (!apiKey) {
    throw new Error('Este addon no trae api_key');
  }

  const language = cfg(config, 'language', 'es-MX');
  const media = cfg(config, 'media', 'all').toLowerCase();
  const limit = Math.max(1, Math.min(20, parseInt(cfg(config, 'limit', '8'), 10) || 8));

  let path;
  if (media === 'movie') {
    path = `/trending/movie/week`;
  } else if (media === 'tv') {
    path = `/trending/tv/week`;
  } else {
    path = `/trending/all/week`;
  }

  const url = `${BASE}${path}?api_key=${encodeURIComponent(apiKey)}&language=${encodeURIComponent(language)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB HTTP ${res.status} — ${url.replace(apiKey, '***')}`);
  }
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];

  const items = [];
  for (const raw of results) {
    // En trending/all a veces vienen person; saltarlos
    const mt = (raw.media_type || media || 'movie').toString().toLowerCase();
    if (mt === 'person') continue;
    const n = normalizeItem(raw, media === 'all' ? raw.media_type : media);
    if (n) items.push(n);
    if (items.length >= limit) break;
  }

  return {
    title: 'Destacados',
    kind: 'mainSlider',
    items: items,
  };
}

// Alias por si el runtime busca getMainSlider
async function getMainSlider(ctx, config) {
  return getHome(ctx, config);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getHome, getMainSlider, normalizeItem };
}
if (typeof globalThis !== 'undefined') {
  globalThis.getHome = getHome;
  globalThis.getMainSlider = getMainSlider;
}
