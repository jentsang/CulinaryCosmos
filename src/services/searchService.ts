/**
 * Search service: fuzzy match against graph nodes, or fall back to LLM-backed search API.
 */

import type { GraphNode } from "@/types/graph";
import { hasLinkBetween } from "@/utils/graph";
import type { GraphLink } from "@/types/graph";
import { searchWithGeminiClient } from "./geminiClientSearch";

/** Thrown when Gemini is requested but no API key is stored in the browser. */
export const GEMINI_KEY_REQUIRED = "GEMINI_KEY_REQUIRED";

export type SearchResult =
  | { type: "node"; node: GraphNode }
  | { type: "pairing"; source: GraphNode; target: GraphNode }
  | { type: "nodes"; nodes: GraphNode[] }
  | { type: "prompt"; prompt: string };

/**
 * Fuzzy match: returns a node if the query matches any node name.
 * Match order: exact > startsWith > includes (case insensitive).
 */
/**
 * Try to extract an ingredient mentioned in a natural-language query.
 * Splits by whitespace/punctuation and fuzzy-matches tokens against nodes.
 */
const LOG = "[Search]";

export function extractQueryIngredient(
  query: string,
  nodes: GraphNode[],
): GraphNode | null {
  const tokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  console.log(LOG, "extractQueryIngredient:", { query, tokens, nodeCount: nodes.length });
  // Try longer phrases first (e.g. "dark chocolate")
  for (let len = Math.min(3, tokens.length); len >= 1; len--) {
    for (let i = 0; i <= tokens.length - len; i++) {
      const phrase = tokens.slice(i, i + len).join(" ");
      const matched = fuzzyMatchNode(phrase, nodes);
      if (matched) {
        console.log(LOG, "extractQueryIngredient: matched", { phrase, nodeId: matched.id, nodeName: matched.name });
        return matched;
      }
    }
  }
  console.log(LOG, "extractQueryIngredient: no match");
  return null;
}

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

export type SearchProvider = "gemini" | "cursor";

/**
 * Execute search: if fuzzy match found, return node; otherwise call LLM search.
 * For Gemini, calls the API client-side using the user's own key.
 * For Cursor, calls the backend /api/search route.
 * Throws GEMINI_KEY_REQUIRED if provider is "gemini" and no key is provided.
 */
export async function search(
  query: string,
  nodes: GraphNode[],
  links: GraphLink[],
  provider: SearchProvider = "gemini",
  geminiApiKey?: string,
  holyGrailPairs?: string[],
): Promise<SearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { type: "prompt", prompt: "" };

  console.log(LOG, "search: entry", { query: trimmed, provider, nodeCount: nodes.length, linkCount: links.length });

  const matched = fuzzyMatchNode(trimmed, nodes);
  if (matched) {
    console.log(LOG, "search: fuzzy match hit, skipping API", { matchedId: matched.id });
    return { type: "node", node: matched };
  }

  if (provider === "gemini") {
    if (!geminiApiKey) {
      throw new Error(GEMINI_KEY_REQUIRED);
    }
    const geminiResult = await searchWithGeminiClient(trimmed, nodes, geminiApiKey, holyGrailPairs ?? []);
    if (geminiResult.error && !geminiResult.node) {
      throw new Error(geminiResult.error);
    }
    if (geminiResult.nodes && geminiResult.nodes.length >= 1) {
      return { type: "nodes", nodes: geminiResult.nodes };
    }
    if (geminiResult.node) {
      const queryIngredient = extractQueryIngredient(trimmed, nodes);
      if (queryIngredient && queryIngredient.id !== geminiResult.node.id && hasLinkBetween(queryIngredient.id, geminiResult.node.id, links)) {
        return { type: "pairing", source: queryIngredient, target: geminiResult.node };
      }
      return { type: "node", node: geminiResult.node };
    }
    return { type: "prompt", prompt: trimmed };
  }

  console.log(LOG, "search: calling API...");
  const result = await searchPrompt(trimmed, provider, nodes);
  console.log(LOG, "search: API result", {
    type: result.type,
    nodeId: result.type === "node" ? result.node?.id : undefined,
    nodeName: result.type === "node" ? result.node?.name : undefined,
    linkCount: links.length,
  });

  if (result.type !== "node") return result;

  const queryIngredient = extractQueryIngredient(trimmed, nodes);
  const hasLink = queryIngredient
    ? hasLinkBetween(queryIngredient.id, result.node.id, links)
    : false;

  console.log(LOG, "search: pairing check", {
    queryIngredient: queryIngredient
      ? { id: queryIngredient.id, name: queryIngredient.name }
      : null,
    resultNode: { id: result.node.id, name: result.node.name },
    sameNode: queryIngredient?.id === result.node.id,
    hasLink,
    willReturnPairing:
      !!queryIngredient &&
      queryIngredient.id !== result.node.id &&
      hasLink,
  });

  if (
    queryIngredient &&
    queryIngredient.id !== result.node.id &&
    hasLink
  ) {
    return {
      type: "pairing",
      source: queryIngredient,
      target: result.node,
    };
  }
  return result;
}

/**
 * Call backend search API with prompt.
 */
async function searchPrompt(
  prompt: string,
  provider: SearchProvider = "gemini",
  nodes: GraphNode[] = [],
): Promise<SearchResult> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      provider,
      nodes: provider === "gemini" ? nodes : undefined,
    }),
  });

  const data = (await res.json()) as {
    node?: GraphNode;
    queryIngredient?: GraphNode;
    nodes?: GraphNode[];
    error?: string;
  };

  if (!res.ok) {
    const message =
      data.error ??
      (res.status === 429
        ? "Rate limit exceeded. Please wait a moment and try again."
        : "Search API failed");
    throw new Error(message);
  }

  if (data.nodes && data.nodes.length >= 1) {
    return { type: "nodes", nodes: data.nodes };
  }
  if (data.node) {
    if (data.queryIngredient && data.queryIngredient.id !== data.node.id) {
      return {
        type: "pairing",
        source: data.queryIngredient,
        target: data.node,
      };
    }
    return { type: "node", node: data.node };
  }
  return { type: "prompt", prompt };
}
