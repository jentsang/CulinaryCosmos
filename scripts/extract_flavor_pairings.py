#!/usr/bin/env python3
"""
Extract flavour pairings from The Flavor Bible PDF.
Outputs a dataset suitable for building a flavour network graph.
"""

import json
import re
from pathlib import Path
from collections import defaultdict

import pdfplumber


# Pages 1-41 are intro; flavor charts start at page 42 (0-indexed: 41)
CHARTS_START_PAGE = 41
# End of main charts (optional cap to skip chef quote prose; use 999 to include all)
CHARTS_END_PAGE = 999
# Skip metadata lines that aren't ingredient headers
METADATA_KEYS = {
    "season", "taste", "weight", "volume", "techniques", "tips",
    "flavor affinities", "avoid", "function"
}
# Blocklist substrings for non-ingredient nodes
BLOCKLIST = {
    "about the", "see also", "acknowledgments", "acquiring editor",
    "achieve balance", "adding bright", "adding some", "after a ",
    "adnews", "awakens flavors", "— bob", "twenty-year",
    "visit to spain", "corporate career", "editor and publisher",
    "and then cooked", "all a mushroom needs", "all the flavor stays",
    "if i ", "most of the time", "the vegetables",
    "also called for", "also known as", "along with",
    "restaurant", "cuisine",  # "X cuisine" and "restaurant" - not ingredients
}


def normalize_ingredient(name: str) -> str:
    """Normalize ingredient name for consistency."""
    name = name.strip().lower()
    # Strip "Holy Grail" asterisk prefix
    name = name.lstrip('*')
    # Remove " — in general" and similar suffixes
    name = re.sub(r'\s*—\s+.*$', '', name)
    # Remove parenthetical notes like (e.g., ...) or (esp. ...)
    name = re.sub(r'\s*\([^)]*\)\s*', ' ', name)
    # Remove orphan parentheses and their content
    name = re.sub(r'[(\[]\s*', ' ', name)
    name = re.sub(r'\s*[)\]]', ' ', name)
    # Remove "esp.", "e.g.", etc.
    name = re.sub(r'\b(esp\.|e\.g\.)\s*', '', name)
    # Collapse whitespace
    name = ' '.join(name.split())
    return name


def is_valid_ingredient(name: str) -> bool:
    """Filter out junk/non-ingredient nodes."""
    if not name or len(name) < 2:
        return False
    # Reject if too long (likely descriptive text)
    if len(name) > 45:
        return False
    # Reject sentence-like patterns
    if any(x in name for x in [
        'recommended by', 'suggested by', 'key:', 'flavors mentioned', 'those in',
        'percent', 'part salt', 'part sugar', 'mixture of', 'a dish', 'a cake',
        'a hint of', 'a little', 'a couple of', 'a dash of', 'a light', 'a moment',
        'a contrast', 'a fruit', 'a harvard', 'a latin', 'a friend', 'a delicious'
    ]):
        return False
    # Reject if starts with article or conjunction (phrase, not ingredient)
    if re.match(r'^(a|an|the|and|also|along)\s+', name):
        return False
    # Reject if mostly digits or punctuation
    if re.match(r'^[\W\d]+$', name):
        return False
    # Reject if contains digits (recipe amounts)
    if re.search(r'\d', name):
        return False
    # Reject if ends with period or exclamation (sentence fragment)
    if name.endswith(('.', '!', '?')):
        return False
    # Reject orphan parens
    if name.startswith('(') or name.endswith(')'):
        return False
    # Blocklist patterns
    lower = name.lower()
    if any(bl in lower for bl in BLOCKLIST):
        return False
    return True


def is_ingredient_header(line: str) -> bool:
    """Check if line is an ingredient section header (ALL CAPS)."""
    stripped = line.strip()
    if not stripped or len(stripped) < 2:
        return False
    # Header: mostly uppercase, may have spaces and commas
    # Exclude known metadata keys
    lower = stripped.lower()
    if lower.startswith(('season:', 'taste:', 'weight:', 'volume:', 'techniques:', 'tips:', 'avoid:', 'function:')):
        return False
    if lower == 'flavor affinities':
        return False
    # Must be at least 50% uppercase letters to be a header
    letters = [c for c in stripped if c.isalpha()]
    if not letters:
        return False
    upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
    return upper_ratio >= 0.8


def parse_pairing_line(line: str, is_bold: bool = False) -> list[tuple[str, int]]:
    """
    Parse a line of pairings into (ingredient, recommendation_level) tuples.
    Level: 1=regular, 2=bold, 3=bold caps, 4=holy grail (*BOLD CAPS)
    """
    # Skip KEY/legend lines
    lower = line.lower()
    if 'key:' in lower or 'flavors mentioned' in lower or 'those in' in lower or 'recommended by' in lower:
        return []
    line_raw = line.strip()
    if not line_raw:
        return []

    # Detect recommendation level from raw text (before normalization)
    has_asterisk = line_raw.lstrip().startswith('*')
    first_part = line_raw.split(',')[0].strip()
    first_word = first_part.split()[0] if first_part else ""
    is_all_caps = first_word.isupper() and len(first_word) > 1

    if has_asterisk:
        level = 4  # Holy Grail
    elif is_all_caps:
        level = 3  # BOLD CAPS (very highly recommended)
    elif is_bold:
        level = 2  # Bold (recommended by a number of experts)
    else:
        level = 1  # Regular

    # Split by comma and extract ingredients
    parts = [p.strip() for p in line_raw.split(',')]
    result = []
    for part in parts:
        part = re.sub(r'\s+(esp\.|e\.g\.)\s+.*$', '', part, flags=re.I)
        part = re.sub(r'\s*\([^)]*\)\s*', ' ', part)
        part = part.strip(' )')
        part = ' '.join(part.split())
        norm = normalize_ingredient(part)
        if norm and is_valid_ingredient(norm):
            result.append((norm, level))
    return result


def parse_flavor_affinity(line: str) -> list[tuple[str, ...]]:
    """
    Parse a Flavor Affinities line like "achiote + pork + sour orange"
    into edges: (achiote, pork), (achiote, sour orange), (pork, sour orange)
    """
    line = line.strip()
    if not line or 'flavor affinit' in line.lower():
        return []
    # Split by +
    parts = [normalize_ingredient(p.strip()) for p in line.split('+') if p.strip()]
    parts = [p for p in parts if is_valid_ingredient(p)]
    if len(parts) < 2:
        return []
    # Create all pairs within this affinity group
    edges = []
    for i in range(len(parts)):
        for j in range(i + 1, len(parts)):
            if parts[i] != parts[j]:
                edges.append((parts[i], parts[j]))
    return edges


def extract_from_pdf(pdf_path: Path) -> tuple[dict, list[tuple]]:
    """
    Extract pairings from the Flavor Bible PDF.
    Returns:
        - pairings: dict mapping ingredient -> set of paired ingredients
        - affinity_edges: list of (ingredient_a, ingredient_b) from Flavor Affinities
    """
    pairings = defaultdict(set)
    edge_levels = {}
    affinity_edges = []
    current_ingredient = None
    in_affinities = False

    with pdfplumber.open(pdf_path) as pdf:
        end_page = min(CHARTS_END_PAGE, len(pdf.pages))
        for page_num in range(CHARTS_START_PAGE, end_page):
            page = pdf.pages[page_num]
            words = page.extract_words(extra_attrs=["fontname"])
            if not words:
                continue

            line_groups = defaultdict(list)
            for w in words:
                top_key = round(w["top"] / 3) * 3
                line_groups[top_key].append(w)

            for top in sorted(line_groups.keys()):
                wlist = line_groups[top]
                line_stripped = " ".join(w["text"] for w in wlist).strip()
                is_bold = any("Bold" in w.get("fontname", "") for w in wlist)
                if not line_stripped:
                    continue

                # Check for Flavor Affinities section
                if 'flavor affinit' in line_stripped.lower():
                    in_affinities = True
                    continue

                # Parse affinity lines (contain +)
                if in_affinities and '+' in line_stripped and not line_stripped.isupper():
                    edges = parse_flavor_affinity(line_stripped)
                    affinity_edges.extend(edges)
                    for a, b in edges:
                        pairings[a].add(b)
                        pairings[b].add(a)
                        edge_levels[frozenset([a, b])] = max(edge_levels.get(frozenset([a, b]), 1), 2)
                    continue

                # New ingredient header
                if is_ingredient_header(line_stripped):
                    in_affinities = False
                    # Extract header (may have "Season:", etc. on same line - take first part)
                    header = line_stripped.split(':')[0].strip()
                    norm_header = normalize_ingredient(header)
                    current_ingredient = norm_header if is_valid_ingredient(norm_header) else None
                    continue

                # Pairing line (under current ingredient)
                if current_ingredient and not in_affinities:
                    # Skip metadata lines
                    lower = line_stripped.lower()
                    if any(lower.startswith(k) for k in METADATA_KEYS):
                        if 'flavor affinit' in lower:
                            in_affinities = True
                        continue
                    # Skip if it looks like a section header (all caps, short)
                    if is_ingredient_header(line_stripped):
                        current_ingredient = normalize_ingredient(line_stripped.split(':')[0].strip())
                        continue

                    parsed = parse_pairing_line(line_stripped, is_bold=is_bold)
                    if current_ingredient:
                        for ing, level in parsed:
                            if ing and ing != current_ingredient:
                                pairings[current_ingredient].add(ing)
                                pairings[ing].add(current_ingredient)
                                key = frozenset([current_ingredient, ing])
                                edge_levels[key] = max(edge_levels.get(key, 1), level)

    return dict(pairings), edge_levels, affinity_edges


def build_edges(pairings: dict, edge_levels: dict | None = None) -> list[dict]:
    """Convert pairings dict to list of unique edges. Weight = recommendation level (1-4)."""
    seen = set()
    edges = []
    for ing_a, paired in pairings.items():
        for ing_b in paired:
            key = tuple(sorted([ing_a, ing_b]))
            if key not in seen:
                seen.add(key)
                level = 1
                if edge_levels:
                    level = edge_levels.get(frozenset([ing_a, ing_b]), 1)
                edges.append({
                    "source": ing_a,
                    "target": ing_b,
                    "weight": level,
                    "recommendation_level": level,
                })
    return edges


def main():
    project_root = Path(__file__).resolve().parent.parent
    pdf_path = project_root / "data" / "Flavor-Bible-epub.pdf"
    output_dir = project_root / "data"

    if not pdf_path.exists():
        print(f"Error: PDF not found at {pdf_path}")
        return 1

    print("Extracting flavour pairings from The Flavor Bible...")
    pairings, edge_levels, affinity_edges = extract_from_pdf(pdf_path)

    # Filter to valid ingredients only
    valid = {k for k in pairings if is_valid_ingredient(k)}
    pairings = {k: {x for x in v if is_valid_ingredient(x)} for k, v in pairings.items() if k in valid}
    # Filter edge_levels to valid pairs only
    edge_levels = {k: v for k, v in edge_levels.items() if k.issubset(valid)}

    # Build nodes (all unique ingredients)
    nodes = sorted(set(pairings.keys()))
    edges = build_edges(pairings, edge_levels)

    # Mark affinity edges (Flavor Affinities section)
    affinity_set = {tuple(sorted([a, b])) for a, b in affinity_edges}
    for e in edges:
        key = tuple(sorted([e["source"], e["target"]]))
        if key in affinity_set:
            e["from_affinity"] = True

    level_counts = {i: sum(1 for e in edges if e["weight"] == i) for i in range(1, 5)}
    dataset = {
        "nodes": [{"id": n, "label": n} for n in nodes],
        "edges": edges,
        "metadata": {
            "source": "The Flavor Bible (Dornenburg & Page, 2008)",
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "affinity_edges": len(affinity_set),
            "recommendation_levels": {
                "1": "regular (suggested by one or more experts)",
                "2": "bold (recommended by a number of experts)",
                "3": "bold caps (very highly recommended)",
                "4": "holy grail (*bold caps, most highly recommended)",
            },
            "level_counts": level_counts,
        }
    }

    # Write JSON (for graph visualization)
    json_path = output_dir / "flavor_pairings.json"
    with open(json_path, "w") as f:
        json.dump(dataset, f, indent=2)
    print(f"Wrote {json_path} ({len(nodes)} nodes, {len(edges)} edges)")

    # Write CSV (simple format: source,target,weight)
    csv_path = output_dir / "flavor_pairings.csv"
    with open(csv_path, "w") as f:
        f.write("source,target,weight\n")
        for e in edges:
            f.write(f'{e["source"]},{e["target"]},{e["weight"]}\n')
    print(f"Wrote {csv_path}")

    return 0


if __name__ == "__main__":
    exit(main())
