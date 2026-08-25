import os
import sys
import json
import re
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_FILE = os.path.join(BASE_DIR, "movies.json")

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
    return {
        'title': clean_name,
        'category': cat_name,
        'tag': tag,
        'poster': poster_url,
        'url': stream_url,
        'size': file_size,
        'date': md.get('date', '')
    }

def scrape_all():
    print("[*] Starting Complete DhakaFlix Catalog Harvest...")
    all_movies = []
    seen_urls = set()

    for src in SOURCES:
        print(f"\n[*] Scanning: {src['name']} ({src['tag']})...")
        movie_dirs = []

        if src["type"] == "direct":
            # Items in this folder are direct movie folders
            direct_items = fetch_folder(src["url"])
            for it in direct_items:
                if it["is_dir"] and "parent directory" not in it["name"].lower():
                    movie_dirs.append(it)
        else:
            # Subfolders (e.g. years, collections, A-Z)
            subs = fetch_folder(src["url"])
            for sub in subs:
                if sub["is_dir"] and "parent directory" not in sub["name"].lower():
                    sub_movies = fetch_folder(sub["url"])
                    for sm in sub_movies:
                        if sm["is_dir"] and "parent directory" not in sm["name"].lower():
                            movie_dirs.append(sm)

        print(f"   -> Found {len(movie_dirs)} titles in {src['name']}. Fetching posters & streams...")
        
        with ThreadPoolExecutor(max_workers=14) as executor:
            futures = [executor.submit(process_movie_folder, md, src['name'], src['tag']) for md in movie_dirs]
            for f in futures:
                try:
                    res = f.result()
                    if res and res["url"] not in seen_urls:
                        seen_urls.add(res["url"])
                        all_movies.append(res)
                except Exception:
                    pass

    print(f"\n[+] Total Unique Movies Harvested: {len(all_movies)}")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_movies, f, ensure_ascii=False, indent=2)
    print(f"[+] Successfully saved clean catalog to: {OUTPUT_FILE}")

if __name__ == "__main__":
    scrape_all()
