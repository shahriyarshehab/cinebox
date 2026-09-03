# CineBox - AI Agent Operating Manual

This document provides a complete technical specification and step-by-step serial guide for AI agents working on the CineBox codebase. Any AI agent reading this document can understand the architecture, data flow, serial processes, and rules without ambiguity.

---

## 1. System Overview

CineBox is an open-source, client-optimized cinema streaming platform designed for ultra-fast performance on broadband and BDIX (Bangladesh Internet Exchange) networks.

- Front End: Vanilla JavaScript (ES6+), HTML5 Video, Web Audio API, CSS3 (Glassmorphism), Tailwind CSS (pre-configured), Lucide Icons.
- Streaming: Adaptive HLS via `Hls.js` with automatic fallback to native HTML5 MP4/WebM with Range request seek support.
- Back End: Custom Node.js HTTP server (`server.js`) with Server-Sent Events (SSE) live-reload and Range request handling.
- Scraper: Python 3 crawler scripts in `scripts/` that scrape upstream BDIX servers (172.16.50.x) and compile static JSON catalogs.
- PWA: Progressive Web App with Service Worker (`sw.js`) implementing a Stale-While-Revalidate strategy.

---

## 2. Directory and File Map

```
cinebox/
├── index.html              # Home page (carousel, top rated, latest updates)
├── movies.html             # Movie catalog with filter controls
├── tv.html                 # TV series directory
├── animation.html          # Animation and anime catalog
├── watchlist.html          # User bookmarks and Continue Watching list
├── watch.html              # Dedicated player view with cinema controls
├── server.js               # Node.js development server (Range requests, SSE reload)
├── sw.js                   # Service Worker (Stale-While-Revalidate caching)
├── package.json            # Scripts and metadata (npm start, npm run lint)
├── manifest.json           # PWA installation manifest
├── metadata_cache.json     # Preloaded metadata dictionary (TMDB/IMDb data)
├── tv_index.json           # Indexed TV series mapped with seasons and episodes
├── home_data.json          # Compiled home screen categories and carousel
├── data/
│   ├── latest.json         # Latest scraped releases
│   └── today.json          # Releases uploaded today
├── css/
│   └── style.css           # Global stylesheet and player overlay styles
├── js/
│   ├── core.js             # Shared utilities (storage, toast, sanitize, theme)
│   ├── audio-engine.js     # Web Audio API booster, EQ, and channel routing
│   ├── app.js              # Home/catalog rendering, fuzzy search, filters
│   ├── watch.js            # Player controller, TV episodes, gestures, watchdog
│   └── lucide.min.js       # Lucide vector icon library
└── scripts/
    ├── auto_update.py      # Upstream mother server scraper
    ├── crawl_tv_episodes.py# Recursive TV directory crawler
    └── compress_tv_index.py# TV catalog index minifier
```

---

## 3. Serial Processes (Step-by-Step Execution Flows)

### Process 1: Upstream Mother Server Crawling and Catalog Generation

```
[Upstream Servers: 172.16.50.x]
       |
       v  (urllib HTTP requests)
[scripts/auto_update.py]
       |
       +---> Generates data/latest.json
       +---> Generates data/today.json
       +---> Generates data/category_*.json
       +---> Compiles and writes home_data.json
```

1. Step 1.1: `scripts/auto_update.py` defines mother server targets in the `SOURCES` array (e.g. `http://172.16.50.14/DHAKA-FLIX-14/...`).
2. Step 1.2: The script fetches directory listings using thread pool workers.
3. Step 1.3: Folder and file names are cleaned of release junk tags (`1080p`, `x264`, `BluRay`, `Dual Audio`).
4. Step 1.4: Releases added within the last 48 hours are extracted to `data/today.json` and `data/latest.json`.
5. Step 1.5: Category buckets are populated and written to `home_data.json`.

### Process 2: Deep TV Series Mapping

```
[TV Series Directory: 172.16.50.12]
       |
       v  (Recursive BFS crawler)
[scripts/crawl_tv_episodes.py]
       |
       v  (Minification)
[scripts/compress_tv_index.py]
       |
       v
[tv_index.json]
```

1. Step 2.1: `crawl_tv_episodes.py` traverses each TV series directory to discover season subfolders (`Season 1`, `Season 2`).
2. Step 2.2: Within each season folder, video files (`.mp4`, `.mkv`) are indexed by filename and direct URL.
3. Step 2.3: `compress_tv_index.py` packs the tree into `tv_index.json` using the format: `[folderUrl, [season1_episodes, season2_episodes], [specials]]`.

### Process 3: Development Server Boot and Live Reload

```
CLI Execution: `npm start` -> `node server.js`
```

1. Step 3.1: `server.js` parses CLI flags (`--port` / `-p`, `--open` / `-o`).
2. Step 3.2: Initializes an HTTP server bound to `localhost:3000` (automatically increments port if in use).
3. Step 3.3: Watches the project directory using `fs.watch`, excluding `.git`, `node_modules`, and cache files.
4. Step 3.4: On file change, debounces events and broadcasts `data: reload\n\n` via the `/live-reload` SSE endpoint.
5. Step 3.5: All served HTML files have a live-reload script injected before `</body>`.
6. Step 3.6: Range requests (`Range: bytes=start-end`) are handled with `HTTP 206 Partial Content` headers for video seeking.
7. Step 3.7: Directory traversal security is enforced: `path.relative(ROOT, filePath)` must not start with `..`.

### Process 4: Client Boot and Instant Catalog Rendering

1. Step 4.1: Browser loads `index.html`.
2. Step 4.2: Inline Tailwind config assigns `window.tailwind` before the CDN script executes to prevent `ReferenceError`.
3. Step 4.3: `js/core.js` loads, restoring user theme, watchlist count badge, and Continue Watching state.
4. Step 4.4: `js/app.js` checks `sessionStorage` for cached `cinebox_home_v3`. If present, renders instantly in 0ms.
5. Step 4.5: Simultaneously fetches fresh `./home_data.json?v=timestamp`. If updated, updates UI and cache.
6. Step 4.6: PWA Service Worker (`sw.js`) registers on load.

### Process 5: Fuzzy Search and Live Filtering

1. Step 5.1: When the user types in the search bar, `handleLiveSearch()` debounces input by 150ms.
2. Step 5.2: Queries under 2 characters display recent searches from `localStorage`.
3. Step 5.3: Queries >= 2 characters run `filterFuzzyMatches()`:
   - Evaluates exact title matches (score 1000).
   - Evaluates prefix matches (score 800).
   - Evaluates substring token matches (score 500).
   - Evaluates Levenshtein distance typo tolerance (score 300-350).
4. Step 5.4: Results are sanitized via `escapeHtml()` and rendered inside the live dropdown.

### Process 6: Watch Page Navigation and State Transfer

1. Step 6.1: Clicking a media card constructs URL: `watch.html?title=${encodeURIComponent(rawTitle)}&data=${itemData}`.
2. Step 6.2: `watch.html` loads scripts in order: `core.js` -> `audio-engine.js` -> `watch.js`.
3. Step 6.3: `initWatch()` decodes `data` param from `window.location.search`.
4. Step 6.4: Calls `renderWatchPage(item)`:
   - Sets backdrop image, poster, clean display title, quality tag, and genres.
   - Restores watchlist state and update tracking state.
   - Populates action buttons (Watch Online, Download Hub, Share).

### Process 7: TMDB / OMDB Metadata Hydration

1. Step 7.1: `loadAndApplyOnlineMetadata()` checks `metadata_cache.json` for immediate offline metadata.
2. Step 7.2: If absent, queries OMDB API rotating across API keys in `OMDB_API_KEYS`.
3. Step 7.3: Updates IMDb rating, synopsis, runtime, director, awards, and country tags.
4. Step 7.4: Renders cast grid and calls `getActorPortraitPhoto(actorName)` to asynchronously fetch actor photos.

### Process 8: Video Player Initialization and Adaptive Streaming

1. Step 8.1: User clicks "Watch Online" or selects an episode.
2. Step 8.2: `enterPlayerMode()` hides `#detailView`, displays `#playerView`, and calls `startStream(url, title)`.
3. Step 8.3: `startStream()` checks if the URL is an HLS `.m3u8` stream.
   - If HLS: Instantiates `Hls` with worker support and attaches media.
   - If MP4: Assigns `player.src = url`.
4. Step 8.4: Autoplay is attempted unmuted. If browser blocks autoplay, mutes audio, starts playback, and shows a toast prompting the user to unmute.
5. Step 8.5: Auto-resume restores playback position from `localStorage` if saved progress > 15s.

### Process 9: Mother Server Monitoring, Failover, and Timeout Watchdog

1. Step 9.1: `generateAvailableServerMirrors()` constructs 3 fallback mirror URLs:
   - Server 1: Primary BDIX node (`172.16.50.14`).
   - Server 2: Secondary mirror (`172.16.50.7`).
   - Server 3: Alternative mirror (`172.16.50.4`).
2. Step 9.2: `startMotherServerWatchdog()` starts a 12-second timer.
3. Step 9.3: If `player.onerror` or `Hls.Events.ERROR (fatal)` fires:
   - If secondary mirrors are available: Automatically calls `switchMediaServer(nextIdx)`.
   - If all mirrors fail: Calls `showMotherServerErrorOverlay()`.
4. Step 9.4: If the BDIX network silently drops packets (player hangs at readyState < 2 after 12 seconds):
   - Watchdog timer triggers `handleStreamConnectionError()`.
5. Step 9.5: `#motherServerErrorOverlay` displays:
   - Message: "Cannot Connect to Mother Server".
   - Target server IP information.
   - Action buttons: "Retry Connection", "Next Server Mirror", "Play in VLC / MX", "Download Hub".

### Process 10: Web Audio DSP and Channel Routing (`js/audio-engine.js`)

1. Step 10.1: On first playback interaction, `setupAudioBooster()` initializes `AudioContext`.
2. Step 10.2: Wires audio node graph:
   `player -> MediaElementSource -> ChannelSplitter(2) -> ChannelMerger(2) -> BiquadFilter -> DynamicsCompressor -> GainNode -> Destination`
3. Step 10.3: Volume booster slider adjusts `GainNode.gain` up to 3.0 (300%).
4. Step 10.4: Dual-Audio Stereo Channel Splitting:
   - Mode `left-channel`: Connects splitter output 0 to merger inputs 0 and 1 (routes Dub 1 / Hindi to both ears).
   - Mode `right-channel`: Connects splitter output 1 to merger inputs 0 and 1 (routes Dub 2 / English to both ears).
   - Mode `stereo`: Connects 0->0 and 1->1 (original stereo mix).
5. Step 10.5: Equalizer profiles:
   - `dialogue`: Peaking filter at 2.5 kHz (+6 dB).
   - `bass`: Low-shelf filter at 120 Hz (+7 dB).
   - `night`: Dynamic compressor with 12:1 ratio and -32 dB threshold.

### Process 11: Subtitle Conversion and Synchronization

1. Step 11.1: Dropped `.srt` files or loaded tracks are read via `FileReader`.
2. Step 11.2: `srtToVtt()` replaces comma milliseconds (`00:01:23,456` -> `00:01:23.456`) and appends the `WEBVTT` header.
3. Step 11.3: Converted content is mounted as a Blob URL into an HTML5 `<track>` element.
4. Step 11.4: Sync adjustments (`+0.5s` / `-0.5s`) nudge active cue timestamps dynamically.
5. Step 11.5: Font size, color, and background styles are applied via dynamic CSS variables.

### Process 12: External Player Launchers and Downloads

1. Step 12.1: `openExternalPlayerModal()` displays options for VLC, MX Player, and PotPlayer.
2. Step 12.2: Launch handlers:
   - VLC: Dispatches `vlc://${streamUrl}`.
   - MX Player: Dispatches Android intent scheme `intent:${streamUrl}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;end`.
   - PotPlayer: Dispatches `potplayer://${streamUrl}`.
3. Step 12.3: `downloadSeasonM3u()` aggregates all season episode URLs into an extended M3U file (`#EXTM3U`) and triggers browser download.

---

## 4. Strict Engineering Rules for AI Agents

When modifying this repository, every AI agent MUST adhere to the following rules:

1. Rule 1 - No Emojis:
   Do not include emojis in user-facing assistant messages, explanations, git commit messages, or newly rendered UI labels. Use clean text labels (e.g., `Track 1: Hindi`, `Server 1 (DhakaFlix)`, `Cannot Connect to Mother Server`).

2. Rule 2 - Strict DOM Sanitization:
   Never interpolate raw variables directly into `innerHTML` or attribute strings without escaping. Always use:
   - `escapeHtml(str)` for text content inside HTML tags.
   - `escapeQuotes(str)` for title/alt attribute values.
   - `sanitizeUrl(url)` for `href`, `src`, and media endpoints.

3. Rule 3 - Linting Verification:
   After editing any JavaScript file, always run:
   ```bash
   npm run lint
   ```
   Ensuring all files exit with code 0 before completing tasks.

4. Rule 4 - Modular Architecture Preservation:
   - Core storage, toasts, and helpers belong in `js/core.js`.
   - Web Audio API and multi-audio track routing belong in `js/audio-engine.js`.
   - Home catalog, fuzzy search, and carousels belong in `js/app.js`.
   - Player controls, TV episodes, gestures, and failover belong in `js/watch.js`.
   - Do not re-merge `audio-engine.js` back into `watch.js`.

5. Rule 5 - Service Worker Cache Synchronization:
   When new static assets (`.js`, `.css`) are created or renamed, update the `STATIC_ASSETS` array and increment `CACHE_NAME` in `sw.js`.
