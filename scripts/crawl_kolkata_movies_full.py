import urllib.request
import urllib.parse
import re
import json
import os
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")
HOME_FILE = os.path.join(BASE_DIR, "home_data.json")

KOLKATA_URL = "http://172.16.50.7/DHAKA-FLIX-7/Kolkata%20Bangla%20Movies/"
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

def crawl_movie_leaf(leaf_item):
    name, leaf_url, year_name = leaf_item
    html = fetch_html(leaf_url)
    if not html:
        return None

    items = parse_apache_index(html, leaf_url)
    poster_url = ""
    video_url = ""

    for href, text, full_url, is_dir in items:
        clean_text = urllib.parse.unquote(text).strip('/')
        ext = os.path.splitext(clean_text)[1].lower()

        if not is_dir and ext in POSTER_EXTS and not poster_url:
            poster_url = full_url
        elif not is_dir and ext in VIDEO_EXTS and not video_url:
            video_url = full_url

    if not video_url:
        video_url = leaf_url

    if not poster_url:
        poster_url = leaf_url.rstrip('/') + "/a_AL_.jpg"

    return [
        name,
        poster_url,
        video_url,
        "Bangla",
        "Kolkata Bangla Movies",
        "HD",
        year_name.replace('(', '').replace(')', '').strip() or "2024"
    ]

def main():
    print(f"Deep crawling Kolkata Bangla Movies from: {KOLKATA_URL}")
    root_html = fetch_html(KOLKATA_URL)
    year_folders = parse_apache_index(root_html, KOLKATA_URL)
    print(f"Found {len(year_folders)} year folders/collections.")

    movie_leaves = []

    for y_href, y_text, y_url, y_is_dir in year_folders:
        clean_y = urllib.parse.unquote(y_text).strip('/')
        if not y_is_dir:
            continue
        y_html = fetch_html(y_url)
        movies_in_year = parse_apache_index(y_html, y_url)
        print(f"  {clean_y}: {len(movies_in_year)} items")
        for m_href, m_text, m_url, m_is_dir in movies_in_year:
            clean_m = urllib.parse.unquote(m_text).strip('/')
            ext = os.path.splitext(clean_m)[1].lower()
            if m_is_dir:
                movie_leaves.append((clean_m, m_url, clean_y))
            elif ext in VIDEO_EXTS:
                movie_leaves.append((clean_m, m_url, clean_y))

    print(f"Total Kolkata movie items to scrape: {len(movie_leaves)}")

    scraped_movies = []
    with ThreadPoolExecutor(max_workers=32) as executor:
        for res in executor.map(crawl_movie_leaf, movie_leaves):
            if res:
                scraped_movies.append(res)

    print(f"Scraped {len(scraped_movies)} complete Kolkata Bangla Movies!")

    # Merge into movies.json
    with open(MOVIES_FILE, "r", encoding="utf-8") as f:
        movies_data = json.load(f)

    # Remove the 26 generic year folder entries if added previously
    clean_movies = [m for m in movies_data if not (m[3] == "Bangla" and m[0].startswith("(") and m[0].endswith(")"))]

    existing_titles = set()
    for m in clean_movies:
        t = m[0] if isinstance(m, list) else m.get("title", "")
        if t: existing_titles.add(t.lower().strip())

    added_count = 0
    for m in scraped_movies:
        t = m[0].lower().strip()
        if t not in existing_titles:
            clean_movies.append(m)
            existing_titles.add(t)
            added_count += 1

    print(f"Added {added_count} new Kolkata Bangla movies to movies.json (Total: {len(clean_movies)})")

    with open(MOVIES_FILE, "w", encoding="utf-8") as f:
        json.dump(clean_movies, f, ensure_ascii=False, separators=(",", ":"))

    # Regenerate home_data.json
    CATEGORY_TAGS = [
        'Top Rated', 'Animation', 'Hollywood 1080p', 'Bollywood', 
        'South Action', 'South Original', 'TV Series', 'K-Drama', 
        'Bangla', 'Foreign Movies', '3D Movies', 'English Movies'
    ]

    home_categories = {}
    for tag in CATEGORY_TAGS:
        matches = [m for m in clean_movies if (m[3] if isinstance(m, list) else m.get('tag')) == tag]
        home_categories[tag] = matches[:16]

    home_payload = {
        'total': len(clean_movies),
        'carousel': clean_movies[:10],
        'categories': home_categories
    }

    with open(HOME_FILE, "w", encoding="utf-8") as f:
        json.dump(home_payload, f, ensure_ascii=False, separators=(",", ":"))

    print("Regenerated home_data.json successfully with full Kolkata Bangla movies!")

if __name__ == "__main__":
    main()
