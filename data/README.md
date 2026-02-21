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

## Regenerating the Dataset

```bash
# From project root, with venv activated:
.venv/bin/python scripts/extract_flavor_pairings.py
```

Requires: `pdfplumber` (see `scripts/requirements.txt`).
