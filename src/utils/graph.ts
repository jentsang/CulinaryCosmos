/**
 * Graph layout and helper utilities.
 */

import type { GraphNode, GraphLink } from "@/types/graph";

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
