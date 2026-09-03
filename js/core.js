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

function triggerConfettiBurst() {
  try {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#00e5ff', '#ff2a5f', '#ffb800', '#ffffff']
      });
    }
  } catch (e) {}
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
    showToast('💖 Added to Watchlist');
    triggerConfettiBurst();
    isAdded = true;
  }

  localStorage.setItem('cinebox_watchlist', JSON.stringify(list));
  updateWatchlistNavBadge();
  return isAdded;
}

function updateWatchlistNavBadge() {
  try {
    const list = getWatchlist();
    const count = list.length;
    const badge = document.getElementById('watchlistNavCount');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    const mobBadge = document.getElementById('mobWatchlistNavCount');
    if (mobBadge) {
      mobBadge.textContent = count;
      mobBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  } catch (e) {}
}

// ==========================================
// 🔔 Future Updates & Release Tracker System
// ==========================================
function getMarkedUpdates() {
  try {
    return JSON.parse(localStorage.getItem('cinebox_marked_updates') || '[]');
  } catch (e) {
    return [];
  }
}

function isMarkedForUpdate(title) {
  if (!title) return false;
  const list = getMarkedUpdates();
  const clean = title.toLowerCase().trim();
  return list.some((m) => (m.title || '').toLowerCase().trim() === clean);
}

function toggleMarkedUpdate(movieObj) {
  if (!movieObj || !movieObj.title) return false;
  const list = getMarkedUpdates();
  const cleanTitle = (movieObj.title || '').toLowerCase().trim();
  const idx = list.findIndex((m) => (m.title || '').toLowerCase().trim() === cleanTitle);

  let isMarked = false;
  if (idx >= 0) {
    list.splice(idx, 1);
    showToast('🔔 Removed from Update Tracker');
  } else {
    list.unshift(movieObj);
    showToast('🔔 Marked for Future Updates! Tracking new releases.');
    triggerConfettiBurst();
    isMarked = true;
  }

  localStorage.setItem('cinebox_marked_updates', JSON.stringify(list));
  updateMarkedUpdatesBadge();
  return isMarked;
}

function updateMarkedUpdatesBadge() {
  const list = getMarkedUpdates();
  const badges = [document.getElementById('markedUpdatesCount'), document.getElementById('mobMarkedUpdatesCount')];
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

// ==========================================================================
// 🎬 Real Movie Name & Clean Title Sanitizer Engine
// Normalizes messy raw mother-server folder names into clean real titles
// e.g., "001. The.Shawshank.Redemption.1994.1080p.BluRay.Dual.Audio" -> "The Shawshank Redemption (1994)"
// ==========================================================================
function getCleanMovieTitle(rawTitle) {
  if (!rawTitle) return '';
  let title = String(rawTitle).trim();

  // 1. Remove file extensions (.mkv, .mp4, .avi, .webm, .m4v, .ts)
  title = title.replace(/\.(mp4|mkv|avi|webm|m4v|ts)$/i, '');

  // 2. Remove leading ranking/index numbers like "001. ", "012 - ", "1. "
  title = title.replace(/^\d{1,4}[\.\s\-–—]+\s*/, '');

  // 3. Clean up "(TV Series ...)", "(TV Mini Series ...)", "(TV Special ...)"
  title = title.replace(/\(TV\s*(?:Mini\s*|Special\s*)?Series\s*([^)]*)\)/gi, '($1)');

  // 4. Remove brackets and tags like [Dual Audio], [Multi Audio], [Hindi], [1080p], [HQ], etc.
  title = title.replace(/\[[^\]]*\]/g, ' ');

  // 5. Replace underscores with spaces
  title = title.replace(/_/g, ' ');

  // 6. Replace dots between words (e.g. Iron.Man.3 -> Iron Man 3)
  title = title.replace(/\./g, ' ');

  // 7. Remove resolution, quality, codec, source and release junk words
  const junkPatterns = [
    /\b(?:1080p|720p|576p|480p|360p|2160p|4k|uhd|fhd|hd|sd)\b/gi,
    /\b(?:bluray|brrip|bdrip|web-dl|webrip|web|dvdrip|hdtc|hdts|hd-ts|camrip|cam|telesync|ts|dvd|remux|hdtv)\b/gi,
    /\b(?:x264|x265|hevc|h264|h265|10bit|8bit|avc|xvid|divx)\b/gi,
    /\b(?:aac(?:[\.\s]?[0-9]\.[0-9])?|ac3|ddp?5\.1|dd5\.1|dts(?:-hd)?|truehd|atmos|mp3|flac|2ch|6ch)\b/gi,
    /\b(?:dual[\s\-]?audio|multi[\s\-]?audio|multi[\s\-]?dub|hindi[\s\-]?dubbed|tamil[\s\-]?dubbed|telugu[\s\-]?dubbed|bengali[\s\-]?dubbed|english[\s\-]?dubbed|dubbed)\b/gi,
    /\b(?:esub|esubs|subtitles|subs|msubs|softsub|hardsub)\b/gi,
    /\b(?:uncut|extended(?:\s*cut)?|director'?s(?:\s*cut)?|remastered|imax|proper|repack|unrated|theatrical(?:\s*cut)?|clean)\b/gi,
    /\b(?:amzn|nflx|ds4k|dsnp|hmax|zee5|hotstar|sonyliv|jiocinema|voot|aha|aha-web|jhs|mkvcinemas|hdhub(?:4u)?|katmoviehd|vegamovies|yify|yts|pahe(?:\.in)?|rarbg|psa|galaxyrg|tgx|fgt|olam|3xo|tigole|anoXmous|sartre|joy|sujaidr|sungeorge|msmod)\b/gi
  ];

  junkPatterns.forEach((pattern) => {
    title = title.replace(pattern, ' ');
  });

  // 8. Fix hyphenated subtitles like "Insidious-Out of the Further" -> "Insidious: Out of the Further"
  title = title.replace(/([a-zA-Z0-9])\s*-\s*([A-Z][a-z]+)/g, '$1: $2');

  // 9. Extract or normalize Year (YYYY) or (YYYY–YYYY)
  const yearMatch = title.match(/\b(19\d\d|20\d\d)(?:\s*[–—\-]\s*(19\d\d|20\d\d|present|\s*))?\b/i);
  let yearStr = '';
  if (yearMatch) {
    yearStr = yearMatch[0].trim();
    title = title.replace(yearMatch[0], ' ');
  }

  // 10. Clean up residual punctuation and whitespace
  title = title
    .replace(/[\[\]\(\)\{\}]/g, ' ')
    .replace(/[\s\-–—:_]+$/, '')
    .replace(/^[\s\-–—:_]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 11. Append clean year if found
  if (yearStr) {
    const cleanYear = yearStr.replace(/\s+/g, '').replace(/-/g, '–');
    title = `${title} (${cleanYear})`;
  }

  return title.trim() || rawTitle;
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
//  String, UI & Security Formatting Helpers
// ==========================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  // Safe protocols or relative URLs
  if (/^(?:https?:\/\/|\/|\.\/|\.\.\/|blob:|data:image\/)/i.test(trimmed)) {
    return trimmed;
  }
  // Safe custom player schemes
  if (/^(?:vlc:\/\/|intent:\/\/|potplayer:\/\/)/i.test(trimmed)) {
    return trimmed;
  }
  return '#';
}

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
  'movie': '<path fill-rule="evenodd" clip-rule="evenodd" d="M8.99987 4.45459C8.24714 4.45459 7.63623 5.0655 7.63623 5.81823C7.63623 6.57095 8.24714 7.18186 8.99987 7.18186C9.75259 7.18186 10.3635 6.57095 10.3635 5.81823C10.3635 5.0655 9.75259 4.45459 8.99987 4.45459Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M8.99987 10.6399C8.24714 10.6399 7.63623 11.2508 7.63623 12.0035C7.63623 12.7563 8.24714 13.3672 8.99987 13.3672C9.75259 13.3672 10.3635 12.7563 10.3635 12.0035C10.3635 11.2508 9.75259 10.6399 8.99987 10.6399Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.0922 7.54724C11.3394 7.54724 10.7285 8.15815 10.7285 8.91088C10.7285 9.6636 11.3394 10.2745 12.0922 10.2745C12.8449 10.2745 13.4558 9.6636 13.4558 8.91088C13.4558 8.15815 12.8449 7.54724 12.0922 7.54724Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M5.90758 7.54724C5.15485 7.54724 4.54395 8.15815 4.54395 8.91088C4.54395 9.6636 5.15485 10.2745 5.90758 10.2745C6.66031 10.2745 7.27122 9.6636 7.27122 8.91088C7.27122 8.15815 6.66031 7.54724 5.90758 7.54724Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M15.525 9C15.525 12.6037 12.6037 15.525 9 15.525C5.39634 15.525 2.475 12.6037 2.475 9C2.475 5.39634 5.39634 2.475 9 2.475C12.6037 2.475 15.525 5.39634 15.525 9ZM9.17896 16.873C9.11947 16.8743 9.05981 16.875 9 16.875C4.65076 16.875 1.125 13.3492 1.125 9C1.125 4.65076 4.65076 1.125 9 1.125C13.3492 1.125 16.875 4.65076 16.875 9C16.875 11.715 15.501 14.1092 13.4105 15.525H16.5C16.8728 15.525 17.175 15.8272 17.175 16.2C17.175 16.5728 16.8728 16.875 16.5 16.875H9.23129C9.21368 16.875 9.19623 16.8743 9.17896 16.873Z" fill="currentColor"/>',
  'movies': '<path fill-rule="evenodd" clip-rule="evenodd" d="M8.99987 4.45459C8.24714 4.45459 7.63623 5.0655 7.63623 5.81823C7.63623 6.57095 8.24714 7.18186 8.99987 7.18186C9.75259 7.18186 10.3635 6.57095 10.3635 5.81823C10.3635 5.0655 9.75259 4.45459 8.99987 4.45459Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M8.99987 10.6399C8.24714 10.6399 7.63623 11.2508 7.63623 12.0035C7.63623 12.7563 8.24714 13.3672 8.99987 13.3672C9.75259 13.3672 10.3635 12.7563 10.3635 12.0035C10.3635 11.2508 9.75259 10.6399 8.99987 10.6399Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.0922 7.54724C11.3394 7.54724 10.7285 8.15815 10.7285 8.91088C10.7285 9.6636 11.3394 10.2745 12.0922 10.2745C12.8449 10.2745 13.4558 9.6636 13.4558 8.91088C13.4558 8.15815 12.8449 7.54724 12.0922 7.54724Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M5.90758 7.54724C5.15485 7.54724 4.54395 8.15815 4.54395 8.91088C4.54395 9.6636 5.15485 10.2745 5.90758 10.2745C6.66031 10.2745 7.27122 9.6636 7.27122 8.91088C7.27122 8.15815 6.66031 7.54724 5.90758 7.54724Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M15.525 9C15.525 12.6037 12.6037 15.525 9 15.525C5.39634 15.525 2.475 12.6037 2.475 9C2.475 5.39634 5.39634 2.475 9 2.475C12.6037 2.475 15.525 5.39634 15.525 9ZM9.17896 16.873C9.11947 16.8743 9.05981 16.875 9 16.875C4.65076 16.875 1.125 13.3492 1.125 9C1.125 4.65076 4.65076 1.125 9 1.125C13.3492 1.125 16.875 4.65076 16.875 9C16.875 11.715 15.501 14.1092 13.4105 15.525H16.5C16.8728 15.525 17.175 15.8272 17.175 16.2C17.175 16.5728 16.8728 16.875 16.5 16.875H9.23129C9.21368 16.875 9.19623 16.8743 9.17896 16.873Z" fill="currentColor"/>',
  'sparkles': '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>',
  'animation': '<path d="M2.43642 7.06155L3.06914 7.29671C3.18173 6.99376 3.06378 6.65351 2.78785 6.48525L2.43642 7.06155ZM1.40192 2.99999L1.98649 3.33749L1.40192 2.99999ZM15.5635 7.06124L15.212 6.48495C14.9361 6.65322 14.8182 6.99348 14.9308 7.29643L15.5635 7.06124ZM16.5981 3L16.0135 3.3375V3.3375L16.5981 3ZM12.4996 1.9013L12.1621 1.31674L12.1621 1.31674L12.4996 1.9013ZM11.4384 2.93639L11.2032 3.56911C11.5063 3.68176 11.8468 3.56363 12.0149 3.28744L11.4384 2.93639ZM6.56186 2.9363L5.98529 3.28729C6.15344 3.56351 6.49386 3.68167 6.79699 3.56903L6.56186 2.9363ZM5.50052 1.90101L5.16302 2.48557L5.16302 2.48557L5.50052 1.90101ZM2.78785 6.48525C1.7141 5.83049 1.35361 4.43367 1.98649 3.33749L0.817356 2.66249C-0.182679 4.3946 0.3866 6.60219 2.085 7.63786L2.78785 6.48525ZM2.675 9.5C2.675 8.7239 2.81448 7.98191 3.06914 7.29671L1.80371 6.8264C1.49395 7.65984 1.325 8.56095 1.325 9.5H2.675ZM9 15.825C5.5068 15.825 2.675 12.9932 2.675 9.5H1.325C1.325 13.7388 4.76122 17.175 9 17.175V15.825ZM15.325 9.5C15.325 12.9932 12.4932 15.825 9 15.825V17.175C13.2388 17.175 16.675 13.7388 16.675 9.5H15.325ZM14.9308 7.29643C15.1855 7.98171 15.325 8.72379 15.325 9.5H16.675C16.675 8.56083 16.506 7.65959 16.1962 6.82606L14.9308 7.29643ZM16.0135 3.3375C16.6463 4.43345 16.2858 5.83014 15.212 6.48495L15.9149 7.63754C17.6132 6.6019 18.1826 4.3945 17.1826 2.6625L16.0135 3.3375ZM12.8371 2.48587C13.949 1.84392 15.3712 2.225 16.0135 3.3375L17.1826 2.6625C16.1677 0.904566 13.92 0.301837 12.1621 1.31674L12.8371 2.48587ZM12.0149 3.28744C12.2104 2.96635 12.4868 2.68812 12.8371 2.48587L12.1621 1.31674C11.611 1.63495 11.1721 2.07584 10.8619 2.58534L12.0149 3.28744ZM9 3.175C9.77609 3.175 10.5181 3.31446 11.2032 3.56911L11.6735 2.30368C10.8401 1.99394 9.93902 1.825 9 1.825V3.175ZM6.79699 3.56903C7.48211 3.31443 8.224 3.175 9 3.175V1.825C8.06108 1.825 7.16008 1.9939 6.32674 2.30358L6.79699 3.56903ZM5.16302 2.48557C5.51336 2.68784 5.78978 2.96613 5.98529 3.28729L7.13843 2.58532C6.8282 2.0757 6.38928 1.63471 5.83802 1.31644L5.16302 2.48557ZM1.98649 3.33749C2.62892 2.22477 4.05119 1.84365 5.16302 2.48557L5.83802 1.31644C4.08011 0.301505 1.83236 0.904456 0.817356 2.66249L1.98649 3.33749Z" fill="currentColor"/><circle cx="6.25" cy="7.75" r="0.75" fill="currentColor"/><circle cx="11.75" cy="7.75" r="0.75" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M8.65 11.0479L8.01119 11.6441C7.86988 11.776 7.86224 11.9975 7.99413 12.1388C8.12602 12.2801 8.3475 12.2878 8.48881 12.1559L9 11.6788L9.51119 12.1559C9.6525 12.2878 9.87398 12.2801 10.0059 12.1388C10.1378 11.9975 10.1301 11.776 9.98881 11.6441L9.35 11.0479V10.937C9.72967 10.7952 10 10.4292 10 10H8C8 10.4292 8.27033 10.7952 8.65 10.937V11.0479Z" fill="currentColor"/>',
  'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>',
  'search': '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>',
  'chevron-left': '<path d="m15 18-6-6 6-6"></path>',
  'chevron-right': '<path d="m9 18 6-6-6-6"></path>',
  'x': '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  'house': '<path d="M8.46875 2.08008C8.73744 1.85383 9.11437 1.82542 9.41016 1.99512L9.53125 2.08008L15.1562 6.81641C15.3424 6.97316 15.4502 7.20489 15.4502 7.44824V15C15.4502 15.4556 15.0806 15.8252 14.625 15.8252H11.25C11.2086 15.8252 11.1748 15.7914 11.1748 15.75V11.625C11.1748 11.2522 10.8728 10.9502 10.5 10.9502H7.5C7.12721 10.9502 6.8252 11.2522 6.8252 11.625V15.75C6.8252 15.7914 6.79142 15.8252 6.75 15.8252H3.375C2.91937 15.8252 2.5498 15.4556 2.5498 15V7.44824C2.5498 7.23534 2.63212 7.03144 2.77734 6.87891L2.84375 6.81641L8.46875 2.08008Z" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>',
  'home': '<path d="M8.46875 2.08008C8.73744 1.85383 9.11437 1.82542 9.41016 1.99512L9.53125 2.08008L15.1562 6.81641C15.3424 6.97316 15.4502 7.20489 15.4502 7.44824V15C15.4502 15.4556 15.0806 15.8252 14.625 15.8252H11.25C11.2086 15.8252 11.1748 15.7914 11.1748 15.75V11.625C11.1748 11.2522 10.8728 10.9502 10.5 10.9502H7.5C7.12721 10.9502 6.8252 11.2522 6.8252 11.625V15.75C6.8252 15.7914 6.79142 15.8252 6.75 15.8252H3.375C2.91937 15.8252 2.5498 15.4556 2.5498 15V7.44824C2.5498 7.23534 2.63212 7.03144 2.77734 6.87891L2.84375 6.81641L8.46875 2.08008Z" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>',
  'loader-2': '<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>'
};

function getLucideSvg(iconName, options = {}) {
  const cls = options.class || 'icon lucide-icon';
  const width = options.width || 18;
  const height = options.height || 18;
  const strokeWidth = options.strokeWidth || 2;
  const fill = options.fill || 'none';
  const stroke = options.stroke || 'currentColor';

  if (iconName === 'animation') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 18 18" fill="none" class="${cls}">${CINEBOX_ICON_PATHS['animation']}</svg>`;
  }
  if (iconName === 'movie' || iconName === 'movies') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 18 18" fill="none" class="${cls}">${CINEBOX_ICON_PATHS['movie']}</svg>`;
  }
  if (iconName === 'home' || iconName === 'house') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 18 18" fill="none" class="${cls}">${CINEBOX_ICON_PATHS['home']}</svg>`;
  }

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
    const viewBox = (iconName === 'animation' || iconName === 'sparkles') ? '0 0 18 18' : '0 0 24 24';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${CINEBOX_ICON_PATHS[iconName]}</svg>`;
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
  document.addEventListener('DOMContentLoaded', () => {
    refreshLucideIcons();
    setupSpaPageRouter();
  });
} else {
  refreshLucideIcons();
  setupSpaPageRouter();
}

// ==========================================
// 🚀 Modern Live SPA Instant Page Router
// ==========================================
function setupSpaPageRouter() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    try {
      const targetUrl = new URL(href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;

      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      const targetPath = targetUrl.pathname.split('/').pop() || 'index.html';

      // If clicking same page with hash only
      if (currentPath === targetPath && targetUrl.search === window.location.search) return;

      e.preventDefault();
      navigateToSpaPage(targetUrl.href);
    } catch (err) {}
  });

  window.addEventListener('popstate', () => {
    navigateToSpaPage(window.location.href, false);
  });
}

async function navigateToSpaPage(url, push = true) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      window.location.href = url;
      return;
    }
    const htmlText = await res.text();
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(htmlText, 'text/html');

    const updateDom = () => {
      document.title = newDoc.title;

      const newMain = newDoc.querySelector('main');
      const currentMain = document.querySelector('main');
      if (newMain && currentMain) {
        currentMain.innerHTML = newMain.innerHTML;
        currentMain.className = newMain.className;
        currentMain.id = newMain.id;
      }

      // Update active nav links
      const currentPath = new URL(url).pathname.split('/').pop() || 'index.html';
      document.querySelectorAll('.nav-link, .mobile-nav-btn').forEach((nav) => {
        const navHref = (nav.getAttribute('href') || '').split('/').pop() || 'index.html';
        const isActive = navHref === currentPath;
        nav.classList.toggle('active', isActive);
      });

      if (push) {
        window.history.pushState(null, '', url);
      }

      window.scrollTo({ top: 0, behavior: 'instant' });
      refreshLucideIcons();

      // Trigger page initializers
      if (typeof initApp === 'function') initApp();
      if (typeof initWatchPage === 'function') initWatchPage();
    };

    if (document.startViewTransition) {
      document.startViewTransition(() => updateDom());
    } else {
      updateDom();
    }
  } catch (err) {
    window.location.href = url;
  }
}
