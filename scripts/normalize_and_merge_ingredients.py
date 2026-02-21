#!/usr/bin/env python3
"""
1. Filter out non-single-food items (phrases, dish descriptions)
2. Normalize and merge similar ingredients (apricots/dried apricots → apricot)
"""

import json
import re
from pathlib import Path
from collections import defaultdict

# Phrases that indicate multi-item or sentence (not single ingredient)
PHRASE_PATTERNS = [
    r"^are\s+",               # "are salty"
    r"\bare\s+\w+",            # "X are salty"
    r"\bis\s+\w+",            # "is milder"
    r"\bin\s+carrot\s+butter",
    r"\bin\s+red\s+wine\s+sauce",
    r"\bin\s+a\s+",           # "in a spicy sauce"
    r"\bin\s+the\s+",
    r"\bas\s+in\s+",         # "as in coffee"
    r"\bfor\s+granted",
    r"\bif\s+you\s+want",
    r"\bwhen\s+they\s+are",
    r"\bdon'?t\s+\w+",
    r"\bthose\s+",
    r"\bthen\s+pull",
    r"\btypically\s+in",
    r"\bgenerally\s+in",
    r"\bshirts\s+in\s+half",
    r"\bemulsification\s+in",
    r"\bpopular\s+in",
    r"\bmarinated\s+in\s+\w+s$",  # "marinated in oranges" - dish desc
    r"\bstuffed\s+in\s+",
    r"\bjalapeños\s+in\s+an\s+",
    r"\bmussels\s+in\s+a\s+",
    r"\bshort\s+ribs\s+are\s+",
    r"\bpeppers\s+are\s+smoked",
    r"\brosemary\s+is\s+milder",
    r"\bi'?d\s+toss\s+in",
    r"\bsummer\s+when\s+they",
    r"\bbaby\s+round\s+carrots\s+in",
    r"\bbraised\s+short\s+ribs\s+in",
    r"\bround\s+carrots\s+in",
]


def is_single_ingredient(node_id: str) -> bool:
    """Return False if this looks like a phrase or multi-item description."""
    lower = node_id.lower().strip()

    # Starts with "and " or "and/or" - phrase fragment
    if lower.startswith("and ") or lower.startswith("and/or"):
        return False

    # Too many words (likely a phrase)
    if len(lower.split()) > 4:
        return False

    # Phrase patterns
    if any(re.search(pat, lower) for pat in PHRASE_PATTERNS):
        return False

    # Contains " in " (often dish description: "X in Y sauce")
    if " in " in lower and any(x in lower for x in ["sauce", "butter", "wine", "pan", "dessert"]):
        return False

    return True


def normalize_to_canonical(name: str) -> str:
    """
    Map variant names to a canonical form for merging.
    Returns the canonical name (singular, base form).
    """
    lower = name.lower().strip()

    # "liqueurs: apricot" → "apricot liqueur"
    if ": " in lower:
        cat, ing = lower.split(": ", 1)
        if cat in ("liqueurs", "vinegar", "oil", "wine"):
            return f"{ing.strip()} {cat.rstrip('s')}".strip()
        return ing.strip()

    # "X, dried" or "dried X" → X
    if ", dried" in lower:
        return normalize_to_canonical(lower.replace(", dried", "").strip())
    if lower.startswith("dried "):
        return normalize_to_canonical(lower[6:].strip())

    # "X, fresh" → X
    if ", fresh" in lower:
        return normalize_to_canonical(lower.replace(", fresh", "").strip())

    # "X, canned" → X
    if ", canned" in lower:
        return normalize_to_canonical(lower.replace(", canned", "").strip())

    # "cheese, X" → X (specific cheese name)
    if lower.startswith("cheese, "):
        return lower.replace("cheese, ", "").strip()

    # "beans, X" or "beans, X, Y" → "X beans"
    if lower.startswith("beans, "):
        parts = lower.replace("beans, ", "").split(", ")
        if len(parts) == 1:
            return f"{parts[0]} beans"
        return f"{parts[0]} beans"  # "black, pinto" → "black beans"

    # "X, Y" where Y is subtype - "anise, star" → "star anise"
    if ", " in lower:
        a, b = lower.split(", ", 1)
        # "basil, thai" → "thai basil"
        if b in ("thai", "lemon", "sweet", "holy"):
            return f"{b} {a}"
        # "anise, star" → "star anise"
        if b == "star":
            return "star anise"
        # "oil, olive" → "olive oil"
        if a == "oil" and b:
            return f"{b} oil"
        # "vinegar, X" → "X vinegar"
        if a == "vinegar" and b:
            return f"{b} vinegar"
        # "cabbage, X" → "X cabbage"
        if a == "cabbage" and b:
            return f"{b} cabbage"
        # "pepper, X" → "X pepper"
        if a == "pepper" and b and b not in ("black", "white"):
            return f"{b} pepper"
        # "butter, unsalted" → "butter"
        if a == "butter" and b in ("unsalted", "salted"):
            return "butter"
        # "bass, black" → "black bass"
        if a in ("bass", "cod", "fish") and b:
            return f"{b} {a}"
        # "artichokes, jerusalem" → "jerusalem artichoke"
        if a.endswith("s") and b:
            base = a[:-1]  # artichokes → artichoke
            return f"{b} {base}"
        # Generic: use first part if second is qualifier
        if b in ("ground", "whole", "minced", "chopped", "sliced"):
            return a

    # Singular/plural for common ingredients
    singular_map = {
        "apricots": "apricot", "apples": "apple", "bananas": "banana",
        "beans": "beans", "berries": "berry", "carrots": "carrot",
        "cherries": "cherry", "dates": "date", "figs": "fig",
        "grapes": "grape", "lemons": "lemon", "limes": "lime",
        "mangoes": "mango", "mangos": "mango", "melons": "melon",
        "olives": "olive", "onions": "onion", "oranges": "orange",
        "peaches": "peach", "pears": "pear", "peas": "pea",
        "peppers": "pepper", "plums": "plum", "potatoes": "potato",
        "tomatoes": "tomato", "walnuts": "walnut", "almonds": "almond",
        "anchovies": "anchovy", "clams": "clam", "mussels": "mussel",
        "oysters": "oyster", "scallops": "scallop", "shrimps": "shrimp",
        "shrimp": "shrimp", "herbs": "herbs", "spices": "spices",
    }
    if lower in singular_map:
        return singular_map[lower]

    return lower


def main():
    project_root = Path(__file__).resolve().parent.parent
    json_path = project_root / "data" / "flavor_pairings.json"
    csv_path = project_root / "data" / "flavor_pairings.csv"

    if not json_path.exists():
        print(f"Error: {json_path} not found")
        return 1

    with open(json_path) as f:
        data = json.load(f)

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    # Step 1: Filter non-single-ingredient nodes
    keep_ids = {n["id"] for n in nodes if is_single_ingredient(n["id"])}
    nodes_filtered = [n for n in nodes if n["id"] in keep_ids]
    edges_filtered = [e for e in edges if e["source"] in keep_ids and e["target"] in keep_ids]

    removed_phrases = len(nodes) - len(nodes_filtered)
    print(f"Filtered {removed_phrases} phrase/non-ingredient nodes")

    # Step 2: Build canonical mapping (original_id → canonical_id)
    id_to_canonical = {}
    for n in nodes_filtered:
        orig = n["id"]
        canon = normalize_to_canonical(orig)
        # Keep "apricot brandy" etc. as distinct (compound products)
        if " brandy" in orig or " liqueur" in orig or " wine" in orig or " vinegar" in orig:
            if orig != canon and canon in ("apricot", "cherry", "orange", "peach"):
                # "apricot brandy" - keep as is, don't merge with "apricot"
                id_to_canonical[orig] = orig
                continue
        id_to_canonical[orig] = canon

    # Step 3: Merge nodes - group by canonical id
    canon_to_node = {}
    for n in nodes_filtered:
        orig = n["id"]
        canon = id_to_canonical[orig]
        if canon not in canon_to_node:
            canon_to_node[canon] = {"id": canon, "label": canon, "category": n.get("category", "other")}
        # Prefer shorter label
        if len(canon) < len(canon_to_node[canon]["label"]):
            canon_to_node[canon]["label"] = canon

    # Step 4: Remap edges to canonical ids, deduplicate
    edge_counts = defaultdict(int)
    for e in edges_filtered:
        src = id_to_canonical.get(e["source"], e["source"])
        tgt = id_to_canonical.get(e["target"], e["target"])
        if src != tgt and src in canon_to_node and tgt in canon_to_node:
            key = (min(src, tgt), max(src, tgt))
            edge_counts[key] = max(edge_counts[key], e.get("weight", 1))

    edges_merged = [
        {"source": k[0], "target": k[1], "weight": v}
        for (k, v) in edge_counts.items()
    ]

    nodes_merged = list(canon_to_node.values())
    merge_count = len(nodes_filtered) - len(nodes_merged)
    print(f"Merged {merge_count} similar nodes ({len(nodes_filtered)} → {len(nodes_merged)})")

    # Update data
    data["nodes"] = nodes_merged
    data["edges"] = edges_merged
    if "metadata" in data:
        data["metadata"]["total_nodes"] = len(nodes_merged)
        data["metadata"]["total_edges"] = len(edges_merged)

    with open(json_path, "w") as f:
        json.dump(data, f, indent=2)

    with open(csv_path, "w") as f:
        f.write("source,target,weight\n")
        for e in edges_merged:
            f.write(f'{e["source"]},{e["target"]},{e["weight"]}\n')

    print(f"Final: {len(nodes_merged)} nodes, {len(edges_merged)} edges")
    return 0


if __name__ == "__main__":
    exit(main())
