let allMovies = [];
let tvCatalog = {};
let currentView = 'home'; // 'home' | 'category' | 'search'
let currentCategoryTag = 'All';
let currentCategoryName = 'All Movies';
let filteredMovies = [];
let displayedCount = 40;
const BATCH_SIZE = 40;

let currentSlide = 0;
let carouselMovies = [];
let carouselTimer = null;

const CATEGORY_ROWS = [
    { name: 'IMDb Top 250', tag: 'Top Rated', limit: 12 },
    { name: 'Animation & Anime', tag: 'Animation', limit: 12 },
    { name: 'Hollywood 1080p', tag: 'Hollywood 1080p', limit: 12 },
    { name: 'Bollywood (Hindi)', tag: 'Bollywood', limit: 12 },
    { name: 'South Hindi Dubbed', tag: 'South Action', limit: 12 },
    { name: 'South Original', tag: 'South Original', limit: 12 },
    { name: 'TV & Web Series', tag: 'TV Series', limit: 12 },
    { name: 'Korean Drama', tag: 'K-Drama', limit: 12 },
    { name: 'Bangla Movies', tag: 'Bangla', limit: 12 },
    { name: 'Foreign Movies', tag: 'Foreign Movies', limit: 12 },
    { name: '3D Movies', tag: '3D Movies', limit: 12 },
    { name: 'English Classic Movies', tag: 'English Movies', limit: 12 }
];

// Official VLC Cone SVG (svgrepo:349556)
const VLC_ICON_SVG = `
    <svg class="icon" viewBox="0 0 512 512" width="16" height="16" aria-label="VLC" style="vertical-align: middle;">
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

async function init() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <div style="font-size: 16px; font-weight: 600; color: var(--text-muted);">Loading 36,000+ Movies & Category Rows...</div>
        </div>
    `;

    // Load TV Series catalog index in background
    fetch('./tv_index.json?v=' + Date.now())
        .then(r => r.json())
        .then(data => {
            tvCatalog = data || {};
        })
        .catch(e => console.warn('TV catalog load notice:', e));

    try {
        const res = await fetch('./movies.json?v=' + Date.now());
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
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

        document.getElementById('totalCountBadge').textContent = `${allMovies.length.toLocaleString()} Movies`;
        
        setupCarousel();
        renderView();
    } catch (err) {
        console.error("Load error:", err);
        main.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <p style="color: #ff527b; font-size: 15px; margin-bottom: 16px;">Failed to load catalog: ${err.message}</p>
                <button class="btn btn-primary" onclick="init()">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                    <span>Retry Loading</span>
                </button>
            </div>
        `;
    }
}

function setupCarousel() {
    const featuredList = [];
    const seenTitles = new Set();

    const candidates = [
        ...allMovies.filter(m => m.poster && m.title.includes('2026')),
        ...allMovies.filter(m => m.poster && m.title.includes('2025')),
        ...allMovies.filter(m => m.poster && m.tag === 'Top Rated'),
        ...allMovies.filter(m => m.poster && m.tag === 'Animation'),
        ...allMovies.filter(m => m.poster && m.tag === 'Bollywood'),
        ...allMovies.filter(m => m.poster && m.tag === 'South Action')
    ];

    for (const c of candidates) {
        if (!seenTitles.has(c.title) && c.poster) {
            seenTitles.add(c.title);
            featuredList.push(c);
            if (featuredList.length >= 10) break;
        }
    }

    carouselMovies = featuredList.length > 0 ? featuredList : allMovies.slice(0, 10);

    const track = document.getElementById('carouselTrack');
    track.innerHTML = carouselMovies.map((m, idx) => `
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
                        <button class="btn btn-primary" onclick="openDirectMovie('${escapeQuotes(m.title)}')">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>
                            <span>Watch Stream</span>
                        </button>
                        <button class="btn btn-vlc" onclick="openInVLC('${m.url}', '${escapeQuotes(m.title)}')">
                            ${VLC_ICON_SVG}
                            <span>Play in VLC</span>
                        </button>
                        <a class="btn btn-ghost" href="${m.url}" download>
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Download</span>
                        </a>
                    </div>
                </div>

                <div class="slide-poster-showcase" onclick="openDirectMovie('${escapeQuotes(m.title)}')">
                    <img src="${m.poster}" alt="${escapeQuotes(m.title)}" loading="eager"
                         onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400';">
                    <div class="slide-poster-badge">${m.tag || 'HD'}</div>
                </div>
            </div>
        </div>
    `).join('');

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
    currentSlide = (currentSlide + 1) % carouselMovies.length;
    showSlide(currentSlide);
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + carouselMovies.length) % carouselMovies.length;
    showSlide(currentSlide);
}

function goToSlide(idx) {
    showSlide(idx);
    startCarouselAuto();
}

function openDirectMovie(title) {
    const item = allMovies.find(m => m.title === title);
    if (item) {
        renderModalContent(item);
    }
}

function renderView() {
    const main = document.getElementById('mainContent');

    if (currentView === 'home') {
        document.getElementById('heroCarousel').style.display = 'block';
        renderHomeRows(main);
    } else {
        document.getElementById('heroCarousel').style.display = 'none';
        renderCategoryFullGrid(main);
    }
}

function renderHomeRows(container) {
    let html = '';

    CATEGORY_ROWS.forEach(cat => {
        const catMovies = allMovies.filter(m => m.tag === cat.tag || (m.category && m.category.includes(cat.tag)));
        if (catMovies.length === 0) return;

        const topSlice = catMovies.slice(0, 12);

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
                    <span>Back to All Categories</span>
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
    const safeTitle = escapeQuotes(item.title);
    const safeObj = encodeURIComponent(JSON.stringify(item));
    const isSeries = item.tag === 'TV Series' || item.tag === 'K-Drama' || item.url.endsWith('/');

    return `
        <div class="movie-card" onclick="openItemFromData('${safeObj}')">
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
                    <span style="font-size: 11px; font-weight: 700; color: #fff;">${isSeries ? 'Browse Seasons & Episodes' : 'Stream / VLC / Download'}</span>
                </div>
            </div>

            <div class="card-body">
                <div class="card-title" title="${item.title}">${item.title}</div>
                <div class="card-meta">
                    <span>${item.size || 'HD'}</span>
                    <span>${item.date || ''}</span>
                </div>
            </div>
        </div>
    `;
}

function showHomeView() {
    currentView = 'home';
    document.getElementById('searchInput').value = '';
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openCategoryView(tag, name) {
    currentView = 'category';
    currentCategoryTag = tag;
    currentCategoryName = name || tag;
    filteredMovies = allMovies.filter(m => m.tag === tag || (m.category && m.category.includes(tag)));
    displayedCount = BATCH_SIZE;
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleSearch() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!q) {
        showHomeView();
        return;
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

function openItemFromData(encodedJson) {
    try {
        const item = JSON.parse(decodeURIComponent(encodedJson));
        renderModalContent(item);
    } catch (e) {
        console.error(e);
    }
}

function renderModalContent(item) {
    document.getElementById('mTitle').textContent = item.title;
    document.getElementById('mPoster').src = item.poster;
    document.getElementById('mPoster').style.display = 'block';

    const isSeries = item.tag === 'TV Series' || item.tag === 'K-Drama' || item.url.endsWith('/');

    document.getElementById('mTags').innerHTML = `
        <span class="modal-chip">Category: ${item.category || item.tag}</span>
        <span class="modal-chip">Type: ${isSeries ? 'TV Series' : 'Movie'}</span>
        <span class="modal-chip">Size: ${item.size || 'HD'}</span>
        <span class="modal-chip">Score: 8.8/10</span>
    `;

    if (isSeries) {
        document.getElementById('mActions').innerHTML = `
            <a class="btn btn-ghost" href="${item.url}" target="_blank">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>Open Server Directory</span>
            </a>
            <button class="btn btn-ghost" onclick="copyLink('${item.url}')">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>Copy Series Link</span>
            </button>
        `;
    } else {
        document.getElementById('mActions').innerHTML = `
            <button class="btn btn-primary" onclick="startStream('${item.url}')">
                <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>
                <span>Play in Browser</span>
            </button>
            <button class="btn btn-vlc" onclick="openInVLC('${item.url}', '${escapeQuotes(item.title)}')">
                ${VLC_ICON_SVG}
                <span>Play in VLC</span>
            </button>
            <a class="btn btn-accent" href="${item.url}" download>
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download</span>
            </a>
            <button class="btn btn-ghost" onclick="copyLink('${item.url}')">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>Copy URL</span>
            </button>
        `;
    }

    const vWrap = document.getElementById('videoWrap');
    vWrap.style.display = 'none';
    const player = document.getElementById('videoPlayer');
    player.pause();
    player.src = '';

    const tvWrap = document.getElementById('tvExplorerWrap');
    if (isSeries) {
        tvWrap.style.display = 'block';
        loadTvSeriesSeasons(item.url, item.title);
    } else {
        tvWrap.style.display = 'none';
    }

    document.getElementById('movieModal').style.display = 'flex';
}

let currentTvEntry = null;
let motherFolderSpecials = [];

async function loadTvSeriesSeasons(seriesUrl, seriesTitle) {
    const tabs = document.getElementById('seasonTabs');
    const epList = document.getElementById('episodeList');
    const countBadge = document.getElementById('seasonCountBadge');

    tabs.innerHTML = '<div style="font-size: 12px; color: var(--text-muted);">Loading seasons & episodes...</div>';
    epList.innerHTML = '';
    countBadge.textContent = 'Loading...';
    motherFolderSpecials = [];

    // 1. Check if tvCatalog has this series
    let matchedData = tvCatalog[seriesTitle];
    if (!matchedData) {
        const lowerTitle = seriesTitle.toLowerCase();
        const key = Object.keys(tvCatalog).find(k => k.toLowerCase() === lowerTitle || lowerTitle.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerTitle));
        if (key) matchedData = tvCatalog[key];
    }

    if (matchedData) {
        renderIndexedTvData(matchedData, seriesTitle);
        return;
    }

    // Fallback attempt to fetch index if empty
    if (Object.keys(tvCatalog).length === 0) {
        try {
            const res = await fetch('./tv_index.json?v=' + Date.now());
            tvCatalog = await res.json();
            matchedData = tvCatalog[seriesTitle];
            if (!matchedData) {
                const lowerTitle = seriesTitle.toLowerCase();
                const key = Object.keys(tvCatalog).find(k => k.toLowerCase() === lowerTitle || lowerTitle.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerTitle));
                if (key) matchedData = tvCatalog[key];
            }
            if (matchedData) {
                renderIndexedTvData(matchedData, seriesTitle);
                return;
            }
        } catch (e) {
            console.warn('tvCatalog direct load notice:', e);
        }
    }

    // 2. Fallback to server directory link
    fallbackTvView(seriesUrl, seriesTitle);
}

function renderIndexedTvData(tvData, seriesTitle) {
    const tabs = document.getElementById('seasonTabs');
    const countBadge = document.getElementById('seasonCountBadge');

    const folderUrl = tvData[0] || '';
    const seasons = tvData[1] || [];
    const specials = tvData[2] || [];

    motherFolderSpecials = specials.map(spName => ({
        name: spName,
        url: folderUrl.endsWith('/') ? folderUrl + encodeURI(spName) : folderUrl + '/' + encodeURI(spName)
    }));

    if (seasons.length > 0) {
        countBadge.textContent = `${seasons.length} Seasons ${specials.length > 0 ? '+ Specials' : ''}`;

        let tabsHtml = seasons.map((s, idx) => {
            const sName = s[0];
            return `
            <button class="btn btn-ghost ${idx === 0 ? 'active' : ''}" style="font-size: 12px; padding: 6px 14px; border-radius: 20px; ${idx === 0 ? 'background: var(--primary); color: #07090e; font-weight: 700;' : ''}" onclick="selectIndexedSeason(this, ${idx}, '${escapeQuotes(sName)}')">
                ${sName}
            </button>
            `;
        }).join('');

        if (specials.length > 0) {
            tabsHtml += `
                <button class="btn btn-ghost" style="font-size: 12px; padding: 6px 14px; border-radius: 20px; border-color: rgba(255, 184, 0, 0.4); color: #ffb800;" onclick="selectSpecialsTab(this)">
                    ★ Specials / Bonus (${specials.length})
                </button>
            `;
        }

        tabs.innerHTML = tabsHtml;

        currentTvEntry = tvData;
        loadIndexedSeasonEpisodes(0, seasons[0][0]);
    } else if (specials.length > 0) {
        countBadge.textContent = `${specials.length} Specials / Episodes`;
        tabs.innerHTML = '<span style="font-size: 12px; color: var(--primary); font-weight: 700;">Bonus Videos</span>';
        currentSeasonEpisodes = motherFolderSpecials;
        currentPlayingEpisodeIdx = -1;
        renderEpisodeListHtml(motherFolderSpecials);
    } else {
        fallbackTvView(folderUrl, seriesTitle);
    }
}

function selectIndexedSeason(btnEl, seasonIdx, seasonName) {
    document.querySelectorAll('#seasonTabs button').forEach(b => {
        b.style.background = 'rgba(255, 255, 255, 0.05)';
        b.style.color = '#fff';
        b.style.fontWeight = '600';
    });
    btnEl.style.background = 'var(--primary)';
    btnEl.style.color = '#07090e';
    btnEl.style.fontWeight = '700';

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
}

function selectSpecialsTab(btnEl) {
    document.querySelectorAll('#seasonTabs button').forEach(b => {
        b.style.background = 'rgba(255, 255, 255, 0.05)';
        b.style.color = '#fff';
        b.style.fontWeight = '600';
    });
    btnEl.style.background = 'var(--accent-gold)';
    btnEl.style.color = '#07090e';
    btnEl.style.fontWeight = '700';

    currentSeasonName = 'Specials / Bonus';
    currentSeasonEpisodes = motherFolderSpecials;
    currentPlayingEpisodeIdx = -1;
    renderEpisodeListHtml(motherFolderSpecials);
}

let currentSeasonEpisodes = [];
let currentPlayingEpisodeIdx = -1;
let currentSeasonName = 'Season 1';

function renderEpisodeListHtml(episodes) {
    const epList = document.getElementById('episodeList');
    epList.innerHTML = episodes.map((ep, idx) => {
        const isPlaying = idx === currentPlayingEpisodeIdx;
        return `
        <div id="ep-item-${idx}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: ${isPlaying ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${isPlaying ? 'var(--primary)' : 'var(--border)'}; border-radius: 8px; transition: all 0.2s ease;">
            <div style="display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden;">
                <span style="font-size: 11px; font-weight: 800; color: ${isPlaying ? 'var(--primary)' : 'var(--text-dim)'}; min-width: 22px;">${idx + 1}</span>
                <div style="font-size: 12.5px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeQuotes(ep.name)}">
                    ${ep.name}
                </div>
            </div>
            <div style="display: flex; gap: 6px; flex-shrink: 0;">
                <button class="btn btn-primary" style="padding: 5px 10px; font-size: 11px;" onclick="playSpecificEpisode(${idx})">
                    <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M8 5v14l11-7z"/></svg>
                    <span>${isPlaying ? 'Playing' : 'Play'}</span>
                </button>
                <button class="btn btn-vlc" style="padding: 5px 10px; font-size: 11px;" onclick="openInVLC('${ep.url}', '${escapeQuotes(ep.name)}')">
                    ${VLC_ICON_SVG}
                    <span>VLC</span>
                </button>
                <a class="btn btn-ghost" style="padding: 5px 8px; font-size: 11px;" href="${ep.url}" download>
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </a>
            </div>
        </div>
    `;}).join('');
}

function playSpecificEpisode(idx) {
    if (!currentSeasonEpisodes[idx]) return;
    currentPlayingEpisodeIdx = idx;
    const ep = currentSeasonEpisodes[idx];

    document.getElementById('playerCurrentEpTitle').textContent = `${currentSeasonName} • ${ep.name}`;
    document.getElementById('playerNavBtns').style.display = 'flex';

    renderEpisodeListHtml(currentSeasonEpisodes);

    startStream(ep.url);

    document.getElementById('videoWrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function playNextEpisode() {
    if (currentPlayingEpisodeIdx + 1 < currentSeasonEpisodes.length) {
        playSpecificEpisode(currentPlayingEpisodeIdx + 1);
    } else {
        const toast = document.getElementById('toast');
        toast.textContent = 'End of this season';
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2500);
    }
}

function playPrevEpisode() {
    if (currentPlayingEpisodeIdx > 0) {
        playSpecificEpisode(currentPlayingEpisodeIdx - 1);
    }
}

function fallbackTvView(seriesUrl, seriesTitle) {
    document.getElementById('seasonCountBadge').textContent = 'Series Directory';
    document.getElementById('seasonTabs').innerHTML = `
        <a class="btn btn-primary" style="font-size: 12px; padding: 6px 14px; border-radius: 20px;" href="${seriesUrl}" target="_blank">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>Browse All Seasons & Episodes on Server</span>
        </a>
    `;
    document.getElementById('episodeList').innerHTML = `
        <div style="font-size: 12px; color: var(--text-muted); padding: 8px 4px; line-height: 1.5;">
            Click above to browse all season folders and stream/download any episode directly via high-speed BDIX.
        </div>
    `;
}

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

    const toast = document.getElementById('toast');
    toast.textContent = 'Opening stream in VLC Player...';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function startStream(url) {
    const vWrap = document.getElementById('videoWrap');
    const player = document.getElementById('videoPlayer');
    vWrap.style.display = 'block';
    player.src = url;
    player.play().catch(e => {
        console.log('Playback notice:', e);
    });
}

function closeModal() {
    const player = document.getElementById('videoPlayer');
    player.pause();
    player.src = '';
    document.getElementById('movieModal').style.display = 'none';
}

function copyLink(url) {
    navigator.clipboard.writeText(url);
    const toast = document.getElementById('toast');
    toast.textContent = 'Link copied to clipboard';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function escapeQuotes(str) {
    return str.replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
}

window.onload = init;
