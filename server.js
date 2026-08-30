const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = 'localhost';
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

// Live Reload SSE client pool
const liveReloadClients = new Set();

function broadcastLiveReload() {
  for (const client of liveReloadClients) {
    try {
      client.write('data: reload\n\n');
    } catch (e) {
      liveReloadClients.delete(client);
    }
  }
}

// Watch project directory for live changes (excluding .git, node_modules, temp files)
let reloadDebounce = null;
try {
  fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (filename.includes('.git') || filename.includes('__pycache__') || filename.includes('metadata_cache.json')) return;
    clearTimeout(reloadDebounce);
    reloadDebounce = setTimeout(() => {
      console.log(`\x1b[35m[Live Reload]\x1b[0m File changed: ${filename} -> Refreshing connected browsers...`);
      broadcastLiveReload();
    }, 150);
  });
} catch (e) {}

const server = http.createServer((req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Service-Worker-Allowed', '/');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Live Reload SSE Endpoint
  if (req.url === '/live-reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: connected\n\n');
    liveReloadClients.add(res);
    req.on('close', () => liveReloadClients.delete(res));
    return;
  }

  // Parse URL & query parameters
  let pathname;
  try {
    const parsedUrl = new URL(req.url, `http://${HOST}:${PORT}`);
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch (e) {
    pathname = req.url.split('?')[0];
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  let filePath = path.join(ROOT, pathname);

  // Safety check against directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>404 Not Found</title></head><body style="font-family:sans-serif;background:#07090e;color:#fff;text-align:center;padding:50px;"><h1>404 - Not Found</h1><p>File <code>${pathname}</code> was not found.</p><p><a href="/" style="color:#00e5ff;text-decoration:none;font-weight:bold;">← Return to CineBox</a></p></body></html>`);
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileSize = stats.size;

    // Inject live-reload script into HTML documents for instant live development
    if (ext === '.html') {
      fs.readFile(filePath, 'utf8', (readErr, htmlContent) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Server Read Error');
          return;
        }
        const liveReloadScript = `\n<script>(function(){if(location.hostname==='localhost'||location.hostname==='127.0.0.1'){try{const es=new EventSource('/live-reload');es.onmessage=(e)=>{if(e.data==='reload')location.reload();};}catch(e){}}})();</script>\n</body>`;
        const modifiedHtml = htmlContent.includes('</body>')
          ? htmlContent.replace('</body>', liveReloadScript)
          : htmlContent + liveReloadScript;

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(modifiedHtml);
      });
      return;
    }

    // Support Range Requests (video / audio streaming seek)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
        res.end();
        return;
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

const { exec } = require('child_process');
const os = require('os');

// Parse CLI flags (--port 3000, --open, -o, -p 8080)
const args = process.argv.slice(2);
let customPort = null;
let shouldOpen = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--open' || arg === '-o') {
    shouldOpen = true;
  } else if ((arg === '--port' || arg === '-p') && args[i + 1]) {
    customPort = parseInt(args[i + 1], 10);
    i++;
  } else if (arg.startsWith('--port=')) {
    customPort = parseInt(arg.split('=')[1], 10);
  }
}

const DEFAULT_PORT = customPort || parseInt(process.env.PORT || '3000', 10);

function openBrowser(url) {
  const platform = process.platform;
  let cmd = '';
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      // Ignore background launcher errors
    }
  });
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

const SYNC_TRACKER_FILE = path.join(ROOT, '.last_daily_sync');

function checkAndRunDailyAutoUpdate() {
  const todayStr = new Date().toISOString().split('T')[0];
  let lastSync = '';
  try {
    if (fs.existsSync(SYNC_TRACKER_FILE)) {
      lastSync = fs.readFileSync(SYNC_TRACKER_FILE, 'utf8').trim();
    }
  } catch (e) {}

  if (lastSync !== todayStr) {
    console.log(`\x1b[33m[Daily Auto-Update]\x1b[0m 📅 First load of the day (${todayStr}) detected.`);
    console.log(`\x1b[33m[Daily Auto-Update]\x1b[0m 🔄 Automatically fetching new files from mother server...`);

    const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
    exec(`${pyCmd} "${path.join(ROOT, 'scripts', 'auto_update.py')}"`, (err, stdout, stderr) => {
      if (err) {
        console.warn(`\x1b[31m[Daily Auto-Update Warning]\x1b[0m Mother server crawler skipped (${err.message}). Local catalog active.`);
      } else {
        try {
          fs.writeFileSync(SYNC_TRACKER_FILE, todayStr, 'utf8');
        } catch (e) {}
        console.log(`\x1b[32m[Daily Auto-Update Success]\x1b[0m ✅ Mother server releases successfully synced!`);
        broadcastLiveReload();
      }
    });
  } else {
    console.log(`\x1b[90m[Daily Auto-Update]\x1b[0m 📅 Already synchronized for today (${todayStr}).`);
  }
}

function startServer(port) {
  server.removeAllListeners('error');
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\x1b[33m[!] Port ${port} is in use, trying port ${port + 1}...\x1b[0m`);
      server.close(() => {
        startServer(port + 1);
      });
      setTimeout(() => startServer(port + 1), 100);
    } else {
      console.error('\x1b[31m[!] Server error:\x1b[0m', err);
    }
  });

  server.listen(port, () => {
    const localUrl = `http://localhost:${port}`;
    const ips = getLocalIpAddresses();
    const networkUrl = ips.length > 0 ? `http://${ips[0]}:${port}` : `http://127.0.0.1:${port}`;

    console.log(`\n\x1b[36m╔════════════════════════════════════════════════════════════╗\x1b[0m`);
    console.log(`\x1b[36m║\x1b[0m   \x1b[1m🎬 CineBox Ultra-Speed Streaming Server (Node.js)\x1b[0m        \x1b[36m║\x1b[0m`);
    console.log(`\x1b[36m╚════════════════════════════════════════════════════════════╝\x1b[0m`);
    console.log(`\n  \x1b[32m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[36m${localUrl}\x1b[0m`);
    console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mNetwork:\x1b[0m \x1b[36m${networkUrl}\x1b[0m`);
    console.log(`\n  \x1b[90mReady to stream! Press \x1b[1mCtrl + C\x1b[0m\x1b[90m to stop.\x1b[0m\n`);

    // Check & trigger daily first load update in background
    checkAndRunDailyAutoUpdate();

    if (shouldOpen) {
      openBrowser(localUrl);
    }
  });
}

startServer(DEFAULT_PORT);
