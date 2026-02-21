#!/usr/bin/env python3
"""
Categorize ingredients in the flavour pairings dataset for graph colouring and UI filtering.
Adds a `category` field to each node.
"""

import json
import re
from pathlib import Path
from typing import Optional

# Category definitions - order matters (first match wins)
# Format: (category_id, display_name, keyword_patterns)
CATEGORIES = [
    ("cuisine", "Cuisine & Region", [
        "cuisine", "cooking", "european", "asian", "american", "french", "italian",
        "mexican", "indian", "chinese", "japanese", "thai", "mediterranean",
        "african", "afghan", "middle eastern", "latin american", "cajun", "creole",
        "alsatian", "belgian", "canadian", "cuban", "ethiopian", "greek", "hungarian",
        "moroccan", "spanish", "turkish", "vietnamese", "west indian"
    ]),
    ("meat_poultry", "Meat & Poultry", [
        "beef", "veal", "lamb", "pork", "bacon", "ham", "prosciutto", "pancetta",
        "chicken", "turkey", "duck", "goose", "quail", "game", "venison",
        "rabbit", "goat", "bison", "oxtail", "sausage", "chorizo", "speck",
        "foie gras", "guanciale", "lardo", "andouille", "short ribs", "sirloin",
        "filet mignon", "tenderloin", "liver", "marrow", "offal", "squab",
        "guinea fowl", "pheasant", "boar", "bratwurst", "kielbasa", "merguez",
        "sopressata", "salami", "pastrami", "charcuterie", "salumi"
    ]),
    ("seafood", "Seafood & Fish", [
        "fish", "salmon", "tuna", "cod", "halibut", "bass", "trout", "mackerel",
        "sardine", "anchov", "shrimp", "prawn", "lobster", "crab", "scallop",
        "clam", "mussel", "oyster", "squid", "octopus", "caviar", "roe",
        "shellfish", "seafood", "dungeness", "haddie", "eel", "haddock",
        "flounder", "fluke", "grouper", "herring", "langoustine", "calamari",
        "snapper", "sole", "turbot", "skate", "pike", "shad", "sea urchin",
        "bottarga", "gravlax", "bonito", "kelp", "nori", "seaweed", "konbu"
    ]),
    ("dairy_cheese", "Dairy & Cheese", [
        "cheese", "cream", "butter", "milk", "yogurt", "yoghurt", "ricotta",
        "mozzarella", "parmesan", "parmigiano", "cheddar", "gouda", "brie",
        "feta", "goat cheese", "blue cheese", "gruyère", "fontina", "pecorino",
        "mascarpone", "fromage", "crème fraîche", "sour cream", "cottage cheese",
        "asiago", "burrata", "camembert", "comté", "cotija", "havarti", "manchego",
        "roquefort", "stilton", "gorgonzola", "cambozola", "raclette", "chèvre",
        "queso fresco", "emmental", "colby", "monterey jack", "dry jack",
        "explorateur", "mahon", "piave", "picholine", "roncal", "teleme",
        "valdeon", "zamorano", "époisses", "brin d'amour", "egg", "eggs",
        "egg yolk", "egg white", "half-and-half", "whey", "crème fraîche"
    ]),
    ("vegetables", "Vegetables", [
        "tomato", "onion", "garlic", "shallot", "leek", "potato", "carrot",
        "celery", "broccoli", "cauliflower", "spinach", "kale", "chard",
        "arugula", "lettuce", "cabbage", "brussels", "asparagus", "artichoke",
        "eggplant", "zucchini", "squash", "pumpkin", "beet", "radish",
        "turnip", "parsnip", "fennel", "mushroom", "bell pepper",
        "chicory", "endive", "watercress", "bok choy", "daikon", "jícama",
        "horseradish", "truffle", "corn", "pea", "green bean", "okra",
        "ramp", "sunchoke", "cipollini", "chayote", "kohlrabi", "rutabaga",
        "bitter greens", "baby greens", "dandelion", "escarole", "frisée",
        "mâche", "mesclun", "radicchio", "romaine", "iceberg", "bibb",
        "sprouts", "fiddlehead", "enoki", "cremini", "shiitake", "porcini",
        "morel", "chanterelle", "cepes", "nettles", "purslane", "sorrel",
        "lotus root", "salsify", "collard", "haricot vert", "cucumber"
    ]),
    ("herbs_spices", "Herbs & Spices", [
        "basil", "oregano", "thyme", "rosemary", "sage", "mint", "parsley",
        "cilantro", "coriander", "dill", "tarragon", "bay leaf", "marjoram",
        "chives", "chive", "chervil", "epazote", "lemongrass", "shiso", "curry leaf",
        "cumin", "cinnamon", "clove", "nutmeg", "allspice", "ginger", "turmeric",
        "paprika", "saffron", "cardamom", "vanilla", "pepper", "chile", "chili",
        "ancho", "chipotle", "cayenne", "mustard", "fenugreek", "sumac",
        "achiote", "annatto", "juniper", "star anise", "fennel seed", "caraway",
        "angelica", "anise", "hyssop", "lavender", "lovage", "borage", "verbena",
        "galangal", "kaffir", "herbes de provence", "fines herbes", "poppy seed",
        "guajillo", "serrano", "jalapeño", "poblano", "piquillo", "anaheim",
        "old bay", "ras el hanout", "garam masala", "quatre épices", "five-spice"
    ]),
    ("fruits", "Fruits", [
        "apple", "pear", "peach", "plum", "apricot", "cherry", "berry",
        "strawberry", "raspberry", "blackberry", "blueberry", "cranberry",
        "citrus", "lemon", "lime", "orange", "grapefruit", "tangerine",
        "mango", "pineapple", "banana", "coconut", "fig", "date", "prune",
        "grape", "melon", "watermelon", "cantaloupe", "persimmon", "pomegranate",
        "quince", "kiwi", "passion fruit", "lychee", "kumquat", "currant",
        "rhubarb", "cassis", "elderberry", "gooseberry", "tamarind",
        "avocado", "papaya", "guava", "loquat", "pomelo", "citron", "yuzu",
        "mandarin", "clementine", "blood orange", "boysenberry", "huckleberry",
        "nectarine", "plantain", "medjool", "raisin", "dried fruit",
        "olive", "capers", "caperberries"
    ]),
    ("legumes", "Legumes & Beans", [
        "bean", "lentil", "chickpea", "pea", "black-eyed", "edamame",
        "flageolet", "navy bean", "cannellini", "fava", "hummus", "cannelini",
        "lima", "kidney", "haricot"
    ]),
    ("grains_starches", "Grains & Starches", [
        "rice", "pasta", "noodle", "bread", "flour", "polenta", "couscous",
        "quinoa", "barley", "bulgur", "farro", "millet", "oats", "grits",
        "phyllo", "wonton", "dumpling", "risotto", "tortilla", "pita",
        "bagel", "bagels", "blini", "focaccia", "naan", "pumpernickel",
        "arborio", "basmati", "bomba", "carnaroli", "jasmine rice",
        "gnocchi", "ravioli", "tortellini", "fettuccine", "vermicelli",
        "hominy", "tapioca", "arrowroot"
    ]),
    ("nuts_seeds", "Nuts & Seeds", [
        "almond", "walnut", "pecan", "pistachio", "hazelnut", "cashew",
        "pine nut", "peanut", "sesame", "sunflower", "pumpkin seed",
        "macadamia", "marcona", "chestnut", "ginkgo", "gingko", "hickory"
    ]),
    ("oils_vinegars", "Oils & Vinegars", [
        "olive oil", "oil:", "vinegar", "balsamic", "sherry vinegar",
        "rice vinegar", "cider vinegar", "red wine vinegar", "canola",
        "sesame oil", "peanut oil", "truffle oil", "walnut oil",
        "avocado oil", "safflower oil", "porcini oil", "yucatán oil"
    ]),
    ("sauces_condiments", "Sauces & Condiments", [
        "sauce", "soy sauce", "fish sauce", "worcestershire", "hot sauce",
        "mustard", "mayonnaise", "aioli", "pesto", "mole", "salsa",
        "chutney", "relish", "ponzu", "tahini", "harissa", "sambal",
        "dashi", "stock", "broth", "glaze", "reduction", "jus",
        "béarnaise", "bordelaise", "hollandaise", "mornay", "romesco",
        "tapenade", "tapanade", "gremolata", "mostarda", "ketchup",
        "tamari", "mirin", "miso", "teriyaki", "jerk seasoning"
    ]),
    ("beverages", "Beverages", [
        "wine", "beer", "ale", "spirits", "brandy", "whiskey", "bourbon",
        "rum", "vodka", "tequila", "sherry", "port", "vermouth", "liqueur",
        "champagne", "cider", "coffee", "tea", "espresso", "amaretto",
        "calvados", "armagnac", "cognac", "kirsch", "framboise",
        "cabernet", "merlot", "pinot noir", "riesling", "sauvignon blanc",
        "chardonnay", "barolo", "beaujolais", "chianti", "prosecco",
        "sake", "gin", "campari", "chartreuse", "pernod", "cachuca",
        "coca-cola", "soda", "aquavit", "schnapps", "grappa", "madeira",
        "marsala", "sauternes", "vin santo", "curaçao", "grand marnier",
        "cointreau", "frangelico", "kahlúa", "sambuca", "triple sec"
    ]),
    ("sweets_desserts", "Sweets & Desserts", [
        "chocolate", "sugar", "honey", "maple", "molasses", "caramel",
        "ice cream", "sorbet", "granita", "custard", "crème", "mousse",
        "cookie", "biscuit", "pastry", "cake", "pie", "tart", "compote",
        "jam", "jelly", "marmalade", "syrup", "grenadine",
        "cocoa", "candy", "candies", "brittle", "praline", "toffee",
        "dulce de leche", "fudge", "marshmallow", "panforte",
        "doughnut", "muffin", "scone", "biscotti", "ladyfinger"
    ]),
    ("techniques_dishes", "Techniques & Dish Types", [
        "braised", "grilled", "roasted", "baked", "fried", "sautéed",
        "stew", "soup", "salad", "risotto", "kebab", "tagine", "curry",
        "stir-fry", "tempura", "carpaccio", "ceviche", "terrine",
        "gazpacho", "borscht", "chowder", "paella", "falafel", "gumbo",
        "dim sum", "sushi", "sashimi", "biryani", "pilaf", "succotash"
    ]),
    ("other", "Other", []),  # Fallback
]

# Manual overrides for ambiguous ingredients (checked first)
OVERRIDES = {
    "bell pepper": "vegetables",
    "bell peppers": "vegetables",
    "bell peppers: green": "vegetables",
    "chile peppers": "herbs_spices",
    "chile peppers: habanero": "herbs_spices",
    "black pepper": "herbs_spices",
    "white pepper": "herbs_spices",
    "pepper: black": "herbs_spices",
}

# Keywords that indicate "other" (junk, phrases, non-ingredients)
OTHER_PATTERNS = [
    r"^and\s", r"^along with", r"^also ", r"^always ", r"^because ",
    r"^but\s", r"^good\s", r"^in small", r"^on me ", r"^or honey",
    r"^the ", r"^when ", r"^if i\b", r"^that ", r"^this ",
    r"restaurant\s*$", r"\schef\s",  # exclude "american restaurant" but keep "cuisine"
    r"^\d", r"percent", r"part salt", r"part sugar",
]


def get_category(ingredient: str) -> str:
    """Assign a category to an ingredient. Returns category id."""
    lower = ingredient.lower().strip()

    # Check manual overrides first
    for key, cat in OVERRIDES.items():
        if key in lower or lower in key:
            return cat

    # Check for "other" patterns
    for pat in OTHER_PATTERNS:
        if re.search(pat, lower):
            return "other"

    # Check category keyword patterns (whole-word or as part of ingredient name)
    for cat_id, _display, keywords in CATEGORIES:
        if cat_id == "other":
            continue
        for kw in keywords:
            # Match whole word or as substring for compound names (e.g. "olive oil")
            if kw in lower:
                # Avoid false positives: "cheese" in "cheese sauce" -> sauces
                # "pepper" is tricky - bell pepper vs black pepper
                if cat_id == "herbs_spices" and "bell pepper" in lower and "pepper" in kw:
                    continue  # bell pepper -> vegetables
                if cat_id == "vegetables" and "ginger" in kw and "ginger" in lower:
                    # ginger root -> vegetable, ginger spice -> herbs_spices
                    if "root" in lower or "fresh" in lower:
                        return "vegetables"
                return cat_id

    return "other"


def main():
    project_root = Path(__file__).resolve().parent.parent
    json_path = project_root / "data" / "flavor_pairings.json"

    if not json_path.exists():
        print(f"Error: {json_path} not found")
        return 1

    with open(json_path) as f:
        data = json.load(f)

    # Build category list for UI (id -> display name)
    category_list = [
        {"id": cat_id, "label": label}
        for cat_id, label, _ in CATEGORIES
    ]

    # Assign category to each node
    counts = {}
    for node in data["nodes"]:
        cat = get_category(node["id"])
        node["category"] = cat
        counts[cat] = counts.get(cat, 0) + 1

    # Add categories to metadata for UI filter dropdown
    data["metadata"]["categories"] = category_list
    data["metadata"]["category_counts"] = counts

    with open(json_path, "w") as f:
        json.dump(data, f, indent=2)

    print("Categorized", len(data["nodes"]), "nodes")
    for cat_id, label, _ in CATEGORIES:
        n = counts.get(cat_id, 0)
        if n > 0:
            print(f"  {cat_id}: {n} ({label})")

    return 0


if __name__ == "__main__":
    exit(main())
