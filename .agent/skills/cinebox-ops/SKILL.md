---
name: cinebox-ops
description: >-
  Comprehensive operational workflows, commands, and runbooks for CineBox.
  Use this skill when developing, debugging, scraping, or maintaining the CineBox
  cinema streaming platform, its Web Audio DSP engine, BDIX mother server failover,
  or crawler automation scripts.
---

# CineBox Engineering Operations & Workflows

This skill provides step-by-step operational runbooks for developing, testing, and maintaining CineBox.

---

## 1. Quick Command Cheatsheet

| Task | Command | Description |
|---|---|---|
| Start Dev Server | `npm start` | Boots HTTP server on port 3000 with SSE live-reload |
| Dev Mode | `npm run dev` | Boots HTTP server and opens default web browser |
| Run Syntax Linter | `npm run lint` | Syntax-checks core JS files via `node -c` |
| Upstream Scrape | `npm run update` | Executes `scripts/auto_update.py` against BDIX nodes |
| Custom Port | `node server.js -p 8080` | Binds server to custom port |
| Background Dev | `node server.js -o -p 3000` | Shorthand for port binding and browser launch |

---

## 2. Standard Workflows

### Workflow 1: Mother Server Scraping and Catalog Update

Run this when fresh releases need to be scraped from upstream BDIX servers (172.16.50.x):

1. Verify Python 3 is installed:
   ```bash
   python3 --version
   ```
2. Execute the scraper:
   ```bash
   python3 scripts/auto_update.py
   ```
3. Verify outputs generated in `data/`:
   - `data/latest.json`: Recent media items from the last 48 hours.
   - `data/today.json`: Uploads from today.
   - `home_data.json`: Updated categories and carousel movies.
4. Verify JSON integrity:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('home_data.json'))"
   ```

### Workflow 2: TV Series Indexing

Run this when new TV series or episodes are added to the mother server:

1. Traverse TV series directory:
   ```bash
   python3 scripts/crawl_tv_episodes.py
   ```
2. Minify and compress the index:
   ```bash
   python3 scripts/compress_tv_index.py
   ```
3. Check `tv_index.json` output file format:
   `[seriesFolderUrl, [[ep1, ep2], [s2_ep1, s2_ep2]], [specials]]`

### Workflow 3: Developing Player Features (`watch.html` & `js/watch.js`)

When adding controls, gestures, or overlays to the player:

1. Add markup inside `#videoContainer` in `watch.html`.
2. Add corresponding styling in `css/style.css` matching the dark glassmorphic palette (`rgba(18, 22, 34, 0.98)`).
3. Connect event listeners and state management in `js/watch.js`.
4. Ensure all newly inserted text avoids emojis and uses clean, standard labels.
5. If the element contains dynamic user/server strings, ALWAYS use:
   - `escapeHtml(string)`
   - `escapeQuotes(string)`
   - `sanitizeUrl(url)`
6. Run linter:
   ```bash
   npm run lint
   ```

### Workflow 4: Modifying Web Audio API & Multi-Audio Engine (`js/audio-engine.js`)

When modifying audio booster, equalizer profiles, or channel splitting:

1. All audio DSP logic must remain inside `js/audio-engine.js`. Do not re-merge audio DSP code into `js/watch.js`.
2. Ensure `AudioContext` is only instantiated after user interaction to avoid browser autoplay policy blocks.
3. Node connection pipeline:
   `Source -> ChannelSplitter -> ChannelMerger -> BiquadFilter -> DynamicsCompressor -> GainNode -> Destination`
4. Dual-Audio Channel Routing conventions:
   - `left-channel`: Splitter output 0 connected to Merger inputs 0 and 1.
   - `right-channel`: Splitter output 1 connected to Merger inputs 0 and 1.
   - `stereo`: Splitter output 0 -> 0, output 1 -> 1.
5. Verify syntax with `npm run lint`.

### Workflow 5: Cache Management & Static Asset Updates (`sw.js`)

When creating, renaming, or updating static assets (`.js`, `.css`):

1. Open `sw.js`.
2. Add the file path to `STATIC_ASSETS` array.
3. Increment `CACHE_NAME` (e.g. `cinebox-v21` -> `cinebox-v22`).
4. Note: The Service Worker uses Stale-While-Revalidate for static assets, so clients receive instant cache loads while updating assets in the background.

---

## 3. Pre-Commit Quality Checklist

Before completing any task or committing changes:

- [ ] Run `npm run lint` and verify exit code is 0.
- [ ] Ensure ZERO emojis exist in user responses, UI strings, and commit messages.
- [ ] Verify all dynamic DOM interpolations use `escapeHtml()` and `sanitizeUrl()`.
- [ ] Check git status to ensure no temporary scratch files are staged.
