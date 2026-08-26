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

// Player state
const playbackSpeeds = [0.75, 1.0, 1.25, 1.5, 2.0];
let currentSpeedIdx = 1;
const aspectRatios = ['contain', 'cover', 'fill'];
let currentAspectIdx = 0;
let nextEpCountdownTimer = null;
let currentSubtitleTrack = null;

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

async function initWatch() {
    updateWatchlistNavBadge();
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
            const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanName)}`);
            if (res.ok) {
                const data = await res.json();
                const summary = (data.summary || '').replace(/<[^>]*>/g, '').trim();
                meta = {
                    title: data.name,
                    year: data.premiered ? data.premiered.slice(0, 4) : year,
                    releaseDate: data.premiered || null,
                    imdbRating: data.rating && data.rating.average ? data.rating.average.toString() : null,
                    runtime: data.averageRuntime ? `${data.averageRuntime} min` : null,
                    genres: data.genres || [],
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
        if (meta.actors && meta.actors.length > 0) {
            const castSection = document.getElementById('wCastSection');
            const castGrid = document.getElementById('wCastGrid');
            const dirHeadline = document.getElementById('wDirectorHeadline');

            if (dirHeadline && meta.director) {
                dirHeadline.textContent = `Directed by ${meta.director}`;
            }

            if (castSection && castGrid) {
                castGrid.innerHTML = meta.actors.map(actor => {
                    const initials = actor.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return `
                        <a class="mb-cast-card" href="https://www.google.com/search?q=${encodeURIComponent(actor + ' actor')}" target="_blank" title="Search ${escapeQuotes(actor)}">
                            <div class="mb-cast-avatar">${initials}</div>
                            <div class="mb-cast-info">
                                <span class="mb-cast-name">${actor}</span>
                                <span class="mb-cast-role">Cast Member</span>
                            </div>
                        </a>
                    `;
                }).join('');
                castSection.style.display = 'flex';
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
        <button class="mb-btn-action mb-btn-vlc" onclick="openCurrentInVLC()">
            ${VLC_ICON_SVG}
            <span>Play in VLC</span>
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

    // Populate Player Heading Info
    document.getElementById('playerHeadingTitle').textContent = currentActiveStreamTitle;
    document.getElementById('playerQualityTag').textContent = (currentItem && currentItem.tag) ? currentItem.tag : '1080p HD';

    const isSeries = currentItem && (currentItem.tag === 'TV Series' || currentItem.tag === 'K-Drama' || (currentItem.url && currentItem.url.endsWith('/')));

    // Populate Quick Actions Toolbar
    document.getElementById('playerQuickActions').innerHTML = `
        <button class="mb-btn-action mb-btn-vlc" onclick="openCurrentInVLC()">
            ${VLC_ICON_SVG}
            <span>VLC Player</span>
        </button>
        <button class="mb-btn-action" onclick="openDownloadModal(currentActiveStreamUrl, currentActiveStreamTitle)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Download</span>
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

    // Start video playback
    startStream(url, currentActiveStreamTitle);

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

        if (currentPlayingEpisodeIdx >= 0 && currentSeasonEpisodes.length > currentPlayingEpisodeIdx + 1) {
            if (player.duration > 30 && player.currentTime >= player.duration - 12 && !nextEpCountdownTimer) {
                triggerNextEpisodeCountdown();
            }
        }
    });

    player.addEventListener('ended', () => {
        savePlaybackProgress(
            currentActiveStreamUrl,
            currentActiveStreamTitle,
            player.duration,
            player.duration,
            currentItem || {}
        );
        if (currentPlayingEpisodeIdx >= 0 && currentSeasonEpisodes.length > currentPlayingEpisodeIdx + 1) {
            confirmNextEpisode();
        }
    });

    player.addEventListener('pause', () => {
        savePlaybackProgress(
            currentActiveStreamUrl,
            currentActiveStreamTitle,
            player.currentTime,
            player.duration,
            currentItem || {}
        );
    });
}

function startStream(url, title) {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    currentActiveStreamUrl = url;
    currentActiveStreamTitle = title || 'Playing Media';
    document.getElementById('playerCurrentTitle').textContent = currentActiveStreamTitle;

    player.src = url;

    const prev = getPlaybackProgress(url, title);
    if (prev && prev.time > 15 && prev.time < prev.duration - 20) {
        player.currentTime = prev.time;
        showToast(`Resumed from ${formatTime(prev.time)}`);
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
        leftTapCount++;
        clearTimeout(leftTapTimer);
        if (leftTapCount === 1) {
            leftTapTimer = setTimeout(() => {
                leftTapCount = 0;
            }, 300);
        } else if (leftTapCount >= 2) {
            leftTapCount = 0;
            seekRelative(-10, 'left');
        }
    });

    rightZone.addEventListener('click', (e) => {
        rightTapCount++;
        clearTimeout(rightTapTimer);
        if (rightTapCount === 1) {
            rightTapTimer = setTimeout(() => {
                rightTapCount = 0;
            }, 300);
        } else if (rightTapCount >= 2) {
            rightTapCount = 0;
            seekRelative(10, 'right');
        }
    });
}

function seekRelative(seconds, direction) {
    const player = document.getElementById('videoPlayer');
    if (!player) return;

    player.currentTime = Math.max(0, Math.min(player.duration || 0, player.currentTime + seconds));

    const ripple = direction === 'left' ? document.getElementById('seekRippleLeft') : document.getElementById('seekRippleRight');
    if (ripple) {
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
                <button class="ep-icon-btn btn-vlc-sm" onclick="openInVLC('${ep.url}', '${escapeQuotes(ep.name)}')" title="Play in VLC Player">
                    ${VLC_ICON_SVG}
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
                <button class="ep-icon-btn btn-vlc-sm" onclick="openInVLC('${ep.url}', '${escapeQuotes(ep.name)}')" title="VLC">
                    ${VLC_ICON_SVG}
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

    setTimeout(() => {
        try {
            window.location.href = `vlc://${url}`;
        } catch (e) {}
    }, 300);

    showToast('Opening in VLC Player...');
}

function openCurrentInVLC() {
    openInVLC(currentActiveStreamUrl || (currentItem ? currentItem.url : ''), currentActiveStreamTitle || (currentItem ? currentItem.title : ''));
}

function openInMXPlayer() {
    const url = currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    if (!url) return;
    const title = encodeURIComponent(currentActiveStreamTitle || (currentItem ? currentItem.title : 'Movie'));
    const intentUrl = `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;S.title=${title};end`;
    window.location.href = intentUrl;
    showToast('Launching MX Player...');
}

function openInPotPlayer() {
    const url = currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    if (!url) return;
    window.location.href = `potplayer://${url}`;
    showToast('Launching PotPlayer on PC...');
}

function copyCurrentStreamUrl() {
    const url = currentActiveStreamUrl || (currentItem ? currentItem.url : '');
    if (url) {
        copyLink(url);
        showToast('Stream URL copied to clipboard');
    }
}

function copyLink(url) {
    navigator.clipboard.writeText(url);
}

// ==========================================
// 🎛️ Video Player Toolbar Controls
// ==========================================
function cyclePlaybackSpeed() {
    currentSpeedIdx = (currentSpeedIdx + 1) % playbackSpeeds.length;
    const speed = playbackSpeeds[currentSpeedIdx];
    const player = document.getElementById('videoPlayer');
    if (player) player.playbackRate = speed;
    document.getElementById('speedLabel').textContent = `${speed}x`;
    showToast(`Speed: ${speed}x`);
}

function cycleAspectRatio() {
    currentAspectIdx = (currentAspectIdx + 1) % aspectRatios.length;
    const fit = aspectRatios[currentAspectIdx];
    const player = document.getElementById('videoPlayer');
    if (player) player.style.objectFit = fit;
    document.getElementById('aspectLabel').textContent = fit.charAt(0).toUpperCase() + fit.slice(1);
    showToast(`Aspect: ${fit}`);
}

async function togglePictureInPicture() {
    const player = document.getElementById('videoPlayer');
    if (!player) return;
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
            await player.requestPictureInPicture();
        }
    } catch (e) {
        showToast('PiP not supported');
    }
}

// ==========================================
// ⌨️ Keyboard Shortcuts
// ==========================================
function setupSearchKeybindings() {
    document.addEventListener('keydown', (e) => {
        const player = document.getElementById('videoPlayer');
        if (document.activeElement.tagName === 'INPUT') return;

        if (e.code === 'Space' || e.key === 'k') {
            e.preventDefault();
            if (player) {
                if (player.paused) player.play(); else player.pause();
            }
        } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
            e.preventDefault();
            if (player) seekRelative(10, 'right');
        } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
            e.preventDefault();
            if (player) seekRelative(-10, 'left');
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            if (player) {
                if (!document.fullscreenElement) {
                    player.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            }
        } else if (e.key === 'm' || e.key === 'M') {
            if (player) {
                player.muted = !player.muted;
                showToast(player.muted ? 'Muted' : 'Unmuted');
            }
        } else if (e.key === 'n' || e.key === 'N') {
            playNextEpisode();
        } else if (e.key === 'p' || e.key === 'P') {
            playPrevEpisode();
        } else if (e.key === 'c' || e.key === 'C') {
            toggleSubtitles();
        } else if (e.key === 'Escape' && isPlayerMode) {
            exitPlayerMode();
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
