import sys
import os
import urllib.request
import ssl
import re
import json
from concurrent.futures import ThreadPoolExecutor

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "moviebox_data.json")

ctx = ssl._create_unverified_context()
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

PAGES_TO_SCAN = [
    {"name": "Movies", "url": "https://movie-box.co/web/movie", "tag": "Movie"},
    {"name": "TV Shows", "url": "https://movie-box.co/web/tv-series", "tag": "TV Series"},
    {"name": "Animation", "url": "https://movie-box.co/web/animated-series", "tag": "Animation"},
    {"name": "Trending / Most Watched", "url": "https://movie-box.co/ranking-list", "tag": "Trending"},
    {"name": "Midnight", "url": "https://movie-box.co/web/midnight", "tag": "Midnight"},
    {"name": "Home Showcase", "url": "https://movie-box.co/", "tag": "Featured"}
]

def fetch_html(url):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ctx, timeout=12) as response:
            return response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return ""

def process_movie_detail(detail_path, cat_name, tag):
    full_url = f"https://movie-box.co{detail_path}" if detail_path.startswith('/') else detail_path
    html = fetch_html(full_url)
    if not html:
        return None

    # Title extraction
    title_match = re.findall(r'<h1[^>]*>(.*?)</h1>', html)
    raw_title = title_match[0].strip() if title_match else ""
    if not raw_title:
        title_tag = re.findall(r'<title>(.*?)</title>', html, re.I)
        raw_title = title_tag[0].split('-')[0].split('|')[0].strip() if title_tag else "Movie"

    # Poster extraction (from pbcdnw.aoneroom.com)
    posters = re.findall(r'https://pbcdnw\.aoneroom\.com/image/[^\s"\'<>]+', html)
    poster_url = posters[0] if posters else ""

    # Direct Video Stream MP4 extraction (from macdn.aoneroom.com)
    streams = list(set(re.findall(r'https://macdn\.aoneroom\.com/media/[^\s"\'<>]+\.mp4', html)))
    if not streams:
        # Check for other video sources
        streams = list(set(re.findall(r'https?://[^\s"\'<>]+\.(?:mp4|m3u8)', html)))

    stream_url = streams[0] if streams else full_url

    return {
        "title": raw_title,
        "category": cat_name,
        "tag": tag,
        "poster": poster_url,
        "url": stream_url,
        "page_url": full_url,
        "size": "CDN HD Stream",
        "date": "2025/2026"
    }

def scrape_moviebox():
    print("[*] Starting movie-box.co Catalog Harvest...")
    all_detail_links = []
    seen_details = set()

    for page in PAGES_TO_SCAN:
        print(f"[*] Scanning section: {page['name']} ({page['url']})...")
        html = fetch_html(page['url'])
        detail_links = re.findall(r'href="(/detail/[^"]+)"', html)
        print(f"   -> Found {len(detail_links)} movie links in {page['name']}")
        
        for d in detail_links:
            if d not in seen_details:
                seen_details.add(d)
                all_detail_links.append({"path": d, "cat": page['name'], "tag": page['tag']})

    print(f"\n[+] Total Unique Movies to Harvest: {len(all_detail_links)}")
    print("[*] Extracting direct CDN streams and high-res posters from movie-box.co...")

    movie_records = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(process_movie_detail, item["path"], item["cat"], item["tag"]) for item in all_detail_links]
        for f in futures:
            try:
                res = f.result()
                if res and res["title"]:
                    movie_records.append(res)
                    print(f"   ✓ Extracted: {res['title']} -> {res['url'][:45]}...")
            except Exception:
                pass

    print(f"\n[+] Harvested {len(movie_records)} movies from movie-box.co successfully!")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(movie_records, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved movie database to: {OUTPUT_FILE}")

if __name__ == "__main__":
    scrape_moviebox()
