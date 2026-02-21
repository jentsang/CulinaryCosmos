/**
 * Graph layout and helper utilities.
 */

import type { GraphNode, GraphLink } from "@/types/graph";

/** Display labels for ingredient categories (from metadata.categories). */
export const CATEGORY_LABELS: Record<string, string> = {
  cuisine: "Cuisine & Region",
  meat_poultry: "Meat & Poultry",
  seafood: "Seafood & Fish",
  dairy_cheese: "Dairy & Cheese",
  vegetables: "Vegetables",
  herbs_spices: "Herbs & Spices",
  fruits: "Fruits",
  legumes: "Legumes & Beans",
  grains_starches: "Grains & Starches",
  nuts_seeds: "Nuts & Seeds",
  oils_vinegars: "Oils & Vinegars",
  sauces_condiments: "Sauces & Condiments",
  beverages: "Beverages",
  sweets_desserts: "Sweets & Desserts",
  techniques_dishes: "Techniques & Dish Types",
  other: "Other",
};

export function hashToColor(str: string, brightForDark = false): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  const hue = Math.abs(h) % 360;
  if (brightForDark) return `hsl(${hue}, 75%, 62%)`;
  return `hsl(${hue}, 65%, 55%)`;
}

const LOG = "[Graph]";

/** Check if a link exists between two node IDs. */
export function hasLinkBetween(
  nodeIdA: string,
  nodeIdB: string,
  links: GraphLink[],
): boolean {
  let found = false;
  for (const link of links) {
    const src =
      typeof link.source === "string"
        ? link.source
        : ((link.source as { id?: string }).id ?? "");
    const tgt =
      typeof link.target === "string"
        ? link.target
        : ((link.target as { id?: string }).id ?? "");
    if (
      (src === nodeIdA && tgt === nodeIdB) ||
      (src === nodeIdB && tgt === nodeIdA)
    ) {
      found = true;
      break;
    }
  }
  console.log(LOG, "hasLinkBetween", {
    nodeIdA,
    nodeIdB,
    linkCount: links.length,
    found,
    linkSourceType: typeof links[0]?.source,
    linkTargetType: typeof links[0]?.target,
  });
  return found;
}

export function getPairings(
  nodeId: string,
  links: GraphLink[],
  nodes: GraphNode[],
): GraphNode[] {
  const ids = new Set<string>();
  for (const link of links) {
    const src =
      typeof link.source === "string"
        ? link.source
        : ((link.source as { id?: string }).id ?? "");
    const tgt =
      typeof link.target === "string"
        ? link.target
        : ((link.target as { id?: string }).id ?? "");
    if (src === nodeId) ids.add(tgt);
    if (tgt === nodeId) ids.add(src);
  }
  return nodes.filter((n) => ids.has(n.id));
}

export interface PairingWithLevel {
  node: GraphNode;
  level: number;
}

export function getPairingsWithLevel(
  nodeId: string,
  links: GraphLink[],
  nodes: GraphNode[],
): PairingWithLevel[] {
  const pairingsMap = new Map<string, number>();
  for (const link of links) {
    const src =
      typeof link.source === "string"
        ? link.source
        : ((link.source as { id?: string }).id ?? "");
    const tgt =
      typeof link.target === "string"
        ? link.target
        : ((link.target as { id?: string }).id ?? "");
    const level = link.value ?? 1;
    if (src === nodeId) {
      const existing = pairingsMap.get(tgt);
      if (existing === undefined || level > existing) pairingsMap.set(tgt, level);
    }
    if (tgt === nodeId) {
      const existing = pairingsMap.get(src);
      if (existing === undefined || level > existing) pairingsMap.set(src, level);
    }
  }
  return Array.from(pairingsMap.entries())
    .map(([id, level]) => {
      const node = nodes.find((n) => n.id === id);
      return node ? { node, level } : null;
    })
    .filter((p): p is PairingWithLevel => p !== null);
}

/** Category order for layout (matches CATEGORY_LABELS). */
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

/** Radius for category cluster layout. */
const LAYOUT_RADIUS = 450;

/** Get (x, y) center for a category by its index (0..numCategories-1). */
export function getCategoryCenter(categoryIndex: number, numCategories: number): { x: number; y: number } {
  const angle = (2 * Math.PI * categoryIndex) / numCategories - Math.PI / 2;
  return {
    x: LAYOUT_RADIUS * Math.cos(angle),
    y: LAYOUT_RADIUS * Math.sin(angle),
  };
}

/** Map category id to layout index. */
export function getCategoryIndex(category: string | undefined): number {
  const idx = CATEGORY_ORDER.indexOf(category ?? "other");
  return idx >= 0 ? idx : CATEGORY_ORDER.indexOf("other");
}

export function spreadNodes(
  nodes: GraphNode[],
): (GraphNode & { x: number; y: number })[] {
  const n = nodes.length;
  const cols = Math.ceil(Math.sqrt(n));
  const spacing = 70;
  const offset = (cols * spacing) / 2;
  const jitter = spacing * 0.6;
  return nodes.map((node, i) => ({
    ...node,
    x:
      (i % cols) * spacing -
      offset +
      (Math.random() - 0.5) * jitter,
    y:
      Math.floor(i / cols) * spacing -
      offset +
      (Math.random() - 0.5) * jitter,
  }));
}

/** Deterministic pseudo-random in [-0.5, 0.5] from a string seed. */
function seededJitter(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return ((Math.abs(h) % 1000) / 1000 - 0.5);
}

/**
 * Spread nodes by category so each category forms a cluster.
 * Categories are arranged in a circular layout; nodes within each
 * category are placed in a sub-cluster with deterministic jitter.
 */
export function spreadNodesByCategory(
  nodes: GraphNode[],
): (GraphNode & { x: number; y: number })[] {
  const categoryToNodes = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const cat = node.category ?? "other";
    if (!categoryToNodes.has(cat)) categoryToNodes.set(cat, []);
    categoryToNodes.get(cat)!.push(node);
  }

  const numCategories = CATEGORY_ORDER.length;
  const radius = LAYOUT_RADIUS;
  const subSpacing = 22;
  const jitter = 8;

  const result: (GraphNode & { x: number; y: number })[] = [];
  const categoryToIndex = new Map<string, number>();
  let nextIdx = 0;
  for (const cat of CATEGORY_ORDER) {
    categoryToIndex.set(cat, nextIdx++);
  }

  for (const [cat, nodesInCat] of categoryToNodes) {
    const catIdx = categoryToIndex.get(cat) ?? categoryToIndex.get("other") ?? 0;

    const angle = (2 * Math.PI * catIdx) / numCategories - Math.PI / 2;
    const cx = radius * Math.cos(angle);
    const cy = radius * Math.sin(angle);

    const cols = Math.ceil(Math.sqrt(nodesInCat.length));
    for (let i = 0; i < nodesInCat.length; i++) {
      const node = nodesInCat[i];
      const subX = (i % cols) * subSpacing - (cols * subSpacing) / 2;
      const subY = Math.floor(i / cols) * subSpacing - subSpacing;
      const jx = seededJitter(`${node.id}-x`) * jitter;
      const jy = seededJitter(`${node.id}-y`) * jitter;
      result.push({
        ...node,
        x: cx + subX + jx,
        y: cy + subY + jy,
      });
    }
  }
  return result;
}
