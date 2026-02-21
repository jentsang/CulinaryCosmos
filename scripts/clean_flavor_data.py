#!/usr/bin/env python3
"""
Filter junk/non-ingredient nodes from flavor_pairings.json.
Removes phrases, cuisine types, and other non-food items.
"""

import json
import re
from pathlib import Path

# Substring patterns - node is removed if ANY of these appear in its id (lowercase)
BLOCKLIST = {
    # Descriptive phrases (not ingredients)
    "also called for",
    "also known as",
    "along with",
    "and a ",
    "and add ",
    "and after ",
    "and almost ",
    "and almonds at chef",
    "and amaretti",
    "and anchovies",
    "and apple cider",
    "and artichoke puree",
    "and avocado in a",
    "and bacon and eggs",
    "and barolo",
    "and belgian endive",
    "and blood orange",
    "and bourbon",
    "and brown butter",
    "and burning",
    "and cabernet",
    "and candied",
    "and cauliflower puree",
    "and chanterelles",
    "and cheese sauces",
    "and chicory emulsion",
    "and chiles. i",
    "and chive",
    "and cilantro",
    "and clove works",
    "and coulis",
    "and country bread",
    "and crisp",
    "and currant",
    "and delicate",
    "and diced",
    "and doing something",
    "and drizzled",
    "and dungeness crab risotto",
    "and edamame with",
    "and egg salad",
    "and epazote",
    "and extra-virgin",
    "and fatty",
    "and fava bean puree",
    "and foie gras",
    "and fried",
    "and garlic",
    "and garrotxa",
    "and gets a note",
    "and ginger vinaigrette",
    "and giving body",
    "and green apple",
    "and green chile",
    "and herb",
    "and honey mushrooms",
    "and horseradish",
    "and hot chiles",
    "and i agree",
    "and i also use",
    "and it became",
    "and it has a",
    "and it was good",
    "and jams",
    "and kale braised",
    "and keep the",
    "and lavender",
    "and lemon",
    "and let the",
    "and letting it",
    "and lightly",
    "and lobster",
    "and make a salad",
    "and mandarin",
    "and maple-sherry",
    "and marcona",
    "and mascarpone",
    "and meat-based",
    "and mint;",
    "and niçoise",
    "and olive oil and",
    "and one guindilla",
    "and one reason",
    "and one that is",
    "and onion",
    "and onions",
    "and orange blossom",
    "and other hard",
    "and parmesan",
    "and parmigiano",
    "and parsley",
    "and pedro",
    "and pepper",
    "and peruvian",
    "and pine nuts",
    "and pistachios",
    "and port",
    "and potatoes",
    "and preferably",
    "and preserved",
    "and pure luck",
    "and ramps",
    "and red mustard",
    "and red wine",
    "and saba",
    "and salad dressings",
    "and salt",
    "and shaved",
    "and slicing",
    "and smoked",
    "and spanish",
    "and spicy",
    "and squash with",
    "and star anise",
    "and stuffed",
    "and sweetness",
    "and tarragon",
    "and tempura",
    "and texture",
    "and the big",
    "and the dish",
    "and the flavor",
    "and the meat",
    "and the next",
    "and then add",
    "and then just",
    "and then the",
    "and there's",
    "and they want",
    "and thyme",
    "and to cover",
    "and tomato sauce",
    "and toss",
    "and truffle",
    "we make a ",
    "we make ",
    "all kinds of vegetables",
    "always tend to be",
    "restaurant",
    "chef's",
    "chef ",
    # Instruction/descriptive phrases (not ingredients)
    "for morel",
    "buying and cleaning",
    "scoop out the",
    "from the cheese",
    "from the ham",
    "from the pig",
    "putting the fish",
    "then the corn",
    "as flour", "as mustard seeds", "assertive fish like", "asparagus soup:",
}

# Regex patterns - node is removed if it matches
BLOCKLIST_REGEX = [
    r"^and\s",            # starts with "and " (and pasilla, and red)
    r"^and/or\s",         # "and/or dried sweet"
    r"^and$",             # just "and"
    r"^along with",      # "along with X"
    r"^also ",            # "also called", "also known"
    r"\salso\s",          # "as they are also known", "who also loved"
    r"^the ",            # "the dish", etc.
    r"^that ", r"^this ",
    r"^if i\b", r"^when ", r"^because ",
    r"^but\s", r"^good\s", r"^in small",
    r"^or\s",            # "or whatever", "or butter", "or curry powder" - phrase fragment
    r"^or honey", r"^on me ",
    r"^a\s",           # "a dish", "a cake" - phrase
    r"^an\s",
    r"^for\s",           # "for morel mushrooms", "for poultry" - instruction, not ingredient
    r"^as\s",            # "as flour", "as mustard seeds" - phrase fragment
    r"\s+and\s+",        # "buying and cleaning mushrooms", "salt and pepper" - phrase or multi-item
    r"\s+the\s+",        # "scoop out the mushrooms", "in the shell" - phrase
    r"\s+or\s+",         # "X or Y" - alternative, not single ingredient (catches any " or ")
    r"\s(cuisine|cuisines)\s*$",  # ends with "cuisine" - e.g. "alsatian cuisine"
    r"^cuisine$",       # just "cuisine"
    r"^\d",              # starts with digit
    r"percent", r"part salt", r"part sugar",
    r"\.\s+[a-z]",       # sentence fragment (period followed by lowercase)
    r"!$", r"\?$",       # ends with ! or ?
]


def should_remove(node_id: str) -> bool:
    """Return True if this node should be removed."""
    lower = node_id.lower().strip()

    # Too short
    if len(lower) < 3:
        return True

    # Too long (likely descriptive text)
    if len(lower) > 50:
        return True

    # Blocklist substrings
    if any(bl in lower for bl in BLOCKLIST):
        return True

    # Blocklist regex
    if any(re.search(pat, lower) for pat in BLOCKLIST_REGEX):
        return True

    # Cuisine types: "X cuisine" where X is a region/place
    if lower.endswith(" cuisine") or lower.endswith(" cuisines"):
        return True

    # Sentence-like (contains "we ", "who ", "as they ", etc.)
    if re.search(r"\b(we|who|as they|it is|that is)\s+(also|are|make|loved)", lower):
        return True

    # Standalone non-food words
    non_food = {
        "alabama", "alinea", "alcohol", "acidity", "aged", "alsatian",
        "adnews", "acknowledgments", "acquiring", "achieve", "adding",
        "after a", "about the", "aka tagines", "it",
        "bell", "blood",  # fragments (bell pepper, blood orange)
    }
    if lower in non_food:
        return True

    return False


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

    # Find nodes to keep
    keep_ids = {n["id"] for n in nodes if not should_remove(n["id"])}
    removed_ids = {n["id"] for n in nodes if n["id"] not in keep_ids}

    # Filter nodes
    nodes_clean = [n for n in nodes if n["id"] in keep_ids]

    # Filter edges
    edges_clean = [
        e for e in edges
        if e["source"] in keep_ids and e["target"] in keep_ids
    ]

    # Update data
    data["nodes"] = nodes_clean
    data["edges"] = edges_clean

    # Update metadata
    if "metadata" in data:
        data["metadata"]["total_nodes"] = len(nodes_clean)
        data["metadata"]["total_edges"] = len(edges_clean)

    with open(json_path, "w") as f:
        json.dump(data, f, indent=2)

    # Regenerate CSV
    with open(csv_path, "w") as f:
        f.write("source,target,weight\n")
        for e in edges_clean:
            w = e.get("weight", 1)
            f.write(f'{e["source"]},{e["target"]},{w}\n')

    print(f"Removed {len(removed_ids)} junk nodes")
    print(f"Kept {len(nodes_clean)} nodes, {len(edges_clean)} edges")
    print(f"Sample removed: {list(removed_ids)[:15]}")
    return 0


if __name__ == "__main__":
    exit(main())
