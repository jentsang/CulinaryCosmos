# Flavour Network Data

## Source

Extracted from **The Flavor Bible** (Dornenburg & Page, 2008) — `Flavor-Bible-epub.pdf`.

## Files

| File | Format | Description |
|------|--------|-------------|
| `flavor_pairings.json` | JSON | Graph-ready format with `nodes` and `edges` for visualization |
| `flavor_pairings.csv` | CSV | Simple edge list: `source,target,weight` |

## Dataset Structure

### JSON (`flavor_pairings.json`)

```json
{
  "nodes": [{"id": "garlic", "label": "garlic"}, ...],
  "edges": [
    {"source": "garlic", "target": "basil", "weight": 1},
    {"source": "garlic", "target": "tomatoes", "weight": 2, "from_affinity": true}
  ],
  "metadata": {
    "source": "The Flavor Bible (Dornenburg & Page, 2008)",
    "total_nodes": 3738,
    "total_edges": 23328,
    "affinity_edges": ...
  }
}
```

- **weight**: 1 = general pairing, 2 = from "Flavor Affinities" (expert-recommended combinations)
- **from_affinity**: present when the pairing comes from an explicit Flavor Affinities line

### CSV (`flavor_pairings.csv`)

```
source,target,weight
garlic,basil,1
garlic,tomatoes,2
...
```

## Node Categories

Each node has a `category` field for graph colouring and UI filtering. Categories are in `metadata.categories`:

| ID | Label |
|----|-------|
| cuisine | Cuisine & Region |
| meat_poultry | Meat & Poultry |
| seafood | Seafood & Fish |
| dairy_cheese | Dairy & Cheese |
| vegetables | Vegetables |
| herbs_spices | Herbs & Spices |
| fruits | Fruits |
| legumes | Legumes & Beans |
| grains_starches | Grains & Starches |
| nuts_seeds | Nuts & Seeds |
| oils_vinegars | Oils & Vinegars |
| sauces_condiments | Sauces & Condiments |
| beverages | Beverages |
| sweets_desserts | Sweets & Desserts |
| techniques_dishes | Techniques & Dish Types |
| other | Other |

`metadata.category_counts` has the count per category for filter UI.

## Regenerating the Dataset

```bash
# 1. Extract from PDF
.venv/bin/python scripts/extract_flavor_pairings.py

# 2. Clean junk nodes (phrases, cuisines, non-ingredients)
.venv/bin/python scripts/clean_flavor_data.py

# 3. Normalize & merge similar ingredients (apricots/dried apricots → apricot)
.venv/bin/python scripts/normalize_and_merge_ingredients.py

# 4. Add categories (for colouring & filtering)
.venv/bin/python scripts/categorize_ingredients.py
```

Requires: `pdfplumber` (see `scripts/requirements.txt`).
