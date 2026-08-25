import json
import os
import re
import sys
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")
TV_INDEX_FILE = os.path.join(BASE_DIR, "tv_index.json")

with open(MOVIES_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# Extract all TV series and K-Drama items
tv_items = []
for m in data:
    if isinstance(m, list):
        title = m[0] if len(m) > 0 else ""
        poster = m[1] if len(m) > 1 else ""
        url = m[2] if len(m) > 2 else ""
        tag = m[3] if len(m) > 3 else ""
        category = m[4] if len(m) > 4 else ""
        if tag in ["TV Series", "K-Drama"] or "series" in category.lower():
            # Derive series folder URL
            if url.endswith("/"):
                series_dir = url
            elif poster and "/a_" in poster:
                series_dir = poster.rsplit("/", 1)[0] + "/"
            else:
                series_dir = url.rsplit("/", 1)[0] + "/"
            tv_items.append({"title": title, "url": url, "series_dir": series_dir, "tag": tag})

print(f"Total TV / Drama series to index: {len(tv_items)}")

tv_catalog = {}

def crawl_series(item):
    title = item["title"]
    folder_url = item["series_dir"]
    if not folder_url or not folder_url.startswith("http"):
        return None

    try:
        req = urllib.request.Request(folder_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            html = r.read().decode("utf-8", errors="ignore")

        raw_links = re.findall(r'<a href="([^"]+)">([^<]+)</a>', html)
        seasons = []
        specials = []

        for href, name in raw_links:
            text = name.strip()
            if not href or "parent directory" in text.lower() or text in [".", "..", "modern browsers"] or "browsehappy" in href:
                continue
            if href.lower().endswith(".jpg") or href.lower().endswith(".png") or href.lower().endswith(".nfo") or href.lower().endswith(".txt"):
                continue

            full_url = urllib.parse.urljoin(folder_url, href)

            if href.endswith("/") or "season" in text.lower() or "s0" in text.lower() or "s1" in text.lower():
                # Fetch season episodes
                season_episodes = []
                try:
                    req_s = urllib.request.Request(full_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req_s, timeout=8) as rs:
                        s_html = rs.read().decode("utf-8", errors="ignore")
                    s_links = re.findall(r'<a href="([^"]+)">([^<]+)</a>', s_html)
                    for shref, sname in s_links:
                        stext = sname.strip()
                        if not shref or "parent directory" in stext.lower() or stext in [".", ".."]:
                            continue
                        if re.search(r'\.(mp4|mkv|avi|webm)$', shref, re.I):
                            season_episodes.append({
                                "name": stext,
                                "url": urllib.parse.urljoin(full_url, shref)
                            })
                except Exception:
                    pass

                seasons.append({
                    "name": text.rstrip("/"),
                    "url": full_url,
                    "episodes": season_episodes
                })
            elif re.search(r'\.(mp4|mkv|avi|webm)$', href, re.I):
                specials.append({
                    "name": text,
                    "url": full_url
                })

        if seasons or specials:
            return title, {
                "folder_url": folder_url,
                "seasons": seasons,
                "specials": specials
            }
        return None
    except Exception as e:
        return None

# Deduplicate items by series_dir
seen_dirs = set()
unique_targets = []
for t in tv_items:
    if t["series_dir"] not in seen_dirs:
        seen_dirs.add(t["series_dir"])
        unique_targets.append(t)

print(f"Starting multi-threaded crawl for {len(unique_targets)} series...")

indexed_count = 0
with ThreadPoolExecutor(max_workers=40) as executor:
    results = executor.map(crawl_series, unique_targets)
    for res in results:
        if res:
            title, s_data = res
            tv_catalog[title] = s_data
            # Also key by folder_url for instant lookup
            tv_catalog[s_data["folder_url"]] = s_data
            indexed_count += 1
            if indexed_count % 50 == 0:
                print(f"Indexed {indexed_count} series so far...")

with open(TV_INDEX_FILE, "w", encoding="utf-8") as f:
    json.dump(tv_catalog, f, ensure_ascii=False, separators=(',', ':'))

print(f"Successfully saved {indexed_count} TV Series to {TV_INDEX_FILE}!")
