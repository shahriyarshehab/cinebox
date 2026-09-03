# CineBox

Ultra-Speed Cinema & HD Media Streaming Platform

CineBox is an open-source, high-performance web streaming application built for ultra-fast local and broadband (BDIX) networks. It catalogs and streams movies, television series, and animations with adaptive HLS streaming, Web Audio channel splitting for dual-audio releases, and an integrated media player.

Live Demo: [https://shahriyarshehab.github.io/cinebox/](https://shahriyarshehab.github.io/cinebox/)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture and Directory Structure](#architecture-and-directory-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation and Running](#installation-and-running)
  - [Server CLI Options](#server-cli-options)
- [Core Systems](#core-systems)
  - [Audio DSP and Channel Splitting Engine](#audio-dsp-and-channel-splitting-engine)
  - [Adaptive Streaming and Server Failover](#adaptive-streaming-and-server-failover)
  - [Mother Server Connection Monitoring](#mother-server-connection-monitoring)
  - [Subtitles and VTT Synchronization](#subtitles-and-vtt-synchronization)
  - [TV Series and Season Explorer](#tv-series-and-season-explorer)
  - [External Player and Download Hub](#external-player-and-download-hub)
- [Automation and Data Scraping](#automation-and-data-scraping)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Security and Code Quality](#security-and-code-quality)
- [License](#license)

---

## Overview

CineBox is designed to work seamlessly in high-speed intranet/broadband environments, particularly BDIX networks, where content is hosted on direct HTTP servers. The front end is fully responsive, lightweight, and functions both as a traditional web portal and as an installable Progressive Web App (PWA).

The user interface follows a modern glassmorphism design language with ambient glow backdrops, intuitive video controls, YouTube-style settings panels, and dedicated touch gestures for mobile devices.

---

## Key Features

- Extensive Catalog: Movies, TV series, Korean drama, anime, and regional cinema organized into searchable collections.
- Web Audio API DSP: Audio gain booster (up to 300%), dynamic compression, dialogue enhancement filter, and stereo channel routing.
- Dual-Audio Separation: Dedicated channel splitter that isolates Left (Dub 1) and Right (Dub 2) audio channels for dual-audio video files.
- Adaptive Bitrate Streaming: Integrated Hls.js engine for `.m3u8` streams with automatic fallback to native HTML5 playback.
- Mother Server Health Monitoring: Automated fallback across alternative server mirrors with an on-screen connection troubleshooting modal and 12-second timeout watchdog.
- Zero-Lag Instant Search: Client-side fuzzy matching with Levenshtein typo tolerance and instant dropdown recommendations.
- Playback Memory: Automatic playback position recording in localStorage with one-click resume.
- TV Series Explorer: Episode parsing, season switching, next-episode autoplay countdowns, and batch playlist exports.
- External Player Integrations: One-click intent launchers for VLC Media Player, MX Player, PotPlayer, 1DM, and ADM.
- Progressive Web App: Offline caching using a Stale-While-Revalidate Service Worker strategy.

---

## Architecture and Directory Structure

```
cinebox/
├── index.html              # Main landing page with hero carousel and category rows
├── movies.html             # Dedicated movies catalog with multi-faceted filtering
├── tv.html                 # Television and web series explorer
├── animation.html          # Animation and anime catalog
├── watchlist.html          # User bookmarks and Continue Watching hub
├── watch.html              # Dedicated player view with cinema controls and settings
├── server.js               # Node.js development HTTP server with live-reload SSE
├── sw.js                   # Service Worker (Stale-While-Revalidate caching)
├── package.json            # Node project configuration and script definitions
├── manifest.json           # PWA web app manifest
├── metadata_cache.json     # Preloaded metadata cache for offline / instant load
├── tv_index.json           # Indexed TV series directory with seasons and episodes
├── css/
│   └── style.css           # Core styling, responsive layouts, and animations
├── js/
│   ├── core.js             # Shared storage, toast, sanitizer, and watchlist utilities
│   ├── audio-engine.js     # Web Audio API booster, EQ, and multi-track switching
│   ├── app.js              # Catalog browsing, search index, and home carousels
│   ├── watch.js            # Video player runtime, gestures, and TV season navigation
│   └── lucide.min.js       # Lucide vector icon library
└── scripts/
    ├── auto_update.py      # Mother server crawler and catalog synchronization
    ├── crawl_tv_episodes.py# Deep TV directory crawler for season and episode mapping
    └── compress_tv_index.py# JSON index compression for tv_index.json
```

---

## Getting Started

### Prerequisites

- Node.js (v14.0 or higher recommended)
- Python 3 (optional, required only for running crawler scripts)

### Installation and Running

Clone the repository and launch the built-in development server:

```bash
# Clone repository
git clone https://github.com/shahriyarshehab/cinebox.git
cd cinebox

# Start local server
npm start

# Or start in development mode (auto-opens default browser)
npm run dev
```

The server will bind to `http://localhost:3000` (or the next available port if 3000 is occupied).

### Server CLI Options

The custom server implementation (`server.js`) includes built-in command-line arguments:

```bash
# Run on a custom port
node server.js --port 8080
# Or using the shorthand:
node server.js -p 8080

# Auto-launch default browser
node server.js --open
# Or using the shorthand:
node server.js -o
```

---

## Core Systems

### Audio DSP and Channel Splitting Engine

The dedicated audio engine (`js/audio-engine.js`) interfaces directly with the Web Audio API to provide advanced audio processing:

1. Volume Booster: A GainNode amplification chain allows volume to be increased safely up to 300% without hard digital clipping.
2. Equalizer Profiles:
   - Standard: Flat response curve.
   - Dialogue Enhancer: Peaking filter at 2.5 kHz (+6 dB, Q=1.2) coupled with dynamic compression to prioritize dialogue intelligibility.
   - Bass Cinema: Low-shelf filter at 120 Hz (+7 dB) for low-end theatrical resonance.
   - Night Mode: Aggressive dynamic compression (12:1 ratio, -32 dB threshold) to normalize explosions and soft whisper scenes.
3. Dual-Audio Stereo Channel Splitting: Many video files encode different audio languages on separate channels of a single stereo track (e.g., Hindi on Channel 0, English on Channel 1). Using `ChannelSplitterNode` and `ChannelMergerNode`, CineBox can route either the left or right channel to both speakers, effectively acting as an audio track selector for dual-audio media.
4. External Audio Sync: Synchronize external `.mp3` or `.aac` tracks with on-screen video, with sub-second offset adjustments (`+0.1s` / `-0.1s`).

### Adaptive Streaming and Server Failover

When a video begins playback, CineBox constructs an array of server mirrors based on known BDIX server clusters (DhakaFlix, SamOnline, Elaach, Triangle). 

- If an HLS `.m3u8` stream is detected, `Hls.js` is dynamically instantiated with low-latency worker threads and buffer management.
- Standard MP4/WebM files stream directly through native HTML5 elements with Range header support for instantaneous scrubbing.
- If the primary server node fails or returns an error, playback automatically switches to the next available mirror seamlessly.

### Mother Server Connection Monitoring

When streaming from BDIX networks, private intranet servers (`172.16.50.x`) may become unreachable if the user is connected to mobile data or an unpeered ISP. CineBox includes:

- Watchdog Timer: A 12-second connection watchdog detects silent packet drops where browsers fail to trigger native error events.
- Error Modal: If all server mirrors fail, a modal appears inside the player explaining the issue, displaying the target server address, and providing direct buttons to retry, cycle mirrors, or open the link in external media players.

### Subtitles and VTT Synchronization

- Drag-and-Drop: Drop any `.srt` or `.vtt` file directly onto the player window.
- Auto-Conversion: `.srt` files are parsed and transformed in real-time into WebVTT blobs for native track display.
- Sync Controls: Live offset adjustments (`+0.5s` / `-0.5s`) without requiring video reloading.
- Visual Customization: Real-time controls for font size, font color, background style (translucent, solid, outline, shadow), and vertical positioning.

### TV Series and Season Explorer

For episodic content, CineBox resolves seasons and episodes using `tv_index.json`. Features include:

- Multi-Season Navigation: Tabbed season selection with instant episode counts.
- Autoplay Next Episode: A countdown prompt overlays 10 seconds before an episode ends, allowing continuous viewing.
- Episode Filter: Live search field inside the season drawer to quickly find specific episodes by title or episode number.

### External Player and Download Hub

Users who prefer dedicated desktop or mobile media players can launch streams directly:

- One-Click Launchers: Deep link handlers for VLC Media Player (`vlc://`), MX Player (`intent:`), and PotPlayer (`potplayer://`).
- Batch Playlist Export: Generate and download `.m3u` playlists containing all season episodes for media center importing.
- Mobile Downloaders: Integration with 1DM and ADM download managers for multi-threaded chunk downloading.

---

## Automation and Data Scraping

The repository includes Python crawling utilities located in the `scripts/` directory:

- `scripts/auto_update.py`: Crawls upstream mother servers, parses release directories, categorizes entries, generates `data/latest.json` and `data/today.json`, and updates `home_data.json`.
- `scripts/crawl_tv_episodes.py`: Recursively maps television series season directories and generates structured episode lists.
- `scripts/compress_tv_index.py`: Minifies and optimizes the television index for low bandwidth delivery.

To manually trigger a catalog synchronization:

```bash
npm run update
# Or directly:
python scripts/auto_update.py
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Space` / `K` | Play / Pause toggle |
| `←` / `→` | Seek backward / forward by configured step |
| `J` / `L` | Seek backward / forward by 10 seconds |
| `↑` / `↓` | Volume up / down by 5% |
| `M` | Mute / Unmute audio |
| `F` | Toggle Fullscreen |
| `T` | Toggle Theater mode |
| `B` | Open Audio Track & Channel Selector |
| `C` | Toggle Subtitles |
| `N` | Play Next Episode (TV Series) |
| `P` | Play Previous Episode (TV Series) |
| `>` / `<` | Increase / Decrease playback speed |
| `D` | Cycle Aspect Ratio (Contain, Cover, 16:9, 4:3, 21:9) |
| `Ctrl + K` / `/` | Focus global search bar |
| `Esc` | Exit fullscreen, player mode, or close active modals |

---

## Security and Code Quality

The codebase enforces strict defensive engineering standards:

- XSS Prevention: All dynamic strings, titles, actor names, and URLs pass through `escapeHtml()` and `sanitizeUrl()` before rendering into the DOM.
- Path Traversal Guard: The Node.js static server verifies that requested relative file paths strictly resolve inside the application root directory.
- Service Worker Architecture: Static assets employ a Stale-While-Revalidate strategy to prevent cache trapping and ensure updates deploy immediately on client revisit.
- Linter Verification: All JavaScript files are syntax-verified via `npm run lint`:
  ```bash
  npm run lint
  ```

---

## License

This project is licensed under the MIT License. See `LICENSE` for details.
