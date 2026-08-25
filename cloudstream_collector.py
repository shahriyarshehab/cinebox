import os
import sys
import json
import urllib.request
import urllib.parse
import re
from concurrent.futures import ThreadPoolExecutor

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOVIES_JSON = os.path.join(BASE_DIR, "movies.json")

# Cloudstream Multi-Provider API Endpoints & Sources
PROVIDERS = [
    {
        "name": "DhakaFlix BDIX Engine",
        "type": "bdix",
        "urls": [
            {"cat": "Hollywood 1080p", "tag": "Hollywood 1080p", "url": "http://172.16.50.14/DHAKA-FLIX-14/English%20Movies%20%281080p%29/"},
            {"cat": "Bollywood", "tag": "Bollywood", "url": "http://172.16.50.14/DHAKA-FLIX-14/Hindi%20Movies/"},
            {"cat": "Animation", "tag": "Animation", "url": "http://172.16.50.14/DHAKA-FLIX-14/Animation%20Movies%20%281080p%29/"},
            {"cat": "South Action", "tag": "South Action", "url": "http://172.16.50.14/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/Hindi%20Dubbed/"},
            {"cat": "IMDb Top 250", "tag": "Top Rated", "url": "http://172.16.50.14/DHAKA-FLIX-14/IMDb%20Top-250%20Movies/"},
            {"cat": "Korean Drama", "tag": "K-Drama", "url": "http://172.16.50.14/DHAKA-FLIX-14/KOREAN%20TV%20%26%20WEB%20Series/"},
            {"cat": "TV Series", "tag": "TV Series", "url": "http://172.16.50.12/DHAKA-FLIX-12/TV-WEB-Series/"}
        ]
    }
]

def fetch_html(url, timeout=8):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='ignore')
    except Exception:
        return ""

def parse_apache_directory(url):
    html = fetch_html(url)
    if not html:
        return []

    row_regex = re.compile(
        r'<tr[^>]*>.*?<td class="fb-i"><img[^>]+src="([^"]+)"[^>]*></td>\s*<td class="fb-n"><a href="([^"]+)">([^<]+)</a></td>(?:\s*<td class="fb-d">([^<]*)</td>)?(?:\s*<td class="fb-s">([^<]*)</td>)?',
        re.DOTALL | re.IGNORECASE
    )
    matches = row_regex.findall(html)
    items = []
    for icon_src, href, name, date, size in matches:
        name = name.strip()
        if not name or name.lower() in ['parent directory', '..', '.']:
            continue
        is_dir = 'folder' in icon_src.lower() or href.endswith('/')
        full_url = urllib.parse.urljoin(url, href)
        items.append({
            'name': urllib.parse.unquote(name),
            'url': full_url,
            'is_dir': is_dir,
            'size': size.strip() if size else ('Folder' if is_dir else 'File'),
            'date': date.strip() if date else ''
        })
    return items

def extract_movie_details(entry, cat_name, tag):
    name = entry['name'].strip()
    if not name or name.lower() in ['parent directory', '..', '.']:
        return None

    poster_url = urllib.parse.urljoin(entry['url'], 'a_AL_.jpg')
    stream_url = entry['url']
    file_size = entry.get('size', 'HD')

    sub_files = parse_apache_directory(entry['url'])
    for sub in sub_files:
        s_name = sub['name'].lower()
        if re.search(r'\.(jpe?g|png|webp)$', s_name, re.I):
            poster_url = sub['url']
        elif re.search(r'\.(mp4|mkv|avi|webm)$', s_name, re.I):
            stream_url = sub['url']
            if sub.get('size') and sub['size'] != 'File':
                file_size = sub['size']

    clean_title = re.sub(r'\.(mp4|mkv|avi|webm)$', '', name, flags=re.I)
    return {
        'title': clean_title,
        'category': cat_name,
        'tag': tag,
        'poster': poster_url,
        'url': stream_url,
        'size': file_size,
        'date': entry.get('date', '')
    }

def run_cloudstream_collector():
    print("============================================================")
    print("🎬 Cloudstream Multi-Provider Movie Aggregator Engine")
    print("============================================================")

    existing_movies = []
    if os.path.exists(MOVIES_JSON):
        try:
            with open(MOVIES_JSON, "r", encoding="utf-8") as f:
                existing_movies = json.load(f)
            print(f"[*] Loaded {len(existing_movies)} existing catalog items.")
        except Exception:
            pass

    seen_urls = {m['url'] for m in existing_movies if 'url' in m}
    new_collected = []

    for prov in PROVIDERS:
        print(f"\n[+] Activating Provider: {prov['name']}")
        for src in prov["urls"]:
            print(f"   -> Scraping Channel: {src['cat']}...")
            dirs = parse_apache_directory(src["url"])
            movie_dirs = []

            for d in dirs:
                if d['is_dir']:
                    # If direct movies folder or year folder
                    subs = parse_apache_directory(d['url'])
                    has_subdirs = any(s['is_dir'] for s in subs)
                    if has_subdirs:
                        for s in subs:
                            if s['is_dir']:
                                movie_dirs.append(s)
                    else:
                        movie_dirs.append(d)

            print(f"      Found {len(movie_dirs)} candidate items. Resolving media streams...")
            with ThreadPoolExecutor(max_workers=14) as executor:
                futures = [executor.submit(extract_movie_details, md, src['cat'], src['tag']) for md in movie_dirs]
                for fut in futures:
                    try:
                        res = fut.result()
                        if res and res['url'] not in seen_urls:
                            seen_urls.add(res['url'])
                            new_collected.append(res)
                    except Exception:
                        pass

    total_database = new_collected + existing_movies
    # Clean parent directory items if any
    clean_database = [m for m in total_database if 'parent directory' not in m.get('title', '').lower()]

    print(f"\n[✓] Total Aggregated Movies in Cloudstream Database: {len(clean_database)}")
    with open(MOVIES_JSON, "w", encoding="utf-8") as f:
        json.dump(clean_database, f, ensure_ascii=False, indent=2)

    print(f"[✓] Saved updated catalog to: {MOVIES_JSON}")
    print("============================================================")

if __name__ == "__main__":
    run_cloudstream_collector()
