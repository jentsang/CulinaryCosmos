/**
 * Shared utilities for search providers.
 */

import type { GraphNode } from "@/types/graph";

export const CATEGORIES =
  "beverages, cuisine, dairy_cheese, fruits, grains_starches, herbs_spices, legumes, meat_poultry, nuts_seeds, oils_vinegars, other, sauces_condiments, seafood, sweets_desserts, techniques_dishes, vegetables";

export function extractNodeFromText(text: string): GraphNode | null {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const toParse = codeBlock?.[1]?.trim() ?? text;
  const braceMatch = toParse.match(/\{[\s\S]*\}/);
  if (!braceMatch) return null;

  try {
    const parsed = JSON.parse(braceMatch[0]) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed &&
      "name" in parsed &&
      typeof (parsed as { id: unknown }).id === "string" &&
      typeof (parsed as { name: unknown }).name === "string"
    ) {
      const obj = parsed as Record<string, unknown>;
      return {
        id: String(obj.id),
        name: String(obj.name),
        category:
          typeof obj.category === "string" ? obj.category : undefined,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export type SearchResult = {
  node: GraphNode | null;
  queryIngredient?: GraphNode;
  error?: string;
  rateLimited?: boolean;
};

/**
 * Match organic LLM response text against local nodes.
 * Tries exact, contains, and word-overlap matching.
 */
export function matchOrganicToNode(
  text: string,
  nodes: GraphNode[],
): GraphNode | null {
  const t = text.trim().toLowerCase();
  if (!t || !nodes.length) return null;

  // Exact match
  const exact = nodes.find((n) => n.name.toLowerCase() === t);
  if (exact) return exact;

  // Node name contained in text (e.g. "I suggest cheddar" -> node "cheddar")
  const byContained = nodes.find((n) => t.includes(n.name.toLowerCase()));
  if (byContained) return byContained;

  // Text contained in node name (e.g. "cheddar" -> node "aged cheddar")
  const byReverse = nodes.find((n) => n.name.toLowerCase().includes(t));
  if (byReverse) return byReverse;

  // Word overlap: try each significant word
  const words = t.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    const match = nodes.find((n) => {
      const name = n.name.toLowerCase();
      return name === word || name.includes(word) || word.includes(name);
    });
    if (match) return match;
  }

  return null;
}

/**
 * Get candidate nodes for the "pick from" re-prompt.
 * Prefers nodes that overlap with the organic response or user query.
 */
export function getCandidateNodesForPick(
  organicResponse: string,
  userQuery: string,
  nodes: GraphNode[],
  limit = 15,
): GraphNode[] {
  const combined = `${organicResponse} ${userQuery}`.toLowerCase();
  const words = combined.split(/\s+/).filter((w) => w.length > 2);
  const seen = new Set<string>();
  const candidates: GraphNode[] = [];

  for (const node of nodes) {
    const name = node.name.toLowerCase();
    const matches =
      combined.includes(name) ||
      name.includes(combined.trim()) ||
      words.some((w) => name.includes(w) || name === w);
    if (matches && !seen.has(node.id)) {
      seen.add(node.id);
      candidates.push(node);
      if (candidates.length >= limit) break;
    }
  }

  if (candidates.length >= limit) return candidates;

  // Fill with diverse nodes if needed
  for (const node of nodes) {
    if (candidates.length >= limit) break;
    if (!seen.has(node.id)) {
      seen.add(node.id);
      candidates.push(node);
    }
  }

  return candidates;
}
