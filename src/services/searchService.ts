/**
 * Search service: fuzzy match against graph nodes, or fall back to LLM-backed search API.
 */

import type { GraphNode } from "@/types/graph";

export type SearchResult =
  | { type: "node"; node: GraphNode }
  | { type: "prompt"; prompt: string };

/**
 * Fuzzy match: returns a node if the query matches any node name.
 * Match order: exact > startsWith > includes (case insensitive).
 */
export function fuzzyMatchNode(
  query: string,
  nodes: GraphNode[],
): GraphNode | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  let exact: GraphNode | null = null;
  let startsWith: GraphNode | null = null;
  let includes: GraphNode | null = null;

  for (const node of nodes) {
    const name = node.name.toLowerCase();
    if (name === q) exact = node;
    else if (!exact && name.startsWith(q)) startsWith ??= node;
    else if (!exact && !startsWith && name.includes(q)) includes ??= node;
  }

  return exact ?? startsWith ?? includes ?? null;
}

/**
 * Get fuzzy match results for dropdown (multiple nodes).
 */
export function fuzzyMatchNodes(
  query: string,
  nodes: GraphNode[],
  limit = 10,
): GraphNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exact: GraphNode[] = [];
  const startsWith: GraphNode[] = [];
  const includes: GraphNode[] = [];

  for (const node of nodes) {
    const name = node.name.toLowerCase();
    if (name === q) exact.push(node);
    else if (name.startsWith(q)) startsWith.push(node);
    else if (name.includes(q)) includes.push(node);
  }

  return [...exact, ...startsWith, ...includes].slice(0, limit);
}

/**
 * Execute search: if fuzzy match found, return node; otherwise call backend API.
 */
export async function search(
  query: string,
  nodes: GraphNode[],
): Promise<SearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { type: "prompt", prompt: "" };

  const matched = fuzzyMatchNode(trimmed, nodes);
  if (matched) return { type: "node", node: matched };

  const result = await searchPrompt(trimmed);
  return result;
}

/**
 * Call backend search API with prompt (placeholder for future LLM integration).
 */
async function searchPrompt(prompt: string): Promise<SearchResult> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    throw new Error("Search API failed");
  }

  const data = (await res.json()) as { node?: GraphNode };
  if (data.node) {
    return { type: "node", node: data.node };
  }
  return { type: "prompt", prompt };
}
