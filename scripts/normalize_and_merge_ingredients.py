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


def expand_comma_to_canonicals(name: str) -> list[str]:
    """
    Expand comma-separated items to canonical forms. Returns a list of 1+ canonical names.
    E.g. "chocolate, dark, milk" -> ["dark chocolate", "milk chocolate"]
    """
    lower = name.lower().strip()
    if ", " not in lower:
        return [normalize_to_canonical(lower)]

    parts = [p.strip() for p in lower.split(", ")]
    base = parts[0]
    variants = parts[1:]

    # "chocolate, dark, milk" -> ["dark chocolate", "milk chocolate"]
    if base == "chocolate" and len(variants) >= 2:
        return [f"{v} chocolate" for v in variants]

    # Single variant: use normalize_to_canonical
    return [normalize_to_canonical(name)]


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
        # "balsamic, aged vinegar" → "aged balsamic vinegar"
        if a == "balsamic" and "vinegar" in b:
            return f"{b} {a}"
        # "pepper, black/white" → "black pepper" / "white pepper"
        if a == "pepper" and b in ("black", "white"):
            return f"{b} pepper"
        # "cream, heavy" → "heavy cream"
        if a == "cream" and b:
            return f"{b} cream"
        # "chicken, roasted" → "roasted chicken"
        if a == "chicken" and b:
            return f"{b} chicken"
        # "crab, soft-shell" → "soft-shell crab"
        if a == "crab" and b:
            return f"{b} crab"
        # "chocolate, white" → "white chocolate"
        if a == "chocolate" and b:
            return f"{b} chocolate"
        # "ham, X" → "X ham"
        if a == "ham" and b:
            return f"{b} ham"
        # "honey, X" → "X honey"
        if a == "honey" and b:
            return f"{b} honey"
        # "lamb, chops" → "lamb chops"
        if a == "lamb" and b:
            return f"{a} {b}" if b in ("chops", "shank") else f"{b} {a}"
        # "lemon, juice" / "lime, juice" → "lemon juice" / "lime juice"
        if a in ("lemon", "lime", "orange") and b == "juice":
            return f"{a} juice"
        # "lettuce, romaine" → "romaine lettuce"
        if a == "lettuce" and b:
            return f"{b} lettuce"
        # "liver, X" → "X liver"
        if a == "liver" and b:
            return f"{b} liver"
        # "mint, peppermint" → "peppermint"
        if a == "mint" and b == "peppermint":
            return "peppermint"
        if a == "mint" and b:
            return f"{b} mint"
        # "mustard, dijon" → "dijon mustard"
        if a == "mustard" and b:
            return f"{b} mustard"
        # "paprika, smoked" → "smoked paprika"
        if a == "paprika" and b:
            return f"{b} paprika"
        # "parsley, flat-leaf" → "flat-leaf parsley"
        if a == "parsley" and b:
            return f"{b} parsley"
        # "rice, X" → "X rice"
        if a == "rice" and b:
            return f"{b} rice"
        # "salmon, X" / "trout, X" → "X salmon" / "X trout"
        if a in ("salmon", "trout") and b:
            return f"{b} {a}"
        # "salt, X" → "X salt"
        if a == "salt" and b:
            return f"{b} salt" if " " not in b else b
        # "savory, summer" → "summer savory"
        if a == "savory" and b:
            return f"{b} savory"
        # "stock, chicken" → "chicken stock"
        if a == "stock" and b:
            return f"{b} stock"
        # "sugar, X" → "X sugar"
        if a == "sugar" and b:
            return f"{b} sugar"
        # "wine, X" → "X wine"
        if a == "wine" and b:
            return f"{b} wine"
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
        # Generic "X, Y" -> "Y X" (e.g. "mint, northeast africa" -> "northeast africa mint")
        return f"{b} {a}"

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

    # Step 2: Build canonical mapping (original_id → list of canonical_ids)
    # Comma-separated items like "chocolate, dark, milk" expand to multiple canonicals
    id_to_canonicals = {}
    for n in nodes_filtered:
        orig = n["id"]
        # Keep "apricot brandy" etc. as distinct (compound products)
        if " brandy" in orig or " liqueur" in orig or " wine" in orig or " vinegar" in orig:
            canon = normalize_to_canonical(orig)
            if orig != canon and canon in ("apricot", "cherry", "orange", "peach"):
                id_to_canonicals[orig] = [orig]
                continue
        id_to_canonicals[orig] = expand_comma_to_canonicals(orig)

    # Step 3: Merge nodes - collect all canonical ids (split items may create new nodes)
    canon_to_node = {}
    for n in nodes_filtered:
        for canon in id_to_canonicals[n["id"]]:
            if canon not in canon_to_node:
                canon_to_node[canon] = {"id": canon, "label": canon, "category": n.get("category", "other")}

    # Step 4: Remap edges - expand to all canonical pairs, deduplicate
    edge_data = {}  # key -> (weight, recommendation_level)
    for e in edges_filtered:
        src_canons = id_to_canonicals.get(e["source"], [e["source"]])
        tgt_canons = id_to_canonicals.get(e["target"], [e["target"]])
        w = e.get("weight", 1)
        rec = e.get("recommendation_level", 1)
        for src in src_canons:
            for tgt in tgt_canons:
                if src != tgt and src in canon_to_node and tgt in canon_to_node:
                    key = (min(src, tgt), max(src, tgt))
                    prev = edge_data.get(key, (0, 0))
                    edge_data[key] = (max(prev[0], w), max(prev[1], rec))

    edges_merged = [
        {"source": k[0], "target": k[1], "weight": v[0], "recommendation_level": v[1]}
        for (k, v) in edge_data.items()
    ]

    nodes_merged = list(canon_to_node.values())
    delta = len(nodes_merged) - len(nodes_filtered)
    if delta < 0:
        print(f"Merged {-delta} similar nodes ({len(nodes_filtered)} → {len(nodes_merged)})")
    else:
        print(f"Normalized/split comma items: {len(nodes_filtered)} → {len(nodes_merged)} nodes")

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
