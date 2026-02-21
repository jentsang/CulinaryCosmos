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

export function hashToColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 65%, 55%)`;
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
