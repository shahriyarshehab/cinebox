/**
 * CineBox Main Application Controller
 * Handles Homepage, Category Grids, Fullscreen Filtering, Live Fuzzy Search & PWA
 */

let allMovies = [];
let homeData = null;
let currentView = 'home'; // 'home' | 'category' | 'search' | 'watchlist'
let currentCategoryTag = 'All';
let currentCategoryName = 'All Movies';
let filteredMovies = [];
let displayedCount = 40;
const BATCH_SIZE = 40;

// Filter facets
let filterYear = 'all';
let filterQuality = 'all';
let filterAudio = 'all';
let currentSort = 'latest';

let currentSlide = 0;
let carouselMovies = [];
let carouselTimer = null;
let isFullCatalogLoaded = false;

const CATEGORY_ROWS = [
    { name: "Today's Updates", tag: "Today", limit: 14 },
    { name: 'IMDb Top 250', tag: 'Top Rated', limit: 14 },
    { name: 'Animation & Anime', tag: 'Animation', limit: 14 },
    { name: 'Hollywood 1080p', tag: 'Hollywood 1080p', limit: 14 },
    { name: 'Bollywood (Hindi)', tag: 'Bollywood', limit: 14 },
    { name: 'South Hindi Dubbed', tag: 'South Action', limit: 14 },
    { name: 'South Original', tag: 'South Original', limit: 14 },
    { name: 'TV & Web Series', tag: 'TV Series', limit: 14 },
    { name: 'Korean Drama', tag: 'K-Drama', limit: 14 },
    { name: 'Bangla Movies', tag: 'Bangla', limit: 14 },
    { name: 'Foreign Movies', tag: 'Foreign Movies', limit: 14 },
    { name: '3D Movies', tag: '3D Movies', limit: 14 },
    { name: 'English Classic Movies', tag: 'English Movies', limit: 14 }
];

const ALL_CATEGORY_PILLS = [
    { label: 'All Categories', tag: 'All' },
    { label: "Today's Updates", tag: 'Today' },
    { label: 'IMDb Top 250', tag: 'Top Rated' },
    { label: 'Hollywood 1080p', tag: 'Hollywood 1080p' },
    { label: 'Animation & Anime', tag: 'Animation' },
    { label: 'Bollywood (Hindi)', tag: 'Bollywood' },
    { label: 'South Action (Dubbed)', tag: 'South Action' },
    { label: 'South Original', tag: 'South Original' },
    { label: 'TV & Web Series', tag: 'TV Series' },
    { label: 'Korean Drama', tag: 'K-Drama' },
    { label: 'Bangla Movies', tag: 'Bangla' },
    { label: 'Foreign Cinema', tag: 'Foreign Movies' },
    { label: '3D Movies', tag: '3D Movies' },
    { label: 'English Classic', tag: 'English Movies' }
];

const TV_CATEGORY_PILLS = [
    { label: 'All TV & K-Drama', tag: 'All_TV' },
    { label: "Today's Releases", tag: 'Today' },
    { label: 'TV & Web Series', tag: 'TV Series' },
    { label: 'Korean Drama (K-Drama)', tag: 'K-Drama' },
    { label: 'Animation & Anime Series', tag: 'Animation' }
];

const MOVIES_CATEGORY_PILLS = [
    { label: 'All 36,000+ Movies', tag: 'All_Movies' },
    { label: "Today's Releases", tag: 'Today' },
    { label: 'Hollywood 1080p', tag: 'Hollywood 1080p' },
    { label: 'Bollywood (Hindi)', tag: 'Bollywood' },
    { label: 'South Action (Dubbed)', tag: 'South Action' },
    { label: 'South Original', tag: 'South Original' },
    { label: 'Bangla Cinema', tag: 'Bangla' },
    { label: 'Foreign & Asian', tag: 'Foreign Movies' },
    { label: 'IMDb Top 250', tag: 'Top Rated' },
    { label: '3D Cinema', tag: '3D Movies' },
    { label: 'English Classic', tag: 'English Movies' }
];

const ANIMATION_CATEGORY_PILLS = [
    { label: 'All Animation & Anime', tag: 'All_Animation' },
    { label: "Today's Releases", tag: 'Today' },
    { label: 'Anime & TV Series', tag: 'TV Series' },
    { label: 'Animated Movies', tag: 'Hollywood 1080p' }
];

function detectPageType() {
    if (window.CINEBOX_PAGE) return window.CINEBOX_PAGE;
    const path = (window.location.pathname || '').toLowerCase();
    if (path.endsWith('tv.html')) return 'tv';
    if (path.endsWith('movies.html')) return 'movies';
    if (path.endsWith('animation.html')) return 'animation';
    if (path.endsWith('watchlist.html')) return 'watchlist';
    return 'home';
}

function getActivePagePills() {
    const page = detectPageType();
    if (page === 'tv') return TV_CATEGORY_PILLS;
    if (page === 'movies') return MOVIES_CATEGORY_PILLS;
    if (page === 'animation') return ANIMATION_CATEGORY_PILLS;
    return ALL_CATEGORY_PILLS;
}

const CATEGORY_JSON_MAP = {
    'Today': 'data/today.json',
    "Today's Updates": 'data/today.json',
    'K-Drama': 'data/kdrama.json',
    'TV Series': 'data/tv_series.json',
    'Hollywood 1080p': 'data/hollywood.json',
    'Bollywood': 'data/bollywood.json',
    'South Action': 'data/south_action.json',
    'South Original': 'data/south_original.json',
    'Animation': 'data/animation.json',
    'Bangla': 'data/bangla.json',
    'Foreign Movies': 'data/foreign.json',
    '3D Movies': 'data/3d.json',
    'English Movies': 'data/english.json',
    'Top Rated': 'data/top_rated.json'
};

const categoryCache = {};

function cleanItem(item) {
    if (Array.isArray(item)) {
        return {
            title: item[0] || '',
            poster: item[1] || '',
            url: item[2] || '',
            tag: item[3] || 'HD',
            category: item[4] || 'Cinema',
            size: item[5] || 'HD',
            date: item[6] || ''
        };
    }
    return item;
}

async function init() {
    updateWatchlistNavBadge();
    const page = detectPageType();

    // 1. Check client cached home_data or fetch home_data.json immediately for 0ms instant render
    const cachedHome = sessionStorage.getItem('cinebox_home_v2');
    if (cachedHome) {
        try {
            homeData = JSON.parse(cachedHome);
        } catch (e) {}
    }

    if (!homeData) {
        try {
            const res = await fetch('./home_data.json?v=' + Date.now());
            if (res.ok) {
                homeData = await res.json();
                sessionStorage.setItem('cinebox_home_v2', JSON.stringify(homeData));
            }
        } catch (e) {
            console.warn('Home data load notice:', e);
        }
    }

    // 2. Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    const catParam = urlParams.get('cat');
    const tabParam = urlParams.get('tab');

    if (page === 'tv') {
        activeNavTab = 'tv';
        currentView = 'category';
        currentCategoryTag = catParam || 'All_TV';
        currentCategoryName = catParam ? catParam : 'TV Shows & Korean Dramas';
        
        // Instant 0ms Preview from homeData
        if (homeData && homeData.categories) {
            const tvHome = (homeData.categories['TV Series'] || []).map(cleanItem);
            const kdHome = (homeData.categories['K-Drama'] || []).map(cleanItem);
            rawCategoryPool = [...tvHome, ...kdHome];
            if (rawCategoryPool.length > 0) {
                setupCarousel(rawCategoryPool.slice(0, 10));
            }
            applyAllFilters();
            renderView();
        }

        // Fetch complete TV datasets in background
        Promise.all([fetchCategoryData('TV Series'), fetchCategoryData('K-Drama')]).then(([tv, kd]) => {
            if (currentCategoryTag === 'All_TV') {
                rawCategoryPool = [...tv, ...kd];
            } else if (currentCategoryTag === 'TV Series') {
                rawCategoryPool = tv;
            } else if (currentCategoryTag === 'K-Drama') {
                rawCategoryPool = kd;
            }
            if (rawCategoryPool.length > 0) {
                setupCarousel(rawCategoryPool.slice(0, 10));
            }
            applyAllFilters();
            renderView();
        });
    } else if (page === 'movies') {
        activeNavTab = 'movies';
        currentView = 'category';
        currentCategoryTag = catParam || 'All_Movies';
        currentCategoryName = catParam ? catParam : 'Movies Collection';

        // Instant 0ms Preview from homeData
        if (homeData && homeData.categories) {
            const cats = homeData.categories;
            const h = (cats['Hollywood 1080p'] || []).map(cleanItem);
            const b = (cats['Bollywood'] || []).map(cleanItem);
            const s = (cats['South Action'] || []).map(cleanItem);
            const so = (cats['South Original'] || []).map(cleanItem);
            const bg = (cats['Bangla'] || []).map(cleanItem);
            const f = (cats['Foreign Movies'] || []).map(cleanItem);
            const tr = (cats['Top Rated'] || []).map(cleanItem);
            const threeD = (cats['3D Movies'] || []).map(cleanItem);
            rawCategoryPool = [...h, ...b, ...s, ...so, ...bg, ...f, ...tr, ...threeD];
            if (rawCategoryPool.length > 0) {
                setupCarousel(rawCategoryPool.slice(0, 10));
            }
            applyAllFilters();
            renderView();
        }

        // Fetch complete Movie datasets in background
        Promise.all([
            fetchCategoryData('Hollywood 1080p'),
            fetchCategoryData('Bollywood'),
            fetchCategoryData('South Action'),
            fetchCategoryData('South Original'),
            fetchCategoryData('Bangla'),
            fetchCategoryData('Foreign Movies'),
            fetchCategoryData('Top Rated'),
            fetchCategoryData('3D Movies')
        ]).then(([h, b, s, so, bg, f, tr, threeD]) => {
            if (currentCategoryTag === 'All_Movies') {
                rawCategoryPool = [...h, ...b, ...s, ...so, ...bg, ...f, ...tr, ...threeD];
            } else {
                rawCategoryPool = categoryCache[currentCategoryTag] || [];
            }
            if (rawCategoryPool.length > 0) {
                setupCarousel(rawCategoryPool.slice(0, 10));
            }
            applyAllFilters();
            renderView();
        });
    } else if (page === 'animation') {
        activeNavTab = 'animation';
        currentView = 'category';
        currentCategoryTag = catParam || 'All_Animation';
        currentCategoryName = catParam ? catParam : 'Animation & Anime Collection';

        // Instant 0ms Preview from homeData
        if (homeData && homeData.categories && homeData.categories['Animation']) {
            rawCategoryPool = homeData.categories['Animation'].map(cleanItem);
            if (rawCategoryPool.length > 0) {
                setupCarousel(rawCategoryPool.slice(0, 10));
            }
            applyAllFilters();
            renderView();
        }

        // Fetch full animation dataset in background
        fetchCategoryData('Animation').then((anim) => {
            rawCategoryPool = anim;
            if (rawCategoryPool.length > 0) {
                setupCarousel(rawCategoryPool.slice(0, 10));
            }
            applyAllFilters();
            renderView();
        });
    } else if (page === 'watchlist') {
        activeNavTab = 'watchlist';
        currentView = 'watchlist';
        renderView();
    } else {
        // Standard Home Page
        activeNavTab = 'home';
        if (homeData) {
            applyHomeData(homeData);
        }
    }

    if (queryParam) {
        const input = document.getElementById('searchInput');
        if (input) input.value = queryParam;
        loadFullCatalogInBackground().then(() => handleSearch());
    } else if (catParam && page === 'home') {
        loadFullCatalogInBackground().then(() => openCategoryView(catParam, catParam));
    } else if (tabParam && page === 'home') {
        switchNavTab(tabParam);
    } else {
        setTimeout(loadFullCatalogInBackground, 300);
    }

    setupGlobalShortcuts();
    setupSearchFocusEvents();
}

function applyHomeData(data) {
    if (!data) return;
    if (data.carousel && data.carousel.length > 0) {
        setupCarousel(data.carousel);
    }
    if (currentView === 'home') {
        renderHomeRowsFromPayload(data.categories);
    }
}

const ALL_CATEGORY_FILES = Object.values(CATEGORY_JSON_MAP);

async function loadFullCatalogInBackground() {
    if (isFullCatalogLoaded && allMovies.length > 0) return;

    try {
        const fetchPromises = ALL_CATEGORY_FILES.map(async file => {
            try {
                const res = await fetch(`./${file}`);
                if (!res.ok) return [];
                const data = await res.json();
                return data.map(cleanItem);
            } catch (e) {
                return [];
            }
        });

        const categoryResults = await Promise.all(fetchPromises);
        allMovies = categoryResults.flat().filter(m => {
            const t = (m.title || '').trim().toLowerCase();
            return t && !t.includes('parent directory') && t !== '..' && t !== '.';
        });

        isFullCatalogLoaded = true;

        // Cache category pools for instantaneous tab switching
        for (const [tag, file] of Object.entries(CATEGORY_JSON_MAP)) {
            if (!categoryCache[tag]) {
                categoryCache[tag] = allMovies.filter(m => matchesCategory(m, tag));
            }
        }

        const page = detectPageType();
        if (page === 'movies' && currentCategoryTag === 'All_Movies') {
            rawCategoryPool = allMovies.filter(m => !(m.tag === 'TV Series' || m.tag === 'K-Drama'));
            applyAllFilters();
            renderView();
        } else if (page === 'tv' && currentCategoryTag === 'All_TV') {
            rawCategoryPool = allMovies.filter(m => (m.tag === 'TV Series' || m.tag === 'K-Drama'));
            applyAllFilters();
            renderView();
        } else if (page === 'animation' && currentCategoryTag === 'All_Animation') {
            rawCategoryPool = allMovies.filter(m => matchesCategory(m, 'Animation'));
            applyAllFilters();
            renderView();
        } else if (currentView === 'search') {
            handleSearch();
        }
    } catch (e) {
        console.warn('Modular catalog load notice:', e);
    }
}

// ==========================================
//  Hero Carousel
// ==========================================
function setupCarousel(moviesList) {
    const rawList = moviesList || (homeData && homeData.carousel) || allMovies.slice(0, 10);
    carouselMovies = rawList.map(item => Array.isArray(item) ? {
        title: item[0], poster: item[1], url: item[2], tag: item[3], category: item[4], size: item[5], date: item[6]
    } : item);

    if (carouselMovies.length === 0) return;

    const track = document.getElementById('carouselTrack');
    track.innerHTML = carouselMovies.map((m, idx) => {
        const itemData = encodeURIComponent(JSON.stringify(m));
        const linkUrl = `watch.html?title=${encodeURIComponent(m.title)}&data=${itemData}`;
        const inWatchlist = isInWatchlist(m.title);

        return `
        <div class="carousel-slide ${idx === 0 ? 'active' : ''}" id="slide-${idx}">
            <div class="slide-bg" style="background-image: url('${m.poster}')"></div>
            <div class="slide-overlay"></div>
            <div class="slide-container">
                <div class="slide-content">
                    <div class="slide-tag">Featured • ${m.tag || 'Latest'}</div>
                    <h2 class="slide-title" title="${escapeQuotes(m.title)}">${m.title}</h2>
                    <div class="slide-meta">
                        <span style="color: var(--accent-gold); font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><svg class="icon" viewBox="0 0 24 24" fill="#ffb800" width="12" height="12"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> 8.9</span>
                        <span>•</span>
                        <span>${m.size || 'HD 1080P'}</span>
                        <span>•</span>
                        <span>${m.category || 'Cinema'}</span>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap;">
                        <a class="btn btn-primary" href="${linkUrl}">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>
                            <span>Watch Now</span>
                        </a>
                        <button class="btn btn-ghost" onclick="toggleWatchlistAndRefresh(${escapeQuotesJson(m)})">
                            <svg class="icon" viewBox="0 0 24 24" fill="${inWatchlist ? 'var(--accent)' : 'none'}" stroke="${inWatchlist ? 'var(--accent)' : 'currentColor'}" stroke-width="2" width="14" height="14"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                            <span>${inWatchlist ? 'In List' : 'Save'}</span>
                        </button>
                    </div>
                </div>

                <a class="slide-poster-showcase" href="${linkUrl}">
                    <img src="${m.poster}" alt="${escapeQuotes(m.title)}" loading="eager"
                         onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400';">
                    <div class="slide-poster-badge">${m.tag || 'HD'}</div>
                </a>
            </div>
        </div>
    `;}).join('');

    const dots = document.getElementById('carouselDots');
    dots.innerHTML = carouselMovies.map((_, idx) => `
        <div class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide(${idx})"></div>
    `).join('');

    startCarouselAuto();
}

function startCarouselAuto() {
    clearInterval(carouselTimer);
    carouselTimer = setInterval(nextSlide, 5000);
}

function showSlide(idx) {
    document.querySelectorAll('.carousel-slide').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
    });
    document.querySelectorAll('.carousel-dot').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
    });
    currentSlide = idx;
}

function nextSlide() {
    if (carouselMovies.length === 0) return;
    currentSlide = (currentSlide + 1) % carouselMovies.length;
    showSlide(currentSlide);
}

function prevSlide() {
    if (carouselMovies.length === 0) return;
    currentSlide = (currentSlide - 1 + carouselMovies.length) % carouselMovies.length;
    showSlide(currentSlide);
}

function goToSlide(idx) {
    showSlide(idx);
    startCarouselAuto();
}

// ==========================================
// ⏱ Continue Watching UI
// ==========================================
function renderContinueWatchingHtml() {
    const history = getWatchHistory();
    if (!history || history.length === 0) return '';

    return `
        <div class="continue-watching-block">
            <div class="row-header" style="border-bottom: none; margin-bottom: 10px;">
                <div class="row-title-wrap">
                    <h2 class="row-heading">
                        <span style="color: var(--primary);">▶</span> Continue Watching
                    </h2>
                    <span class="row-badge">${history.length}</span>
                </div>
                <div class="row-controls">
                    <button class="row-nav-btn prev" onclick="slideRow('continueSlider', -1)" aria-label="Previous">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <button class="row-nav-btn next" onclick="slideRow('continueSlider', 1)" aria-label="Next">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                </div>
            </div>

            <div class="row-slider" id="continueSlider">
                ${history.map(item => {
                    const itemData = encodeURIComponent(JSON.stringify(item));
                    const linkUrl = `watch.html?title=${encodeURIComponent(item.title)}&data=${itemData}`;
                    const timeLeft = Math.max(1, Math.round((item.duration - item.time) / 60));

                    return `
                        <div class="continue-card">
                            <button class="btn-remove-history" onclick="removeWatchHistory('${item.url}', event)" title="Remove" aria-label="Remove"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                            <a href="${linkUrl}" style="text-decoration: none; color: inherit;">
                                <div class="continue-thumb-wrap">
                                    <img src="${item.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300'}" alt="${escapeQuotes(item.title)}" loading="lazy">
                                    <div class="progress-bar-container">
                                        <div class="progress-bar-fill" style="width: ${item.percent || 10}%;"></div>
                                    </div>
                                </div>
                                <div class="card-body">
                                    <div class="card-title" title="${item.title}">${item.title}</div>
                                    <div class="card-meta">
                                        <span style="color: var(--primary); font-weight: 700;">${item.percent}%</span>
                                        <span>${timeLeft}m left</span>
                                    </div>
                                </div>
                            </a>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Watchlist bridge
function toggleWatchlistAndRefresh(movieObj, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    toggleWatchlist(movieObj);
    if (currentView === 'watchlist') {
        renderWatchlistView();
    }
}

// ==========================================
//  Views Rendering (Home, Category, Watchlist)
// ==========================================
function renderView() {
    const main = document.getElementById('mainContent');
    const carousel = document.getElementById('heroCarousel');
    const page = detectPageType();

    if (currentView === 'home') {
        if (carousel) carousel.style.display = 'block';
        if (homeData && homeData.categories) {
            renderHomeRowsFromPayload(homeData.categories);
        } else {
            renderHomeRows(main);
        }
    } else if (currentView === 'watchlist') {
        if (carousel) carousel.style.display = 'none';
        renderWatchlistView();
    } else {
        if (carousel) {
            if (page !== 'home' && (currentCategoryTag.startsWith('All_') || currentCategoryTag === 'All')) {
                carousel.style.display = 'block';
            } else {
                carousel.style.display = 'none';
            }
        }
        renderCategoryFullGrid(main);
    }
}

function renderHomeRowsFromPayload(categoriesMap) {
    const container = document.getElementById('mainContent');
    if (!categoriesMap) return;

    let html = renderContinueWatchingHtml();

    html += `
        <!-- MovieBox Quick-Category Filter Bar -->
        <div class="home-category-pills-bar">
            <div class="filter-pills-row">
                ${ALL_CATEGORY_PILLS.map(p => `
                    <button class="filter-pill ${p.tag === 'All' ? 'active' : ''}" onclick="${p.tag === 'All' ? 'showHomeView()' : `openCategoryView('${p.tag}', '${escapeQuotes(p.label)}')`}">
                        ${p.label}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    CATEGORY_ROWS.forEach((cat, catIdx) => {
        const rawItems = categoriesMap[cat.tag] || [];
        if (rawItems.length === 0) return;

        const items = rawItems.map(item => Array.isArray(item) ? {
            title: item[0], poster: item[1], url: item[2], tag: item[3], category: item[4], size: item[5], date: item[6]
        } : item);

        const sixItems = items.slice(0, 6);
        const rowSliderId = `rowSlider_${catIdx}`;

        html += `
            <div class="category-row-block">
                <div class="row-header">
                    <div class="row-title-wrap">
                        <h2 class="row-heading">${cat.name}</h2>
                    </div>
                    <div class="row-controls">
                        <button class="row-nav-btn prev" onclick="slideRow('${rowSliderId}', -1)" aria-label="Previous">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M15 18l-6-6 6-6"/></svg>
                        </button>
                        <button class="row-nav-btn next" onclick="slideRow('${rowSliderId}', 1)" aria-label="Next">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M9 18l6-6-6-6"/></svg>
                        </button>
                    </div>
                </div>

                <div class="row-slider" id="${rowSliderId}">
                    ${sixItems.map((item) => renderMovieCardHtml(item)).join('')}
                    ${renderShowAllCardHtml(cat)}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderShowAllCardHtml(cat) {
    return `
        <div class="movie-card show-all-card" onclick="openCategoryView('${cat.tag}', '${escapeQuotes(cat.name)}')">
            <div class="show-all-card-inner">
                <div class="show-all-glow-orb"></div>
                <div class="show-all-icon-circle">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="22" height="22">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </div>
                <div class="show-all-card-title">Show All</div>
                <div class="show-all-card-cat">${cat.name}</div>
            </div>
        </div>
    `;
}

function renderHomeRows(container) {
    let html = renderContinueWatchingHtml();

    html += `
        <!-- MovieBox Quick-Category Filter Bar -->
        <div class="home-category-pills-bar">
            <div class="filter-pills-row">
                ${ALL_CATEGORY_PILLS.map(p => `
                    <button class="filter-pill ${p.tag === 'All' ? 'active' : ''}" onclick="${p.tag === 'All' ? 'showHomeView()' : `openCategoryView('${p.tag}', '${escapeQuotes(p.label)}')`}">
                        ${p.label}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    CATEGORY_ROWS.forEach((cat, catIdx) => {
        const catMovies = allMovies.filter(m => m.tag === cat.tag || (m.category && m.category.includes(cat.tag)));
        if (catMovies.length === 0) return;

        const sixItems = catMovies.slice(0, 6);
        const rowSliderId = `rowSlider_${catIdx}`;

        html += `
            <div class="category-row-block">
                <div class="row-header">
                    <div class="row-title-wrap">
                        <h2 class="row-heading">${cat.name}</h2>
                        <span class="row-badge">${catMovies.length.toLocaleString()}</span>
                    </div>
                    <div class="row-controls">
                        <button class="row-nav-btn prev" onclick="slideRow('${rowSliderId}', -1)" aria-label="Previous">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M15 18l-6-6 6-6"/></svg>
                        </button>
                        <button class="row-nav-btn next" onclick="slideRow('${rowSliderId}', 1)" aria-label="Next">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M9 18l6-6-6-6"/></svg>
                        </button>
                    </div>
                </div>

                <div class="row-slider" id="${rowSliderId}">
                    ${sixItems.map((item) => renderMovieCardHtml(item)).join('')}
                    ${renderShowAllCardHtml(cat, catMovies.length)}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function fetchCategoryData(tag) {
    if (categoryCache[tag]) return categoryCache[tag];
    const file = CATEGORY_JSON_MAP[tag];
    if (file) {
        try {
            const res = await fetch(`./${file}`);
            if (res.ok) {
                const data = await res.json();
                const clean = data.map(item => Array.isArray(item) ? {
                    title: item[0], poster: item[1], url: item[2], tag: item[3], category: item[4], size: item[5], date: item[6]
                } : item);
                categoryCache[tag] = clean;
                return clean;
            }
        } catch (e) {
            console.warn('Category fetch notice:', e);
        }
    }
    return allMovies.filter(m => matchesCategory(m, tag));
}

let activeNavTab = 'home';

function switchNavTab(tab) {
    const pageMap = {
        'home': 'index.html',
        'tv': 'tv.html',
        'movies': 'movies.html',
        'animation': 'animation.html',
        'watchlist': 'watchlist.html'
    };
    if (pageMap[tab]) {
        window.location.href = pageMap[tab];
    }
}

let rawCategoryPool = [];
let currentWatchlistFilter = 'all'; // 'all' | 'movies' | 'tv' | 'history'

function filterWatchlistTab(tab) {
    currentWatchlistFilter = tab;
    renderWatchlistView();
}

function renderWatchlistView() {
    const container = document.getElementById('mainContent');
    if (!container) return;

    const list = getWatchlist();
    const historyList = getWatchHistory();

    const moviesOnly = list.filter(m => !(m.tag === 'TV Series' || m.tag === 'K-Drama' || (m.url && m.url.endsWith('/'))));
    const tvOnly = list.filter(m => (m.tag === 'TV Series' || m.tag === 'K-Drama' || (m.url && m.url.endsWith('/'))));

    let displayList = list;
    if (currentWatchlistFilter === 'movies') displayList = moviesOnly;
    else if (currentWatchlistFilter === 'tv') displayList = tvOnly;
    else if (currentWatchlistFilter === 'history') displayList = historyList;

    container.innerHTML = `
        <div class="filter-bar-wrap">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <a class="btn btn-ghost" style="padding: 5px 10px; font-size: 11.5px; text-decoration: none;" href="index.html">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        <span>Home</span>
                    </a>
                    <h1 class="row-heading" style="font-size: 18px; display: inline-flex; align-items: center; gap: 8px;">
                        <svg class="icon" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" stroke-width="2" width="18" height="18"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        <span>My Watchlist & Library</span>
                    </h1>
                </div>

                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-ghost" style="padding: 5px 10px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;" onclick="exportWatchlist()" title="Backup watchlist as JSON">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Export JSON</span>
                    </button>
                    <button class="btn btn-ghost" style="padding: 5px 10px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;" onclick="triggerWatchlistImport()" title="Restore saved watchlist">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span>Import JSON</span>
                    </button>
                    ${list.length > 0 ? `
                        <button class="btn btn-ghost" style="padding: 5px 10px; font-size: 11.5px; color: var(--accent); display: inline-flex; align-items: center; gap: 6px;" onclick="clearAllWatchlist()" title="Clear all saved titles">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            <span>Clear All</span>
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Horizontal Watchlist Tabs -->
            <div class="filter-pills-row" style="margin-top: 10px;">
                <button class="filter-pill ${currentWatchlistFilter === 'all' ? 'active' : ''}" onclick="filterWatchlistTab('all')">
                    All Saved (${list.length})
                </button>
                <button class="filter-pill ${currentWatchlistFilter === 'movies' ? 'active' : ''}" onclick="filterWatchlistTab('movies')">
                    Movies (${moviesOnly.length})
                </button>
                <button class="filter-pill ${currentWatchlistFilter === 'tv' ? 'active' : ''}" onclick="filterWatchlistTab('tv')">
                    TV Shows (${tvOnly.length})
                </button>
                <button class="filter-pill ${currentWatchlistFilter === 'history' ? 'active' : ''}" onclick="filterWatchlistTab('history')">
                    Continue Watching (${historyList.length})
                </button>
            </div>
        </div>

        ${displayList.length > 0 ? `
            <div class="poster-grid" id="movieGrid">
                ${displayList.map(item => renderMovieCardHtml(item)).join('')}
            </div>
        ` : `
            <div style="text-align: center; padding: 60px 16px;">
                <div style="margin-bottom: 16px;">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5" width="48" height="48"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">No Titles Found in This Tab</h2>
                <p style="font-size: 13px; color: var(--text-muted); max-width: 380px; margin: 0 auto 16px;">
                    Bookmark movies and series with the save icon to access them here anytime!
                </p>
                <a class="btn btn-primary" style="text-decoration: none;" href="index.html">Explore Cinema Catalog</a>
            </div>
        `}
    `;
}

function exportWatchlist() {
    const list = getWatchlist();
    if (list.length === 0) {
        showToast('Watchlist is empty');
        return;
    }
    const json = JSON.stringify(list, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cinebox_watchlist_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Watchlist exported (.json)');
}

function triggerWatchlistImport() {
    const input = document.getElementById('watchlistFileInput');
    if (input) input.click();
}

function handleWatchlistImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                const existing = getWatchlist();
                const titles = new Set(existing.map(m => (m.title || '').toLowerCase()));
                let added = 0;
                for (const item of imported) {
                    if (item && item.title && !titles.has(item.title.toLowerCase())) {
                        existing.push(item);
                        titles.add(item.title.toLowerCase());
                        added++;
                    }
                }
                localStorage.setItem('cinebox_watchlist', JSON.stringify(existing));
                updateWatchlistNavBadge();
                renderWatchlistView();
                showToast(`Imported ${added} new saved titles!`);
            }
        } catch (err) {
            showToast('Invalid JSON file format');
        }
    };
    reader.readAsText(file);
}

function clearAllWatchlist() {
    if (confirm('Are you sure you want to clear your entire watchlist?')) {
        localStorage.removeItem('cinebox_watchlist');
        updateWatchlistNavBadge();
        renderWatchlistView();
        showToast('Watchlist cleared');
    }
}

function renderCategoryFullGrid(container) {
    const toShow = filteredMovies.slice(0, displayedCount);
    const pills = getActivePagePills();

    container.innerHTML = `
        <!-- MovieBox Filter Bar with Horizontal Pills & Facets -->
        <div class="filter-bar-wrap">
            <div class="category-bar-top">
                <div class="category-bar-left">
                    <a class="btn btn-ghost btn-home-link" style="padding: 5px 10px; font-size: 11.5px; text-decoration: none;" href="index.html">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        <span>Home</span>
                    </a>
                    <h1 class="category-bar-title">${currentCategoryName}</h1>
                </div>

                <div class="category-bar-controls">
                    <span class="category-bar-count">${filteredMovies.length.toLocaleString()} titles</span>
                    <select class="sort-select" onchange="handleSortChange(this.value)" aria-label="Sort media list">
                        <option value="latest" ${currentSort === 'latest' ? 'selected' : ''}>Latest Uploads</option>
                        <option value="title" ${currentSort === 'title' ? 'selected' : ''}>Alphabetical (A-Z)</option>
                        <option value="rating" ${currentSort === 'rating' ? 'selected' : ''}>IMDb Top Rated</option>
                    </select>
                </div>
            </div>

            <!-- Horizontal Category Filter Pills -->
            <div class="filter-pills-row">
                ${pills.map(p => `
                    <button class="filter-pill ${currentCategoryTag === p.tag ? 'active' : ''}" onclick="selectFilterPill('${p.tag}', '${escapeQuotes(p.label)}')">
                        ${p.label}
                    </button>
                `).join('')}
            </div>

            <!-- Multi-Facet Filters (Release Era, Quality, Audio) -->
            <div class="filter-facets-container">
                <div class="facet-group">
                    <span class="facet-label">Era:</span>
                    <button class="filter-pill-mini ${filterYear === 'all' ? 'active' : ''}" onclick="setFacetYear('all')">All</button>
                    <button class="filter-pill-mini ${filterYear === '2024+' ? 'active' : ''}" onclick="setFacetYear('2024+')">2024–26</button>
                    <button class="filter-pill-mini ${filterYear === '2020-2023' ? 'active' : ''}" onclick="setFacetYear('2020-2023')">2020–23</button>
                    <button class="filter-pill-mini ${filterYear === '2010s' ? 'active' : ''}" onclick="setFacetYear('2010s')">2010s</button>
                    <button class="filter-pill-mini ${filterYear === 'classic' ? 'active' : ''}" onclick="setFacetYear('classic')">Classic</button>
                </div>

                <div class="facet-group">
                    <span class="facet-label">Audio:</span>
                    <button class="filter-pill-mini ${filterAudio === 'all' ? 'active' : ''}" onclick="setFacetAudio('all')">All</button>
                    <button class="filter-pill-mini ${filterAudio === 'dual' ? 'active' : ''}" onclick="setFacetAudio('dual')">Dual Audio</button>
                    <button class="filter-pill-mini ${filterAudio === 'multi' ? 'active' : ''}" onclick="setFacetAudio('multi')">Multi Audio</button>
                </div>

                <div class="facet-group">
                    <span class="facet-label">Quality:</span>
                    <button class="filter-pill-mini ${filterQuality === 'all' ? 'active' : ''}" onclick="setFacetQuality('all')">All</button>
                    <button class="filter-pill-mini ${filterQuality === '1080p' ? 'active' : ''}" onclick="setFacetQuality('1080p')">1080p</button>
                    <button class="filter-pill-mini ${filterQuality === '720p' ? 'active' : ''}" onclick="setFacetQuality('720p')">720p</button>
                </div>
            </div>
        </div>

        <div class="poster-grid" id="movieGrid">
            ${toShow.map((item) => renderMovieCardHtml(item)).join('')}
        </div>

        <div class="pagination-wrap">
            <button class="btn btn-ghost" id="loadMoreBtn" style="${displayedCount < filteredMovies.length ? 'display:block' : 'display:none'}" onclick="loadMore()">Load More Titles</button>
        </div>
    `;
}

function setFacetYear(val) {
    filterYear = val;
    applyAllFilters();
    renderView();
}

function setFacetAudio(val) {
    filterAudio = val;
    applyAllFilters();
    renderView();
}

function setFacetQuality(val) {
    filterQuality = val;
    applyAllFilters();
    renderView();
}

function loadMore() {
    displayedCount += BATCH_SIZE;
    renderView();
}

function applyAllFilters() {
    let dataset = rawCategoryPool || [];

    // Apply Year Era
    if (filterYear === '2024+') {
        dataset = dataset.filter(m => (m.title && (m.title.includes('2024') || m.title.includes('2025') || m.title.includes('2026'))) || (m.date && (m.date.startsWith('2024') || m.date.startsWith('2025') || m.date.startsWith('2026'))));
    } else if (filterYear === '2020-2023') {
        dataset = dataset.filter(m => m.title && (m.title.includes('2020') || m.title.includes('2021') || m.title.includes('2022') || m.title.includes('2023')));
    } else if (filterYear === '2010s') {
        dataset = dataset.filter(m => m.title && /201[0-9]/.test(m.title));
    } else if (filterYear === 'classic') {
        dataset = dataset.filter(m => m.title && /(19[0-9]{2}|200[0-9])/.test(m.title));
    }

    // Apply Audio Track
    if (filterAudio === 'dual') {
        dataset = dataset.filter(m => m.title && m.title.toLowerCase().includes('dual audio'));
    } else if (filterAudio === 'multi') {
        dataset = dataset.filter(m => m.title && m.title.toLowerCase().includes('multi audio'));
    }

    // Apply Quality
    if (filterQuality === '1080p') {
        dataset = dataset.filter(m => m.title && m.title.includes('1080p'));
    } else if (filterQuality === '720p') {
        dataset = dataset.filter(m => m.title && m.title.includes('720p'));
    }

    filteredMovies = [...dataset];
    applyCurrentSorting();
}

function matchesCategory(m, tag) {
    if (!m) return false;
    if (tag === 'All') return true;
    if (tag === 'Today' || tag === "Today's Updates" || tag === "Today's Releases") {
        return (m.date && m.date.trim().length > 0);
    }
    if (tag === 'K-Drama') {
        return m.tag === 'K-Drama' || 
               (m.url && m.url.includes('KOREAN')) || 
               (m.category && m.category.toLowerCase().includes('korean'));
    }
    if (tag === 'TV Series') {
        // Strictly exclude K-Drama to eliminate overlap
        if (m.tag === 'K-Drama' || (m.url && m.url.includes('KOREAN')) || (m.category && m.category.toLowerCase().includes('korean'))) {
            return false;
        }
        return m.tag === 'TV Series' || 
               (m.url && m.url.includes('TV-WEB-Series')) || 
               (m.category && m.category.toLowerCase().includes('series'));
    }
    if (tag === 'Hollywood 1080p') {
        return m.tag === 'Hollywood 1080p' || (m.category && m.category.includes('English Movies (1080p)'));
    }
    if (tag === 'English Movies') {
        // Strictly exclude Hollywood 1080p
        if (m.tag === 'Hollywood 1080p' || (m.category && m.category.includes('1080p'))) return false;
        return m.tag === 'English Movies' || (m.category && m.category.includes('English Movies'));
    }
    if (tag === 'Bollywood') {
        return m.tag === 'Bollywood' || (m.category && m.category.toLowerCase().includes('hindi'));
    }
    if (tag === 'South Action') {
        return m.tag === 'South Action' || (m.category && m.category.toLowerCase().includes('dubbed'));
    }
    if (tag === 'South Original') {
        return m.tag === 'South Original' || ((m.category && m.category.includes('South Movies')) && !m.category.includes('Dubbed'));
    }
    if (tag === 'Animation') {
        return m.tag === 'Animation' || (m.category && m.category.toLowerCase().includes('animation'));
    }
    if (tag === 'Bangla') {
        return m.tag === 'Bangla' || (m.category && m.category.toLowerCase().includes('bangla'));
    }
    if (tag === 'Foreign Movies') {
        return m.tag === 'Foreign Movies' || (m.category && m.category.toLowerCase().includes('foreign'));
    }
    if (tag === '3D Movies') {
        return m.tag === '3D Movies' || (m.category && m.category.includes('3D'));
    }
    if (tag === 'Top Rated') {
        return m.tag === 'Top Rated' || (m.category && m.category.includes('Top 250')) || (m.url && m.url.includes('Top-250'));
    }
    return m.category && m.category.toLowerCase().includes(tag.toLowerCase());
}

async function selectFilterPill(tag, label) {
    currentCategoryTag = tag;
    currentCategoryName = label;
    displayedCount = BATCH_SIZE;

    if (tag === 'All') {
        if (!isFullCatalogLoaded && allMovies.length === 0) {
            await loadFullCatalogInBackground();
        }
        rawCategoryPool = [...allMovies];
    } else if (tag === 'Today' || tag === "Today's Updates") {
        rawCategoryPool = await fetchCategoryData('Today');
    } else if (tag === 'All_TV') {
        const [tv, kdrama] = await Promise.all([fetchCategoryData('TV Series'), fetchCategoryData('K-Drama')]);
        rawCategoryPool = [...tv, ...kdrama];
    } else if (tag === 'All_Movies') {
        const [h, b, s1, s2, bg, f, tr, threeD] = await Promise.all([
            fetchCategoryData('Hollywood 1080p'),
            fetchCategoryData('Bollywood'),
            fetchCategoryData('South Action'),
            fetchCategoryData('South Original'),
            fetchCategoryData('Bangla'),
            fetchCategoryData('Foreign Movies'),
            fetchCategoryData('Top Rated'),
            fetchCategoryData('3D Movies')
        ]);
        rawCategoryPool = [...h, ...b, ...s1, ...s2, ...bg, ...f, ...tr, ...threeD];
    } else if (tag === 'All_Animation') {
        rawCategoryPool = await fetchCategoryData('Animation');
    } else {
        rawCategoryPool = await fetchCategoryData(tag);
    }

    applyAllFilters();
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleSortChange(sortVal) {
    currentSort = sortVal;
    applyCurrentSorting();
    displayedCount = BATCH_SIZE;
    renderView();
}

function applyCurrentSorting() {
    if (currentSort === 'title') {
        filteredMovies.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (currentSort === 'rating') {
        filteredMovies.sort((a, b) => (b.title.includes('2026') ? 1 : 0) - (a.title.includes('2026') ? 1 : 0));
    }
}

function showHomeView() {
    currentView = 'home';
    activeNavTab = 'home';
    document.querySelectorAll('.nav-link, .mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
    const b1 = document.getElementById('navHome'); if (b1) b1.classList.add('active');
    const b2 = document.getElementById('mobNavHome'); if (b2) b2.classList.add('active');
    document.getElementById('searchInput').value = '';
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function openCategoryView(tag, name) {
    currentView = 'category';
    currentCategoryTag = tag;
    currentCategoryName = name || tag;
    displayedCount = BATCH_SIZE;

    const container = document.getElementById('mainContent');
    if (container && (!categoryCache[tag] || categoryCache[tag].length === 0)) {
        container.innerHTML = `
            <div style="text-align: center; padding: 80px 20px;">
                <div class="surprise-spinner" style="margin-bottom: 16px;">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" width="36" height="36"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                </div>
                <div style="font-size: 16px; font-weight: 700; color: var(--primary);">Loading ${name || tag}...</div>
            </div>
        `;
    }

    if (tag === 'All') {
        if (!isFullCatalogLoaded && allMovies.length === 0) {
            await loadFullCatalogInBackground();
        }
        rawCategoryPool = [...allMovies];
    } else if (tag === 'All_TV' || tag === 'TV Shows') {
        const [tv, kdrama] = await Promise.all([fetchCategoryData('TV Series'), fetchCategoryData('K-Drama')]);
        rawCategoryPool = [...tv, ...kdrama];
    } else if (tag === 'All_Movies' || tag === 'Movies') {
        const [h, b, s1, s2, bg, f, tr, threeD] = await Promise.all([
            fetchCategoryData('Hollywood 1080p'),
            fetchCategoryData('Bollywood'),
            fetchCategoryData('South Action'),
            fetchCategoryData('South Original'),
            fetchCategoryData('Bangla'),
            fetchCategoryData('Foreign Movies'),
            fetchCategoryData('Top Rated'),
            fetchCategoryData('3D Movies')
        ]);
        rawCategoryPool = [...h, ...b, ...s1, ...s2, ...bg, ...f, ...tr, ...threeD];
    } else if (tag === 'All_Animation' || tag === 'Animation & Anime') {
        rawCategoryPool = await fetchCategoryData('Animation');
    } else {
        rawCategoryPool = await fetchCategoryData(tag);
    }

    applyAllFilters();
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
//  Live Fuzzy Search & Recent Searches UI
// ==========================================
let liveSearchTimer = null;

function setupSearchFocusEvents() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    input.addEventListener('focus', () => {
        if (!input.value.trim()) {
            showRecentSearchesDropdown(document.getElementById('searchDropdown'));
        }
    });
}

function handleLiveSearch(val) {
    clearTimeout(liveSearchTimer);
    const query = (val || '').trim();
    const dropdown = document.getElementById('searchDropdown');
    if (!dropdown) return;

    if (!query) {
        showRecentSearchesDropdown(dropdown);
        return;
    }

    liveSearchTimer = setTimeout(async () => {
        if (!isFullCatalogLoaded && allMovies.length === 0) {
            await loadFullCatalogInBackground();
        }

        let dataset = allMovies;
        if (dataset.length === 0 && homeData) {
            dataset = (homeData.carousel || []).concat(Object.values(homeData.categories || {}).flat());
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
                <div class="search-dropdown-footer" onclick="hideSearchDropdown(); handleSearch();">
                    View all results for "${val}" →
                </div>
            `;
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = `
                <div style="padding: 16px 12px; text-align: center; font-size: 12px; color: var(--text-muted);">
                    No exact title found for "${val}". Press Enter for full search.
                </div>
            `;
            dropdown.style.display = 'block';
        }
    }, 150);
}

function showRecentSearchesDropdown(dropdown) {
    if (!dropdown) return;
    const recent = getRecentSearches();

    if (recent.length === 0) {
        dropdown.innerHTML = `
            <div style="padding: 12px; font-size: 11.5px; color: var(--text-muted);">
                <div style="font-weight: 700; color: var(--primary); margin-bottom: 8px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Trending Searches</div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span class="search-pill-suggestion" onclick="fillAndSearchHome('Oppenheimer')">Oppenheimer</span>
                    <span class="search-pill-suggestion" onclick="fillAndSearchHome('Solo Leveling')">Solo Leveling</span>
                    <span class="search-pill-suggestion" onclick="fillAndSearchHome('All of Us Are Dead')">All of Us Are Dead</span>
                    <span class="search-pill-suggestion" onclick="fillAndSearchHome('Avengers')">Avengers</span>
                    <span class="search-pill-suggestion" onclick="fillAndSearchHome('Interstellar')">Interstellar</span>
                </div>
            </div>
        `;
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = `
        <div style="padding: 6px 10px 4px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border);">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Recent Searches</span>
            <button onclick="clearRecentSearches(event); showRecentSearchesDropdown(document.getElementById('searchDropdown'));" style="background: none; border: none; font-size: 10.5px; color: var(--accent); cursor: pointer; font-weight: 600;">Clear All</button>
        </div>
        <div style="padding: 4px 0;">
            ${recent.map(q => `
                <div class="search-dropdown-item" style="justify-content: space-between;" onclick="fillAndSearchHome('${escapeQuotes(q)}')">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="color:var(--text-muted);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <span>${escapeQuotes(q)}</span>
                    </div>
                    <button class="remove-search-btn" onclick="removeSingleRecentSearch(event, '${escapeQuotes(q)}')" title="Remove" aria-label="Remove"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
            `).join('')}
        </div>
    `;
    dropdown.style.display = 'block';
}

function clearRecentSearches(e) {
    if (e) e.stopPropagation();
    try {
        localStorage.removeItem('cinebox_recent_searches');
    } catch (e) {}
}

function removeSingleRecentSearch(e, query) {
    if (e) e.stopPropagation();
    const recent = getRecentSearches().filter(q => q.toLowerCase() !== query.toLowerCase());
    try {
        localStorage.setItem('cinebox_recent_searches', JSON.stringify(recent));
    } catch (e) {}
    showRecentSearchesDropdown(document.getElementById('searchDropdown'));
}

function fillAndSearchHome(term) {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = term;
        handleSearch();
    }
    hideSearchDropdown();
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

async function handleSearch() {
    hideSearchDropdown();
    const q = document.getElementById('searchInput').value.trim();
    if (!q) {
        showHomeView();
        return;
    }

    saveRecentSearch(q);

    if (!isFullCatalogLoaded) {
        await loadFullCatalogInBackground();
    }

    currentView = 'search';
    currentCategoryName = `Search: "${q}"`;
    
    // Use fuzzy matching for full catalog search
    rawCategoryPool = filterFuzzyMatches(allMovies, q, 300);
    applyAllFilters();
    renderView();
}

function loadMore() {
    if (displayedCount >= filteredMovies.length) return;
    displayedCount += BATCH_SIZE;
    
    const grid = document.getElementById('movieGrid');
    if (grid) {
        const toShow = filteredMovies.slice(0, displayedCount);
        grid.innerHTML = toShow.map(item => renderMovieCardHtml(item)).join('');
        document.getElementById('loadMoreBtn').style.display = displayedCount < filteredMovies.length ? 'block' : 'none';
    }
}

// Auto-load on scroll
let scrollTimeout = null;
window.addEventListener('scroll', () => {
    if (currentView === 'home') return;
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
        scrollTimeout = null;
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight || document.documentElement.clientHeight;

        if (scrollTop + clientHeight >= scrollHeight - 500) {
            if (displayedCount < filteredMovies.length) {
                loadMore();
            }
        }
    }, 100);
});

function toggleShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    if (modal) {
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    }
}

function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const input = document.getElementById('searchInput');
            if (input) { input.focus(); input.select(); }
        } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            const input = document.getElementById('searchInput');
            if (input) { input.focus(); input.select(); }
        } else if (e.key === 'Escape') {
            hideSearchDropdown();
            const scModal = document.getElementById('shortcutsModal');
            if (scModal) scModal.style.display = 'none';
        }
    });
}

function getMediaReleaseMarker(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const clean = dateStr.trim();
    const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const itemDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    if (isNaN(itemDate.getTime())) return '';
    const diffMs = Date.now() - itemDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    if (diffDays >= 0 && diffDays <= 2) {
        return '<div class="media-marker marker-today">TODAY</div>';
    } else if (diffDays > 2 && diffDays <= 90) {
        return '<div class="media-marker marker-new">NEW</div>';
    }
    return '';
}

function renderMovieCardHtml(item) {
    const rawTitle = item.title || '';
    const safeTitle = escapeQuotes(rawTitle);
    const itemData = encodeURIComponent(JSON.stringify(item));
    const isSeries = typeof isMediaSeries === 'function' ? isMediaSeries(item) : (item.tag === 'TV Series' || item.tag === 'K-Drama' || (item.url && item.url.endsWith('/')));
    const linkUrl = `watch.html?title=${encodeURIComponent(rawTitle)}&data=${itemData}`;
    const markerHtml = getMediaReleaseMarker(item.date);
    const isRecent = markerHtml.length > 0;

    return `
        <a class="movie-card" href="${linkUrl}">
            <div class="card-cover">
                <img src="${item.poster}" alt="${safeTitle}" loading="lazy" decoding="async"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="cover-fallback" style="display: none;">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24"><rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                    <div style="font-size: 10px; font-weight: 600;">${item.title}</div>
                </div>
                ${markerHtml}
                <div class="tag-badge">${item.tag || (isSeries ? 'Series' : 'HD')}</div>
                <div class="cover-overlay">
                    <div class="play-button-symbol" style="${isSeries ? 'background: linear-gradient(135deg, #00e5ff 0%, #0077b6 100%);' : ''}">
                        ${isSeries ? 
                            '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#07090e" stroke-width="2.2" width="16" height="16"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>' : 
                            '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>'
                        }
                    </div>
                    <span style="font-size: 10px; font-weight: 700; color: #fff;">${isSeries ? 'Series' : 'Watch'}</span>
                </div>
            </div>
            <div class="card-body">
                <div class="card-title" title="${item.title}">${item.title}</div>
                <div class="card-meta">
                    <span>${item.size || 'HD'}</span>
                    <span style="${isRecent ? 'color: var(--primary); font-weight: 700;' : ''}">${item.date || ''}</span>
                </div>
            </div>
        </a>
    `;
}

window.onload = init;
