import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")
DATA_DIR = os.path.join(BASE_DIR, "data")
HOME_FILE = os.path.join(BASE_DIR, "home_data.json")

os.makedirs(DATA_DIR, exist_ok=True)

with open(MOVIES_FILE, "r", encoding="utf-8") as f:
    movies_data = json.load(f)

print(f"Loaded {len(movies_data)} items from movies.json")

# Category mapping definitions
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

home_categories = {}

for cat_key, cat_info in CATEGORY_FILES.items():
    matched = [m for m in movies_data if cat_info["filter"](m)]
    out_path = os.path.join(DATA_DIR, cat_info["file"])
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(matched, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Created data/{cat_info['file']} ({cat_info['name']}): {len(matched)} items")
    home_categories[cat_info["tag"]] = matched[:16]

# Update home_data.json
home_payload = {
    'total': len(movies_data),
    'carousel': movies_data[:10],
    'categories': home_categories
}

with open(HOME_FILE, "w", encoding="utf-8") as f:
    json.dump(home_payload, f, ensure_ascii=False, separators=(",", ":"))

print("Updated home_data.json successfully with category slices!")
