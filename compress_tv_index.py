import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TV_INDEX_FILE = os.path.join(BASE_DIR, "tv_index.json")

with open(TV_INDEX_FILE, "r", encoding="utf-8") as f:
    raw = json.load(f)

ultra_compact = {}
for title, data in raw.items():
    if title.startswith("http"):
        continue

    folder_url = data.get("folder_url", "")
    seasons = []
    for s in data.get("seasons", []):
        s_name = s.get("name", "")
        s_url = s.get("url", "")
        # store just the episode filename / name
        eps = []
        for ep in s.get("episodes", []):
            ep_name = ep[0] if isinstance(ep, list) else ep.get("name", "")
            if ep_name:
                eps.append(ep_name)
        if eps:
            seasons.append([s_name, s_url, eps])

    specials = []
    for sp in data.get("specials", []):
        sp_name = sp[0] if isinstance(sp, list) else sp.get("name", "")
        if sp_name:
            specials.append(sp_name)

    if seasons or specials:
        ultra_compact[title] = [folder_url, seasons, specials]

with open(TV_INDEX_FILE, "w", encoding="utf-8") as f:
    json.dump(ultra_compact, f, ensure_ascii=False, separators=(',', ':'))

size_mb = os.path.getsize(TV_INDEX_FILE) / (1024 * 1024)
print(f"Nano-compact tv_index.json size: {size_mb:.2f} MB for {len(ultra_compact)} TV series!")
