#!/usr/bin/env python3
"""
CineBox Auto-Update Engine
Crawls mother server sources, harvests latest updates,
generates data/latest.json, data/today.json, splits categories,
and synchronizes home_data.json with Today's Updates.
"""

import os
import sys
import json
import re
import datetime
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")
DATA_DIR = os.path.join(BASE_DIR, "data")
HOME_FILE = os.path.join(BASE_DIR, "home_data.json")
LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
TODAY_FILE = os.path.join(DATA_DIR, "today.json")

os.makedirs(DATA_DIR, exist_ok=True)

SOURCES = [
    # Direct movie folders
    {"name": "IMDb Top 250", "url": "http://172.16.50.14/DHAKA-FLIX-14/IMDb%20Top-250%20Movies/", "tag": "Top Rated", "type": "direct"},
    {"name": "Animation Movies (1080p)", "url": "http://172.16.50.14/DHAKA-FLIX-14/Animation%20Movies%20%281080p%29/", "tag": "Animation", "type": "direct"},
    
    # Subfolder/Year-based categories
    {"name": "Animation Movies (Archive)", "url": "http://172.16.50.14/DHAKA-FLIX-14/Animation%20Movies/", "tag": "Animation", "type": "subfolders"},
    {"name": "English Movies (1080p)", "url": "http://172.16.50.14/DHAKA-FLIX-14/English%20Movies%20%281080p%29/", "tag": "Hollywood 1080p", "type": "subfolders"},
    {"name": "English Movies", "url": "http://172.16.50.7/DHAKA-FLIX-7/English%20Movies/", "tag": "English Movies", "type": "subfolders"},
    {"name": "Hindi Movies", "url": "http://172.16.50.14/DHAKA-FLIX-14/Hindi%20Movies/", "tag": "Bollywood", "type": "subfolders"},
    {"name": "South Movies (Hindi Dubbed)", "url": "http://172.16.50.14/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/Hindi%20Dubbed/", "tag": "South Action", "type": "subfolders"},
    {"name": "South Indian Movies", "url": "http://172.16.50.14/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/South%20Movies/", "tag": "South Original", "type": "subfolders"},
    {"name": "TV & WEB Series", "url": "http://172.16.50.12/DHAKA-FLIX-12/TV-WEB-Series/", "tag": "TV Series", "type": "subfolders"},
    {"name": "Korean TV & WEB Series", "url": "http://172.16.50.14/DHAKA-FLIX-14/KOREAN%20TV%20%26%20WEB%20Series/", "tag": "K-Drama", "type": "subfolders"},
    {"name": "Kolkata Bangla Movies", "url": "http://172.16.50.7/DHAKA-FLIX-7/Kolkata%20Bangla%20Movies/", "tag": "Bangla", "type": "subfolders"},
    {"name": "Foreign Language Movies", "url": "http://172.16.50.7/DHAKA-FLIX-7/Foreign%20Language%20Movies/", "tag": "Foreign Movies", "type": "subfolders"},
    {"name": "3D Movies", "url": "http://172.16.50.7/DHAKA-FLIX-7/3D%20Movies/", "tag": "3D Movies", "type": "direct"}
]

CATEGORY_FILES = {
    "kdrama": {
        "file": "kdrama.json",
        "name": "Korean Drama",
        "tag": "K-Drama",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "K-Drama" or "KOREAN" in ((m[2] if isinstance(m, list) else m.get("url")) or "")
    },
    "tv_series": {
        "file": "tv_series.json",
        "name": "TV & Web Series",
        "tag": "TV Series",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "TV Series" or ("TV-WEB-Series" in ((m[2] if isinstance(m, list) else m.get("url")) or "") and (m[3] if isinstance(m, list) else m.get("tag")) != "K-Drama")
    },
    "hollywood": {
        "file": "hollywood.json",
        "name": "Hollywood 1080p",
        "tag": "Hollywood 1080p",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "Hollywood 1080p"
    },
    "bollywood": {
        "file": "bollywood.json",
        "name": "Bollywood (Hindi)",
        "tag": "Bollywood",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "Bollywood" or "Hindi Movies" in ((m[4] if isinstance(m, list) else m.get("category")) or "")
    },
    "south_action": {
        "file": "south_action.json",
        "name": "South Action (Dubbed)",
        "tag": "South Action",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "South Action" or "Dubbed" in ((m[4] if isinstance(m, list) else m.get("category")) or "")
    },
    "south_original": {
        "file": "south_original.json",
        "name": "South Original",
        "tag": "South Original",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "South Original"
    },
    "animation": {
        "file": "animation.json",
        "name": "Animation & Anime",
        "tag": "Animation",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "Animation" or "Animation" in ((m[4] if isinstance(m, list) else m.get("category")) or "")
    },
    "bangla": {
        "file": "bangla.json",
        "name": "Bangla Movies",
        "tag": "Bangla",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "Bangla" or "Bangla" in ((m[4] if isinstance(m, list) else m.get("category")) or "")
    },
    "foreign": {
        "file": "foreign.json",
        "name": "Foreign Cinema",
        "tag": "Foreign Movies",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "Foreign Movies" or "Foreign" in ((m[4] if isinstance(m, list) else m.get("category")) or "")
    },
    "3d": {
        "file": "3d.json",
        "name": "3D Movies",
        "tag": "3D Movies",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "3D Movies" or "3D" in ((m[4] if isinstance(m, list) else m.get("category")) or "")
    },
    "english": {
        "file": "english.json",
        "name": "English Classic",
        "tag": "English Movies",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "English Movies"
    },
    "top_rated": {
        "file": "top_rated.json",
        "name": "IMDb Top 250",
        "tag": "Top Rated",
        "filter": lambda m: (m[3] if isinstance(m, list) else m.get("tag")) == "Top Rated"
    }
}

def fetch_folder(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            html = r.read().decode('utf-8', errors='ignore')
    except Exception:
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

def process_movie_folder(md, cat_name, tag):
    name_clean = md['name'].strip()
    if not name_clean or name_clean.lower() in ['parent directory', '..', '.']:
        return None

    poster_url = urllib.parse.urljoin(md['url'], 'a_AL_.jpg')
    stream_url = md['url']
    file_size = md.get('size', 'HD')

    sub_items = fetch_folder(md['url'])
    for s in sub_items:
        s_name = s['name'].lower()
        if re.search(r'\.(jpe?g|png|webp)$', s_name, re.I):
            poster_url = s['url']
        elif re.search(r'\.(mp4|mkv|avi|webm)$', s_name, re.I):
            stream_url = s['url']
            if s.get('size') and s['size'] != 'File':
                file_size = s['size']

    clean_name = re.sub(r'\.(mp4|mkv|avi|webm)$', '', name_clean, flags=re.I)
    return [
        clean_name,
        poster_url,
        stream_url,
        tag,
        cat_name,
        file_size,
        md.get('date', '')
    ]

def run_auto_update():
    print("=" * 60)
    print("🎬 CineBox Mother Server Daily Auto-Updater")
    print("=" * 60)

    # 1. Load existing database
    existing_map = {}
    if os.path.exists(MOVIES_FILE):
        try:
            with open(MOVIES_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
                for item in raw:
                    if isinstance(item, list):
                        url = item[2]
                        existing_map[url] = item
                    elif isinstance(item, dict):
                        url = item.get('url')
                        if url:
                            existing_map[url] = [
                                item.get('title', ''),
                                item.get('poster', ''),
                                url,
                                item.get('tag', ''),
                                item.get('category', ''),
                                item.get('size', ''),
                                item.get('date', '')
                            ]
            print(f"[*] Loaded {len(existing_map)} existing movies from catalog.")
        except Exception as e:
            print(f"[!] Warning reading movies.json: {e}")

    # 2. Scrape mother servers
    new_items = []
    seen_urls = set(existing_map.keys())

    for src in SOURCES:
        print(f"[*] Checking source: {src['name']} ({src['tag']})...")
        movie_dirs = []
        try:
            if src["type"] == "direct":
                items = fetch_folder(src["url"])
                for it in items:
                    if it["is_dir"] and "parent directory" not in it["name"].lower():
                        movie_dirs.append(it)
            else:
                subs = fetch_folder(src["url"])
                for sub in subs:
                    if sub["is_dir"] and "parent directory" not in sub["name"].lower():
                        sub_items = fetch_folder(sub["url"])
                        for sm in sub_items:
                            if sm["is_dir"] and "parent directory" not in sm["name"].lower():
                                movie_dirs.append(sm)
        except Exception as e:
            print(f"   [!] Failed to connect to {src['url']}: {e}")
            continue

        with ThreadPoolExecutor(max_workers=12) as executor:
            futures = [executor.submit(process_movie_folder, md, src['name'], src['tag']) for md in movie_dirs]
            for f in futures:
                try:
                    res = f.result()
                    if res and res[2] not in seen_urls:
                        seen_urls.add(res[2])
                        new_items.append(res)
                        existing_map[res[2]] = res
                except Exception:
                    pass

    print(f"\n[+] Newly added titles harvested: {len(new_items)}")

    # 3. Compile full updated catalog
    all_movies = list(existing_map.values())

    # Sort all movies by date descending where possible
    valid_date_regex = re.compile(r'^\d{4}-\d{2}-\d{2}')
    def get_sort_date(m):
        d = m[6] if len(m) > 6 else ''
        return d if valid_date_regex.match(d.strip()) else ''

    all_movies_sorted = sorted(all_movies, key=get_sort_date, reverse=True)

    # 4. Save movies.json
    with open(MOVIES_FILE, "w", encoding="utf-8") as f:
        json.dump(all_movies, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[+] Total Catalog Size: {len(all_movies)} items -> movies.json")

    # 5. Build data/latest.json (Top 300 newest items)
    latest_300 = [m for m in all_movies_sorted if get_sort_date(m)][:300]
    with open(LATEST_FILE, "w", encoding="utf-8") as f:
        json.dump(latest_300, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[+] Created data/latest.json with {len(latest_300)} newest items")

    # 6. Build data/today.json (Items uploaded today or newest date)
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    today_items = [m for m in all_movies_sorted if (m[6] if len(m) > 6 else '').startswith(today_str)]
    if not today_items and latest_300:
        today_items = latest_300[:40]
    with open(TODAY_FILE, "w", encoding="utf-8") as f:
        json.dump(today_items, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[+] Created data/today.json with {len(today_items)} Today's Update items")

    # 7. Split into category files
    home_categories = {
        "🔥 Today's Updates": latest_300[:16]
    }

    for cat_key, cat_info in CATEGORY_FILES.items():
        matched = [m for m in all_movies if cat_info["filter"](m)]
        out_path = os.path.join(DATA_DIR, cat_info["file"])
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(matched, f, ensure_ascii=False, separators=(",", ":"))
        print(f"   -> data/{cat_info['file']} ({cat_info['name']}): {len(matched)} items")
        home_categories[cat_info["tag"]] = matched[:16]

    # 8. Update home_data.json
    top_rated_items = [m for m in all_movies if (m[3] if len(m) > 3 else '') == "Top Rated"]
    carousel_items = top_rated_items[:10] if len(top_rated_items) >= 10 else all_movies[:10]

    home_data = {
        "total": len(all_movies),
        "last_updated": datetime.datetime.now().isoformat(),
        "today_count": len(today_items),
        "carousel": carousel_items,
        "categories": home_categories
    }

    with open(HOME_FILE, "w", encoding="utf-8") as f:
        json.dump(home_data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[+] Updated home_data.json with Today's Updates!")

if __name__ == "__main__":
    run_auto_update()
