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

let allMovies = [];
let homeData = null;
let currentView = 'home'; // 'home' | 'category' | 'search'
let currentCategoryTag = 'All';
let currentCategoryName = 'All Movies';
let filteredMovies = [];
let displayedCount = 40;
const BATCH_SIZE = 40;

let currentSlide = 0;
let carouselMovies = [];
let carouselTimer = null;
let isFullCatalogLoaded = false;

const CATEGORY_ROWS = [
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

async function init() {
    const main = document.getElementById('mainContent');

    // 1. Check client-side cached home data for 0ms instant render
    const cachedHome = sessionStorage.getItem('cinebox_home_v2');
    if (cachedHome) {
        try {
            homeData = JSON.parse(cachedHome);
            applyHomeData(homeData);
        } catch (e) {}
    }

    // 2. Fetch lightweight home_data.json (~90 KB, downloads in ~25ms)
    try {
        const res = await fetch('./home_data.json?v=' + Date.now());
        if (res.ok) {
            homeData = await res.json();
            sessionStorage.setItem('cinebox_home_v2', JSON.stringify(homeData));
            applyHomeData(homeData);
        }
    } catch (e) {
        console.warn('Fast home load notice:', e);
    }

    // 3. Check for URL search parameters, tab parameters, or category parameters
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    const tabParam = urlParams.get('tab');
    const catParam = urlParams.get('cat');

    if (queryParam) {
        document.getElementById('searchInput').value = queryParam;
        loadFullCatalogInBackground().then(() => handleSearch());
    } else if (catParam) {
        loadFullCatalogInBackground().then(() => openCategoryView(catParam, catParam));
    } else if (tabParam) {
        loadFullCatalogInBackground().then(() => switchNavTab(tabParam));
    } else {
        // Asynchronously load the 36,000+ full catalog in background without blocking UI
        setTimeout(loadFullCatalogInBackground, 300);
    }
}

function applyHomeData(data) {
    if (!data) return;
    const badge = document.getElementById('totalCountBadge');
    if (badge && data.total) {
        badge.textContent = `${data.total.toLocaleString()} Movies`;
    }
    if (data.carousel && data.carousel.length > 0) {
        setupCarousel(data.carousel);
    }
    if (currentView === 'home') {
        renderHomeRowsFromPayload(data.categories);
    }
}

const ALL_CATEGORY_FILES = [
    'data/top_rated.json',
    'data/animation.json',
    'data/hollywood.json',
    'data/bollywood.json',
    'data/south_action.json',
    'data/south_original.json',
    'data/tv_series.json',
    'data/kdrama.json',
    'data/bangla.json',
    'data/foreign.json',
    'data/3d.json',
    'data/english.json'
];

async function loadFullCatalogInBackground() {
    if (isFullCatalogLoaded && allMovies.length > 0) return;

    try {
        const fetchPromises = ALL_CATEGORY_FILES.map(async file => {
            try {
                const res = await fetch(`./${file}`);
                if (!res.ok) return [];
                const data = await res.json();
                return data.map(item => Array.isArray(item) ? {
                    title: item[0] || '',
                    poster: item[1] || '',
                    url: item[2] || '',
                    tag: item[3] || 'HD',
                    category: item[4] || 'Cinema',
                    size: item[5] || 'HD',
                    date: item[6] || ''
                } : item);
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
        const badge = document.getElementById('totalCountBadge');
        if (badge) {
            badge.textContent = `${allMovies.length.toLocaleString()} Movies`;
        }

        if (currentView !== 'home') {
            renderView();
        }
    } catch (e) {
        console.warn('Modular catalog load notice:', e);
    }
}

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
        return `
        <div class="carousel-slide ${idx === 0 ? 'active' : ''}" id="slide-${idx}">
            <div class="slide-bg" style="background-image: url('${m.poster}')"></div>
            <div class="slide-overlay"></div>
            <div class="slide-container">
                <div class="slide-content">
                    <div class="slide-tag">Featured • ${m.tag || 'Latest Release'}</div>
                    <h2 class="slide-title" title="${escapeQuotes(m.title)}">${m.title}</h2>
                    <div class="slide-meta">
                        <span style="color: var(--accent-gold); font-weight: 700;">★ 8.9 / 10</span>
                        <span>•</span>
                        <span>${m.size || 'HD 1080P'}</span>
                        <span>•</span>
                        <span>${m.category || 'Cinema'}</span>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap;">
                        <a class="btn btn-primary" href="${linkUrl}">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>
                            <span>Watch Now</span>
                        </a>
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

function navigateToWatch(title) {
    window.location.href = `watch.html?title=${encodeURIComponent(title)}`;
}

function renderView() {
    const main = document.getElementById('mainContent');

    if (currentView === 'home') {
        document.getElementById('heroCarousel').style.display = 'block';
        if (homeData && homeData.categories) {
            renderHomeRowsFromPayload(homeData.categories);
        } else {
            renderHomeRows(main);
        }
    } else {
        document.getElementById('heroCarousel').style.display = 'none';
        renderCategoryFullGrid(main);
    }
}

function slideRow(rowId, direction) {
    const slider = document.getElementById(rowId);
    if (!slider) return;
    const cardWidth = 186;
    const scrollAmount = Math.max(cardWidth * 3, Math.floor(slider.clientWidth * 0.75)) * direction;
    slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

function renderHomeRowsFromPayload(categoriesMap) {
    const container = document.getElementById('mainContent');
    if (!categoriesMap) return;

    let html = `
        <!-- MovieBox Quick-Category Filter Bar -->
        <div class="home-category-pills-bar">
            <div class="filter-pills-row">
                <button class="filter-pill active" onclick="showHomeView()">🔥 All Categories</button>
                ${ALL_CATEGORY_PILLS.map(p => `
                    <button class="filter-pill" onclick="openCategoryView('${p.tag}', '${escapeQuotes(p.label)}')">
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

        const rowSliderId = `rowSlider_${catIdx}`;

        html += `
            <div class="category-row-block">
                <div class="row-header">
                    <div class="row-title-wrap">
                        <h2 class="row-heading">${cat.name}</h2>
                    </div>
                    <div class="row-controls">
                        <button class="row-nav-btn prev" onclick="slideRow('${rowSliderId}', -1)" aria-label="Previous">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M15 18l-6-6 6-6"/></svg>
                        </button>
                        <button class="row-nav-btn next" onclick="slideRow('${rowSliderId}', 1)" aria-label="Next">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M9 18l6-6-6-6"/></svg>
                        </button>
                        <button class="btn-see-all" onclick="openCategoryView('${cat.tag}', '${escapeQuotes(cat.name)}')">
                            <span>Show All</span>
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </div>

                <div class="row-slider" id="${rowSliderId}">
                    ${items.map((item) => renderMovieCardHtml(item)).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderHomeRows(container) {
    let html = `
        <!-- MovieBox Quick-Category Filter Bar -->
        <div class="home-category-pills-bar">
            <div class="filter-pills-row">
                <button class="filter-pill active" onclick="showHomeView()">🔥 All Categories</button>
                ${ALL_CATEGORY_PILLS.map(p => `
                    <button class="filter-pill" onclick="openCategoryView('${p.tag}', '${escapeQuotes(p.label)}')">
                        ${p.label}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    CATEGORY_ROWS.forEach((cat, catIdx) => {
        const catMovies = allMovies.filter(m => m.tag === cat.tag || (m.category && m.category.includes(cat.tag)));
        if (catMovies.length === 0) return;

        const topSlice = catMovies.slice(0, 16);
        const rowSliderId = `rowSlider_${catIdx}`;

        html += `
            <div class="category-row-block">
                <div class="row-header">
                    <div class="row-title-wrap">
                        <h2 class="row-heading">${cat.name}</h2>
                        <span class="row-badge">${catMovies.length.toLocaleString()} items</span>
                    </div>
                    <div class="row-controls">
                        <button class="row-nav-btn prev" onclick="slideRow('${rowSliderId}', -1)" aria-label="Previous">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M15 18l-6-6 6-6"/></svg>
                        </button>
                        <button class="row-nav-btn next" onclick="slideRow('${rowSliderId}', 1)" aria-label="Next">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M9 18l6-6-6-6"/></svg>
                        </button>
                        <button class="btn-see-all" onclick="openCategoryView('${cat.tag}', '${escapeQuotes(cat.name)}')">
                            <span>Show All</span>
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </div>

                <div class="row-slider" id="${rowSliderId}">
                    ${topSlice.map((item) => renderMovieCardHtml(item)).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

const ALL_CATEGORY_PILLS = [
    { label: 'All Categories', tag: 'All' },
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

const CATEGORY_JSON_MAP = {
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
let currentSort = 'latest';

async function switchNavTab(tab) {
    activeNavTab = tab;
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'home') {
        const b = document.getElementById('navHome'); if (b) b.classList.add('active');
        showHomeView();
    } else if (tab === 'tv') {
        const b = document.getElementById('navTv'); if (b) b.classList.add('active');
        currentView = 'category';
        currentCategoryTag = 'TV Series';
        currentCategoryName = 'TV Shows & Korean Dramas';
        const [tv, kdrama] = await Promise.all([fetchCategoryData('TV Series'), fetchCategoryData('K-Drama')]);
        filteredMovies = [...tv, ...kdrama];
        applyCurrentSorting();
        displayedCount = BATCH_SIZE;
        renderView();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'movies') {
        const b = document.getElementById('navMovies'); if (b) b.classList.add('active');
        openCategoryView('Hollywood 1080p', 'Movies Collection');
    } else if (tab === 'animation') {
        const b = document.getElementById('navAnimation'); if (b) b.classList.add('active');
        openCategoryView('Animation', 'Animation & Anime Collection');
    }
}

function renderCategoryFullGrid(container) {
    const toShow = filteredMovies.slice(0, displayedCount);

    container.innerHTML = `
        <!-- MovieBox Filter Bar with Horizontal Pills -->
        <div class="filter-bar-wrap">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn btn-ghost" style="padding: 6px 12px; font-size: 12px;" onclick="showHomeView()">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        <span>Home Rows</span>
                    </button>
                    <h1 class="row-heading" style="font-size: 20px;">${currentCategoryName}</h1>
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 12px; color: var(--text-muted);">${filteredMovies.length.toLocaleString()} titles</span>
                    <select class="sort-select" onchange="handleSortChange(this.value)">
                        <option value="latest" ${currentSort === 'latest' ? 'selected' : ''}>Sort: Latest Releases</option>
                        <option value="title" ${currentSort === 'title' ? 'selected' : ''}>Sort: Name (A-Z)</option>
                        <option value="rating" ${currentSort === 'rating' ? 'selected' : ''}>Sort: Top Rated ★</option>
                    </select>
                </div>
            </div>

            <!-- Horizontal Category Filter Pills -->
            <div class="filter-pills-row">
                ${ALL_CATEGORY_PILLS.map(p => `
                    <button class="filter-pill ${currentCategoryTag === p.tag ? 'active' : ''}" onclick="selectFilterPill('${p.tag}', '${escapeQuotes(p.label)}')">
                        ${p.label}
                    </button>
                `).join('')}
            </div>
        </div>

        <div class="poster-grid" id="movieGrid">
            ${toShow.map((item) => renderMovieCardHtml(item)).join('')}
        </div>

        <div class="pagination-wrap">
            <button class="btn btn-ghost" id="loadMoreBtn" style="${displayedCount < filteredMovies.length ? 'display:block' : 'display:none'}" onclick="loadMore()">Load More Movies</button>
        </div>
    `;
}

function matchesCategory(m, tag) {
    if (tag === 'All') return true;
    if (m.tag === tag) return true;
    if (tag === 'K-Drama' && (m.tag === 'K-Drama' || (m.category && m.category.includes('Korean')) || (m.url && m.url.includes('KOREAN')))) return true;
    if (tag === 'TV Series' && (m.tag === 'TV Series' || (m.category && m.category.includes('Series')))) return true;
    if (tag === 'Bollywood' && (m.tag === 'Bollywood' || (m.category && m.category.includes('Hindi')))) return true;
    if (tag === 'Animation' && (m.tag === 'Animation' || (m.category && m.category.includes('Animation')))) return true;
    if (tag === 'Bangla' && (m.tag === 'Bangla' || (m.category && m.category.includes('Bangla')))) return true;
    return m.category && m.category.toLowerCase().includes(tag.toLowerCase());
}

async function selectFilterPill(tag, label) {
    currentCategoryTag = tag;
    currentCategoryName = label;

    if (tag === 'All') {
        if (!isFullCatalogLoaded && allMovies.length === 0) {
            await loadFullCatalogInBackground();
        }
        filteredMovies = [...allMovies];
    } else {
        filteredMovies = await fetchCategoryData(tag);
    }

    applyCurrentSorting();
    displayedCount = BATCH_SIZE;
    renderView();
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
        // High score top
        filteredMovies.sort((a, b) => (b.title.includes('2026') ? 1 : 0) - (a.title.includes('2026') ? 1 : 0));
    }
}

function showHomeView() {
    currentView = 'home';
    activeNavTab = 'home';
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    const b = document.getElementById('navHome'); if (b) b.classList.add('active');
    document.getElementById('searchInput').value = '';
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function openCategoryView(tag, name) {
    currentView = 'category';
    currentCategoryTag = tag;
    currentCategoryName = name || tag;

    if (tag === 'All') {
        if (!isFullCatalogLoaded && allMovies.length === 0) {
            document.getElementById('mainContent').innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 15px; font-weight: 600; color: var(--text-muted);">Loading catalog...</div>
                </div>
            `;
            await loadFullCatalogInBackground();
        }
        filteredMovies = [...allMovies];
    } else {
        filteredMovies = await fetchCategoryData(tag);
    }

    applyCurrentSorting();
    displayedCount = BATCH_SIZE;
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

let liveSearchTimer = null;

function handleLiveSearch(val) {
    clearTimeout(liveSearchTimer);
    const query = (val || '').trim().toLowerCase();
    const dropdown = document.getElementById('searchDropdown');
    if (!dropdown) return;

    if (!query) {
        dropdown.style.display = 'none';
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

        const matches = [];
        for (const item of dataset) {
            const obj = Array.isArray(item) ? {
                title: item[0], poster: item[1], url: item[2], tag: item[3], category: item[4], size: item[5], date: item[6]
            } : item;

            const t = (obj.title || '').toLowerCase();
            const c = (obj.category || '').toLowerCase();
            const g = (obj.tag || '').toLowerCase();

            if (t.includes(query) || c.includes(query) || g.includes(query)) {
                matches.push(obj);
                if (matches.length >= 8) break;
            }
        }

        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(m => {
                const itemData = encodeURIComponent(JSON.stringify(m));
                const linkUrl = `watch.html?title=${encodeURIComponent(m.title)}&data=${itemData}`;
                const isSeries = m.tag === 'TV Series' || m.tag === 'K-Drama' || (m.url && m.url.endsWith('/'));

                return `
                    <a class="search-dropdown-item" href="${linkUrl}">
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
                <div style="padding: 16px 12px; text-align: center; font-size: 12.5px; color: var(--text-muted);">
                    No exact title found for "${val}". Press Enter for full search.
                </div>
            `;
            dropdown.style.display = 'block';
        }
    }, 150);
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideSearchDropdown();
    }
});

async function handleSearch() {
    hideSearchDropdown();
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!q) {
        showHomeView();
        return;
    }

    if (!isFullCatalogLoaded) {
        await loadFullCatalogInBackground();
    }

    currentView = 'search';
    currentCategoryName = `Search: "${q}"`;
    filteredMovies = allMovies.filter(m => 
        (m.title && m.title.toLowerCase().includes(q)) || 
        (m.category && m.category.toLowerCase().includes(q)) || 
        (m.tag && m.tag.toLowerCase().includes(q))
    );
    displayedCount = BATCH_SIZE;
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

function renderMovieCardHtml(item) {
    const rawTitle = item.title || '';
    const safeTitle = escapeQuotes(rawTitle);
    const itemData = encodeURIComponent(JSON.stringify(item));
    const isSeries = item.tag === 'TV Series' || item.tag === 'K-Drama' || (item.url && item.url.endsWith('/'));
    const linkUrl = `watch.html?title=${encodeURIComponent(rawTitle)}&data=${itemData}`;

    return `
        <a class="movie-card" href="${linkUrl}">
            <div class="card-cover">
                <img src="${item.poster}" alt="${safeTitle}" loading="lazy"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="cover-fallback" style="display: none;">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                    <div style="font-size: 11px; font-weight: 600;">${item.title}</div>
                </div>
                <div class="tag-badge">${item.tag || 'HD'}</div>
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
                <div class="card-title" title="${item.title}">${item.title}</div>
                <div class="card-meta">
                    <span>${item.size || 'HD'}</span>
                    <span>${item.date || ''}</span>
                </div>
            </div>
        </a>
    `;
}

function escapeQuotes(str) {
    return (str || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
}

window.onload = init;
