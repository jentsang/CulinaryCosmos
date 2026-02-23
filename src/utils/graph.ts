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

/** Radius of the ring that category cluster centers are placed on. */
const LAYOUT_RADIUS = 280;

/** Get (x, y, z) center for a category by its index (0..numCategories-1). */
export function getCategoryCenter(categoryIndex: number, numCategories: number): { x: number; y: number; z: number } {
  const angle = (2 * Math.PI * categoryIndex) / numCategories - Math.PI / 2;
  return {
    x: LAYOUT_RADIUS * Math.cos(angle),
    y: LAYOUT_RADIUS * Math.sin(angle),
    z: 0,
  };
}

/** Map category id to layout index. */
export function getCategoryIndex(category: string | undefined): number {
  const idx = CATEGORY_ORDER.indexOf(category ?? "other");
  return idx >= 0 ? idx : CATEGORY_ORDER.indexOf("other");
}

export function spreadNodes(
  nodes: GraphNode[],
): (GraphNode & { x: number; y: number; z: number })[] {
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
    z: (Math.random() - 0.5) * jitter,
  }));
}

/** Deterministic pseudo-random in (0, 1] from a string seed. */
function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  // Ensure result is in (0, 1] to keep log() safe
  return (Math.abs(h) % 99999) / 100000 + 0.00001;
}

/** Box-Muller transform: returns a standard-normal sample seeded by two strings. */
function seededGaussian(seed1: string, seed2: string): number {
  const u1 = seededRandom(seed1);
  const u2 = seededRandom(seed2);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Spread nodes by category in 3D so each category forms an organic blob-shaped cluster.
 * Categories are arranged on a sphere shell; nodes within each category are scattered
 * with Gaussian noise in all three axes so clusters look natural and volumetric.
 */
export function spreadNodesByCategory(
  nodes: GraphNode[],
): (GraphNode & { x: number; y: number; z: number })[] {
  const categoryToNodes = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const cat = node.category ?? "other";
    if (!categoryToNodes.has(cat)) categoryToNodes.set(cat, []);
    categoryToNodes.get(cat)!.push(node);
  }

  const numCategories = CATEGORY_ORDER.length;
  const categoryToIndex = new Map<string, number>();
  let nextIdx = 0;
  for (const cat of CATEGORY_ORDER) {
    categoryToIndex.set(cat, nextIdx++);
  }

  const result: (GraphNode & { x: number; y: number; z: number })[] = [];

  for (const [cat, nodesInCat] of categoryToNodes) {
    const catIdx = categoryToIndex.get(cat) ?? categoryToIndex.get("other") ?? 0;
    // Fibonacci-sphere distribution: spread cluster centres evenly over a sphere shell.
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const t = numCategories > 1 ? catIdx / (numCategories - 1) : 0.5;
    const phi = Math.acos(1 - 2 * t);
    const theta = goldenAngle * catIdx;
    const catR = LAYOUT_RADIUS * (0.5 + 0.3 * seededRandom("cr" + cat));
    const cx = catR * Math.sin(phi) * Math.cos(theta);
    const cy = catR * Math.sin(phi) * Math.sin(theta);
    const cz = catR * Math.cos(phi);

    // Independent σ per axis so clusters have different shapes
    const sigmaX = (3 + 4 * seededRandom("sx" + cat)) * Math.sqrt(nodesInCat.length);
    const sigmaY = (3 + 4 * seededRandom("sy" + cat)) * Math.sqrt(nodesInCat.length);
    const sigmaZ = (3 + 4 * seededRandom("sz" + cat)) * Math.sqrt(nodesInCat.length);

    for (const node of nodesInCat) {
      const gx = seededGaussian("ax" + node.id, "bx" + node.id);
      const gy = seededGaussian("ay" + node.id, "by" + node.id);
      const gz = seededGaussian("az" + node.id, "bz" + node.id);
      result.push({
        ...node,
        x: cx + gx * sigmaX,
        y: cy + gy * sigmaY,
        z: cz + gz * sigmaZ,
      });
    }
  }
  return result;
}
