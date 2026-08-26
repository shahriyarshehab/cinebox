/**
 * CineBox Core Utilities & State Management
 * Shared across index.html and watch.html
 */

// ==========================================
//  Theme Management
// ==========================================
function initTheme() {
  const saved = localStorage.getItem('cinebox_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cinebox_theme', next);
}

initTheme();

// ==========================================
//  Toast Notification System
// ==========================================
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 2800);
}

// ==========================================
//  Watchlist Storage Engine
// ==========================================
function getWatchlist() {
  try {
    return JSON.parse(localStorage.getItem('cinebox_watchlist') || '[]');
  } catch (e) {
    return [];
  }
}

function isInWatchlist(title) {
  if (!title) return false;
  const list = getWatchlist();
  const clean = title.toLowerCase().trim();
  return list.some((m) => (m.title || '').toLowerCase().trim() === clean);
}

function toggleWatchlist(movieObj) {
  if (!movieObj || !movieObj.title) return false;
  const list = getWatchlist();
  const cleanTitle = (movieObj.title || '').toLowerCase().trim();
  const idx = list.findIndex((m) => (m.title || '').toLowerCase().trim() === cleanTitle);

  let isAdded = false;
  if (idx >= 0) {
    list.splice(idx, 1);
    showToast('Removed from Watchlist');
  } else {
    list.unshift(movieObj);
    showToast('Added to Watchlist');
    isAdded = true;
  }

  localStorage.setItem('cinebox_watchlist', JSON.stringify(list));
  updateWatchlistNavBadge();
  return isAdded;
}

function updateWatchlistNavBadge() {
  const list = getWatchlist();
  const badges = [document.getElementById('watchlistNavCount'), document.getElementById('mobWatchlistNavCount')];
  badges.forEach((badge) => {
    if (badge) {
      if (list.length > 0) {
        badge.textContent = list.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  });
}

// ==========================================
// ⏱ Playback History & Resume Engine
// ==========================================
function getWatchHistory() {
  try {
    return JSON.parse(localStorage.getItem('cinebox_watch_history') || '[]');
  } catch (e) {
    return [];
  }
}

function savePlaybackProgress(url, title, time, duration, extraData = {}) {
  if (!url || !duration || duration < 30 || time < 5) return;
  try {
    const history = getWatchHistory();
    const percent = Math.min(100, Math.round((time / duration) * 100));
    const entry = {
      title: title || 'Movie',
      url: url,
      poster: extraData.poster || '',
      tag: extraData.tag || 'HD',
      category: extraData.category || '',
      time: Math.floor(time),
      duration: Math.floor(duration),
      percent: percent,
      date: new Date().toISOString()
    };

    const existingIdx = history.findIndex((h) => h.url === url || (h.title && h.title === entry.title));
    if (existingIdx >= 0) history.splice(existingIdx, 1);
    history.unshift(entry);

    localStorage.setItem('cinebox_watch_history', JSON.stringify(history.slice(0, 30)));
  } catch (e) {}
}

function getPlaybackProgress(url, title) {
  try {
    const history = getWatchHistory();
    return history.find((h) => h.url === url || (h.title && title && h.title === title));
  } catch (e) {
    return null;
  }
}

function removeWatchHistory(url, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  let history = getWatchHistory();
  history = history.filter((h) => h.url !== url);
  localStorage.setItem('cinebox_watch_history', JSON.stringify(history));
  showToast('Removed from Continue Watching');
  if (typeof renderView === 'function') renderView();
}

// ==========================================
//  Recent Searches Manager
// ==========================================
const RECENT_SEARCHES_KEY = 'cinebox_recent_searches';

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveRecentSearch(query) {
  const clean = (query || '').trim();
  if (!clean || clean.length < 2) return;
  let list = getRecentSearches();
  list = list.filter((q) => q.toLowerCase() !== clean.toLowerCase());
  list.unshift(clean);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, 10)));
}

function removeRecentSearch(query, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  let list = getRecentSearches();
  list = list.filter((q) => q.toLowerCase() !== (query || '').toLowerCase());
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
}

function clearRecentSearches(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

// ==========================================
//  Fuzzy Search & Typo-Tolerance Algorithms
// ==========================================
function levenshteinDistance(s1, s2) {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyMatchScore(query, targetText) {
  if (!query || !targetText) return 0;
  const q = query.toLowerCase().trim();
  const t = targetText.toLowerCase().trim();

  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - (t.length - q.length);

  const subIdx = t.indexOf(q);
  if (subIdx >= 0) return 600 - subIdx;

  const qTokens = q.split(/[\s_.-]+/).filter(Boolean);
  const tTokens = t.split(/[\s_.-]+/).filter(Boolean);

  if (qTokens.length > 0) {
    let matchedTokens = 0;
    for (const qt of qTokens) {
      if (tTokens.some((tt) => tt.includes(qt))) {
        matchedTokens++;
      }
    }
    if (matchedTokens === qTokens.length) {
      return 500 + matchedTokens * 20;
    }
  }

  if (q.length >= 4) {
    for (const tt of tTokens) {
      if (tt.length >= 3) {
        const dist = levenshteinDistance(q, tt);
        const maxDist = q.length <= 5 ? 1 : 2;
        if (dist <= maxDist) {
          return 350 - dist * 50;
        }
      }
    }

    const titlePrefix = t.slice(0, q.length);
    const prefixDist = levenshteinDistance(q, titlePrefix);
    if (prefixDist <= (q.length <= 5 ? 1 : 2)) {
      return 300 - prefixDist * 50;
    }
  }

  return 0;
}

function filterFuzzyMatches(dataset, query, limit = 8) {
  if (!query || !dataset || dataset.length === 0) return [];
  const q = query.trim().toLowerCase();

  const scored = [];
  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    const obj = Array.isArray(item)
      ? {
          title: item[0] || '',
          poster: item[1] || '',
          url: item[2] || '',
          tag: item[3] || 'HD',
          category: item[4] || 'Cinema',
          size: item[5] || 'HD',
          date: item[6] || ''
        }
      : item;

    const titleScore = fuzzyMatchScore(q, obj.title);
    const catScore = obj.category && obj.category.toLowerCase().includes(q) ? 200 : 0;
    const tagScore = obj.tag && obj.tag.toLowerCase().includes(q) ? 150 : 0;

    const totalScore = Math.max(titleScore, catScore, tagScore);
    if (totalScore > 0) {
      scored.push({ obj, score: totalScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.obj);
}

// ==========================================
//  Subtitles Parser (.srt to .vtt converter)
// ==========================================
function srtToVtt(srtContent) {
  if (!srtContent) return '';
  let cleaned = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  cleaned = cleaned.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return 'WEBVTT\n\n' + cleaned;
}

// ==========================================
//  String, UI & Formatting Helpers
// ==========================================
function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
}

function escapeQuotesJson(obj) {
  return JSON.stringify(obj).replace(/"/g, '&quot;');
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function slideRow(rowId, direction) {
  const slider = document.getElementById(rowId);
  if (!slider) return;
  const cardWidth = 140;
  const scrollAmount = Math.max(cardWidth * 2, Math.floor(slider.clientWidth * 0.75)) * direction;
  slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

function isMediaSeries(item) {
  if (!item) return false;
  const tag = (item.tag || '').toLowerCase();
  const cat = (item.category || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  const url = item.url || '';
  return (
    tag.includes('series') ||
    tag.includes('drama') ||
    tag === 'tv' ||
    tag === 'tv series' ||
    cat.includes('series') ||
    cat.includes('drama') ||
    cat.includes('tv') ||
    title.includes('season') ||
    title.includes('s0') ||
    title.includes('s1') ||
    url.endsWith('/') ||
    url.includes('/tv/') ||
    url.includes('/series/')
  );
}

// ==========================================
//  PWA Install Promotion Engine
// ==========================================
let deferredPwaPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const dismissedUntil = localStorage.getItem('cinebox_pwa_dismissed');
  if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

  const banner = document.getElementById('pwaBanner');
  if (banner) banner.style.display = 'flex';
});

function installPwaApp() {
  if (!deferredPwaPrompt) {
    showToast('Install CineBox via browser menu (Add to Home Screen)');
    return;
  }
  deferredPwaPrompt.prompt();
  deferredPwaPrompt.userChoice.then((choice) => {
    if (choice.outcome === 'accepted') {
      showToast('Installing CineBox App...');
    }
    deferredPwaPrompt = null;
    dismissPwaBanner();
  });
}

function dismissPwaBanner() {
  const banner = document.getElementById('pwaBanner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('cinebox_pwa_dismissed', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
}

// ==========================================
// Lucide Icons Integration Engine
// ==========================================
const CINEBOX_ICON_PATHS = {
  'arrow-right': '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>',
  'arrow-left': '<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>',
  'play': '<polygon points="6 3 20 12 6 21 6 3"></polygon>',
  'tv': '<rect width="20" height="15" x="2" y="7" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline>',
  'film': '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M7 3v18"></path><path d="M17 3v18"></path><path d="M3 7.5h4"></path><path d="M3 12h18"></path><path d="M3 16.5h4"></path><path d="M17 16.5h4"></path><path d="M17 7.5h4"></path>',
  'sparkles': '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>',
  'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>',
  'search': '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>',
  'chevron-left': '<path d="m15 18-6-6 6-6"></path>',
  'chevron-right': '<path d="m9 18 6-6-6-6"></path>',
  'x': '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  'house': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
  'loader-2': '<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>'
};

function getLucideSvg(iconName, options = {}) {
  const cls = options.class || 'icon lucide-icon';
  const width = options.width || 18;
  const height = options.height || 18;
  const strokeWidth = options.strokeWidth || 2;
  const fill = options.fill || 'none';
  const stroke = options.stroke || 'currentColor';

  if (window.lucide) {
    const pascal = iconName
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');
    const iconsMap = window.lucide.icons || window.lucide;
    const iconDef = iconsMap[pascal] || iconsMap[iconName] || (window.lucide[pascal] || window.lucide[iconName]);

    if (iconDef && Array.isArray(iconDef)) {
      const children = iconDef
        .map(([tag, attrs]) => {
          const attrStr = Object.entries(attrs)
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ');
          return `<${tag} ${attrStr}></${tag}>`;
        })
        .join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${children}</svg>`;
    }
  }

  if (CINEBOX_ICON_PATHS[iconName]) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${CINEBOX_ICON_PATHS[iconName]}</svg>`;
  }

  return `<i data-lucide="${iconName}" style="width:${width}px;height:${height}px;"></i>`;
}

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    try {
      window.lucide.createIcons({
        attrs: {
          'stroke-width': 2,
          class: 'icon lucide-icon'
        }
      });
    } catch (e) {}
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', refreshLucideIcons);
} else {
  refreshLucideIcons();
}
