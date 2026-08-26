#!/usr/bin/env node

/**
 *  CineBox Batch SVG Icon Pack Downloader
 * Fetches and saves all essential UI and player icons from svgrepo.com
 * 
 * Usage:
 *   node scripts/fetch-icons-pack.js
 */

const { processUrl } = require('./fetch-svg');

const ICON_CATALOG = [
    { name: 'mx-player', url: 'https://www.svgrepo.com/svg/518012/mx', filename: 'icons/mx-player.svg' },
    { name: 'vlc-player', url: 'https://www.svgrepo.com/svg/354519/vlc', filename: 'icons/vlc-player.svg' },
    { name: 'home', url: 'https://www.svgrepo.com/svg/532997/home-alt', filename: 'icons/home.svg' },
    { name: 'tv', url: 'https://www.svgrepo.com/svg/532986/tv', filename: 'icons/tv.svg' },
    { name: 'film', url: 'https://www.svgrepo.com/svg/532987/film', filename: 'icons/film.svg' },
    { name: 'bookmark', url: 'https://www.svgrepo.com/svg/532994/bookmark', filename: 'icons/bookmark.svg' },
    { name: 'sparkles', url: 'https://www.svgrepo.com/svg/532989/sparkles', filename: 'icons/sparkles.svg' },
    { name: 'equalizer', url: 'https://www.svgrepo.com/svg/532985/sliders', filename: 'icons/sliders.svg' }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    console.log(' Downloading CineBox SVG Icon Pack from svgrepo.com...\n');
    let success = 0;

    for (const item of ICON_CATALOG) {
        console.log(`⏳ Processing: ${item.name}...`);
        const res = await processUrl(item.url, {
            out: item.filename,
            width: '20',
            height: '20',
            strokeWidth: '2',
            className: 'icon',
            currentColor: true
        });

        if (res) {
            success++;
        }
        await sleep(1500); // 1.5s delay to respect rate limits
    }

    console.log(`\n Successfully fetched and optimized ${success}/${ICON_CATALOG.length} icons into icons/ directory!`);
}

if (require.main === module) {
    run();
}
