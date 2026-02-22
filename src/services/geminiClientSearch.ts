/**
 * Client-side Gemini search — calls the Gemini API directly from the browser
 * using the user's own API key. No server involvement.
 */

import type { GraphNode } from "@/types/graph";
import {
  matchOrganicToNode,
  getCandidateNodesForPick,
  type SearchResult,
} from "@/lib/search/parse";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.0-flash-lite";
const MAX_INGREDIENTS = 3;

function buildOrganicPrompt(
  userQuery: string,
  holyGrailPairs: string[],
): string {
  const holyGrailHint =
    holyGrailPairs.length > 0
      ? `\n\nThese "holy grail" pairings (from The Flavor Bible) are especially prized. When the user's query matches one of these, prefer suggesting that pairing:\n${holyGrailPairs.map((p) => `- ${p}`).join("\n")}\n`
      : "";

  return `The user is searching a flavor pairing network. Respond with 1 to ${MAX_INGREDIENTS} ingredient names separated by pipes (|), nothing else.

RULES:
1. If they ask about pairings or combinations (e.g. "what pairs with lemon", "ingredients for caprese"): list the query ingredient first, then the suggested pairing(s). Example: lemon|tomato
2. If they ask for a dish or combo: list up to ${MAX_INGREDIENTS} ingredients that work together.
3. If they name a single ingredient: respond with just that ingredient.
${holyGrailHint}
Output format: "ingredient" or "ingredient1|ingredient2" (max ${MAX_INGREDIENTS}, no quotes, no explanation).`;
}

function buildPickFromPrompt(
  candidates: GraphNode[],
  userQuery: string,
  organicResponse: string,
): string {
  const list = candidates.map((n) => `- ${n.id}: ${n.name}`).join("\n");
  return `The user asked: "${userQuery}"
You previously suggested: "${organicResponse}"

These flavors exist in our database. Pick the ONE that best matches your suggestion or the user's intent.

Available options:
${list}

Respond with ONLY the exact id of your choice (e.g. "cheddar" or "dark chocolate"). Nothing else.`;
}

async function callGemini(
  apiKey: string,
  prompt: string,
  temperature = 0.3,
): Promise<string> {
  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 256 },
    }),
  });

  if (!res.ok) {
    if (res.status === 400) {
      throw new Error("Invalid API key. Please check your Gemini API key.");
    }
    if (res.status === 429) {
      throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    }
    const errText = await res.text();
    throw new Error(errText.slice(0, 200));
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

export async function searchWithGeminiClient(
  userQuery: string,
  nodes: GraphNode[],
  apiKey: string,
  holyGrailPairs: string[] = [],
): Promise<SearchResult> {
  if (!nodes?.length) {
    return { node: null, error: "No nodes provided for matching" };
  }

  try {
    const organicPrompt = `${buildOrganicPrompt(userQuery, holyGrailPairs)}\n\nUser query: "${userQuery}"`;
    const organicResponse = await callGemini(apiKey, organicPrompt);

    if (!organicResponse) return { node: null };

    // Parse pipe-separated ingredients
    const parts = organicResponse
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_INGREDIENTS);

    const matchedNodes: GraphNode[] = [];
    const seenIds = new Set<string>();
    for (const part of parts) {
      const n = matchOrganicToNode(part, nodes);
      if (n && !seenIds.has(n.id)) {
        seenIds.add(n.id);
        matchedNodes.push(n);
      }
    }
    if (matchedNodes.length >= 1) {
      return { node: matchedNodes[0], nodes: matchedNodes };
    }

    // Fallback: single match
    const matched = matchOrganicToNode(organicResponse, nodes);
    if (matched) return { node: matched };

    // Re-prompt with candidate nodes
    const candidates = getCandidateNodesForPick(organicResponse, userQuery, nodes, 15);
    if (candidates.length === 0) return { node: null };

    const pickPrompt = buildPickFromPrompt(candidates, userQuery, organicResponse);
    const pickResponse = await callGemini(apiKey, pickPrompt, 0.1);

    const pickedId = pickResponse
      .trim()
      .toLowerCase()
      .replace(/^["']|["']$/g, "")
      .split(/\s+/)[0];

    const pickedNode = candidates.find(
      (n) => n.id.toLowerCase() === pickedId || n.name.toLowerCase() === pickedId,
    );

    return pickedNode ? { node: pickedNode } : { node: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini request failed";
    return {
      node: null,
      error: message,
      rateLimited: message.includes("Rate limit"),
    };
  }
}
