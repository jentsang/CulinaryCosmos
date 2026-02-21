#!/usr/bin/env python3
"""
Fetch Wikipedia images for food/ingredient nodes.
Outputs node_id -> image_url mapping to data/node_images.json.
Uses Wikipedia API (no key required). Rate-limited to be respectful.
"""

import json
import re
import time
from pathlib import Path

import requests

WIKI_API = "https://en.wikipedia.org/w/api.php"
REQUEST_DELAY = 1.5  # seconds between requests (Wikipedia rate limit ~200 req/min)
RETRY_DELAY = 60  # seconds to wait on 429
MAX_RETRIES = 3


def to_wiki_search_term(name: str) -> str:
    """Convert ingredient name to a Wikipedia search term."""
    # Remove common suffixes that might not match Wikipedia titles
    name = name.strip()
    # "garlic, minced" -> "garlic"
    name = re.sub(r",\s*.*$", "", name)
    # "pepper, black" -> "black pepper"
    if ", " in name and name.split(", ")[1] in ("black", "white", "red", "green"):
        parts = name.split(", ")
        name = f"{parts[1]} {parts[0]}"
    return name


def _wiki_request(session, params, ingredient, step):
    """Make a Wikipedia API request with retry on 429."""
    for attempt in range(MAX_RETRIES):
        try:
            r = session.get(WIKI_API, params=params, timeout=15)
            if r.status_code == 429:
                if attempt < MAX_RETRIES - 1:
                    print(f"  Rate limited, waiting {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY)
                    continue
                return None
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
                continue
            print(f"  {step} error for {ingredient}: {e}")
            return None
    return None


def fetch_wiki_image(ingredient: str, session: requests.Session):
    """
    Search Wikipedia for the ingredient and return the main page image URL.
    Returns None if no image found.
    """
    search_term = to_wiki_search_term(ingredient)
    search_term = search_term.replace(" ", "+")

    # Step 1: Search for the page
    data = _wiki_request(
        session,
        {
            "action": "query",
            "list": "search",
            "srsearch": search_term,
            "srlimit": 1,
            "format": "json",
        },
        ingredient,
        "Search",
    )
    if not data:
        return None

    results = data.get("query", {}).get("search", [])
    if not results:
        return None

    page_id = results[0].get("pageid")
    if not page_id:
        return None

    time.sleep(REQUEST_DELAY)

    # Step 2: Get page image
    data = _wiki_request(
        session,
        {
            "action": "query",
            "pageids": page_id,
            "prop": "pageimages",
            "pithumbsize": 400,
            "format": "json",
        },
        ingredient,
        "Image",
    )
    if not data:
        return None

    pages = data.get("query", {}).get("pages", {})
    page = pages.get(str(page_id), {})
    thumb = page.get("thumbnail")
    if thumb and "source" in thumb:
        return thumb["source"]
    orig = page.get("original", {})
    if orig and "source" in orig:
        return orig["source"]
    return None


def main():
    project_root = Path(__file__).resolve().parent.parent
    json_path = project_root / "data" / "flavor_pairings.json"
    out_path = project_root / "data" / "node_images.json"

    if not json_path.exists():
        print(f"Error: {json_path} not found")
        return 1

    with open(json_path) as f:
        data = json.load(f)

    edges = data.get("edges", [])
    degree = {}
    for e in edges:
        degree[e["source"]] = degree.get(e["source"], 0) + 1
        degree[e["target"]] = degree.get(e["target"], 0) + 1

    # Nodes with more than 5 edges
    high_degree_nodes = [n for n, d in degree.items() if d > 5]

    # Resume from existing file if present
    images = {}
    if out_path.exists():
        with open(out_path) as f:
            images = json.load(f)
        print(f"Resuming: {len(images)} images already fetched")

    to_fetch = [n for n in high_degree_nodes if n not in images]
    print(f"Fetching images for {len(to_fetch)} nodes (degree > 5)...")

    session = requests.Session()
    session.headers.update({"User-Agent": "FlavourNetwork/1.0 (food visualization project)"})

    failed = []

    for i, node_id in enumerate(to_fetch):
        if (i + 1) % 50 == 0:
            print(f"  Progress: {i + 1}/{len(to_fetch)}")
        url = fetch_wiki_image(node_id, session)
        if url:
            images[node_id] = url
        else:
            failed.append(node_id)

    with open(out_path, "w") as f:
        json.dump(images, f, indent=2)

    print(f"\nDone. Found {len(images)} images, {len(failed)} not found.")
    print(f"Saved to {out_path}")
    if failed[:10]:
        print(f"Sample not found: {failed[:10]}")
    return 0


if __name__ == "__main__":
    exit(main())
