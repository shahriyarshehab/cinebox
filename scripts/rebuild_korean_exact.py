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
DATA_DIR = os.path.join(BASE_DIR, "data")
KDRAMA_FILE = os.path.join(DATA_DIR, "kdrama.json")
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")
TV_INDEX_FILE = os.path.join(BASE_DIR, "tv_index.json")
HOME_FILE = os.path.join(BASE_DIR, "home_data.json")

KOREAN_ROOT = "http://172.16.50.14/DHAKA-FLIX-14/KOREAN%20TV%20%26%20WEB%20Series/"

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

def clean_series_title(raw_name):
    # Unquote URL and normalize characters
    name = urllib.parse.unquote(raw_name).strip('/')
    name = name.replace('–', '-').replace('—', '-').replace('\ufffd', '').replace('', '')
    # Clean up artifacts like '2023- )' -> '2023)'
    name = re.sub(r'(\d{4})\s*-\s*\)', r'\1)', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def crawl_kdrama_folder(folder_item):
    raw_name, folder_url = folder_item
    clean_title = clean_series_title(raw_name)

    html = fetch_html(folder_url)
    if not html:
        return None

    items = parse_apache_index(html, folder_url)
    
    poster_url = ""
    season_folders = []
    specials = []

    # Check for poster in main series folder
    for href, text, full_url, is_dir in items:
        clean_text = urllib.parse.unquote(text).strip('/')
        ext = os.path.splitext(clean_text)[1].lower()

        if is_dir:
            season_folders.append((clean_text, full_url))
        elif ext in POSTER_EXTS:
            if not poster_url or 'a_AL_' in clean_text:
                poster_url = full_url
        elif ext in VIDEO_EXTS:
            specials.append(clean_text)

    # Crawl each season folder
    seasons_data = []
    for s_name, s_url in season_folders:
        s_html = fetch_html(s_url)
        s_items = parse_apache_index(s_html, s_url)
        episodes = []
        for ep_href, ep_text, ep_full, ep_is_dir in s_items:
            clean_ep = urllib.parse.unquote(ep_text).strip('/')
            ep_ext = os.path.splitext(clean_ep)[1].lower()
            if not ep_is_dir and ep_ext in VIDEO_EXTS:
                episodes.append(clean_ep)
            elif not poster_url and ep_ext in POSTER_EXTS:
                poster_url = ep_full
        
        if episodes:
            seasons_data.append([s_name, s_url, episodes])

    # Fallback poster
    if not poster_url:
        poster_url = folder_url.rstrip('/') + "/a_AL_.jpg"

    season_count = len(seasons_data)
    size_str = f"{season_count} Season{'s' if season_count > 1 else ''}" if season_count > 0 else "K-Drama"

    # Extract year if present
    year_match = re.search(r'\(.*?(19\d\d|20\d\d).*?\)', clean_title)
    year_str = year_match.group(1) if year_match else "2026"

    # Compact format for movies.json and kdrama.json
    card_item = [
        clean_title,
        poster_url,
        folder_url,
        "K-Drama",
        "Korean Drama",
        size_str,
        year_str
    ]

    return {
        "card": card_item,
        "raw_title": raw_name,
        "clean_title": clean_title,
        "url": folder_url,
        "seasons": seasons_data,
        "specials": specials
    }

def main():
    print(f"Fetching clean Korean Drama list from {KOREAN_ROOT}...")
    root_html = fetch_html(KOREAN_ROOT)
    if not root_html:
        print("Error fetching Korean root directory!")
        return

    root_items = parse_apache_index(root_html, KOREAN_ROOT)
    folders = []

    for href, text, full_url, is_dir in root_items:
        clean_text = urllib.parse.unquote(text).strip('/')
        if is_dir:
            folders.append((clean_text, full_url))

    print(f"Found {len(folders)} Korean Series folders. Scraping posters and seasons with ThreadPool...")

    results = []
    with ThreadPoolExecutor(max_workers=32) as executor:
        for res in executor.map(crawl_kdrama_folder, folders):
            if res:
                results.append(res)

    print(f"Successfully processed {len(results)} clean Korean Drama series!")

    # Sort alphabetically
    results.sort(key=lambda x: x["clean_title"].lower())

    kdrama_cards = [r["card"] for r in results]

    # 1. Save data/kdrama.json
    with open(KDRAMA_FILE, "w", encoding="utf-8") as f:
        json.dump(kdrama_cards, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Saved {len(kdrama_cards)} items to data/kdrama.json!")

    # 2. Update tv_index.json
    with open(TV_INDEX_FILE, "r", encoding="utf-8") as f:
        tv_index = json.load(f)

    for r in results:
        t_clean = r["clean_title"]
        tv_index[t_clean] = [
            r["url"],
            r["seasons"],
            r["specials"]
        ]
        # Also key by raw folder name
        t_raw = r["raw_title"]
        if t_raw != t_clean:
            tv_index[t_raw] = tv_index[t_clean]

    with open(TV_INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(tv_index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Updated tv_index.json! Total indexed series: {len(tv_index)}")

    # 3. Update movies.json (remove old kdrama, insert fresh clean kdrama)
    with open(MOVIES_FILE, "r", encoding="utf-8") as f:
        movies_data = json.load(f)

    # Filter out any old kdrama
    clean_movies = [m for m in movies_data if (m[3] if isinstance(m, list) else m.get("tag")) != "K-Drama" and "KOREAN" not in ((m[2] if isinstance(m, list) else m.get("url")) or "")]

    # Add all new clean kdrama
    clean_movies.extend(kdrama_cards)

    with open(MOVIES_FILE, "w", encoding="utf-8") as f:
        json.dump(clean_movies, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Updated movies.json! Total items: {len(clean_movies)}")

    # 4. Regenerate home_data.json
    with open(HOME_FILE, "r", encoding="utf-8") as f:
        home_payload = json.load(f)

    home_payload["categories"]["K-Drama"] = kdrama_cards[:16]
    home_payload["total"] = len(clean_movies)

    with open(HOME_FILE, "w", encoding="utf-8") as f:
        json.dump(home_payload, f, ensure_ascii=False, separators=(",", ":"))
    print("Regenerated home_data.json with clean K-Drama slice!")

if __name__ == "__main__":
    main()
