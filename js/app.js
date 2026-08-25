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
    const cachedHome = sessionStorage.getItem('cinebox_home_v1');
    if (cachedHome) {
        try {
            homeData = JSON.parse(cachedHome);
            applyHomeData(homeData);
        } catch (e) {}
    }

    // 2. Fetch lightweight home_data.json (~90 KB, downloads in ~25ms)
    try {
        if (!homeData) {
            const res = await fetch('./home_data.json');
            if (res.ok) {
                homeData = await res.json();
                sessionStorage.setItem('cinebox_home_v1', JSON.stringify(homeData));
                applyHomeData(homeData);
            }
        }
    } catch (e) {
        console.warn('Fast home load notice:', e);
    }

    // 3. Check for URL search parameters (e.g. from watch.html back-search)
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    if (queryParam) {
        document.getElementById('searchInput').value = queryParam;
        loadFullCatalogInBackground().then(() => handleSearch());
    } else {
        // Asynchronously load the 36,000+ full catalog in background without blocking UI
        setTimeout(loadFullCatalogInBackground, 300);
    }
}

function applyHomeData(data) {
    if (!data) return;
    if (data.total) {
        document.getElementById('totalCountBadge').textContent = `${data.total.toLocaleString()} Movies`;
    }
    if (data.carousel && data.carousel.length > 0) {
        setupCarousel(data.carousel);
    }
    if (currentView === 'home') {
        renderHomeRowsFromPayload(data.categories);
    }
}

async function loadFullCatalogInBackground() {
    if (isFullCatalogLoaded && allMovies.length > 0) return;

    try {
        const res = await fetch('./movies.json');
        if (!res.ok) return;
        const rawMovies = await res.json();
        
        allMovies = rawMovies.map(item => {
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
        }).filter(m => {
            const t = (m.title || '').trim().toLowerCase();
            return t && !t.includes('parent directory') && t !== '..' && t !== '.';
        });

        isFullCatalogLoaded = true;
        document.getElementById('totalCountBadge').textContent = `${allMovies.length.toLocaleString()} Movies`;

        if (currentView !== 'home') {
            renderView();
        }
    } catch (e) {
        console.warn('Background catalog load:', e);
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

function renderHomeRowsFromPayload(categoriesMap) {
    const container = document.getElementById('mainContent');
    if (!categoriesMap) return;

    let html = '';
    CATEGORY_ROWS.forEach(cat => {
        const rawItems = categoriesMap[cat.tag] || [];
        if (rawItems.length === 0) return;

        const items = rawItems.map(item => Array.isArray(item) ? {
            title: item[0], poster: item[1], url: item[2], tag: item[3], category: item[4], size: item[5], date: item[6]
        } : item);

        html += `
            <div class="category-row-block">
                <div class="row-header">
                    <div class="row-title-wrap">
                        <h2 class="row-heading">${cat.name}</h2>
                    </div>
                    <button class="btn-see-all" onclick="openCategoryView('${cat.tag}', '${escapeQuotes(cat.name)}')">
                        <span>Show All</span>
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                </div>

                <div class="row-slider">
                    ${items.map((item) => renderMovieCardHtml(item)).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderHomeRows(container) {
    let html = '';

    CATEGORY_ROWS.forEach(cat => {
        const catMovies = allMovies.filter(m => m.tag === cat.tag || (m.category && m.category.includes(cat.tag)));
        if (catMovies.length === 0) return;

        const topSlice = catMovies.slice(0, 14);

        html += `
            <div class="category-row-block">
                <div class="row-header">
                    <div class="row-title-wrap">
                        <h2 class="row-heading">${cat.name}</h2>
                        <span class="row-badge">${catMovies.length.toLocaleString()} items</span>
                    </div>
                    <button class="btn-see-all" onclick="openCategoryView('${cat.tag}', '${escapeQuotes(cat.name)}')">
                        <span>Show All</span>
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                </div>

                <div class="row-slider">
                    ${topSlice.map((item) => renderMovieCardHtml(item)).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderCategoryFullGrid(container) {
    const toShow = filteredMovies.slice(0, displayedCount);

    container.innerHTML = `
        <div class="category-view-bar">
            <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                <button class="btn btn-ghost" onclick="showHomeView()">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    <span>Back to All Rows</span>
                </button>
                <h1 class="row-heading" style="font-size: 24px;">${currentCategoryName}</h1>
            </div>
            <div style="font-size: 13px; color: var(--text-muted);">
                Showing ${toShow.length} of ${filteredMovies.length.toLocaleString()} titles
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
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                    <div style="font-size: 11.5px; font-weight: 600;">${item.title}</div>
                </div>

                <div class="tag-badge">${item.tag || 'HD'}</div>
                <div class="rating-badge">
                    <svg class="icon" viewBox="0 0 24 24" fill="#ffb800" width="12" height="12"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <span>8.8</span>
                </div>

                <div class="cover-overlay">
                    <div class="play-button-symbol" style="${isSeries ? 'background: linear-gradient(135deg, #00e5ff 0%, #0077b6 100%);' : ''}">
                        ${isSeries ? 
                            '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#07090e" stroke-width="2.2" width="20" height="20"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>' : 
                            '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>'
                        }
                    </div>
                    <span style="font-size: 11px; font-weight: 700; color: #fff;">${isSeries ? 'Browse Seasons & Episodes' : 'Watch in Full Page'}</span>
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

function showHomeView() {
    currentView = 'home';
    document.getElementById('searchInput').value = '';
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function openCategoryView(tag, name) {
    currentView = 'category';
    currentCategoryTag = tag;
    currentCategoryName = name || tag;

    if (!isFullCatalogLoaded) {
        document.getElementById('mainContent').innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 15px; font-weight: 600; color: var(--text-muted);">Loading full ${name} catalog...</div>
            </div>
        `;
        await loadFullCatalogInBackground();
    }

    filteredMovies = allMovies.filter(m => m.tag === tag || (m.category && m.category.includes(tag)));
    displayedCount = BATCH_SIZE;
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleSearch() {
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

function escapeQuotes(str) {
    return (str || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
}

window.onload = init;
