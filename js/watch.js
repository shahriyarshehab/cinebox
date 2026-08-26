/**
 * CineBox MovieBox-Style Details & Dedicated Online Player Controller
 * By default: Displays MovieBox details page (No video player / No autoplay)
 * When clicking "Watch Online" or an Episode: Seamlessly opens focused Player Mode
 */

let currentItem = null;
let currentActiveStreamUrl = '';
let currentActiveStreamTitle = '';
let tvCatalog = {};
let currentTvEntry = null;
let motherFolderSpecials = [];
let currentSeasonEpisodes = [];
let currentPlayingEpisodeIdx = -1;
let currentSeasonName = 'Season 1';
let currentSelectedSeasonIdx = 0;
let episodeFilterQuery = '';
let isSynopsisExpanded = false;
let isPlayerMode = false;

// ==========================================================================
// 🎛️ CineBox Player Customization & Settings Engine State
// ==========================================================================
const DEFAULT_PLAYER_SETTINGS = {
    videoFilter: 'normal', // normal, vivid, cinema, night, crisp, oled
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    ambientMode: 'sync', // sync, accent, off
    ambientIntensity: 75,
    aspectRatio: 'contain', // contain, cover, 16/9, 4/3, 21/9
    audioBoostGain: 100, // 100 to 300%
    audioProfile: 'standard', // standard, dialogue, bass, night
    subSize: 18,
    subColor: '#ffffff',
    subColorName: 'White',
    subBgStyle: 'translucent', // translucent, solid, shadow, outline
    subSyncOffset: 0.0, // in seconds
    seekStep: 10, // 5, 10, 15, 30, 60
    defaultSpeed: 1.0,
    gestureBrightness: true,
    gestureVolume: true,
    gestureDoubleTap: true,
    autoResume: true,
    autoPlayNext: true,
    wakeLock: true,
    autoHideDelay: 3500, // ms, 0 = never
    themeName: 'cyan',
    themeColor: '#00e5ff',
    themeTitle: 'Cyber Cyan',
    sleepTimer: 0 // 0 = off, or minutes
};

let playerSettings = { ...DEFAULT_PLAYER_SETTINGS };

// Player Runtime State
const playbackSpeeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
let currentSpeedIdx = 2; // 1.0x
const aspectRatios = ['contain', 'cover', '16/9', '4/3', '21/9'];
let currentAspectIdx = 0;
let nextEpCountdownTimer = null;
let currentSubtitleTrack = null;
let isControlsLocked = false;
let isTheaterMode = false;
let isTimeRemainingMode = false;
let controlsHideTimer = null;
let sleepTimeoutId = null;
let wakeLockSentinel = null;

// Audio Booster Web Audio API Nodes
let audioCtx = null;
let audioSourceNode = null;
let audioGainNode = null;
let audioFilterNode = null;
let audioCompressorNode = null;
let isAudioEngineInitialized = false;

// Official VLC Cone SVG
const VLC_ICON_SVG = `
    <svg class="icon" viewBox="0 0 512 512" width="14" height="14" aria-label="VLC" style="vertical-align: middle;">
        <g fill="#f7901e">
            <path d="M437 400l-36-94c-3-10-13-16-23-16H134c-10 0-20 6-23 16l-36 94c-2 3-2 7-2 11 0 16 13 29 29 29h308a29 29 0 0 0 27-40z"/>
            <path d="M299 109l-15-51c-3-11-13-18-24-18h-8c-11 0-21 7-24 18l-15 51a307 307 0 0 0 86 0zM256 183c-24 0-46-2-64-6l-19 65c20 8 49 13 83 13s63-5 83-13l-20-65c-17 4-39 6-63 6z"/>
        </g>
        <g fill="#ffffff">
            <path d="M319 177l-20-68a307 307 0 0 1-86 0l-21 68c18 4 40 6 64 6s46-2 63-6z"/>
            <path d="M173 242l-18 62c19 14 55 23 101 23s82-9 101-23l-18-62c-20 8-49 13-83 13s-63-5-83-13z"/>
        </g>
    </svg>
`;

// Official MX Player SVG from SVGRepo (518012/mx)
const MX_ICON_SVG = `
    <svg class="icon" viewBox="0 0 48 48" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="MX Player" style="vertical-align: middle;">
        <path d="M24,2.5A21.5,21.5,0,1,0,45.5,24,21.51,21.51,0,0,0,24,2.5ZM18.07,13.14a1.42,1.42,0,0,1,.82.23l15.75,10.2a1.44,1.44,0,0,1,0,2.41L18.89,36.18A1.44,1.44,0,0,1,16.67,35V14.57a1.43,1.43,0,0,1,1.4-1.43Z"/>
    </svg>
`;

async function initWatch() {
    updateWatchlistNavBadge();
    loadPlayerSettings();
    applyAllPlayerSettings();

    const urlParams = new URLSearchParams(window.location.search);
    const targetTitle = urlParams.get('title');
    const dataParam = urlParams.get('data');
    const shouldAutoPlay = urlParams.get('play') === '1' || urlParams.get('play') === 'true';

    // 1. Match from query parameter or sessionStorage
    if (dataParam) {
        try {
            currentItem = JSON.parse(decodeURIComponent(dataParam));
        } catch (e) {}
    }

    const cachedHome = sessionStorage.getItem('cinebox_home_v2');
    if (!currentItem && targetTitle && cachedHome) {
        try {
            const hData = JSON.parse(cachedHome);
            const cleanT = targetTitle.toLowerCase().trim();
            for (const m of (hData.carousel || [])) {
                const mTitle = (Array.isArray(m) ? m[0] : m.title) || '';
                if (mTitle.toLowerCase().trim() === cleanT) {
                    currentItem = Array.isArray(m) ? {
                        title: m[0], poster: m[1], url: m[2], tag: m[3], category: m[4], size: m[5], date: m[6]
                    } : m;
                    break;
                }
            }
            if (!currentItem && hData.categories) {
                for (const catList of Object.values(hData.categories)) {
                    for (const m of catList) {
                        const mTitle = (Array.isArray(m) ? m[0] : m.title) || '';
                        if (mTitle.toLowerCase().trim() === cleanT) {
                            currentItem = Array.isArray(m) ? {
                                title: m[0], poster: m[1], url: m[2], tag: m[3], category: m[4], size: m[5], date: m[6]
                            } : m;
                            break;
                        }
                    }
                    if (currentItem) break;
                }
            }
        } catch (e) {}
    }

    if (currentItem) {
        renderWatchPage(currentItem);
    }

    // 2. Load TV Catalog index if TV series
    fetch('./tv_index.json')
        .then(r => r.json())
        .then(data => {
            tvCatalog = data || {};
            if (currentItem && (currentItem.tag === 'TV Series' || currentItem.tag === 'K-Drama' || (currentItem.url && currentItem.url.endsWith('/')))) {
                loadTvSeriesSeasons(currentItem.url, currentItem.title);
            }
        })
        .catch(e => console.warn(e));

    // 3. Fallback modular category lookup
    if (!currentItem && targetTitle) {
        try {
            const cleanTitle = targetTitle.toLowerCase().trim();
            const categoryFiles = [
                'data/kdrama.json', 'data/tv_series.json', 'data/hollywood.json',
                'data/bollywood.json', 'data/south_action.json', 'data/south_original.json',
                'data/animation.json', 'data/bangla.json', 'data/foreign.json',
                'data/top_rated.json', 'data/3d.json', 'data/english.json'
            ];

            for (const f of categoryFiles) {
                try {
                    const res = await fetch(`./${f}`);
                    if (res.ok) {
                        const list = await res.json();
                        for (const m of list) {
                            const mTitle = Array.isArray(m) ? m[0] : m.title;
                            if (mTitle && mTitle.toLowerCase().trim() === cleanTitle) {
                                currentItem = Array.isArray(m) ? {
                                    title: m[0], poster: m[1], url: m[2], tag: m[3], category: m[4], size: m[5], date: m[6]
                                } : m;
                                break;
                            }
                        }
                        if (currentItem) break;
                    }
                } catch (e) {}
            }

            if (currentItem) {
                renderWatchPage(currentItem);
            } else {
                document.getElementById('wTitle').textContent = 'Title Not Found';
            }
        } catch (err) {
            console.error(err);
        }
    }

    setupPlayerListeners();
    setupDoubleTapSeekControls();
    setupSubtitleDragAndDrop();
    setupSearchKeybindings();
    setupCustomPlayerControls();
    setupMobileTouchGestures();
    setupCustomScrubber();

    // Auto-enter player mode only if explicitly requested in URL (e.g. ?play=1)
    if (shouldAutoPlay && currentItem && currentItem.url) {
        enterPlayerMode(currentItem.url, currentItem.title);
    }
}

// ==========================================
// 🌐 Real-Time Online Movie & Series Metadata Engine
// ==========================================
function parseCleanMediaInfo(rawTitle) {
    if (!rawTitle) return { cleanName: '', year: '', isSeries: false };
    let title = rawTitle.trim().replace(/^\d+\.\s*/, '');
    const isSeries = /TV\s*(Series|Mini\s*Series)?/i.test(title);
    const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : '';

    let cleanName = title
        .replace(/\(TV\s*(Series|Mini\s*Series)?[^)]*\)/gi, '')
        .replace(/\((19\d{2}|20\d{2})[^)]*\)/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\b(1080p|720p|480p|576p|2160p|4K|WEB-?DL|BluRay|HD|HDRip|DVDRip|Dual\s*Audio|Multi\s*Audio|Hindi\s*Dubbed|UNCUT|REM|HEVC|x265|x264|AAC|ESub|DDR|AMZN|DSNP|NF)\b/gi, '')
        .replace(/[._]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return { cleanName, year, isSeries };
}

const OMDB_API_KEYS = ['trilogy', 'b7da8d63', 'd63a8a37', 'a8c17b8f'];

let preloadedMetaCache = null;

async function getPreloadedMetaCache() {
    if (preloadedMetaCache) return preloadedMetaCache;
    try {
        const res = await fetch('./metadata_cache.json');
        if (res.ok) {
            preloadedMetaCache = await res.json();
            return preloadedMetaCache;
        }
    } catch(e) {}
    return {};
}

async function fetchOnlineMetadata(rawTitle, fallbackCategory = '') {
    const { cleanName, year, isSeries } = parseCleanMediaInfo(rawTitle);
    if (!cleanName) return null;

    // Check preloaded static cache first (0ms instantaneous)
    const preloaded = await getPreloadedMetaCache();
    if (preloaded && preloaded[cleanName.toLowerCase()]) {
        return preloaded[cleanName.toLowerCase()];
    }

    const cacheKey = `cinebox_meta_${cleanName.toLowerCase()}_${year || ''}`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed._cachedAt < 1000 * 60 * 60 * 24 * 14) {
                return parsed.data;
            }
        }
    } catch (e) {}

    let meta = null;

    // 1. Try OMDb API with failover keys
    for (const key of OMDB_API_KEYS) {
        try {
            const url = `https://www.omdbapi.com/?t=${encodeURIComponent(cleanName)}${year ? '&y=' + year : ''}&plot=full&apikey=${key}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.Response === 'True') {
                    const ratings = data.Ratings || [];
                    const imdbObj = ratings.find(r => r.Source.includes('Internet Movie') || r.Source.includes('IMDb'));
                    const rtObj = ratings.find(r => r.Source.includes('Rotten Tomatoes'));
                    const metaObj = ratings.find(r => r.Source.includes('Metacritic'));

                    meta = {
                        title: data.Title,
                        year: data.Year,
                        releaseDate: data.Released && data.Released !== 'N/A' ? data.Released : null,
                        runtime: data.Runtime && data.Runtime !== 'N/A' ? data.Runtime : null,
                        rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : null,
                        genres: data.Genre && data.Genre !== 'N/A' ? data.Genre.split(',').map(g => g.trim()) : [],
                        director: data.Director && data.Director !== 'N/A' ? data.Director : null,
                        writer: data.Writer && data.Writer !== 'N/A' ? data.Writer : null,
                        actors: data.Actors && data.Actors !== 'N/A' ? data.Actors.split(',').map(a => a.trim()) : [],
                        synopsis: data.Plot && data.Plot !== 'N/A' ? data.Plot : null,
                        awards: data.Awards && data.Awards !== 'N/A' ? data.Awards : null,
                        boxOffice: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
                        country: data.Country && data.Country !== 'N/A' ? data.Country : null,
                        language: data.Language && data.Language !== 'N/A' ? data.Language : null,
                        imdbRating: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : (imdbObj ? imdbObj.Value.split('/')[0] : null),
                        rottenTomatoes: rtObj ? rtObj.Value : null,
                        metascore: data.Metascore && data.Metascore !== 'N/A' ? data.Metascore : (metaObj ? metaObj.Value.split('/')[0] : null),
                        poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : null
                    };
                    break;
                }
            }
        } catch (e) {}
    }

    // 2. If Series or TVMaze lookup
    if (!meta && (isSeries || fallbackCategory.includes('TV') || fallbackCategory.includes('Drama') || fallbackCategory.includes('Series'))) {
        try {
            const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanName)}&embed=cast`);
            if (res.ok) {
                const data = await res.json();
                const summary = (data.summary || '').replace(/<[^>]*>/g, '').trim();
                const embeddedCast = (data._embedded && Array.isArray(data._embedded.cast)) ? data._embedded.cast.slice(0, 10).map(c => ({
                    name: c.person ? c.person.name : '',
                    character: c.character ? c.character.name : 'Cast',
                    image: (c.person && c.person.image) ? (c.person.image.medium || c.person.image.original) : null
                })).filter(c => c.name) : [];

                meta = {
                    title: data.name,
                    year: data.premiered ? data.premiered.slice(0, 4) : year,
                    releaseDate: data.premiered || null,
                    imdbRating: data.rating && data.rating.average ? data.rating.average.toString() : null,
                    runtime: data.averageRuntime ? `${data.averageRuntime} min` : null,
                    genres: data.genres || [],
                    actors: embeddedCast,
                    synopsis: summary,
                    network: data.network ? data.network.name : (data.webChannel ? data.webChannel.name : null),
                    poster: data.image ? (data.image.original || data.image.medium) : null,
                    backdrop: data.image ? data.image.original : null
                };
            }
        } catch (e) {}
    }

    // 3. Fallback to Wikipedia REST API
    if (!meta) {
        try {
            const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName.replace(/\s+/g, '_'))}`);
            if (wikiRes.ok) {
                const wiki = await wikiRes.json();
                if (wiki.extract && !wiki.title.toLowerCase().includes('disambiguation')) {
                    meta = {
                        title: wiki.title,
                        year: year,
                        synopsis: wiki.extract,
                        backdrop: wiki.originalimage ? wiki.originalimage.source : (wiki.thumbnail ? wiki.thumbnail.source : null)
                    };
                }
            }
        } catch (e) {}
    }

    if (meta) {
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ _cachedAt: Date.now(), data: meta }));
        } catch (e) {}
    }

    return meta;
}

async function getActorPortraitPhoto(actorName) {
    if (!actorName) return null;
    const cacheKey = `cinebox_actor_${actorName.toLowerCase().replace(/\s+/g, '_')}`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) return cached;
    } catch(e) {}
    try {
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(actorName.replace(/\s+/g, '_'))}`);
        if (res.ok) {
            const data = await res.json();
            if (data.thumbnail && data.thumbnail.source) {
                try { localStorage.setItem(cacheKey, data.thumbnail.source); } catch(e) {}
                return data.thumbnail.source;
            }
        }
    } catch(e) {}
    return null;
}

let currentTrailerQuery = '';

function openTrailerModal(customQuery) {
    const q = customQuery || currentTrailerQuery || (currentItem ? currentItem.title : 'Trailer');
    const modal = document.getElementById('trailerModal');
    const iframe = document.getElementById('trailerIframe');
    const titleEl = document.getElementById('trailerModalTitle');

    if (titleEl) titleEl.textContent = `${q} — Official Trailer`;
    if (iframe) {
        // Embed official YouTube search player
        iframe.src = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(q + ' official trailer')}&autoplay=1`;
    }
    if (modal) modal.style.display = 'flex';
}

function closeTrailerModal() {
    const modal = document.getElementById('trailerModal');
    const iframe = document.getElementById('trailerIframe');
    if (iframe) iframe.src = '';
    if (modal) modal.style.display = 'none';
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('trailerModal');
    if (modal && e.target === modal) {
        closeTrailerModal();
    }
});

async function loadAndApplyOnlineMetadata(item) {
    if (!item || !item.title) return;
    try {
        const meta = await fetchOnlineMetadata(item.title, item.category || item.tag);
        if (!meta) return;

        const { cleanName, year } = parseCleanMediaInfo(item.title);
        currentTrailerQuery = `${meta.title || cleanName} ${meta.year || year || ''}`;

        // 1. Plot Synopsis
        if (meta.synopsis) {
            const synEl = document.getElementById('wSynopsis');
            if (synEl) synEl.textContent = meta.synopsis;
        }

        // 2. IMDb Rating
        if (meta.imdbRating) {
            const rateEl = document.getElementById('wRating');
            if (rateEl) {
                rateEl.innerHTML = `<span style="color:#ffb800; font-size:14px;">★</span> ${meta.imdbRating} / 10`;
            }
        }

        // 3. Rotten Tomatoes Score
        if (meta.rottenTomatoes) {
            const rtBadge = document.getElementById('wRtBadge');
            const rtVal = document.getElementById('wRtVal');
            if (rtBadge && rtVal) {
                rtVal.textContent = meta.rottenTomatoes;
                rtBadge.style.display = 'inline-flex';
            }
        }

        // 4. Metascore
        if (meta.metascore) {
            const metaBadge = document.getElementById('wMetaBadge');
            const metaVal = document.getElementById('wMetaVal');
            if (metaBadge && metaVal) {
                metaVal.textContent = meta.metascore;
                metaBadge.style.display = 'inline-flex';
            }
        }

        // 5. Age Rated (PG-13, R, TV-MA)
        if (meta.rated) {
            const ratedBadge = document.getElementById('wRatedBadge');
            if (ratedBadge) {
                ratedBadge.textContent = meta.rated;
                ratedBadge.style.display = 'inline-block';
            }
        }

        // 6. Runtime (format minutes to Xh Ym)
        if (meta.runtime) {
            const durEl = document.getElementById('wDuration');
            if (durEl) {
                const minMatch = meta.runtime.match(/(\d+)\s*min/i);
                if (minMatch) {
                    const totalMin = parseInt(minMatch[1], 10);
                    const hrs = Math.floor(totalMin / 60);
                    const mins = totalMin % 60;
                    durEl.textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                } else {
                    durEl.textContent = meta.runtime;
                }
            }
        }

        // 7. Year
        if (meta.year) {
            const yearEl = document.getElementById('wYear');
            if (yearEl) yearEl.textContent = meta.year;
        }

        // 8. Official Genre Pills
        if (meta.genres && meta.genres.length > 0) {
            const genEl = document.getElementById('wGenres');
            if (genEl) {
                genEl.innerHTML = meta.genres.map(g => `
                    <a class="mb-genre-pill" href="index.html?q=${encodeURIComponent(g)}"># ${g}</a>
                `).join('') + `
                    <span class="mb-genre-pill" style="border-color: rgba(255, 184, 0, 0.4); color: #ffb800;">★ Official IMDb</span>
                `;
            }
        }

        // 9. Top Cast & Characters Section
        let rawActors = meta.actors;
        let actorsList = [];
        if (Array.isArray(rawActors)) {
            actorsList = rawActors.map(a => typeof a === 'string' ? { name: a, character: 'Cast', image: null } : a);
        } else if (typeof rawActors === 'string') {
            actorsList = rawActors.split(',').map(a => ({ name: a.trim(), character: 'Cast', image: null })).filter(a => a.name);
        }

        if (actorsList.length > 0) {
            const castSection = document.getElementById('wCastSection');
            const castGrid = document.getElementById('wCastGrid');
            const dirHeadline = document.getElementById('wDirectorHeadline');

            if (dirHeadline && meta.director) {
                dirHeadline.textContent = `Directed by ${meta.director}`;
            }

            if (castSection && castGrid) {
                castGrid.innerHTML = actorsList.map((actor, idx) => {
                    const initials = actor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const roleLabel = (actor.character && actor.character !== 'Cast') ? actor.character : 'Cast Member';
                    return `
                        <a class="mb-cast-card" href="https://www.google.com/search?q=${encodeURIComponent(actor.name + ' actor')}" target="_blank" title="Search ${escapeQuotes(actor.name)}">
                            <div class="mb-cast-avatar" id="cast-avatar-${idx}">
                                ${actor.image ? `<img src="${actor.image}" alt="${escapeQuotes(actor.name)}" />` : initials}
                            </div>
                            <div class="mb-cast-info">
                                <span class="mb-cast-name">${actor.name}</span>
                                <span class="mb-cast-role">${roleLabel}</span>
                            </div>
                        </a>
                    `;
                }).join('');
                castSection.style.display = 'flex';

                // Asynchronously hydrate portrait photos for actors without images
                actorsList.forEach((actor, idx) => {
                    if (!actor.image) {
                        getActorPortraitPhoto(actor.name).then(photoUrl => {
                            if (photoUrl) {
                                const avatarEl = document.getElementById(`cast-avatar-${idx}`);
                                if (avatarEl) {
                                    avatarEl.innerHTML = `<img src="${photoUrl}" alt="${escapeQuotes(actor.name)}" />`;
                                }
                            }
                        }).catch(() => {});
                    }
                });
            }

            // Also fill technical card
            const actWrap = document.getElementById('wActorsWrap');
            const actVal = document.getElementById('wActorsVal');
            if (actWrap && actVal) {
                actVal.textContent = actorsList.map(a => a.name).join(', ');
                actWrap.style.display = 'flex';
            }
        }

        // 10. Technical Media Info Grid
        if (meta.releaseDate) {
            const el = document.getElementById('wReleaseWrap');
            const val = document.getElementById('wReleaseVal');
            if (el && val) { val.textContent = meta.releaseDate; el.style.display = 'flex'; }
        }
        if (meta.director) {
            const el = document.getElementById('wDirectorWrap');
            const val = document.getElementById('wDirectorVal');
            if (el && val) { val.textContent = meta.director; el.style.display = 'flex'; }
        }
        if (meta.writer) {
            const el = document.getElementById('wWriterWrap');
            const val = document.getElementById('wWriterVal');
            if (el && val) { val.textContent = meta.writer; el.style.display = 'flex'; }
        }
        if (meta.boxOffice) {
            const el = document.getElementById('wBoxOfficeWrap');
            const val = document.getElementById('wBoxOfficeVal');
            if (el && val) { val.textContent = `${meta.boxOffice} (Worldwide)`; el.style.display = 'flex'; }
        }
        if (meta.country || meta.language) {
            const el = document.getElementById('wCountryWrap');
            const val = document.getElementById('wCountryVal');
            if (el && val) {
                val.textContent = [meta.country, meta.language].filter(Boolean).join(' • ');
                el.style.display = 'flex';
            }
        }
        if (meta.awards) {
            const el = document.getElementById('wAwardsWrap');
            const val = document.getElementById('wAwardsVal');
            if (el && val) { val.textContent = meta.awards; el.style.display = 'flex'; }
        }

        // 11. High-Res Cinematic Backdrop
        if (meta.backdrop || meta.poster) {
            const bg = meta.backdrop || meta.poster;
            const bEl = document.getElementById('mbBackdrop');
            if (bEl && bg) {
                bEl.style.backgroundImage = `url('${bg}')`;
            }
        }
    } catch (e) {
        console.warn('Online metadata notice:', e);
    }
}

function renderWatchPage(item) {
    document.title = `${item.title} — CineBox`;
    
    // Backdrop & Poster
    document.getElementById('wTitle').textContent = item.title;
    document.getElementById('wPoster').src = item.poster;
    document.getElementById('mbBackdrop').style.backgroundImage = `url('${item.poster}')`;
    
    const isSeries = item.tag === 'TV Series' || item.tag === 'K-Drama' || (item.url && item.url.endsWith('/'));

    // Quality Badge
    document.getElementById('wQualityBadge').textContent = item.tag || '1080p HD';
    
    // Meta Specs
    document.getElementById('wYear').textContent = item.date || '2024';
    document.getElementById('wType').textContent = isSeries ? 'TV Series' : 'Movie';
    document.getElementById('wDuration').textContent = isSeries ? 'Multiple Seasons' : 'Full HD';

    // Technical info card
    document.getElementById('wQualityVal').textContent = `${item.tag || '1080p Full HD'} (Web-DL)`;
    document.getElementById('wFileSizeVal').textContent = item.size || '1080p HD';
    document.getElementById('wAudioVal').textContent = item.category || 'Dual Audio / Original';

    // Genres Row
    const catName = item.category || item.tag || 'Cinema';
    document.getElementById('wGenres').innerHTML = `
        <a class="mb-genre-pill" href="index.html?cat=${encodeURIComponent(catName)}"># ${catName}</a>
        <a class="mb-genre-pill" href="index.html?tab=${isSeries ? 'tv' : 'movies'}"># ${isSeries ? 'TV Series' : 'Movies'}</a>
        <span class="mb-genre-pill" style="border-color: rgba(255, 184, 0, 0.4); color: #ffb800;"># Top Rated</span>
    `;

    updateWatchlistButtonState();

    const { cleanName, year } = parseCleanMediaInfo(item.title);
    currentTrailerQuery = `${cleanName} ${year || ''}`;

    // MovieBox Action Buttons (On Details View)
    document.getElementById('wActions').innerHTML = `
        ${isSeries ? `
            <button class="mb-btn-primary" onclick="scrollTvExplorer()">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                <span>Select Episode</span>
            </button>
        ` : `
            <button class="mb-btn-primary" onclick="enterPlayerMode('${item.url}', '${escapeQuotes(item.title)}')">
                <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg>
                <span>▶ Watch Online</span>
            </button>
        `}
        <button class="mb-btn-action mb-btn-trailer" onclick="openTrailerModal('${escapeQuotes(cleanName + ' ' + (year || ''))}')" title="Watch official HD trailer">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Trailer</span>
        </button>
        <button class="mb-btn-action mb-btn-external" onclick="openExternalPlayersModal('${item.url}', '${escapeQuotes(item.title)}')" title="Play in External Players (VLC, MX Player, PotPlayer)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
            <span>External Player</span>
        </button>
        ${isSeries ? `
            <button class="mb-btn-action" onclick="openDownloadModal(null, null, true)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download Hub</span>
            </button>
        ` : `
            <button class="mb-btn-action" onclick="openDownloadModal('${item.url}', '${escapeQuotes(item.title)}')">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download</span>
            </button>
        `}
        <button class="mb-btn-action" onclick="openPlayerCustomModal()" title="Customize Video Player Settings">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Player Settings</span>
        </button>
        <button class="mb-btn-action" onclick="toggleCurrentWatchlist()">
            <svg class="icon" id="wHeartIconAction" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <span id="wWatchlistActionText">${isInWatchlist(item.title) ? 'Saved ❤️' : 'Watchlist'}</span>
        </button>
        <button class="mb-btn-action" onclick="shareCurrentMedia()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span>Share</span>
        </button>
    `;

    const relatedTag = item.tag || 'Top Rated';
    document.getElementById('relatedHeading').textContent = `More in ${catName}`;
    document.getElementById('relatedSeeAllBtn').href = `index.html?cat=${encodeURIComponent(relatedTag)}`;

    loadRelatedMedia(relatedTag, item.title);

    if (isSeries) {
        document.getElementById('tvExplorerWrap').style.display = 'flex';
        loadTvSeriesSeasons(item.url, item.title);
    }

    // Retrieve & apply rich real-time metadata (IMDb rating, Rotten Tomatoes, Cast, Director, Box office, Awards)
    loadAndApplyOnlineMetadata(item);
}

// ==========================================
// 📺 Dedicated Online Player View Mode
// ==========================================
function enterPlayerMode(url, title) {
    if (!url && currentItem) url = currentItem.url;
    if (!title && currentItem) title = currentItem.title;
    if (!url) return;

    isPlayerMode = true;
    currentActiveStreamUrl = url;
    currentActiveStreamTitle = title || (currentItem ? currentItem.title : 'Playing Media');

    // Switch Views
    document.getElementById('detailView').style.display = 'none';
    const pView = document.getElementById('playerView');
    pView.style.display = 'block';

    // Populate Player Heading Info & Custom Overlay Title
    document.getElementById('playerHeadingTitle').textContent = currentActiveStreamTitle;
    const mediaTag = (currentItem && currentItem.tag) ? currentItem.tag : '1080p HD';
    document.getElementById('playerQualityTag').textContent = mediaTag;
    
    const cpTitleEl = document.getElementById('cpMediaTitle');
    if (cpTitleEl) cpTitleEl.textContent = currentActiveStreamTitle;
    const cpQualityEl = document.getElementById('cpQualityBadge');
    if (cpQualityEl) cpQualityEl.textContent = mediaTag;

    const isSeries = currentItem && (currentItem.tag === 'TV Series' || currentItem.tag === 'K-Drama' || (currentItem.url && currentItem.url.endsWith('/')));
    const cpNav = document.getElementById('cpSeriesNav');
    if (cpNav) cpNav.style.display = isSeries ? 'inline-flex' : 'none';

    // Populate Quick Actions Toolbar
    document.getElementById('playerQuickActions').innerHTML = `
        <button class="mb-btn-action mb-btn-external" onclick="openExternalPlayersModal(currentActiveStreamUrl, currentActiveStreamTitle)" title="Open in External Player (VLC, MX Player, PotPlayer)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
            <span>External Player</span>
        </button>
        <button class="mb-btn-action" onclick="openDownloadModal(currentActiveStreamUrl, currentActiveStreamTitle)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Download</span>
        </button>
        <button class="mb-btn-action" onclick="openPlayerCustomModal()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>Customize</span>
        </button>
        <button class="mb-btn-action" onclick="toggleCurrentWatchlist()">
            <svg class="icon" id="wHeartIconPlayer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <span id="wWatchlistPlayerText">${isInWatchlist(currentItem ? currentItem.title : '') ? 'Saved ❤️' : 'Save'}</span>
        </button>
        <button class="mb-btn-action" onclick="shareCurrentMedia()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span>Share</span>
        </button>
    `;

    // Apply player settings to current stream
    applyAllPlayerSettings();

    // Start video playback
    startStream(url, currentActiveStreamTitle);

    // Acquire WakeLock if enabled
    if (playerSettings.wakeLock) {
        acquireWakeLock();
    }

    // Reset controls auto-hide timer
    resetControlsTimeout();

    // If TV Series: display episode playlist in player view
    if (isSeries && currentTvEntry) {
        document.getElementById('playerTvPlaylistWrap').style.display = 'block';
        renderPlayerEpisodeList(currentSeasonEpisodes);
    } else {
        document.getElementById('playerTvPlaylistWrap').style.display = 'none';
    }

    // Update URL query param to reflect playing state without reloading
    const urlObj = new URL(window.location);
    urlObj.searchParams.set('play', '1');
    history.replaceState(null, '', urlObj.toString());

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitPlayerMode() {
    isPlayerMode = false;
    
    // Pause playback
    const player = document.getElementById('videoPlayer');
    if (player) player.pause();

    // Release WakeLock
    releaseWakeLock();

    // Reset screen lock
    unlockPlayerScreen();

    // Switch Views back
    document.getElementById('playerView').style.display = 'none';
    document.getElementById('detailView').style.display = 'flex';

    // Remove play query param
    const urlObj = new URL(window.location);
    urlObj.searchParams.delete('play');
    history.replaceState(null, '', urlObj.toString());

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSynopsis() {
    isSynopsisExpanded = !isSynopsisExpanded;
    const textEl = document.getElementById('wSynopsis');
    const btnEl = document.getElementById('mbMoreBtn');
    if (textEl && btnEl) {
        if (isSynopsisExpanded) {
            textEl.classList.add('expanded');
            btnEl.textContent = 'Less';
        } else {
            textEl.classList.remove('expanded');
            btnEl.textContent = 'More';
        }
    }
}

function scrollTvExplorer() {
    const exp = document.getElementById('tvExplorerWrap');
    if (exp) exp.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleCurrentWatchlist() {
    if (!currentItem) return;
    toggleWatchlist(currentItem);
    updateWatchlistButtonState();
}

function updateWatchlistButtonState() {
    if (!currentItem) return;
    const inList = isInWatchlist(currentItem.title);
    
    // Details Action button
    const actionText = document.getElementById('wWatchlistActionText');
    const actionIcon = document.getElementById('wHeartIconAction');
    if (actionText) actionText.textContent = inList ? 'Saved ❤️' : 'Watchlist';
    if (actionIcon) {
        actionIcon.style.stroke = inList ? 'var(--accent)' : 'currentColor';
        actionIcon.style.fill = inList ? 'var(--accent)' : 'none';
    }

    // Player View Action button
    const playerText = document.getElementById('wWatchlistPlayerText');
    const playerIcon = document.getElementById('wHeartIconPlayer');
    if (playerText) playerText.textContent = inList ? 'Saved ❤️' : 'Save';
    if (playerIcon) {
        playerIcon.style.stroke = inList ? 'var(--accent)' : 'currentColor';
        playerIcon.style.fill = inList ? 'var(--accent)' : 'none';
    }
}

function shareCurrentMedia() {
    if (!currentItem) return;
    const shareData = {
        title: `${currentItem.title} — CineBox`,
        text: `Watch ${currentItem.title} in 1080p HD on CineBox!`,
        url: window.location.href
    };
    if (navigator.share) {
        navigator.share(shareData).catch(() => {});
    } else {
        copyLink(window.location.href);
        showToast('Page link copied to clipboard 🔗');
    }
}

// ==========================================
// 🎬 Player Core & Listeners
// ==========================================
function setupPlayerListeners() {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    let lastSave = 0;
    player.addEventListener('timeupdate', () => {
        const now = Date.now();
        if (now - lastSave > 4000) {
            lastSave = now;
            savePlaybackProgress(
                currentActiveStreamUrl,
                currentActiveStreamTitle,
                player.currentTime,
                player.duration,
                currentItem || {}
            );
        }

        // Update custom scrubber & time text
        updateScrubberProgress();

        // Update dynamic ambient glow if active
        if (playerSettings.ambientMode === 'sync' && !player.paused) {
            updateAmbientGlow();
        }

        if (currentPlayingEpisodeIdx >= 0 && currentSeasonEpisodes.length > currentPlayingEpisodeIdx + 1) {
            if (player.duration > 30 && player.currentTime >= player.duration - 12 && !nextEpCountdownTimer) {
                if (playerSettings.autoPlayNext) {
                    triggerNextEpisodeCountdown();
                }
            }
        }
    });

    player.addEventListener('progress', () => {
        updateScrubberBuffer();
    });

    player.addEventListener('play', () => {
        updatePlayPauseButtonUI(true);
        if (isAudioEngineInitialized && audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        if (playerSettings.wakeLock) {
            acquireWakeLock();
        }
        resetControlsTimeout();
    });

    player.addEventListener('pause', () => {
        updatePlayPauseButtonUI(false);
        savePlaybackProgress(
            currentActiveStreamUrl,
            currentActiveStreamTitle,
            player.currentTime,
            player.duration,
            currentItem || {}
        );
    });

    player.addEventListener('ended', () => {
        updatePlayPauseButtonUI(false);
        savePlaybackProgress(
            currentActiveStreamUrl,
            currentActiveStreamTitle,
            player.duration,
            player.duration,
            currentItem || {}
        );
        if (playerSettings.sleepTimer === 'end') {
            showToast('Sleep Timer: Playback ended. Goodnight! 🌙');
            return;
        }
        if (currentPlayingEpisodeIdx >= 0 && currentSeasonEpisodes.length > currentPlayingEpisodeIdx + 1) {
            if (playerSettings.autoPlayNext) {
                confirmNextEpisode();
            }
        }
    });

    player.addEventListener('volumechange', () => {
        updateVolumeUI();
    });

    player.addEventListener('loadedmetadata', () => {
        updateScrubberProgress();
        applyAspectRatioCss();
        if (playerSettings.defaultSpeed && playerSettings.defaultSpeed !== 1.0) {
            player.playbackRate = playerSettings.defaultSpeed;
        }
    });
}

function startStream(url, title) {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    currentActiveStreamUrl = url;
    currentActiveStreamTitle = title || 'Playing Media';
    
    const currTitleEl = document.getElementById('playerCurrentTitle');
    if (currTitleEl) currTitleEl.textContent = currentActiveStreamTitle;
    const cpTitleEl = document.getElementById('cpMediaTitle');
    if (cpTitleEl) cpTitleEl.textContent = currentActiveStreamTitle;

    player.src = url;

    // Apply audio booster engine on play
    setupAudioBooster();

    // Auto-resume from last saved time
    if (playerSettings.autoResume) {
        const prev = getPlaybackProgress(url, title);
        if (prev && prev.time > 15 && prev.time < prev.duration - 20) {
            player.currentTime = prev.time;
            showToast(`Resumed from ${formatTime(prev.time)}`);
        }
    }

    // Apply default speed
    if (playerSettings.defaultSpeed) {
        player.playbackRate = playerSettings.defaultSpeed;
    }

    player.play().catch(e => console.log(e));
}

// ==========================================
// 📱 Mobile Double-Tap to Seek (YouTube Style)
// ==========================================
let leftTapTimer = null;
let leftTapCount = 0;
let rightTapTimer = null;
let rightTapCount = 0;

function setupDoubleTapSeekControls() {
    const leftZone = document.getElementById('seekTouchLeft');
    const rightZone = document.getElementById('seekTouchRight');
    const player = document.getElementById('videoPlayer');

    if (!leftZone || !rightZone || !player) return;

    leftZone.addEventListener('click', (e) => {
        if (!playerSettings.gestureDoubleTap || isControlsLocked) return;
        leftTapCount++;
        clearTimeout(leftTapTimer);
        if (leftTapCount === 1) {
            leftTapTimer = setTimeout(() => {
                leftTapCount = 0;
            }, 300);
        } else if (leftTapCount >= 2) {
            leftTapCount = 0;
            const step = playerSettings.seekStep || 10;
            seekRelative(-step, 'left');
        }
    });

    rightZone.addEventListener('click', (e) => {
        if (!playerSettings.gestureDoubleTap || isControlsLocked) return;
        rightTapCount++;
        clearTimeout(rightTapTimer);
        if (rightTapCount === 1) {
            rightTapTimer = setTimeout(() => {
                rightTapCount = 0;
            }, 300);
        } else if (rightTapCount >= 2) {
            rightTapCount = 0;
            const step = playerSettings.seekStep || 10;
            seekRelative(step, 'right');
        }
    });
}

function seekRelative(seconds, direction) {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    const targetTime = Math.max(0, Math.min(player.duration || 0, player.currentTime + seconds));
    player.currentTime = targetTime;

    const ripple = direction === 'left' ? document.getElementById('seekRippleLeft') : document.getElementById('seekRippleRight');
    if (ripple) {
        const textEl = direction === 'left' ? document.getElementById('seekLeftText') : document.getElementById('seekRightText');
        if (textEl) textEl.textContent = `${seconds > 0 ? '+' : ''}${seconds}s`;
        
        ripple.classList.remove('active');
        void ripple.offsetWidth;
        ripple.classList.add('active');
        setTimeout(() => ripple.classList.remove('active'), 650);
    }
}

// ==========================================
// 💬 Subtitles (CC) Management & Converter
// ==========================================
function openSubtitlePicker() {
    const fileInput = document.getElementById('subFileInput');
    if (fileInput) fileInput.click();
}

function handleSubtitleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        loadSubtitleText(text, file.name);
    };
    reader.readAsText(file);
    event.target.value = '';
}

function setupSubtitleDragAndDrop() {
    const container = document.getElementById('videoContainer');
    if (!container) return;

    ['dragenter', 'dragover'].forEach(name => {
        container.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        container.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.classList.remove('drag-over');
        });
    });

    container.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.name.match(/\.(srt|vtt|sub)$/i)) {
                const reader = new FileReader();
                reader.onload = (re) => loadSubtitleText(re.target.result, file.name);
                reader.readAsText(file);
            } else {
                showToast('Please drop a .srt or .vtt subtitle file');
            }
        }
    });
}

function loadSubtitleText(content, fileName = 'subtitles.srt') {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    let vttContent = content;
    if (fileName.toLowerCase().endsWith('.srt') || !content.trim().startsWith('WEBVTT')) {
        vttContent = srtToVtt(content);
    }

    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const blobUrl = URL.createObjectURL(blob);

    const existingTracks = player.querySelectorAll('track');
    existingTracks.forEach(t => t.remove());

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = fileName.replace(/\.[^/.]+$/, '');
    track.srclang = 'en';
    track.src = blobUrl;
    track.default = true;

    player.appendChild(track);
    currentSubtitleTrack = track;

    if (player.textTracks && player.textTracks[0]) {
        player.textTracks[0].mode = 'showing';
    }

    const subBtn = document.getElementById('subBtn');
    if (subBtn) subBtn.classList.add('active');

    showToast(`Loaded Subtitles: ${fileName} 💬`);
}

function toggleSubtitles() {
    const player = document.getElementById('videoPlayer');
    if (!player || !player.textTracks || player.textTracks.length === 0) {
        openSubtitlePicker();
        return;
    }

    const track = player.textTracks[0];
    if (track.mode === 'showing') {
        track.mode = 'disabled';
        showToast('Subtitles Disabled');
        const subBtn = document.getElementById('subBtn');
        if (subBtn) subBtn.classList.remove('active');
    } else {
        track.mode = 'showing';
        showToast('Subtitles Enabled 💬');
        const subBtn = document.getElementById('subBtn');
        if (subBtn) subBtn.classList.add('active');
    }
}

// ==========================================
// ⏭️ Auto-Play Next Episode
// ==========================================
function triggerNextEpisodeCountdown() {
    const nextIdx = currentPlayingEpisodeIdx + 1;
    if (!currentSeasonEpisodes[nextIdx]) return;

    const nextEp = currentSeasonEpisodes[nextIdx];
    document.getElementById('nextEpTitle').textContent = `${currentSeasonName} • ${nextEp.name}`;
    const countdownEl = document.getElementById('nextEpCountdown');
    countdownEl.style.display = 'block';

    let secs = 8;
    document.getElementById('countdownSecs').textContent = secs;
    clearInterval(nextEpCountdownTimer);
    nextEpCountdownTimer = setInterval(() => {
        secs--;
        document.getElementById('countdownSecs').textContent = secs;
        if (secs <= 0) {
            clearInterval(nextEpCountdownTimer);
            nextEpCountdownTimer = null;
            confirmNextEpisode();
        }
    }, 1000);
}

function confirmNextEpisode() {
    cancelNextEpisode();
    playNextEpisode();
}

function cancelNextEpisode() {
    clearInterval(nextEpCountdownTimer);
    nextEpCountdownTimer = null;
    const countdownEl = document.getElementById('nextEpCountdown');
    if (countdownEl) countdownEl.style.display = 'none';
}

// ==========================================
// 📺 TV Explorer & Episode Management
// ==========================================
async function loadTvSeriesSeasons(seriesUrl, seriesTitle) {
    const tabs = document.getElementById('seasonTabs');
    const epList = document.getElementById('episodeList');
    const countBadge = document.getElementById('seasonCountBadge');

    if (tabs) tabs.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 4px;">Loading seasons...</div>';
    if (epList) epList.innerHTML = '';
    if (countBadge) countBadge.textContent = 'Loading...';
    motherFolderSpecials = [];

    if (Object.keys(tvCatalog).length === 0) {
        try {
            const res = await fetch('./tv_index.json');
            if (res.ok) tvCatalog = await res.json();
        } catch (e) {}
    }

    let matchedData = null;
    if (tvCatalog[seriesTitle]) {
        matchedData = tvCatalog[seriesTitle];
    }

    if (!matchedData && seriesUrl) {
        const normTargetUrl = decodeURI(seriesUrl).replace(/\/+$/, '').toLowerCase();
        for (const [k, v] of Object.entries(tvCatalog)) {
            if (v && v[0]) {
                const normEntryUrl = decodeURI(v[0]).replace(/\/+$/, '').toLowerCase();
                if (normEntryUrl === normTargetUrl) {
                    matchedData = v;
                    break;
                }
            }
        }
    }

    if (!matchedData && seriesTitle) {
        const normTarget = seriesTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        for (const [k, v] of Object.entries(tvCatalog)) {
            const normK = k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (normK === normTarget || (normK.length > 5 && normTarget.includes(normK)) || (normTarget.length > 5 && normK.includes(normTarget))) {
                matchedData = v;
                break;
            }
        }
    }

    if (matchedData) {
        renderIndexedTvData(matchedData, seriesTitle);
        return;
    }

    fallbackTvView(seriesUrl, seriesTitle);
}

function renderIndexedTvData(tvData, seriesTitle) {
    const tabs = document.getElementById('seasonTabs');
    const playerTabs = document.getElementById('playerSeasonTabs');
    const countBadge = document.getElementById('seasonCountBadge');
    const pCountBadge = document.getElementById('playerSeasonCountBadge');

    const folderUrl = tvData[0] || '';
    const seasons = tvData[1] || [];
    const specials = tvData[2] || [];

    motherFolderSpecials = specials.map(spName => ({
        name: spName,
        url: folderUrl.endsWith('/') ? folderUrl + encodeURI(spName) : folderUrl + '/' + encodeURI(spName)
    }));

    const badgeStr = `${seasons.length} Seasons ${specials.length > 0 ? '+ Specials' : ''}`;
    if (countBadge) countBadge.textContent = badgeStr;
    if (pCountBadge) pCountBadge.textContent = badgeStr;

    if (seasons.length > 0) {
        let tabsHtml = seasons.map((s, idx) => {
            const sName = s[0];
            return `
            <button class="season-pill-btn ${idx === 0 ? 'active' : ''}" onclick="selectIndexedSeason(this, ${idx}, '${escapeQuotes(sName)}')">
                ${sName}
            </button>
            `;
        }).join('');

        if (specials.length > 0) {
            tabsHtml += `
                <button class="season-pill-btn specials-pill" onclick="selectSpecialsTab(this)">
                    ★ Specials (${specials.length})
                </button>
            `;
        }

        if (tabs) tabs.innerHTML = tabsHtml;
        if (playerTabs) playerTabs.innerHTML = tabsHtml;

        currentTvEntry = tvData;
        currentSelectedSeasonIdx = 0;
        loadIndexedSeasonEpisodes(0, seasons[0][0]);
    } else if (specials.length > 0) {
        if (countBadge) countBadge.textContent = `${specials.length} Specials`;
        currentSeasonEpisodes = motherFolderSpecials;
        currentPlayingEpisodeIdx = -1;
        renderEpisodeListHtml(motherFolderSpecials);
    } else {
        fallbackTvView(folderUrl, seriesTitle);
    }
}

function selectIndexedSeason(btnEl, seasonIdx, seasonName) {
    document.querySelectorAll('.season-pill-btn').forEach(b => {
        b.classList.remove('active');
    });
    btnEl.classList.add('active');

    currentSelectedSeasonIdx = seasonIdx;
    loadIndexedSeasonEpisodes(seasonIdx, seasonName);
}

function loadIndexedSeasonEpisodes(seasonIdx, seasonName) {
    if (!currentTvEntry || !currentTvEntry[1] || !currentTvEntry[1][seasonIdx]) return;

    currentSeasonName = seasonName;
    const seasonData = currentTvEntry[1][seasonIdx];
    const sUrl = seasonData[1];
    const epNames = seasonData[2] || [];

    const episodes = epNames.map(name => {
        const cleanUrl = sUrl.endsWith('/') ? sUrl + encodeURI(name) : sUrl + '/' + encodeURI(name);
        return { name, url: cleanUrl };
    });

    currentSeasonEpisodes = episodes;
    currentPlayingEpisodeIdx = -1;
    renderEpisodeListHtml(episodes);
    renderPlayerEpisodeList(episodes);
}

function selectSpecialsTab(btnEl) {
    document.querySelectorAll('.season-pill-btn').forEach(b => {
        b.classList.remove('active');
    });
    btnEl.classList.add('active');

    currentSeasonName = 'Specials / Bonus';
    currentSeasonEpisodes = motherFolderSpecials;
    currentPlayingEpisodeIdx = -1;
    renderEpisodeListHtml(motherFolderSpecials);
    renderPlayerEpisodeList(motherFolderSpecials);
}

function filterEpisodes(query) {
    episodeFilterQuery = (query || '').trim().toLowerCase();
    renderEpisodeListHtml(currentSeasonEpisodes);
    renderPlayerEpisodeList(currentSeasonEpisodes);
}

function renderEpisodeListHtml(episodes) {
    const epList = document.getElementById('episodeList');
    if (!epList) return;
    if (!episodes || episodes.length === 0) {
        epList.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 14px; text-align: center;">No episodes found.</div>';
        return;
    }

    const filtered = episodeFilterQuery ? episodes.filter(e => e.name.toLowerCase().includes(episodeFilterQuery)) : episodes;

    let html = '';
    
    // Add search bar if more than 6 episodes
    if (episodes.length > 6) {
        html += `
            <div style="position: relative; margin-bottom: 6px;">
                <input type="text" class="ep-filter-input" placeholder="Filter ${episodes.length} episodes..." value="${escapeQuotes(episodeFilterQuery)}" oninput="filterEpisodes(this.value)">
                ${episodeFilterQuery ? `<button onclick="filterEpisodes('');" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer;">✕</button>` : ''}
            </div>
        `;
    }

    html += filtered.map((ep, idx) => {
        const originalIdx = episodes.indexOf(ep);
        const isPlaying = originalIdx === currentPlayingEpisodeIdx;
        const cleanName = ep.name.replace(/\.(mp4|mkv|avi|webm)$/i, '');

        return `
        <div id="ep-item-${originalIdx}" class="ep-card ${isPlaying ? 'playing' : ''}" onclick="playSpecificEpisode(${originalIdx})">
            <div class="ep-index-badge">
                ${isPlaying ? '▶' : (originalIdx + 1)}
            </div>
            <div class="ep-info-wrap">
                <div class="ep-title-text" title="${escapeQuotes(ep.name)}">
                    ${cleanName}
                </div>
                <div class="ep-meta-sub">
                    <span style="color: ${isPlaying ? 'var(--primary)' : 'var(--text-muted)'}; font-weight: 700;">${isPlaying ? 'NOW PLAYING' : currentSeasonName}</span>
                    <span>•</span>
                    <span>1080p HD</span>
                </div>
            </div>
            <div class="ep-action-btns" onclick="event.stopPropagation();">
                <button class="ep-icon-btn" onclick="openExternalPlayersModal('${ep.url}', '${escapeQuotes(ep.name)}')" title="External Players (VLC, MX, PotPlayer)">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
                <button class="ep-icon-btn" onclick="openDownloadModal('${ep.url}', '${escapeQuotes(ep.name)}')" title="Download Episode">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
            </div>
        </div>
    `;}).join('');

    epList.innerHTML = html;
}

function renderPlayerEpisodeList(episodes) {
    const epList = document.getElementById('playerEpisodeList');
    if (!epList) return;
    if (!episodes || episodes.length === 0) {
        epList.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 10px; text-align: center;">No episodes in this season.</div>';
        return;
    }

    const filtered = episodeFilterQuery ? episodes.filter(e => e.name.toLowerCase().includes(episodeFilterQuery)) : episodes;

    epList.innerHTML = filtered.map((ep, idx) => {
        const originalIdx = episodes.indexOf(ep);
        const isPlaying = originalIdx === currentPlayingEpisodeIdx;
        const cleanName = ep.name.replace(/\.(mp4|mkv|avi|webm)$/i, '');

        return `
        <div class="ep-card ${isPlaying ? 'playing' : ''}" onclick="playSpecificEpisode(${originalIdx})">
            <div class="ep-index-badge">
                ${isPlaying ? '▶' : (originalIdx + 1)}
            </div>
            <div class="ep-info-wrap">
                <div class="ep-title-text" title="${escapeQuotes(ep.name)}">
                    ${cleanName}
                </div>
                <div class="ep-meta-sub">
                    <span style="color: ${isPlaying ? 'var(--primary)' : 'var(--text-muted)'}; font-weight: 700;">${isPlaying ? 'PLAYING NOW' : currentSeasonName}</span>
                </div>
            </div>
            <div class="ep-action-btns" onclick="event.stopPropagation();">
                <button class="ep-icon-btn" onclick="openExternalPlayersModal('${ep.url}', '${escapeQuotes(ep.name)}')" title="External Players">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
                <button class="ep-icon-btn" onclick="openDownloadModal('${ep.url}', '${escapeQuotes(ep.name)}')" title="Download Episode">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
            </div>
        </div>
    `;}).join('');
}

function playSpecificEpisode(idx) {
    if (!currentSeasonEpisodes[idx]) return;
    cancelNextEpisode();
    currentPlayingEpisodeIdx = idx;
    const ep = currentSeasonEpisodes[idx];

    const fullTitle = `${currentSeasonName} • ${ep.name}`;
    currentActiveStreamUrl = ep.url;
    currentActiveStreamTitle = fullTitle;

    document.getElementById('playerNavBtns').style.display = 'flex';

    renderEpisodeListHtml(currentSeasonEpisodes);
    renderPlayerEpisodeList(currentSeasonEpisodes);

    // If not already in player mode, enter player mode automatically!
    if (!isPlayerMode) {
        enterPlayerMode(ep.url, fullTitle);
    } else {
        document.getElementById('playerHeadingTitle').textContent = fullTitle;
        startStream(ep.url, fullTitle);
    }
}

function playNextEpisode() {
    if (currentPlayingEpisodeIdx + 1 < currentSeasonEpisodes.length) {
        playSpecificEpisode(currentPlayingEpisodeIdx + 1);
    } else {
        showToast('End of this season');
    }
}

function playPrevEpisode() {
    if (currentPlayingEpisodeIdx > 0) {
        playSpecificEpisode(currentPlayingEpisodeIdx - 1);
    }
}

function fallbackTvView(seriesUrl, seriesTitle) {
    const sBadge = document.getElementById('seasonCountBadge');
    if (sBadge) sBadge.textContent = 'Directory';
    const sTabs = document.getElementById('seasonTabs');
    if (sTabs) {
        sTabs.innerHTML = `
            <a class="btn btn-primary" style="font-size: 12px; padding: 8px 14px; border-radius: 20px;" href="${seriesUrl}" target="_blank">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>Browse All Seasons on Server</span>
            </a>
        `;
    }
    const epList = document.getElementById('episodeList');
    if (epList) {
        epList.innerHTML = `
            <div style="font-size: 12px; color: var(--text-muted); padding: 10px 4px; line-height: 1.5;">
                Click above to browse all season folders and stream/download any episode directly via high-speed BDIX.
            </div>
        `;
    }
}

// ==========================================
// 📦 Season Batch Playlist (.m3u)
// ==========================================
function downloadSeasonM3u() {
    if (!currentSeasonEpisodes || currentSeasonEpisodes.length === 0) {
        showToast('No episodes in this season');
        return;
    }

    const seriesName = currentItem ? currentItem.title : 'Series';
    let m3u = `#EXTM3U\n#PLAYLIST:${seriesName} - ${currentSeasonName}\n\n`;
    for (const ep of currentSeasonEpisodes) {
        m3u += `#EXTINF:-1,${seriesName} - ${ep.name}\n${ep.url}\n\n`;
    }

    const cleanFileName = `${seriesName}_${currentSeasonName}`.replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([m3u], { type: 'application/x-mpegurl' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${cleanFileName}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    showToast(`Downloaded ${currentSeasonName} playlist (.m3u)`);
}

// ==========================================
// 🍦 External Player Launchers
// ==========================================
function openInVLC(url, title) {
    url = url || currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    title = title || currentActiveStreamTitle || (currentItem ? currentItem.title : 'Movie');
    if (!url) return;

    const cleanTitle = encodeURIComponent(title);
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
        // Direct Android Intent for VLC without downloading any file
        const intentUrl = `intent:${url}#Intent;package=org.videolan.vlc;type=video/*;S.title=${cleanTitle};end`;
        window.location.href = intentUrl;
    } else {
        // Direct VLC URL scheme on Web/Desktop (Windows, Mac, Linux) without downloading file
        window.location.href = `vlc://${url}`;
    }

    showToast('Launching VLC Media Player 🎬');
}

function openCurrentInVLC() {
    openInVLC(currentActiveStreamUrl || (currentItem ? currentItem.url : ''), currentActiveStreamTitle || (currentItem ? currentItem.title : ''));
}

function openInMXPlayer(url, title) {
    url = url || currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    title = title || currentActiveStreamTitle || (currentItem ? currentItem.title : 'Movie');
    if (!url) return;
    const cleanTitle = encodeURIComponent(title);
    const intentUrl = `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;S.title=${cleanTitle};end`;
    window.location.href = intentUrl;
    showToast('Launching MX Player...');
}

function openInPotPlayer(url, title) {
    url = url || currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    if (!url) return;
    window.location.href = `potplayer://${url}`;
    showToast('Launching PotPlayer on PC...');
}

function openInSystemChooser(url, title) {
    url = url || currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    title = title || currentActiveStreamTitle || (currentItem ? currentItem.title : 'Movie');
    if (!url) return;
    const cleanTitle = encodeURIComponent(title);
    const intentUrl = `intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;S.title=${cleanTitle};end`;
    window.location.href = intentUrl;
    showToast('Opening video player menu...');
}

function openExternalPlayersModal(url, title) {
    if (url) currentActiveStreamUrl = url;
    if (title) currentActiveStreamTitle = title;
    const modal = document.getElementById('externalPlayersModal');
    if (!modal) return;
    const titleEl = document.getElementById('extModalMediaTitle');
    if (titleEl) {
        titleEl.textContent = currentActiveStreamTitle || (currentItem ? currentItem.title : 'Selected Media');
    }
    modal.style.display = 'flex';
}

function closeExternalPlayersModal() {
    const modal = document.getElementById('externalPlayersModal');
    if (modal) modal.style.display = 'none';
}

function exportStreamM3u(url, title) {
    url = url || currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    title = title || currentActiveStreamTitle || (currentItem ? currentItem.title : 'Movie');
    if (!url) return;

    const cleanTitle = (title || 'movie').replace(/[/\\?%*:|"<>]/g, '_');
    const m3uContent = `#EXTM3U\n#EXTINF:-1,${title}\n${url}\n`;
    const blob = new Blob([m3uContent], { type: 'application/x-mpegurl' });
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${cleanTitle}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    showToast('Downloaded stream playlist (.m3u) 📥');
}

function copyCurrentStreamUrl() {
    const url = currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    if (url) {
        copyLink(url);
        showToast('Stream URL copied to clipboard 🔗');
    }
}

function copyLink(url) {
    navigator.clipboard.writeText(url);
}

// ==========================================
// ==========================================================================
// 🎛️ CINEBOX PLAYER CUSTOMIZATION & SETTINGS ENGINE
// ==========================================================================

function loadPlayerSettings() {
    try {
        const saved = localStorage.getItem('cinebox_player_custom_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            playerSettings = { ...DEFAULT_PLAYER_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.warn('Error loading player settings', e);
    }
}

function savePlayerSettings() {
    try {
        localStorage.setItem('cinebox_player_custom_settings', JSON.stringify(playerSettings));
    } catch (e) {
        console.warn('Error saving player settings', e);
    }
}

function applyAllPlayerSettings() {
    // 1. Apply Color Theme & CSS Variables
    if (playerSettings.themeColor) {
        document.documentElement.style.setProperty('--primary', playerSettings.themeColor);
        document.documentElement.style.setProperty('--primary-glow', `${playerSettings.themeColor}40`);
    }

    // 2. Apply Video Filters
    applyVideoFilterCss();

    // 3. Apply Aspect Ratio
    applyAspectRatioCss();

    // 4. Apply Subtitle Styles
    updateSubtitleStyleSheet();

    // 5. Update UI Controls & Badges
    updateCustomizerUIState();

    // 6. Update Seek labels
    const step = playerSettings.seekStep || 10;
    const l1 = document.getElementById('stepRewindLabel');
    const l2 = document.getElementById('stepForwardLabel');
    if (l1) l1.textContent = step;
    if (l2) l2.textContent = step;
}

function resetPlayerSettingsToDefaults() {
    playerSettings = { ...DEFAULT_PLAYER_SETTINGS };
    try {
        localStorage.removeItem('cinebox_player_custom_settings');
    } catch (e) {}

    applyAllPlayerSettings();
    showToast('Player customizations reset to default ↺');
}

function updateCustomizerUIState() {
    // Active Filter preset badge
    const filterName = playerSettings.videoFilter.charAt(0).toUpperCase() + playerSettings.videoFilter.slice(1);
    const filterActiveEl = document.getElementById('customFilterActiveName');
    if (filterActiveEl) filterActiveEl.textContent = filterName;
    const cpFilterBadge = document.getElementById('cpFilterBadge');
    if (cpFilterBadge) {
        if (playerSettings.videoFilter === 'normal') {
            cpFilterBadge.style.display = 'none';
        } else {
            cpFilterBadge.style.display = 'inline-flex';
            cpFilterBadge.textContent = filterName;
        }
    }
    const filterLabel = document.getElementById('filterLabel');
    if (filterLabel) filterLabel.textContent = filterName;

    // Filter Preset cards active class
    document.querySelectorAll('.preset-card[data-filter]').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-filter') === playerSettings.videoFilter);
    });

    // Sliders
    const sBright = document.getElementById('sliderBrightness');
    if (sBright) sBright.value = playerSettings.brightness;
    const vBright = document.getElementById('valSliderBrightness');
    if (vBright) vBright.textContent = `${playerSettings.brightness}%`;

    const sContrast = document.getElementById('sliderContrast');
    if (sContrast) sContrast.value = playerSettings.contrast;
    const vContrast = document.getElementById('valSliderContrast');
    if (vContrast) vContrast.textContent = `${playerSettings.contrast}%`;

    const sSat = document.getElementById('sliderSaturation');
    if (sSat) sSat.value = playerSettings.saturation;
    const vSat = document.getElementById('valSliderSaturation');
    if (vSat) vSat.textContent = `${playerSettings.saturation}%`;

    const sHue = document.getElementById('sliderHue');
    if (sHue) sHue.value = playerSettings.hue;
    const vHue = document.getElementById('valSliderHue');
    if (vHue) vHue.textContent = `${playerSettings.hue}°`;

    // Ambient
    const ambStat = document.getElementById('valAmbientStatus');
    if (ambStat) ambStat.textContent = playerSettings.ambientMode === 'off' ? 'Disabled' : (playerSettings.ambientMode === 'sync' ? 'Dynamic Sync' : 'Theme Glow');
    const sAmb = document.getElementById('sliderAmbient');
    if (sAmb) sAmb.value = playerSettings.ambientIntensity;
    const vAmb = document.getElementById('valSliderAmbient');
    if (vAmb) vAmb.textContent = `${playerSettings.ambientIntensity}%`;

    const chipSync = document.getElementById('chipAmbientSync');
    const chipAccent = document.getElementById('chipAmbientAccent');
    const chipOff = document.getElementById('chipAmbientOff');
    if (chipSync) chipSync.classList.toggle('active', playerSettings.ambientMode === 'sync');
    if (chipAccent) chipAccent.classList.toggle('active', playerSettings.ambientMode === 'accent');
    if (chipOff) chipOff.classList.toggle('active', playerSettings.ambientMode === 'off');

    // Audio Boost
    const boostTxt = document.getElementById('valAudioBoostText');
    if (boostTxt) boostTxt.textContent = `${playerSettings.audioBoostGain}% ${playerSettings.audioBoostGain > 100 ? '(Boosted)' : '(Normal)'}`;
    const boostGainVal = document.getElementById('valAudioGainSlider');
    if (boostGainVal) boostGainVal.textContent = `${playerSettings.audioBoostGain}%`;
    const sAudio = document.getElementById('sliderAudioBoost');
    if (sAudio) sAudio.value = playerSettings.audioBoostGain;

    const cpBoostBadge = document.getElementById('cpBoostBadge');
    if (cpBoostBadge) {
        if (playerSettings.audioBoostGain > 100) {
            cpBoostBadge.style.display = 'inline-flex';
            cpBoostBadge.textContent = `Boost ${playerSettings.audioBoostGain}%`;
        } else {
            cpBoostBadge.style.display = 'none';
        }
    }

    [100, 150, 200, 300].forEach(g => {
        const c = document.getElementById(`chipGain${g}`);
        if (c) c.classList.toggle('active', playerSettings.audioBoostGain === g);
    });

    // Audio Profile cards
    document.querySelectorAll('.preset-card[data-profile]').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-profile') === playerSettings.audioProfile);
    });
    const audProfText = document.getElementById('valAudioProfileText');
    if (audProfText) audProfText.textContent = playerSettings.audioProfile.charAt(0).toUpperCase() + playerSettings.audioProfile.slice(1);

    // Subtitle UI
    const subSizeText = document.getElementById('valSubSizeText');
    if (subSizeText) subSizeText.textContent = `${playerSettings.subSize}px`;
    [14, 18, 22, 28, 34].forEach(sz => {
        const c = document.getElementById(`chipSubSize${sz}`);
        if (c) c.classList.toggle('active', playerSettings.subSize === sz);
    });

    const subColText = document.getElementById('valSubColorText');
    if (subColText) subColText.textContent = playerSettings.subColorName || 'Custom';

    const subBgText = document.getElementById('valSubBgText');
    if (subBgText) subBgText.textContent = playerSettings.subBgStyle.charAt(0).toUpperCase() + playerSettings.subBgStyle.slice(1);

    // Seek step chips
    [5, 10, 15, 30, 60].forEach(st => {
        const c = document.getElementById(`chipSeek${st}`);
        if (c) c.classList.toggle('active', playerSettings.seekStep === st);
    });
    const seekStepText = document.getElementById('valSeekStepText');
    if (seekStepText) seekStepText.textContent = `${playerSettings.seekStep}s`;

    // Speed chips
    [0.75, 1.0, 1.25, 1.5, 2.0].forEach(sp => {
        const key = String(sp).replace('.', '');
        const c = document.getElementById(`chipSpeed${key}`);
        if (c) c.classList.toggle('active', playerSettings.defaultSpeed === sp);
    });
    const speedLabel = document.getElementById('speedLabel');
    if (speedLabel) speedLabel.textContent = `${playerSettings.defaultSpeed}x`;

    // Aspect chips
    const aspMode = document.getElementById('valAspectMode');
    if (aspMode) aspMode.textContent = playerSettings.aspectRatio;
    const aspectLabel = document.getElementById('aspectLabel');
    if (aspectLabel) aspectLabel.textContent = playerSettings.aspectRatio;

    // Toggles
    const tgb = document.getElementById('toggleGestureBrightness');
    if (tgb) tgb.checked = !!playerSettings.gestureBrightness;
    const tgv = document.getElementById('toggleGestureVolume');
    if (tgv) tgv.checked = !!playerSettings.gestureVolume;
    const tgd = document.getElementById('toggleGestureDoubleTap');
    if (tgd) tgd.checked = !!playerSettings.gestureDoubleTap;
    const tar = document.getElementById('toggleAutoResume');
    if (tar) tar.checked = !!playerSettings.autoResume;
    const tap = document.getElementById('toggleAutoPlayNext');
    if (tap) tap.checked = !!playerSettings.autoPlayNext;
    const twl = document.getElementById('toggleWakeLock');
    if (twl) twl.checked = !!playerSettings.wakeLock;

    // Theme cards
    document.querySelectorAll('.theme-card[data-theme]').forEach(tc => {
        tc.classList.toggle('active', tc.getAttribute('data-theme') === playerSettings.themeName);
    });
    const themeNameEl = document.getElementById('valThemeActiveName');
    if (themeNameEl) themeNameEl.textContent = playerSettings.themeTitle || 'Cyber Cyan';
}

// ==========================================
// 🎨 Visual Filters Engine
// ==========================================
const VIDEO_PRESET_CONFIGS = {
    normal: { brightness: 100, contrast: 100, saturation: 100, hue: 0 },
    vivid: { brightness: 106, contrast: 124, saturation: 140, hue: 0 },
    cinema: { brightness: 102, contrast: 112, saturation: 118, hue: 3 },
    night: { brightness: 90, contrast: 96, saturation: 85, hue: -5 },
    crisp: { brightness: 104, contrast: 120, saturation: 110, hue: 0 },
    oled: { brightness: 100, contrast: 138, saturation: 122, hue: 0 }
};

function applyVideoFilterPreset(presetName) {
    if (!VIDEO_PRESET_CONFIGS[presetName]) return;
    playerSettings.videoFilter = presetName;
    const conf = VIDEO_PRESET_CONFIGS[presetName];
    playerSettings.brightness = conf.brightness;
    playerSettings.contrast = conf.contrast;
    playerSettings.saturation = conf.saturation;
    playerSettings.hue = conf.hue;

    savePlayerSettings();
    applyAllPlayerSettings();
    showToast(`Applied Visual Filter: ${presetName.toUpperCase()} ✨`);
}

function handleVideoFilterChange(prop, val) {
    playerSettings.videoFilter = 'custom';
    playerSettings[prop] = parseFloat(val);
    savePlayerSettings();
    applyAllPlayerSettings();
}

function resetVideoSliders() {
    playerSettings.videoFilter = 'normal';
    playerSettings.brightness = 100;
    playerSettings.contrast = 100;
    playerSettings.saturation = 100;
    playerSettings.hue = 0;
    savePlayerSettings();
    applyAllPlayerSettings();
    showToast('Video sliders reset');
}

function applyVideoFilterCss() {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    const b = playerSettings.brightness / 100;
    const c = playerSettings.contrast / 100;
    const s = playerSettings.saturation / 100;
    const h = playerSettings.hue;

    let filterStr = `brightness(${b}) contrast(${c}) saturate(${s})`;
    if (h !== 0) {
        filterStr += ` hue-rotate(${h}deg)`;
    }

    if (playerSettings.videoFilter === 'night') {
        filterStr += ` sepia(0.2)`;
    } else if (playerSettings.videoFilter === 'cinema') {
        filterStr += ` sepia(0.12)`;
    }

    player.style.filter = filterStr;
}

function cycleVideoFilter() {
    const presets = ['normal', 'vivid', 'cinema', 'night', 'crisp', 'oled'];
    let idx = presets.indexOf(playerSettings.videoFilter);
    if (idx === -1) idx = 0;
    idx = (idx + 1) % presets.length;
    applyVideoFilterPreset(presets[idx]);
}

// ==========================================
// 💡 Dynamic Ambient Cinema Lighting
// ==========================================
function setAmbientGlowMode(mode) {
    playerSettings.ambientMode = mode;
    savePlayerSettings();
    applyAllPlayerSettings();
    updateAmbientGlow();
    showToast(`Ambient Lighting: ${mode.toUpperCase()}`);
}

function handleAmbientIntensityChange(val) {
    playerSettings.ambientIntensity = parseInt(val, 10);
    savePlayerSettings();
    applyAllPlayerSettings();
    updateAmbientGlow();
}

function toggleAmbientGlow() {
    const nextMode = playerSettings.ambientMode === 'off' ? 'sync' : 'off';
    setAmbientGlowMode(nextMode);
}

function updateAmbientGlow() {
    const glowEl = document.getElementById('playerAmbientGlow');
    if (!glowEl) return;

    if (playerSettings.ambientMode === 'off') {
        glowEl.style.opacity = '0';
        return;
    }

    const intensity = (playerSettings.ambientIntensity || 75) / 100;
    glowEl.style.opacity = String(intensity);

    const themeColor = playerSettings.themeColor || '#00e5ff';
    glowEl.style.background = `radial-gradient(ellipse at center, ${themeColor}55 0%, ${themeColor}22 45%, transparent 70%)`;
}

// ==========================================
// 📐 Aspect Ratio Fit Engine
// ==========================================
function setPlayerAspectRatio(mode) {
    playerSettings.aspectRatio = mode;
    savePlayerSettings();
    applyAllPlayerSettings();
    showToast(`Aspect: ${mode}`);
}

function cycleAspectRatio() {
    currentAspectIdx = (currentAspectIdx + 1) % aspectRatios.length;
    const fit = aspectRatios[currentAspectIdx];
    setPlayerAspectRatio(fit);
}

function applyAspectRatioCss() {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    const mode = playerSettings.aspectRatio || 'contain';
    if (mode === 'contain' || mode === 'cover' || mode === 'fill') {
        player.style.objectFit = mode;
        player.style.aspectRatio = '16/9';
    } else if (mode === '16/9') {
        player.style.objectFit = 'contain';
        player.style.aspectRatio = '16/9';
    } else if (mode === '4/3') {
        player.style.objectFit = 'fill';
        player.style.aspectRatio = '4/3';
    } else if (mode === '21/9') {
        player.style.objectFit = 'cover';
        player.style.aspectRatio = '21/9';
    }
}

// ==========================================
// 🔊 Audio Booster & Web Audio API Engine
// ==========================================
function setupAudioBooster() {
    const player = document.getElementById('videoPlayer');
    if (!player || isAudioEngineInitialized) return;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        audioCtx = new AudioContextClass();
        audioSourceNode = audioCtx.createMediaElementSource(player);
        audioGainNode = audioCtx.createGain();
        audioFilterNode = audioCtx.createBiquadFilter();
        audioCompressorNode = audioCtx.createDynamicsCompressor();

        // Connect chain: source -> filter -> compressor -> gain -> destination
        audioSourceNode.connect(audioFilterNode);
        audioFilterNode.connect(audioCompressorNode);
        audioCompressorNode.connect(audioGainNode);
        audioGainNode.connect(audioCtx.destination);

        isAudioEngineInitialized = true;
        applyAudioSettings();
    } catch (e) {
        console.warn('Audio Context initialization fallback', e);
    }
}

function handleAudioBoostGain(val) {
    const gainNum = parseInt(val, 10);
    playerSettings.audioBoostGain = gainNum;
    savePlayerSettings();
    applyAudioSettings();
    updateCustomizerUIState();
    showToast(`Volume Gain: ${gainNum}%`);
}

function setAudioProfile(profile) {
    playerSettings.audioProfile = profile;
    savePlayerSettings();
    applyAudioSettings();
    updateCustomizerUIState();
    showToast(`Audio Profile: ${profile.toUpperCase()}`);
}

function applyAudioSettings() {
    if (!isAudioEngineInitialized || !audioGainNode) return;

    // 1. Apply Gain
    const gainMultiplier = (playerSettings.audioBoostGain || 100) / 100;
    audioGainNode.gain.value = gainMultiplier;

    // 2. Apply Profile Filters
    if (audioFilterNode && audioCompressorNode) {
        const prof = playerSettings.audioProfile || 'standard';
        if (prof === 'dialogue') {
            audioFilterNode.type = 'peaking';
            audioFilterNode.frequency.value = 2500;
            audioFilterNode.Q.value = 1.4;
            audioFilterNode.gain.value = 6.0;
        } else if (prof === 'bass') {
            audioFilterNode.type = 'lowshelf';
            audioFilterNode.frequency.value = 110;
            audioFilterNode.gain.value = 6.5;
        } else {
            audioFilterNode.type = 'allpass';
            audioFilterNode.gain.value = 0;
        }

        if (prof === 'night') {
            audioCompressorNode.threshold.value = -24;
            audioCompressorNode.ratio.value = 12;
        } else {
            audioCompressorNode.threshold.value = -10;
            audioCompressorNode.ratio.value = 3;
        }
    }
}

// ==========================================
// 💬 Subtitles (CC) Customizer
// ==========================================
function setSubtitleSize(size) {
    playerSettings.subSize = parseInt(size, 10);
    savePlayerSettings();
    applyAllPlayerSettings();
    showToast(`Subtitle Size: ${size}px`);
}

function setSubtitleColor(hex, name) {
    playerSettings.subColor = hex;
    playerSettings.subColorName = name;
    savePlayerSettings();
    applyAllPlayerSettings();
    showToast(`Subtitle Color: ${name}`);
}

function setSubtitleBgStyle(style) {
    playerSettings.subBgStyle = style;
    savePlayerSettings();
    applyAllPlayerSettings();
    showToast(`Subtitle Background: ${style}`);
}

function nudgeSubtitleSync(delta) {
    playerSettings.subSyncOffset = Math.round((playerSettings.subSyncOffset + delta) * 10) / 10;
    savePlayerSettings();
    
    const diffEl = document.getElementById('valSubSyncDiff');
    if (diffEl) {
        diffEl.textContent = `${playerSettings.subSyncOffset > 0 ? '+' : ''}${playerSettings.subSyncOffset}s`;
    }
    showToast(`Subtitle Offset: ${playerSettings.subSyncOffset > 0 ? '+' : ''}${playerSettings.subSyncOffset}s`);
}

function resetSubtitleSync() {
    playerSettings.subSyncOffset = 0.0;
    savePlayerSettings();
    const diffEl = document.getElementById('valSubSyncDiff');
    if (diffEl) diffEl.textContent = `0.0s (In Sync)`;
    showToast('Subtitle sync reset to 0.0s');
}

function clearLoadedSubtitles() {
    const player = document.getElementById('videoPlayer');
    if (!player) return;
    const tracks = player.querySelectorAll('track');
    tracks.forEach(t => t.remove());
    currentSubtitleTrack = null;

    const subStatus = document.getElementById('valSubtitleLoadedStatus');
    if (subStatus) subStatus.textContent = 'No Subtitle';
    const subBtn = document.getElementById('subBtn');
    if (subBtn) subBtn.classList.remove('active');

    showToast('Subtitles removed');
}

function updateSubtitleStyleSheet() {
    let styleEl = document.getElementById('cineboxSubtitleDynamicStyles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'cineboxSubtitleDynamicStyles';
        document.head.appendChild(styleEl);
    }

    const sz = playerSettings.subSize || 18;
    const col = playerSettings.subColor || '#ffffff';
    let bg = 'rgba(0, 0, 0, 0.75)';
    let shadow = '0 2px 4px rgba(0,0,0,0.9)';

    if (playerSettings.subBgStyle === 'solid') {
        bg = '#000000';
    } else if (playerSettings.subBgStyle === 'shadow') {
        bg = 'transparent';
        shadow = '0 0 10px rgba(0,0,0,1), 0 2px 8px rgba(0,0,0,1)';
    } else if (playerSettings.subBgStyle === 'outline') {
        bg = 'transparent';
        shadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
    }

    styleEl.innerHTML = `
        video::cue {
            background-color: ${bg} !important;
            color: ${col} !important;
            font-size: ${sz}px !important;
            text-shadow: ${shadow} !important;
            font-family: var(--font-body), sans-serif !important;
            font-weight: 600 !important;
            border-radius: 6px !important;
            line-height: 1.4 !important;
            padding: 4px 10px !important;
        }
    `;

    // Update Modal Live Preview Box
    const prevRender = document.getElementById('subPreviewRender');
    if (prevRender) {
        prevRender.style.backgroundColor = bg;
        prevRender.style.color = col;
        prevRender.style.fontSize = `${sz}px`;
        prevRender.style.textShadow = shadow;
    }
}

// ==========================================
// 🕹️ Playback, Gestures & Themes
// ==========================================
function setSeekStep(seconds) {
    playerSettings.seekStep = parseInt(seconds, 10);
    savePlayerSettings();
    applyAllPlayerSettings();
    showToast(`Seek Jump: ${seconds}s`);
}

function setDefaultPlaybackSpeed(speed) {
    playerSettings.defaultSpeed = parseFloat(speed);
    savePlayerSettings();
    applyAllPlayerSettings();
    const player = document.getElementById('videoPlayer');
    if (player) player.playbackRate = playerSettings.defaultSpeed;
    showToast(`Default Speed: ${speed}x`);
}

function cyclePlaybackSpeed() {
    currentSpeedIdx = (currentSpeedIdx + 1) % playbackSpeeds.length;
    const speed = playbackSpeeds[currentSpeedIdx];
    setDefaultPlaybackSpeed(speed);
}

function handleGestureToggle(key, val) {
    if (key === 'brightness') playerSettings.gestureBrightness = val;
    if (key === 'volume') playerSettings.gestureVolume = val;
    if (key === 'doubleTap') playerSettings.gestureDoubleTap = val;
    savePlayerSettings();
    applyAllPlayerSettings();
}

function handlePrefToggle(key, val) {
    if (key === 'autoResume') playerSettings.autoResume = val;
    if (key === 'autoPlayNext') playerSettings.autoPlayNext = val;
    if (key === 'wakeLock') {
        playerSettings.wakeLock = val;
        if (val) acquireWakeLock(); else releaseWakeLock();
    }
    savePlayerSettings();
    applyAllPlayerSettings();
}

function setAutoHideDelay(ms) {
    playerSettings.autoHideDelay = parseInt(ms, 10);
    savePlayerSettings();
    applyAllPlayerSettings();
    resetControlsTimeout();
    showToast(`Auto-hide controls: ${ms > 0 ? (ms / 1000) + 's' : 'Never'}`);
}

function setPlayerTheme(themeKey, colorHex, titleName) {
    playerSettings.themeName = themeKey;
    playerSettings.themeColor = colorHex;
    playerSettings.themeTitle = titleName;
    savePlayerSettings();
    applyAllPlayerSettings();
    updateAmbientGlow();
    showToast(`Player Theme: ${titleName} 🎨`);
}

function setSleepTimer(minutesOrEnd) {
    if (sleepTimeoutId) {
        clearTimeout(sleepTimeoutId);
        sleepTimeoutId = null;
    }

    const stat = document.getElementById('valSleepTimerStatus');

    if (minutesOrEnd === 0 || minutesOrEnd === '0') {
        playerSettings.sleepTimer = 0;
        if (stat) stat.textContent = 'Off';
        showToast('Sleep Timer: Disabled');
        return;
    }

    if (minutesOrEnd === 'end') {
        playerSettings.sleepTimer = 'end';
        if (stat) stat.textContent = 'End of Video';
        showToast('Sleep Timer set: Will pause at end of video 🌙');
        return;
    }

    const mins = parseInt(minutesOrEnd, 10);
    playerSettings.sleepTimer = mins;
    if (stat) stat.textContent = `${mins} Min`;

    sleepTimeoutId = setTimeout(() => {
        const player = document.getElementById('videoPlayer');
        if (player) player.pause();
        showToast('Sleep Timer: Paused playback. Sleep tight! 🌙');
    }, mins * 60 * 1000);

    showToast(`Sleep Timer set: ${mins} minutes 🌙`);
}

async function acquireWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
        }
    } catch (e) {}
}

function releaseWakeLock() {
    try {
        if (wakeLockSentinel) {
            wakeLockSentinel.release();
            wakeLockSentinel = null;
        }
    } catch (e) {}
}

// ==========================================
// 🎛️ Custom Video Player Overlay & Scrubber
// ==========================================
function setupCustomPlayerControls() {
    const container = document.getElementById('videoContainer');
    if (!container) return;

    ['mousemove', 'touchstart', 'click', 'keydown'].forEach(evt => {
        container.addEventListener(evt, () => {
            if (!isControlsLocked) {
                showCustomControls();
                resetControlsTimeout();
            }
        });
    });

    const centerArea = document.getElementById('cpCenterArea');
    if (centerArea) {
        centerArea.addEventListener('click', (e) => {
            if (isControlsLocked) return;
            togglePlayPause();
        });
    }
}

function showCustomControls() {
    const controls = document.getElementById('customPlayerControls');
    if (controls) {
        controls.classList.add('visible');
    }
}

function hideCustomControls() {
    const player = document.getElementById('videoPlayer');
    if (player && !player.paused && !isControlsLocked) {
        const controls = document.getElementById('customPlayerControls');
        if (controls) controls.classList.remove('visible');
    }
}

function resetControlsTimeout() {
    if (controlsHideTimer) {
        clearTimeout(controlsHideTimer);
    }
    const delay = playerSettings.autoHideDelay;
    if (delay > 0) {
        controlsHideTimer = setTimeout(() => {
            hideCustomControls();
        }, delay);
    }
}

function togglePlayPause() {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    if (player.paused) {
        player.play().catch(() => {});
        showCenterPlayRipple(true);
    } else {
        player.pause();
        showCenterPlayRipple(false);
    }
}

function updatePlayPauseButtonUI(isPlaying) {
    const btn = document.getElementById('btnCustomPlayPause');
    if (!btn) return;
    const playIcon = btn.querySelector('.icon-play');
    const pauseIcon = btn.querySelector('.icon-pause');
    if (playIcon) playIcon.style.display = isPlaying ? 'none' : 'block';
    if (pauseIcon) pauseIcon.style.display = isPlaying ? 'block' : 'none';
}

function toggleMute() {
    const player = document.getElementById('videoPlayer');
    if (!player) return;
    player.muted = !player.muted;
    updateVolumeUI();
    showToast(player.muted ? 'Muted 🔇' : 'Unmuted 🔊');
}

function handleVolumeSlider(val) {
    const player = document.getElementById('videoPlayer');
    if (!player) return;
    player.muted = false;
    player.volume = Math.max(0, Math.min(1, val / 100));
    updateVolumeUI();
}

function updateVolumeUI() {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    const slider = document.getElementById('customVolumeSlider');
    if (slider) slider.value = player.muted ? 0 : player.volume * 100;

    const btn = document.getElementById('btnCustomMute');
    if (btn) {
        const highIcon = btn.querySelector('.icon-vol-high');
        const muteIcon = btn.querySelector('.icon-vol-mute');
        const isMuted = player.muted || player.volume === 0;
        if (highIcon) highIcon.style.display = isMuted ? 'none' : 'block';
        if (muteIcon) muteIcon.style.display = isMuted ? 'block' : 'none';
    }
}

function toggleTimeRemainingMode() {
    isTimeRemainingMode = !isTimeRemainingMode;
    updateScrubberProgress();
}

function toggleTheaterMode() {
    isTheaterMode = !isTheaterMode;
    const box = document.getElementById('playerCinemaBox');
    if (box) {
        box.classList.toggle('theater-mode', isTheaterMode);
    }
    showToast(isTheaterMode ? 'Theater Mode Active 🎭' : 'Standard Cinema Mode');
}

function togglePlayerFullscreen() {
    const cinemaBox = document.getElementById('playerCinemaBox');
    if (!cinemaBox) return;

    if (!document.fullscreenElement) {
        cinemaBox.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

function lockPlayerScreen() {
    isControlsLocked = true;
    const shield = document.getElementById('screenLockShield');
    if (shield) shield.style.display = 'flex';
    const controls = document.getElementById('customPlayerControls');
    if (controls) controls.classList.remove('visible');
    showToast('Screen touches locked 🔒');
}

function unlockPlayerScreen() {
    isControlsLocked = false;
    const shield = document.getElementById('screenLockShield');
    if (shield) shield.style.display = 'none';
    showCustomControls();
    showToast('Screen unlocked 🔓');
}

// Scrubber interactions
function setupCustomScrubber() {
    const wrap = document.getElementById('customScrubberWrap');
    const player = document.getElementById('videoPlayer');
    const tooltip = document.getElementById('scrubberTooltip');
    if (!wrap || !player) return;

    let isScrubbing = false;

    const updateSeekFromPointer = (e) => {
        const rect = wrap.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        if (player.duration) {
            player.currentTime = pos * player.duration;
            updateScrubberProgress();
        }
    };

    wrap.addEventListener('mousedown', (e) => {
        isScrubbing = true;
        updateSeekFromPointer(e);
    });

    wrap.addEventListener('mousemove', (e) => {
        const rect = wrap.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (tooltip && player.duration) {
            tooltip.style.left = `${pos * 100}%`;
            tooltip.textContent = formatTime(pos * player.duration);
        }
        if (isScrubbing) {
            updateSeekFromPointer(e);
        }
    });

    window.addEventListener('mouseup', () => {
        isScrubbing = false;
    });

    wrap.addEventListener('touchstart', (e) => {
        isScrubbing = true;
        updateSeekFromPointer(e);
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
        if (isScrubbing) updateSeekFromPointer(e);
    }, { passive: true });

    wrap.addEventListener('touchend', () => {
        isScrubbing = false;
    });
}

function updateScrubberProgress() {
    const player = document.getElementById('videoPlayer');
    if (!player || !player.duration) return;

    const percent = (player.currentTime / player.duration) * 100;
    const progressEl = document.getElementById('scrubberProgress');
    if (progressEl) progressEl.style.width = `${percent}%`;

    const currTimeEl = document.getElementById('cpCurrentTime');
    const totalDurEl = document.getElementById('cpTotalDuration');

    if (currTimeEl && totalDurEl) {
        if (isTimeRemainingMode) {
            const rem = Math.max(0, player.duration - player.currentTime);
            currTimeEl.textContent = `-${formatTime(rem)}`;
            totalDurEl.textContent = formatTime(player.duration);
        } else {
            currTimeEl.textContent = formatTime(player.currentTime);
            totalDurEl.textContent = formatTime(player.duration);
        }
    }
}

function updateScrubberBuffer() {
    const player = document.getElementById('videoPlayer');
    const bufferEl = document.getElementById('scrubberBuffer');
    if (!player || !bufferEl || !player.duration || player.buffered.length === 0) return;

    try {
        const end = player.buffered.end(player.buffered.length - 1);
        const percent = (end / player.duration) * 100;
        bufferEl.style.width = `${percent}%`;
    } catch (e) {}
}

// ==========================================
// 📱 Touch Gestures & HUD Engine
// ==========================================
function setupMobileTouchGestures() {
    const container = document.getElementById('videoContainer');
    const player = document.getElementById('videoPlayer');
    if (!container || !player) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let initialTouchVal = 0;
    let gestureType = null; // 'brightness' | 'volume' | 'seek'

    container.addEventListener('touchstart', (e) => {
        if (isControlsLocked || e.touches.length > 1) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        const rect = container.getBoundingClientRect();
        const xRel = (touchStartX - rect.left) / rect.width;

        if (xRel < 0.4 && playerSettings.gestureBrightness) {
            gestureType = 'brightness';
            initialTouchVal = playerSettings.brightness;
        } else if (xRel > 0.6 && playerSettings.gestureVolume) {
            gestureType = 'volume';
            initialTouchVal = playerSettings.audioBoostGain;
        } else {
            gestureType = 'seek';
            initialTouchVal = player.currentTime;
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (isControlsLocked || !gestureType || e.touches.length > 1) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touchStartY - touch.clientY; // up is positive

        if (gestureType === 'brightness' && Math.abs(deltaY) > 10) {
            const newB = Math.max(50, Math.min(160, initialTouchVal + (deltaY / 150) * 50));
            playerSettings.brightness = Math.round(newB);
            applyVideoFilterCss();
            showGestureHud('brightness', '☀️', `${playerSettings.brightness}%`, (playerSettings.brightness - 50) / 110);
        } else if (gestureType === 'volume' && Math.abs(deltaY) > 10) {
            const newGain = Math.max(0, Math.min(300, initialTouchVal + (deltaY / 150) * 100));
            playerSettings.audioBoostGain = Math.round(newGain);
            applyAudioSettings();
            showGestureHud('volume', newGain > 100 ? '🚀' : '🔊', `${playerSettings.audioBoostGain}%`, playerSettings.audioBoostGain / 300);
        } else if (gestureType === 'seek' && Math.abs(deltaX) > 15 && player.duration) {
            const timeDelta = (deltaX / 300) * 60; // 300px = 60s
            const targetTime = Math.max(0, Math.min(player.duration, initialTouchVal + timeDelta));
            showSeekHud(formatTime(targetTime), `${timeDelta > 0 ? '+' : ''}${Math.round(timeDelta)}s`);
        }
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        hideGestureHuds();
        gestureType = null;
    });
}

function showGestureHud(type, icon, value, percent) {
    const hudB = document.getElementById('hudBrightness');
    const hudV = document.getElementById('hudVolume');

    if (type === 'brightness' && hudB) {
        hudB.style.display = 'flex';
        if (hudV) hudV.style.display = 'none';
        const fill = document.getElementById('hudBrightnessFill');
        const val = document.getElementById('hudBrightnessVal');
        if (fill) fill.style.height = `${Math.max(5, Math.min(100, percent * 100))}%`;
        if (val) val.textContent = value;
    } else if (type === 'volume' && hudV) {
        hudV.style.display = 'flex';
        if (hudB) hudB.style.display = 'none';
        const fill = document.getElementById('hudVolumeFill');
        const val = document.getElementById('hudVolumeVal');
        const ico = document.getElementById('hudVolumeIcon');
        if (fill) fill.style.height = `${Math.max(5, Math.min(100, percent * 100))}%`;
        if (val) val.textContent = value;
        if (ico) ico.textContent = icon;
    }
}

function showSeekHud(timeStr, diffStr) {
    const hud = document.getElementById('hudSeek');
    if (!hud) return;
    hud.style.display = 'flex';
    const t = document.getElementById('hudSeekTime');
    const d = document.getElementById('hudSeekDiff');
    if (t) t.textContent = timeStr;
    if (d) d.textContent = diffStr;
}

function hideGestureHuds() {
    setTimeout(() => {
        const hudB = document.getElementById('hudBrightness');
        const hudV = document.getElementById('hudVolume');
        const hudS = document.getElementById('hudSeek');
        if (hudB) hudB.style.display = 'none';
        if (hudV) hudV.style.display = 'none';
        if (hudS) hudS.style.display = 'none';
    }, 450);
}

function showCenterPlayRipple(isPlaying) {
    const ripple = document.getElementById('centerPlayRipple');
    const icon = document.getElementById('centerPlayIcon');
    if (!ripple || !icon) return;

    icon.innerHTML = isPlaying ? '<polygon points="5 3 19 12 5 21 5 3"/>' : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    ripple.classList.remove('active');
    void ripple.offsetWidth;
    ripple.classList.add('active');
    setTimeout(() => ripple.classList.remove('active'), 550);
}

// ==========================================
// 🎛️ Player Customization Studio Modal
// ==========================================
function openPlayerCustomModal() {
    const modal = document.getElementById('playerCustomModal');
    if (!modal) return;
    updateCustomizerUIState();
    modal.style.display = 'flex';
}

function closePlayerCustomModal() {
    const modal = document.getElementById('playerCustomModal');
    if (modal) modal.style.display = 'none';
}

function switchCustomTab(tabId) {
    document.querySelectorAll('.custom-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId || btn.id === `tabBtn${tabId.replace('tab', '')}`);
    });
    document.querySelectorAll('.custom-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === tabId);
    });
}

// ==========================================
// ⌨️ Comprehensive Keyboard Shortcuts
// ==========================================
function setupSearchKeybindings() {
    document.addEventListener('keydown', (e) => {
        const player = document.getElementById('videoPlayer');
        if (document.activeElement.tagName === 'INPUT') return;

        if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            togglePlayPause();
        } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
            e.preventDefault();
            const step = playerSettings.seekStep || 10;
            seekRelative(step, 'right');
        } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
            e.preventDefault();
            const step = playerSettings.seekStep || 10;
            seekRelative(-step, 'left');
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            togglePlayerFullscreen();
        } else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            toggleTheaterMode();
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            openPlayerCustomModal();
        } else if (e.key === 'm' || e.key === 'M') {
            toggleMute();
        } else if (e.key === 'v' || e.key === 'V') {
            cycleVideoFilter();
        } else if (e.key === 'a' || e.key === 'A') {
            cycleAspectRatio();
        } else if (e.key === 'n' || e.key === 'N') {
            playNextEpisode();
        } else if (e.key === 'p' || e.key === 'P') {
            playPrevEpisode();
        } else if (e.key === 'c' || e.key === 'C') {
            toggleSubtitles();
        } else if (e.key === 'Escape') {
            const customModal = document.getElementById('playerCustomModal');
            const extModal = document.getElementById('externalPlayersModal');
            const dlModal = document.getElementById('downloadModal');
            const trModal = document.getElementById('trailerModal');

            if (customModal && customModal.style.display === 'flex') {
                closePlayerCustomModal();
            } else if (extModal && extModal.style.display === 'flex') {
                closeExternalPlayersModal();
            } else if (dlModal && dlModal.style.display === 'flex') {
                closeDownloadModal();
            } else if (trModal && trModal.style.display === 'flex') {
                closeTrailerModal();
            } else if (isPlayerMode) {
                exitPlayerMode();
            }
        }
    });

    document.addEventListener('click', (e) => {
        const customModal = document.getElementById('playerCustomModal');
        if (customModal && e.target === customModal) {
            closePlayerCustomModal();
        }
        const extModal = document.getElementById('externalPlayersModal');
        if (extModal && e.target === extModal) {
            closeExternalPlayersModal();
        }
        const dlModal = document.getElementById('downloadModal');
        if (dlModal && e.target === dlModal) {
            closeDownloadModal();
        }
        const trModal = document.getElementById('trailerModal');
        if (trModal && e.target === trModal) {
            closeTrailerModal();
        }
    });
}

// ==========================================
// 🎬 Related Media Slider
// ==========================================
async function loadRelatedMedia(tag, currentTitle) {
    const slider = document.getElementById('relatedSlider');
    const playerSlider = document.getElementById('playerRelatedSlider');
    if (!slider && !playerSlider) return;

    let candidateList = [];
    const cachedHome = sessionStorage.getItem('cinebox_home_v2');
    if (cachedHome) {
        try {
            const hData = JSON.parse(cachedHome);
            if (hData.categories && hData.categories[tag]) {
                candidateList = hData.categories[tag];
            }
        } catch (e) {}
    }

    if (candidateList.length === 0) {
        try {
            const res = await fetch('./home_data.json');
            if (res.ok) {
                const hData = await res.json();
                if (hData.categories && hData.categories[tag]) {
                    candidateList = hData.categories[tag];
                }
            }
        } catch (e) {}
    }

    const cleanT = (currentTitle || '').toLowerCase().trim();
    const filtered = candidateList.filter(item => {
        const title = (Array.isArray(item) ? item[0] : item.title) || '';
        return title.toLowerCase().trim() !== cleanT;
    });

    if (filtered.length > 0) {
        const cardsHtml = filtered.slice(0, 16).map(item => {
            const obj = Array.isArray(item) ? {
                title: item[0], poster: item[1], url: item[2], tag: item[3], category: item[4], size: item[5], date: item[6]
            } : item;
            const rawTitle = obj.title || '';
            const safeTitle = escapeQuotes(rawTitle);
            const itemData = encodeURIComponent(JSON.stringify(obj));
            const isSeries = obj.tag === 'TV Series' || obj.tag === 'K-Drama' || (obj.url && obj.url.endsWith('/'));
            const linkUrl = `watch.html?title=${encodeURIComponent(rawTitle)}&data=${itemData}`;

            return `
                <a class="movie-card" href="${linkUrl}">
                    <div class="card-cover">
                        <img src="${obj.poster}" alt="${safeTitle}" loading="lazy"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="cover-fallback" style="display: none;">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                            <div style="font-size: 11px; font-weight: 600;">${obj.title}</div>
                        </div>
                        <div class="tag-badge">${obj.tag || 'HD'}</div>
                        <div class="cover-overlay">
                            <div class="play-button-symbol" style="${isSeries ? 'background: linear-gradient(135deg, #00e5ff 0%, #0077b6 100%);' : ''}">
                                ${isSeries ? 
                                    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#07090e" stroke-width="2.2" width="18" height="18"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>' : 
                                    '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg>'
                                }
                            </div>
                            <span style="font-size: 10.5px; font-weight: 700; color: #fff;">${isSeries ? 'View Series' : 'Watch Now'}</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="card-title" title="${obj.title}">${obj.title}</div>
                        <div class="card-meta">
                            <span>${obj.size || 'HD'}</span>
                            <span>${obj.date || ''}</span>
                        </div>
                    </div>
                </a>
            `;
        }).join('');

        if (slider) slider.innerHTML = cardsHtml;
        if (playerSlider) playerSlider.innerHTML = cardsHtml;
    }
}

// ==========================================
// 🔍 Watch Page Search with Fuzzy Search & Recent Searches
// ==========================================
let watchLiveSearchTimer = null;
let watchAllMovies = [];

function handleLiveSearch(val) {
    clearTimeout(watchLiveSearchTimer);
    const query = (val || '').trim();
    const dropdown = document.getElementById('searchDropdown');
    if (!dropdown) return;

    if (!query) {
        showRecentSearchesDropdown(dropdown);
        return;
    }

    watchLiveSearchTimer = setTimeout(async () => {
        if (watchAllMovies.length === 0) {
            try {
                const files = [
                    'data/top_rated.json', 'data/animation.json', 'data/hollywood.json',
                    'data/bollywood.json', 'data/south_action.json', 'data/south_original.json',
                    'data/tv_series.json', 'data/kdrama.json', 'data/bangla.json',
                    'data/foreign.json', 'data/3d.json', 'data/english.json'
                ];
                const lists = await Promise.all(files.map(f => fetch(`./${f}`).then(r => r.ok ? r.json() : []).catch(() => [])));
                watchAllMovies = lists.flat();
            } catch (e) {}
        }

        let dataset = watchAllMovies;
        if (dataset.length === 0) {
            const cachedHome = sessionStorage.getItem('cinebox_home_v2');
            if (cachedHome) {
                try {
                    const hData = JSON.parse(cachedHome);
                    dataset = (hData.carousel || []).concat(Object.values(hData.categories || {}).flat());
                } catch (e) {}
            }
        }

        const matches = filterFuzzyMatches(dataset, query, 8);

        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(m => {
                const itemData = encodeURIComponent(JSON.stringify(m));
                const linkUrl = `watch.html?title=${encodeURIComponent(m.title)}&data=${itemData}`;
                const isSeries = m.tag === 'TV Series' || m.tag === 'K-Drama' || (m.url && m.url.endsWith('/'));

                return `
                    <a class="search-dropdown-item" href="${linkUrl}" onclick="saveRecentSearch('${escapeQuotes(m.title)}')">
                        <img class="search-item-thumb" src="${m.poster}" alt="${escapeQuotes(m.title)}" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=100';">
                        <div class="search-item-info">
                            <div class="search-item-title">${m.title}</div>
                            <div class="search-item-meta">
                                <span class="search-item-badge">${m.tag || (isSeries ? 'Series' : 'HD')}</span>
                                <span>${m.category || ''}</span>
                                <span>${m.size || ''}</span>
                            </div>
                        </div>
                    </a>
                `;
            }).join('') + `
                <div class="search-dropdown-footer" onclick="hideSearchDropdown(); searchToHome('${escapeQuotes(val)}');">
                    View all results for "${val}" →
                </div>
            `;
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = `
                <div style="padding: 16px 12px; text-align: center; font-size: 12px; color: var(--text-muted);">
                    No titles found for "${val}". Press Enter for full search.
                </div>
            `;
            dropdown.style.display = 'block';
        }
    }, 150);
}

function showRecentSearchesDropdown(dropdown) {
    const recent = getRecentSearches();
    if (recent.length === 0) {
        dropdown.innerHTML = `
            <div style="padding: 12px; font-size: 11.5px; color: var(--text-muted);">
                <div style="font-weight: 700; color: var(--primary); margin-bottom: 8px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">🔥 Popular Searches</div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span class="search-pill-suggestion" onclick="fillAndSearch('Oppenheimer')">Oppenheimer</span>
                    <span class="search-pill-suggestion" onclick="fillAndSearch('Solo Leveling')">Solo Leveling</span>
                    <span class="search-pill-suggestion" onclick="fillAndSearch('All of Us Are Dead')">All of Us Are Dead</span>
                    <span class="search-pill-suggestion" onclick="fillAndSearch('Avengers')">Avengers</span>
                    <span class="search-pill-suggestion" onclick="fillAndSearch('Interstellar')">Interstellar</span>
                </div>
            </div>
        `;
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = `
        <div style="padding: 6px 10px 4px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border);">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">🕒 Recent Searches</span>
            <button onclick="clearRecentSearches(event); showRecentSearchesDropdown(document.getElementById('searchDropdown'));" style="background: none; border: none; font-size: 10.5px; color: var(--accent); cursor: pointer; font-weight: 600;">Clear All</button>
        </div>
        <div style="padding: 4px 0;">
            ${recent.map(q => `
                <div class="search-dropdown-item" style="justify-content: space-between;" onclick="fillAndSearch('${escapeQuotes(q)}')">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="color: var(--text-dim);"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span style="font-size: 12.5px; font-weight: 600;">${q}</span>
                    </div>
                    <button onclick="removeRecentSearch('${escapeQuotes(q)}', event); showRecentSearchesDropdown(document.getElementById('searchDropdown'));" style="background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 2px 6px; font-size: 13px;" title="Remove">✕</button>
                </div>
            `).join('')}
        </div>
    `;
    dropdown.style.display = 'block';
}

function fillAndSearch(query) {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = query;
        searchToHome(query);
    }
}

function hideSearchDropdown() {
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) {
        hideSearchDropdown();
    }
});

function searchToHome(q) {
    hideSearchDropdown();
    const clean = (q || '').trim();
    if (clean) {
        saveRecentSearch(clean);
        window.location.href = `index.html?q=${encodeURIComponent(clean)}`;
    }
}

// ==========================================
// 📥 Comprehensive In-App Download Manager
// ==========================================
function openDownloadModal(targetUrl, targetTitle, isBatch) {
    const modal = document.getElementById('downloadModal');
    const body = document.getElementById('downloadModalBody');
    const heading = document.getElementById('dlModalHeading');
    if (!modal || !body) return;

    const url = targetUrl || currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    const title = targetTitle || currentActiveStreamTitle || (currentItem ? currentItem.title : 'Media');
    const isSeries = (currentItem && (currentItem.tag === 'TV Series' || currentItem.tag === 'K-Drama' || (currentItem.url && currentItem.url.endsWith('/')))) || isBatch;
    
    if (heading) {
        heading.textContent = isBatch ? 'Batch Download Manager' : 'Download Hub';
    }

    const poster = (currentItem && currentItem.poster) ? currentItem.poster : '';
    const cleanFileName = (title || 'media').replace(/[/\\?%*:|"<>]/g, '_');
    const tag = (currentItem && currentItem.tag) ? currentItem.tag : '1080p HD';

    let html = `
        <!-- Active Media Preview Header -->
        <div class="dl-preview-card">
            ${poster ? `<img class="dl-preview-thumb" src="${poster}" alt="${escapeQuotes(title)}" onerror="this.style.display='none'">` : ''}
            <div class="dl-preview-info">
                <div class="dl-preview-title" title="${escapeQuotes(title)}">${title}</div>
                <div class="dl-preview-sub">
                    <span class="dl-tag-badge">⚡ ${tag}</span>
                    <span style="color: var(--accent-green); font-weight: 600;">Direct BDIX CDN</span>
                </div>
            </div>
        </div>

        <!-- Download Channels Grid -->
        <div class="dl-options-grid">
            <!-- 1. Direct Browser / Native Download -->
            <a class="dl-action-card primary-dl" href="${url}" download="${cleanFileName}.mp4" onclick="showToast('Starting high-speed download...');">
                <div class="dl-action-icon" style="background: rgba(0, 229, 255, 0.2); color: var(--primary);">🚀</div>
                <div class="dl-action-text">
                    <span class="dl-action-title">Direct Download</span>
                    <span class="dl-action-desc">High-speed browser / native engine</span>
                </div>
            </a>

            <!-- 2. 1DM / IDM for Android -->
            <button class="dl-action-card" onclick="downloadVia1DM('${url}', '${escapeQuotes(title)}')">
                <div class="dl-action-icon" style="background: rgba(0, 230, 118, 0.15); color: var(--accent-green);">⚡</div>
                <div class="dl-action-text">
                    <span class="dl-action-title">1DM / IDM Android</span>
                    <span class="dl-action-desc">Multi-thread turbo download</span>
                </div>
            </button>

            <!-- 3. ADM (Advanced Download Manager) -->
            <button class="dl-action-card" onclick="downloadViaADM('${url}', '${escapeQuotes(title)}')">
                <div class="dl-action-icon" style="background: rgba(255, 42, 95, 0.15); color: var(--accent);">📥</div>
                <div class="dl-action-text">
                    <span class="dl-action-title">ADM Downloader</span>
                    <span class="dl-action-desc">Advanced Download Manager</span>
                </div>
            </button>

            <!-- 4. Copy Direct Stream Link -->
            <button class="dl-action-card" onclick="copySpecificUrl('${url}')">
                <div class="dl-action-icon" style="background: rgba(255, 184, 0, 0.15); color: var(--accent-gold);">📋</div>
                <div class="dl-action-text">
                    <span class="dl-action-title">Copy Direct Link</span>
                    <span class="dl-action-desc">For IDM PC, Aria2, JDownloader</span>
                </div>
            </button>
        </div>
    `;

    // If TV Series: Add Season Batch Section
    if (isSeries && currentSeasonEpisodes && currentSeasonEpisodes.length > 0) {
        html += `
            <div class="dl-batch-box">
                <div class="dl-batch-header">
                    <span>📦 ${currentSeasonName || 'Season'} Batch Downloader</span>
                    <span style="font-size: 11px; color: var(--primary);">${currentSeasonEpisodes.length} Episodes</span>
                </div>
                <div class="dl-batch-buttons">
                    <button class="dl-batch-btn" onclick="downloadSeasonM3u()">
                        <span>📦</span>
                        <span>Export Playlist (.m3u)</span>
                    </button>
                    <button class="dl-batch-btn" onclick="exportSeasonLinksTxt()">
                        <span>📄</span>
                        <span>Export Links (.txt)</span>
                    </button>
                </div>
                <div style="font-size: 11.5px; font-weight: 700; color: var(--text-muted); margin-top: 4px;">Individual Episodes:</div>
                <div class="dl-ep-quick-list">
                    ${currentSeasonEpisodes.map((ep, idx) => `
                        <div class="dl-ep-quick-item">
                            <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75%;">${ep.name.replace(/\.(mp4|mkv|avi|webm)$/i, '')}</span>
                            <div style="display: flex; gap: 6px;">
                                <a class="btn btn-primary" style="padding: 4px 10px; font-size: 11px; border-radius: 12px; text-decoration: none;" href="${ep.url}" download>Download</a>
                                <button class="btn btn-ghost" style="padding: 4px 8px; font-size: 11px; border-radius: 12px;" onclick="downloadVia1DM('${ep.url}', '${escapeQuotes(ep.name)}')">1DM</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    body.innerHTML = html;
    modal.style.display = 'flex';
}

function closeDownloadModal() {
    const modal = document.getElementById('downloadModal');
    if (modal) modal.style.display = 'none';
}

function downloadVia1DM(url, title) {
    if (!url) return;
    const cleanTitle = encodeURIComponent((title || 'Video').replace(/[/\\?%*:|"<>]/g, '_'));
    const intentUrl = `intent:${url}#Intent;action=android.intent.action.VIEW;package=idm.internet.download.manager;type=video/*;S.title=${cleanTitle};end`;
    window.location.href = intentUrl;
    showToast('Sending to 1DM / IDM Downloader...');
}

function downloadViaADM(url, title) {
    if (!url) return;
    const cleanTitle = encodeURIComponent((title || 'Video').replace(/[/\\?%*:|"<>]/g, '_'));
    const intentUrl = `intent:${url}#Intent;action=android.intent.action.VIEW;package=com.dv.adm;type=video/*;S.title=${cleanTitle};end`;
    window.location.href = intentUrl;
    showToast('Sending to ADM Downloader...');
}

function copySpecificUrl(url) {
    if (!url) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => showToast('Direct download URL copied!'));
    } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Direct download URL copied!');
    }
}

function exportSeasonLinksTxt() {
    if (!currentSeasonEpisodes || currentSeasonEpisodes.length === 0) {
        showToast('No episodes in this season');
        return;
    }

    const seriesName = currentItem ? currentItem.title : 'Series';
    let text = `# CineBox Links Export: ${seriesName} - ${currentSeasonName}\n# Import directly into IDM / 1DM / JDownloader\n\n`;
    for (const ep of currentSeasonEpisodes) {
        text += `${ep.url}\n`;
    }

    const cleanFileName = `${seriesName}_${currentSeasonName}_links`.replace(/[/\\?%*:|"<>]/g, '_');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${cleanFileName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    showToast(`Exported ${currentSeasonName} links (.txt)`);
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('downloadModal');
    if (modal && e.target === modal) {
        closeDownloadModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDownloadModal();
    }
});

window.onload = initWatch;
