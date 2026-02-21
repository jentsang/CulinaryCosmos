#!/usr/bin/env python3
"""
1. Remove isolated nodes (no edges)
2. Filter out non-food items (serve, seedless, etc.)
"""

import json
import re
from pathlib import Path

# Standalone non-food words (verbs, adjectives, concepts, etc.)
NON_FOOD_WORDS = {
    "serve", "served", "serving", "seedless", "back", "ask", "avoid",
    "balance", "baking", "autumn", "august", "fall", "spring", "winter",
    "summer", "example", "around", "artificial", "artisanal", "aroma",
    "astringency", "bitter", "bitterness", "sweetness", "acidity",
    "beverages", "dishes", "appetizers", "desserts", "cuisines",
    "cooked", "raw", "fermented", "broiled", "barbecued", "grilled",
    "minced", "chopped", "sliced", "diced", "ground", "whole",
    "baby", "adult", "fresh", "dried", "canned", "frozen",
    "avoid", "use", "try", "add", "adds", "ask", "back",
    "belly", "flakes", "balm", "cress", "european", "arizona",
    "asiate", "babbo", "barbate", "berkswell", "azeitao",
    "august", "balance", "baking", "barbecue", "barbecued",
    "bitter", "bitterness", "bitters", "black", "white", "red",
    "green", "yellow", "brown", "light", "dark", "heavy",
    "artificial", "natural", "organic", "conventional",
    "around", "the", "world", "example", "avoid", "see",
    "ingredient", "ingredients", "method", "technique",
    "dishes", "foods", "dishes", "appetizers", "desserts",
    "breakfast", "lunch", "dinner", "snack", "meal",
    "crust", "crusts", "sauce", "sauces", "rub", "rubs",
    "powder", "starch", "thickener",
    "fall", "spring", "winter", "summer", "season", "seasons",
    "august", "september", "october", "november", "december",
    "january", "february", "march", "april", "may", "june", "july",
    "but", "catalogs", "color", "other", "then", "which", "with", "you",
    "many", "most", "first", "done", "off", "half", "good", "nice",
    "rich", "hot", "cold", "warm", "cooling", "warming", "refreshing",
    "ripe", "unripe", "young", "old", "new", "soft", "hard", "dry",
    "wet", "fatty", "lean", "mild", "strong", "sweet", "sour", "salty",
    "bitter", "umami", "texture", "heat", "crunch", "crunchy", "flaky",
    "velvety", "greasy", "grainy", "luxurious", "heartier", "meatier",
    "fattier", "lighter", "stronger", "sweeter", "deeper", "deeper flavor",
}

# Substring patterns - node contains these and is not a food
NON_FOOD_SUBSTRINGS = {
    " as a ", " as crust", " as dessert", " see ", " see also",
    " dishes", " foods", " appetizers", " cuisines", " beverages",
    "ingredient", "method", " to ", " for granted", " and other ",
    " and/or ", "brined first", "for braising", "for poultry", "for sushi",
    "café ", "cafe ", " bistro", " restaurant", " grill", " room",
    " washington", " vienna", " hoboken", " brasserie", " eat place",
    " he said", " i like", " i recently", " i use the", " which i",
    " which is", " which makes", " which means", " which produce",
    " which they", " which adds", " we tasted", " you can", " you wouldn't",
    " then add", " then wipe", " throw it out", " to finish this",
    " have two favorite", " knew it", " of course", " in terms of",
    " so many childhood", " spread them out", " used the husks",
    " using smoked salt", " virtually all", " wash greens",
    " while in large", " your life", "—david", "— ",
}

# Place names (US states, cities, countries when standalone)
PLACE_NAMES = {
    "alabama", "arizona", "california", "florida", "idaho", "massachusetts",
    "new jersey", "new york", "oregon", "sonoma", "vermont", "virginia",
    "washington", "rome", "japan", "spain", "france", "tuscan", "venetian",
    "new england", "southern", "northern", "eastern", "peking", "szechuan",
    "boston", "pocantico",
}

# Restaurant/cafe names (often appear in chef quotes)
RESTAURANT_PATTERNS = (
    "café boulud", "café annie", "café gray", "café juanita",
    "le bernardin", "union square café", "eleven madison park",
    "daniel", "nobu", "jean georges", "charlie trotter",
    "felidia", "san domenico", "frontera grill", "topolobampo",
    "everest", "farallon", "gary danko", "gilt", "imperial fez",
    "kinkead", "la côte brasserie", "locke-ober", "monday room",
    "naha", "osteria mozza", "payard", "rover's", "sanford",
    "trade lake", "t'afia", "tía pol", "veritas", "vij's",
    "zuni café", "zafra", "cucharamama", "brasserie jo",
    "colvin run", "citronelle", "esca", "hook", "cashion",
)

# Exact non-food phrases (multi-word)
NON_FOOD_PHRASES = {
    "around the world", "as a kid", "as a crust", "as crust",
    "as dessert", "as fruit crystals to", "autumn and dried",
    "barbecue dishes", "barbecued foods", "bitter / winter",
    "black or kalamata", "black or kidney", "black or red",
    "broiled dishes", "calf's liver see liver", "cook al dente",
    "cooked and raw", "fines herbes ingredient", "fruits and fruit sauces",
    "goat / sheep cheese", "green pasta", "guindilla or piquillo",
    "ice wine wine", "or bomba", "or carnaroli", "or piquillo",
    "or raisins", "or roasted", "or stinky", "see also",
    "serve", "seedless", "baby round", "café con leche",
    "blueberries for the summer", "name of the dish", "it a deep",
    "it's their smell", "which adds color", "fresh shell",
    " and will", "of all vegetables", "of the brine", "of course",
    "fruits and fruit juices", "vegetables and root vegetables",
    "vegetables and vegetable juices", "meats and meat loaf",
    "some high-fiber vitamin", "some water", "so many childhood",
    "sour notes enhance bitterness", "to finish this dish",
    "then wipe off the", "these short", "used the husks",
    "using smoked salt provides", "virtually all vegetables",
    "was seared well", "we tasted it", "which i pair with",
    "which produce a juice", "which they added to",
    "while in large doses", "you wouldn't", "your life",
}


def is_food_item(node_id: str) -> bool:
    """Return False if this is not an actual food/ingredient."""
    lower = node_id.lower().strip()

    # Exact match non-food
    if lower in NON_FOOD_WORDS or lower in NON_FOOD_PHRASES:
        return False

    # Place names (standalone)
    if lower in PLACE_NAMES:
        return False

    # Restaurant/cafe names
    if any(r in lower for r in RESTAURANT_PATTERNS):
        return False

    # Single word in blocklist
    words = lower.split()
    if len(words) == 1 and lower in NON_FOOD_WORDS:
        return False

    # Contains non-food phrase
    if any(phrase in lower for phrase in NON_FOOD_PHRASES):
        return False

    # Contains non-food substring
    if any(sub in lower for sub in NON_FOOD_SUBSTRINGS):
        return False

    # "X or Y" / "X / Y" - multi-item, not single food
    if " or " in lower or " / " in lower:
        return False

    # "see " - cross-reference
    if " see " in lower or lower.startswith("see "):
        return False

    # " as a " - phrase
    if " as a " in lower or " as " in lower and " as crust" in lower:
        return False

    # Starts with "and " or "and/or" - phrase fragment
    if lower.startswith("and ") or lower.startswith("and/or"):
        return False

    # Too short
    if len(lower) < 3:
        return False

    # Standalone descriptors (not food names)
    if lower in ("baby", "back", "balm", "belly", "bitter", "black",
                 "brown", "dark", "light", "red", "green", "white",
                 "yellow", "heavy", "fall", "spring", "summer", "winter"):
        return False

    return True


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

    # Build set of node IDs that have at least one edge
    connected_ids = set()
    for e in edges:
        connected_ids.add(e["source"])
        connected_ids.add(e["target"])

    # Step 1: Remove isolated nodes
    nodes_with_edges = [n for n in nodes if n["id"] in connected_ids]
    isolated_count = len(nodes) - len(nodes_with_edges)
    print(f"Removed {isolated_count} isolated nodes (no edges)")

    # Step 2: Filter non-food items
    food_ids = {n["id"] for n in nodes_with_edges if is_food_item(n["id"])}
    nodes_food = [n for n in nodes_with_edges if n["id"] in food_ids]
    non_food_removed = len(nodes_with_edges) - len(nodes_food)
    print(f"Removed {non_food_removed} non-food items")

    # Filter edges to only include food nodes
    edges_food = [
        e for e in edges
        if e["source"] in food_ids and e["target"] in food_ids
    ]

    # Re-check: any nodes now isolated after filtering?
    connected_after = set()
    for e in edges_food:
        connected_after.add(e["source"])
        connected_after.add(e["target"])
    nodes_final = [n for n in nodes_food if n["id"] in connected_after]

    data["nodes"] = nodes_final
    data["edges"] = edges_food
    if "metadata" in data:
        data["metadata"]["total_nodes"] = len(nodes_final)
        data["metadata"]["total_edges"] = len(edges_food)

    with open(json_path, "w") as f:
        json.dump(data, f, indent=2)

    with open(csv_path, "w") as f:
        f.write("source,target,weight\n")
        for e in edges_food:
            w = e.get("weight", 1)
            f.write(f'{e["source"]},{e["target"]},{w}\n')

    print(f"Final: {len(nodes_final)} nodes, {len(edges_food)} edges")
    return 0


if __name__ == "__main__":
    exit(main())
