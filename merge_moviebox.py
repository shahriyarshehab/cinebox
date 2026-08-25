import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")
MB_FILE = os.path.join(BASE_DIR, "moviebox_data.json")

with open(MOVIES_FILE, "r", encoding="utf-8") as f:
    local_movies = json.load(f)

with open(MB_FILE, "r", encoding="utf-8") as f:
    mb_movies = json.load(f)

# Filter out any old moviebox tagged movies first if re-running
clean_local = [m for m in local_movies if m.get("tag") != "MovieBox CDN"]

print(f"DhakaFlix movies: {len(clean_local)}")
print(f"MovieBox.co movies: {len(mb_movies)}")

tagged_mb_movies = []
for m in mb_movies:
    if not m.get("title") or not m.get("url"):
        continue
    tagged_mb_movies.append({
        "title": m["title"],
        "category": f"MovieBox • {m.get('category', 'Online')}",
        "tag": "MovieBox CDN",
        "source": "MovieBox.co Global CDN",
        "poster": m.get("poster", ""),
        "url": m.get("url", ""),
        "page_url": m.get("page_url", ""),
        "size": "Global CDN MP4",
        "date": "MovieBox Official"
    })

combined = tagged_mb_movies + clean_local
print(f"Combined Total Movies: {len(combined)}")

with open(MOVIES_FILE, "w", encoding="utf-8") as f:
    json.dump(combined, f, ensure_ascii=False, indent=2)

print("Successfully merged and marked MovieBox files into movies.json!")
