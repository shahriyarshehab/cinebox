#!/usr/bin/env python3
"""
CineBox Master Movie Harvester & Compiler
Collects and aggregates movies and TV series across all working BDIX and media sources:
- Upstream Mother Server (DhakaFlix / SamOnline / BDIX 172.16.50.x)
- Elaach BDIX Media Server (elaach.com)
Deduplicates, categorizes, and produces a unified big movies.json and home_data.json.
"""

import os
import sys
import json
import re
import datetime
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")
HOME_FILE = os.path.join(BASE_DIR, "home_data.json")
LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
TODAY_FILE = os.path.join(DATA_DIR, "today.json")
ELAACH_FILE = os.path.join(DATA_DIR, "elaach.json")

os.makedirs(DATA_DIR, exist_ok=True)

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

def clean_title_for_key(title):
    t = (title or "").lower()
    t = re.sub(r'\[.*?\]|\(.*?\)', '', t)
    t = re.sub(r'[^a-z0-9]', '', t)
    return t.strip()

def scrape_elaach_page(page_num, is_tv=False):
    base = "https://elaach.com/tv-series" if is_tv else "https://elaach.com/movies"
    url = f"{base}?page={page_num}"
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    items = []
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            cards = re.findall(r'<div class=\"card[^\"]*\">(.*?)</div>\s*</div>\s*</div>', html, re.DOTALL)
            for c in cards:
                m_title = re.search(r'<h3 class=\"card__title\"><a[^>]*title=[\"\']([^\"\']+)[\"\']', c)
                if not m_title:
                    m_title = re.search(r'<h3 class=\"card__title\"><a[^>]*>(.*?)</a>', c)
                raw_title = m_title.group(1).strip() if m_title else ''
                if not raw_title:
                    continue

                m_img = re.search(r'<img[^>]+src=[\"\']([^\"\']+)[\"\']', c)
                poster = ''
                if m_img:
                    p = m_img.group(1).strip()
                    poster = f'https://elaach.com/{p}' if not p.startswith('http') else p

                m_link = re.search(r'href=[\"\'](/movies/[^\"\']+|/tv-series/[^\"\']+)[\"\']', c)
                link = f'https://elaach.com{m_link.group(1).strip()}' if m_link else ''

                genres = re.findall(r'geners=([^\"]+)', c)
                primary_genre = genres[0] if genres else ('TV Series' if is_tv else 'Hollywood 1080p')

                m_qual = re.search(r'<span class=\"card__quality\">([^<]+)</span>', c)
                quality = m_qual.group(1).strip() if m_qual else 'HD'

                # Map genre to CineBox category tags
                genre_lower = primary_genre.lower()
                if is_tv:
                    tag = 'K-Drama' if 'korean' in genre_lower else 'TV Series'
                elif 'anim' in genre_lower:
                    tag = 'Animation'
                elif 'hindi' in genre_lower or 'bollywood' in genre_lower:
                    tag = 'Bollywood'
                elif 'south' in genre_lower or 'tamil' in genre_lower or 'telugu' in genre_lower:
                    tag = 'South Action'
                elif 'bangla' in genre_lower or 'bengali' in genre_lower:
                    tag = 'Bangla'
                elif any(x in genre_lower for x in ['french', 'german', 'spanish', 'korean', 'japanese', 'chinese']):
                    tag = 'Foreign Movies'
                else:
                    tag = 'Hollywood 1080p'

                full_title = f"{raw_title} [{quality}]"
                now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

                items.append([
                    full_title,
                    poster,
                    link,
                    tag,
                    'Elaach BDIX',
                    quality,
                    now_str
                ])
    except Exception as e:
        pass
    return items

def harvest_elaach(max_movie_pages=60, max_tv_pages=20):
    print(f"[*] Harvesting Elaach catalog ({max_movie_pages} movie pages, {max_tv_pages} TV pages)...")
    harvested = []
    tasks = []
    with ThreadPoolExecutor(max_workers=20) as executor:
        for p in range(1, max_movie_pages + 1):
            tasks.append(executor.submit(scrape_elaach_page, p, False))
        for p in range(1, max_tv_pages + 1):
            tasks.append(executor.submit(scrape_elaach_page, p, True))
        
        for future in as_completed(tasks):
            res = future.result()
            if res:
                harvested.extend(res)
    print(f"[+] Harvested {len(harvested)} items from Elaach.")
    return harvested

def load_existing_movies():
    if os.path.exists(MOVIES_FILE):
        try:
            with open(MOVIES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    print(f"[*] Loaded {len(data)} existing movies from movies.json")
                    return data
        except Exception as e:
            print(f"[!] Error loading movies.json: {e}")
    return []

def main():
    print("=== CineBox Master Movie Harvester ===")
    
    # 1. Load existing catalog
    existing_movies = load_existing_movies()
    
    # 2. Scrape live Elaach BDIX repository
    elaach_movies = harvest_elaach(max_movie_pages=60, max_tv_pages=20)
    
    # Save dedicated Elaach dataset
    with open(ELAACH_FILE, 'w', encoding='utf-8') as f:
        json.dump(elaach_movies, f, ensure_ascii=False)
    print(f"[+] Saved dedicated Elaach catalog ({len(elaach_movies)} items) to {ELAACH_FILE}")
    
    # 3. Deduplicate and merge
    seen_keys = set()
    master_list = []
    
    # Prioritize fresh Elaach releases at the top
    for item in elaach_movies:
        title = item[0] if isinstance(item, list) else item.get('title', '')
        key = clean_title_for_key(title)
        if key and key not in seen_keys:
            seen_keys.add(key)
            master_list.append(item)
            
    # Append existing movies
    for item in existing_movies:
        title = item[0] if isinstance(item, list) else item.get('title', '')
        key = clean_title_for_key(title)
        if key and key not in seen_keys:
            seen_keys.add(key)
            master_list.append(item)
            
    print(f"[+] Master combined movie count: {len(master_list)}")
    
    # 4. Save Master movies.json
    print(f"[*] Writing big movies.json ({len(master_list)} movies)...")
    with open(MOVIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(master_list, f, ensure_ascii=False)
        
    # 5. Build category buckets
    categories = {
        "Today's Updates": [],
        "Today": [],
        "K-Drama": [],
        "TV Series": [],
        "Hollywood 1080p": [],
        "Bollywood": [],
        "South Action": [],
        "South Original": [],
        "Animation": [],
        "Bangla": [],
        "Foreign Movies": [],
        "Top Rated": [],
        "3D Movies": [],
        "English Movies": [],
        "Elaach BDIX": elaach_movies[:200]
    }
    
    # Extract Latest / Today from newly harvested and recent
    categories["Today's Updates"] = (elaach_movies[:30] + master_list[:20])[:35]
    categories["Today"] = categories["Today's Updates"]
    
    for item in master_list:
        tag = item[3] if len(item) > 3 else ''
        if tag in categories and len(categories[tag]) < 400:
            categories[tag].append(item)
            
    # Ensure all categories have items
    for cat, items in categories.items():
        if len(items) == 0:
            for item in master_list:
                t = (item[0] or "").lower()
                if cat.lower() in t:
                    items.append(item)
                    if len(items) >= 50:
                        break
                        
    # 6. Build carousel items (top 15 visually rich featured movies)
    carousel_candidates = [m for m in master_list if m[1] and m[1].startswith('http') and not m[1].endswith('a11.jpg')]
    carousel = (carousel_candidates[:12] + master_list[:3])[:10]
    
    # 7. Compile home_data.json
    home_obj = {
        "total": len(master_list),
        "last_updated": datetime.datetime.now().isoformat(),
        "today_count": len(categories["Today's Updates"]),
        "carousel": carousel,
        "categories": categories
    }
    
    print(f"[*] Writing home_data.json with {len(master_list)} total titles...")
    with open(HOME_FILE, 'w', encoding='utf-8') as f:
        json.dump(home_obj, f, ensure_ascii=False)
        
    # 8. Save latest.json & today.json
    with open(LATEST_FILE, 'w', encoding='utf-8') as f:
        json.dump(categories["Today's Updates"], f, ensure_ascii=False)
    with open(TODAY_FILE, 'w', encoding='utf-8') as f:
        json.dump(categories["Today"], f, ensure_ascii=False)
        
    print("=== Master Collection Complete ===")
    print(f"Total Movies in Database: {len(master_list)}")
    print(f"Updated: {MOVIES_FILE}")
    print(f"Updated: {HOME_FILE}")
    print(f"Updated: {ELAACH_FILE}")

if __name__ == '__main__':
    main()
