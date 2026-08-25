import os
import sys
import json
import re
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "movies.json")

CATEGORIES = [
    {"name": "English Movies (1080p)", "url": "http://172.16.50.14/DHAKA-FLIX-14/English%20Movies%20%281080p%29/", "tag": "Hollywood 1080p"},
    {"name": "English Movies", "url": "http://172.16.50.7/DHAKA-FLIX-7/English%20Movies/", "tag": "English Movies"},
    {"name": "Hindi Movies", "url": "http://172.16.50.14/DHAKA-FLIX-14/Hindi%20Movies/", "tag": "Bollywood"},
    {"name": "South Movies (Hindi Dubbed)", "url": "http://172.16.50.14/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/Hindi%20Dubbed/", "tag": "South Action"},
    {"name": "South Indian Movies", "url": "http://172.16.50.14/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/South%20Movies/", "tag": "South Original"},
    {"name": "IMDb Top 250 Movies", "url": "http://172.16.50.14/DHAKA-FLIX-14/IMDb%20Top-250%20Movies/", "tag": "Top Rated"},
    {"name": "Animation Movies (1080p)", "url": "http://172.16.50.14/DHAKA-FLIX-14/Animation%20Movies%20%281080p%29/", "tag": "Animation"},
    {"name": "TV & WEB Series", "url": "http://172.16.50.12/DHAKA-FLIX-12/TV-WEB-Series/", "tag": "TV Shows"},
    {"name": "Korean TV & WEB Series", "url": "http://172.16.50.14/DHAKA-FLIX-14/KOREAN%20TV%20%26%20WEB%20Series/", "tag": "K-Drama"},
    {"name": "Kolkata Bangla Movies", "url": "http://172.16.50.7/DHAKA-FLIX-7/Kolkata%20Bangla%20Movies/", "tag": "Bangla"}
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
        if name in ['parent directory', '..', '.']:
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
    poster_url = urllib.parse.urljoin(md['url'], 'a_AL_.jpg')
    stream_url = md['url']
    file_size = md.get('size', 'HD')

    sub_items = fetch_folder(md['url'])
    for s in sub_items:
        if re.search(r'\.(jpe?g|png)$', s['name'], re.I):
            poster_url = s['url']
        elif re.search(r'\.(mp4|mkv|avi|webm)$', s['name'], re.I):
            stream_url = s['url']
            if s.get('size') and s['size'] != 'File':
                file_size = s['size']

    clean_name = re.sub(r'\.(mp4|mkv|avi|webm)$', '', md['name'], flags=re.I)
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
    print("[*] Starting DhakaFlix catalog export for GitHub Pages...")
    all_movies = []

    for cat in CATEGORIES:
        print(f"[*] Scanning: {cat['name']}...")
        years = fetch_folder(cat['url'])
        year_folders = [y for y in years if y['is_dir'] and any(d in y['name'] for d in ['2026', '2025', '2024', '2023', '2022', '2021', '2020', 'Top', 'Collection', 'Marvel', 'Bond'])][:6]
        
        movie_dirs = []
        for yf in year_folders:
            m_items = fetch_folder(yf['url'])
            for m in m_items:
                if m['is_dir']:
                    movie_dirs.append(m)

        print(f"   Found {len(movie_dirs)} movies in {cat['name']}. Fetching details...")
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(process_movie_folder, md, cat['name'], cat['tag']) for md in movie_dirs]
            for f in futures:
                try:
                    res = f.result()
                    if res:
                        all_movies.append(res)
                except Exception:
                    pass

    print(f"[+] Total Movies Harvested: {len(all_movies)}")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_movies, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    scrape_all()
