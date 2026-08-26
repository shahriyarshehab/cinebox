#!/usr/bin/env node

/**
 * 🎨 SVGRepo Icon Collector & Optimizer for CineBox
 * Fetches, cleans, and optimizes SVG icons from svgrepo.com
 * 
 * Usage:
 *   node scripts/fetch-svg.js https://www.svgrepo.com/svg/518012/mx
 *   node scripts/fetch-svg.js 518012/mx --out icons/mx-player.svg
 *   node scripts/fetch-svg.js https://www.svgrepo.com/svg/518012/mx --js-const MX_ICON_SVG
 *   node scripts/fetch-svg.js --batch https://www.svgrepo.com/svg/518012/mx https://www.svgrepo.com/svg/354519/vlc
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function getDirectSvgUrl(inputUrl) {
    if (!inputUrl) return null;
    inputUrl = inputUrl.trim();

    // Direct SVG url
    if (inputUrl.endsWith('.svg')) return inputUrl;

    // Matches https://www.svgrepo.com/svg/518012/mx or https://www.svgrepo.com/svg/518012
    const svgrepoMatch = inputUrl.match(/svgrepo\.com\/(?:svg|show)\/(\d+)(?:\/([a-zA-Z0-9_-]+))?/i);
    if (svgrepoMatch) {
        const id = svgrepoMatch[1];
        const slug = svgrepoMatch[2] || 'icon';
        return `https://www.svgrepo.com/show/${id}/${slug}.svg`;
    }

    // Matches shorthand "518012/mx" or "518012"
    const shortMatch = inputUrl.match(/^(\d+)(?:\/([a-zA-Z0-9_-]+))?$/);
    if (shortMatch) {
        const id = shortMatch[1];
        const slug = shortMatch[2] || 'icon';
        return `https://www.svgrepo.com/show/${id}/${slug}.svg`;
    }

    return inputUrl;
}

function fetchSvg(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.svgrepo.com/',
                'Accept': 'image/svg+xml,*/*'
            }
        };

        client.get(url, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchSvg(res.headers.location).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`Failed with HTTP status ${res.statusCode} for ${url}`));
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function cleanAndNormalizeSvg(rawSvg, options = {}) {
    if (!rawSvg) return '';

    let svg = rawSvg;

    // 1. Remove XML declaration, doctype, and comments
    svg = svg.replace(/<\?xml[\s\S]*?\?>/gi, '');
    svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
    svg = svg.replace(/<!--[\s\S]*?-->/gi, '');

    // 2. Extract viewBox
    const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/i);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

    // 3. Remove embedded <style> tags and class attributes if inline styling is desired
    if (options.stripClasses) {
        svg = svg.replace(/<style[\s\S]*?<\/style>/gi, '');
        svg = svg.replace(/\s*class=["'][^"']*["']/gi, '');
        svg = svg.replace(/\s*id=["'][^"']*["']/gi, '');
    }

    // 4. Remove hardcoded width and height to make it responsive
    svg = svg.replace(/<svg\b([^>]*)>/i, (match, attrs) => {
        let cleanAttrs = attrs
            .replace(/\s*(width|height)=["'][^"']*["']/gi, '')
            .replace(/\s*viewBox=["'][^"']*["']/gi, '')
            .replace(/\s*xmlns(:\w+)?=["'][^"']*["']/gi, '')
            .replace(/\s*data-[a-zA-Z0-9_-]+(=["'][^"']*["'])?/gi, '')
            .trim();

        const className = options.className || 'icon';
        const width = options.width || '20';
        const height = options.height || '20';
        const strokeWidth = options.strokeWidth || '2';
        const fill = options.fill !== undefined ? options.fill : 'none';
        const stroke = options.stroke !== undefined ? options.stroke : 'currentColor';

        return `<svg class="${className}" viewBox="${viewBox}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${cleanAttrs}>`;
    });

    // 5. Replace inline black/white fills and strokes with currentColor
    if (options.currentColor) {
        svg = svg.replace(/fill=["'](#000000|#000|black)["']/gi, 'fill="currentColor"');
        svg = svg.replace(/stroke=["'](#000000|#000|black)["']/gi, 'stroke="currentColor"');
    }

    // 6. Clean excess whitespaces and empty defs
    svg = svg.replace(/<defs>\s*<\/defs>/gi, '');
    svg = svg.replace(/\n\s*\n/g, '\n').trim();

    return svg;
}

async function processUrl(inputUrl, options = {}) {
    const directUrl = getDirectSvgUrl(inputUrl);
    console.log(`\n📥 Fetching SVG from: ${directUrl}`);

    try {
        const raw = await fetchSvg(directUrl);
        const cleaned = cleanAndNormalizeSvg(raw, {
            className: options.className || 'icon',
            width: options.width || '20',
            height: options.height || '20',
            strokeWidth: options.strokeWidth || '2',
            fill: options.fill || 'none',
            stroke: options.stroke || 'currentColor',
            currentColor: true,
            stripClasses: true
        });

        if (options.out) {
            const outPath = path.resolve(process.cwd(), options.out);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, cleaned, 'utf8');
            console.log(`✅ Saved optimized SVG to: ${options.out}`);
        }

        if (options.jsConst) {
            console.log(`\n📦 JavaScript Constant (${options.jsConst}):\n`);
            console.log(`const ${options.jsConst} = \`${cleaned}\`;\n`);
        } else if (!options.out) {
            console.log('\n✨ Optimized SVG Output:\n');
            console.log(cleaned);
            console.log('\n');
        }

        return cleaned;
    } catch (err) {
        console.error(`❌ Error fetching ${inputUrl}:`, err.message);
        return null;
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
CineBox SVG Collector CLI
=========================
Usage:
  node scripts/fetch-svg.js <url_or_id> [options]

Examples:
  node scripts/fetch-svg.js https://www.svgrepo.com/svg/518012/mx
  node scripts/fetch-svg.js 518012/mx --out icons/mx.svg
  node scripts/fetch-svg.js https://www.svgrepo.com/svg/518012/mx --js-const MX_ICON_SVG
  node scripts/fetch-svg.js --batch 518012/mx 354519/vlc

Options:
  --out <path>         Save output to file
  --js-const <name>    Format output as JS template literal string constant
  --width <px>         Set width attribute (default: 20)
  --height <px>        Set height attribute (default: 20)
  --stroke-width <n>   Set stroke width (default: 2)
  --fill <color>       Set default fill (default: none)
  --batch <urls...>    Process multiple URLs sequentially
        `);
        return;
    }

    const options = {};
    const urls = [];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--out' && args[i + 1]) {
            options.out = args[++i];
        } else if (args[i] === '--js-const' && args[i + 1]) {
            options.jsConst = args[++i];
        } else if (args[i] === '--width' && args[i + 1]) {
            options.width = args[++i];
        } else if (args[i] === '--height' && args[i + 1]) {
            options.height = args[++i];
        } else if (args[i] === '--stroke-width' && args[i + 1]) {
            options.strokeWidth = args[++i];
        } else if (args[i] === '--fill' && args[i + 1]) {
            options.fill = args[++i];
        } else if (args[i] === '--batch') {
            // next arguments will be urls
        } else if (!args[i].startsWith('--')) {
            urls.push(args[i]);
        }
    }

    for (const url of urls) {
        await processUrl(url, options);
    }
}

if (require.main === module) {
    main();
}

module.exports = { fetchSvg, getDirectSvgUrl, cleanAndNormalizeSvg, processUrl };
