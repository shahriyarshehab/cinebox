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
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")
TV_INDEX_FILE = os.path.join(BASE_DIR, "tv_index.json")

KOREAN_URL = "http://172.16.50.14/DHAKA-FLIX-14/KOREAN%20TV%20%26%20WEB%20Series/"

VIDEO_EXTS = {'.mkv', '.mp4', '.avi', '.mov', '.ts', '.m4v', '.webm'}
POSTER_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}

def fetch_html(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return ""

def parse_apache_index(html, parent_url):
    rows = []
    link_pattern = re.compile(r'<a\s+href=[\'"]([^\'"]+)[\'"]>(.*?)</a>', re.I)
    for match in link_pattern.finditer(html):
        href, text = match.group(1), match.group(2).strip()
        if href.startswith('?') or 'Parent Directory' in text or text == '..' or href.endswith('/..') or 'browsehappy.com' in href:
            continue
        full_url = urllib.parse.urljoin(parent_url, href)
        if full_url == parent_url or full_url.rstrip('/') == parent_url.rstrip('/'):
            continue
        is_dir = href.endswith('/') or full_url.endswith('/')
        rows.append((href, text, full_url, is_dir))
    return rows

def crawl_series_details(series_item):
    name, series_url = series_item
    html = fetch_html(series_url)
    if not html:
        return None

    items = parse_apache_index(html, series_url)
    
    poster_url = ""
    subfolders = []
    specials = []

    for href, text, full_url, is_dir in items:
        clean_text = urllib.parse.unquote(text).strip('/')
        ext = os.path.splitext(clean_text)[1].lower()

        if is_dir:
            subfolders.append((clean_text, full_url))
        elif ext in POSTER_EXTS and not poster_url:
            poster_url = full_url
        elif ext in VIDEO_EXTS:
            specials.append(clean_text)

    # Crawl each season/subfolder
    seasons_data = []
    for s_name, s_url in subfolders:
        s_html = fetch_html(s_url)
        s_items = parse_apache_index(s_html, s_url)
        episodes = []
        for ep_href, ep_text, ep_full, ep_is_dir in s_items:
            clean_ep = urllib.parse.unquote(ep_text).strip('/')
            ep_ext = os.path.splitext(clean_ep)[1].lower()
            if not ep_is_dir and ep_ext in VIDEO_EXTS:
                episodes.append(clean_ep)
            elif ep_ext in POSTER_EXTS and not poster_url:
                poster_url = ep_full
        
        if episodes:
            seasons_data.append([s_name, s_url, episodes])

    return {
        "title": name,
        "poster": poster_url,
        "url": series_url,
        "tag": "K-Drama",
        "category": "Korean Drama",
        "size": f"{len(seasons_data)} Seasons" if seasons_data else "Series",
        "date": "2026",
        "seasons": seasons_data,
        "specials": specials
    }

def main():
    print(f"Crawling Korean Series Root: {KOREAN_URL}")
    root_html = fetch_html(KOREAN_URL)
    if not root_html:
        print("Failed to fetch root URL!")
        return

    root_items = parse_apache_index(root_html, KOREAN_URL)
    series_candidates = []

    for href, text, full_url, is_dir in root_items:
        clean_name = urllib.parse.unquote(text).strip('/')
        if is_dir:
            # Check if this is an alphabetical subfolder like 'A - L/' or direct series
            if len(clean_name) <= 15 and ('—' in clean_name or '-' in clean_name or '♥' in clean_name or 'Series' in clean_name):
                sub_html = fetch_html(full_url)
                sub_items = parse_apache_index(sub_html, full_url)
                for s_href, s_text, s_full, s_is_dir in sub_items:
                    if s_is_dir:
                        s_clean = urllib.parse.unquote(s_text).strip('/')
                        series_candidates.append((s_clean, s_full))
            else:
                series_candidates.append((clean_name, full_url))

    print(f"Found {len(series_candidates)} Korean Series folders. Crawling season & episode details with ThreadPool...")

    results = []
    with ThreadPoolExecutor(max_workers=24) as executor:
        for res in executor.map(crawl_series_details, series_candidates):
            if res:
                results.append(res)

    print(f"Successfully scraped {len(results)} Korean TV & Web Series!")

    # 1. Update movies.json
    with open(MOVIES_FILE, "r", encoding="utf-8") as f:
        movies_data = json.load(f)

    existing_titles = set()
    for m in movies_data:
        t = m[0] if isinstance(m, list) else m.get("title", "")
        if t:
            existing_titles.add(t.lower().strip())

    added_to_movies = 0
    for item in results:
        t = item["title"]
        if t.lower().strip() not in existing_titles:
            # Add in compact format: [title, poster, url, tag, category, size, date]
            movies_data.append([
                item["title"],
                item["poster"],
                item["url"],
                item["tag"],
                item["category"],
                item["size"],
                item["date"]
            ])
            existing_titles.add(t.lower().strip())
            added_to_movies += 1

    print(f"Added {added_to_movies} new Korean series to movies.json (Total: {len(movies_data)})")
    with open(MOVIES_FILE, "w", encoding="utf-8") as f:
        json.dump(movies_data, f, ensure_ascii=False, separators=(",", ":"))

    # 2. Update tv_index.json
    with open(TV_INDEX_FILE, "r", encoding="utf-8") as f:
        tv_index = json.load(f)

    added_to_tv = 0
    for item in results:
        t = item["title"]
        # Format in tv_index: [folder_url, seasons_data, specials]
        tv_index[t] = [
            item["url"],
            item["seasons"],
            item["specials"]
        ]
        added_to_tv += 1

    print(f"Updated tv_index.json with Korean Series. Total indexed TV series: {len(tv_index)}")
    with open(TV_INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(tv_index, f, ensure_ascii=False, separators=(",", ":"))

    # 3. Regenerate home_data.json
    CATEGORY_TAGS = [
        'Top Rated', 'Animation', 'Hollywood 1080p', 'Bollywood', 
        'South Action', 'South Original', 'TV Series', 'K-Drama', 
        'Bangla', 'Foreign Movies', '3D Movies', 'English Movies'
    ]

    home_categories = {}
    for tag in CATEGORY_TAGS:
        matches = [m for m in movies_data if (m[3] if isinstance(m, list) else m.get('tag')) == tag]
        home_categories[tag] = matches[:16]

    home_payload = {
        'total': len(movies_data),
        'carousel': movies_data[:10],
        'categories': home_categories
    }

    home_file = os.path.join(BASE_DIR, "home_data.json")
    with open(home_file, "w", encoding="utf-8") as f:
        json.dump(home_payload, f, ensure_ascii=False, separators=(",", ":"))
    print("Regenerated home_data.json successfully!")

if __name__ == "__main__":
    main()
