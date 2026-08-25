import json
import urllib.parse
import re
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")
TV_INDEX_FILE = os.path.join(BASE_DIR, "tv_index.json")
HOME_FILE = os.path.join(BASE_DIR, "home_data.json")

with open(MOVIES_FILE, "r", encoding="utf-8") as f:
    movies_data = json.load(f)

with open(TV_INDEX_FILE, "r", encoding="utf-8") as f:
    tv_index = json.load(f)

print(f"Original total in movies.json: {len(movies_data)}")

# 1. Collect all non-KDrama movies
clean_movies = []
for m in movies_data:
    tag = m[3] if isinstance(m, list) else m.get("tag")
    cat = m[4] if isinstance(m, list) else m.get("category")
    url = m[2] if isinstance(m, list) else m.get("url")
    if tag != "K-Drama" and "KOREAN" not in (url or ""):
        clean_movies.append(m)

print(f"Non-KDrama items count: {len(clean_movies)}")

# 2. Extract unique Korean Series from tv_index.json and build proper clean items
korean_series_map = {}

for key, val in tv_index.items():
    folder_url = val[0]
    if "KOREAN" in folder_url:
        clean_key = key.replace('–', '-').replace('—', '-').replace('\ufffd', '-').strip()
        # Find poster
        poster_url = ""
        seasons = val[1] if len(val) > 1 else []
        # Construct proper poster url
        if seasons and len(seasons) > 0:
            first_s_url = seasons[0][1]
            poster_url = first_s_url.rstrip('/') + "/a_AL_.jpg"
        if not poster_url:
            poster_url = folder_url.rstrip('/') + "/a_AL_.jpg"

        season_count = len(seasons)
        size_str = f"{season_count} Season{'s' if season_count > 1 else ''}" if season_count > 0 else "K-Drama"

        korean_series_map[clean_key] = [
            clean_key,
            poster_url,
            folder_url,
            "K-Drama",
            "Korean Drama",
            size_str,
            "2026"
        ]

print(f"Built {len(korean_series_map)} distinct, clean Korean Series items!")

# 3. Add all clean Korean Series to clean_movies
for s_item in korean_series_map.values():
    clean_movies.append(s_item)

print(f"New total movies.json items: {len(clean_movies)}")

# 4. Save movies.json
with open(MOVIES_FILE, "w", encoding="utf-8") as f:
    json.dump(clean_movies, f, ensure_ascii=False, separators=(",", ":"))

# 5. Regenerate home_data.json
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

print("Updated movies.json and home_data.json successfully with clean Korean Drama series!")
