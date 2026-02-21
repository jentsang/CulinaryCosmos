/**
 * Gemini search provider.
 * Flow: organic response -> match locally -> re-prompt to pick from nodes if no match.
 */

import { readFile } from "fs/promises";
import path from "path";
import type { GraphNode } from "@/types/graph";
import {
  matchOrganicToNode,
  getCandidateNodesForPick,
  type SearchResult,
} from "./parse";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const LOG = "[Gemini]";

/** Max number of ingredients for Gemini to return (1–5). */
const MAX_INGREDIENTS = 3;

let holyGrailCache: string[] | null = null;

async function loadHolyGrailPairings(): Promise<string[]> {
  if (holyGrailCache) return holyGrailCache;
  try {
    const dataDir = path.join(process.cwd(), "data");
    const raw = await readFile(
      path.join(dataDir, "flavor_pairings.json"),
      "utf-8",
    );
    const data = JSON.parse(raw) as {
      edges?: { source: string; target: string; weight?: number }[];
    };
    const pairs = (data.edges ?? [])
      .filter((e) => e.weight === 4)
      .map((e) => `${e.source} + ${e.target}`);
    holyGrailCache = [...new Set(pairs)];
    return holyGrailCache;
  } catch {
    holyGrailCache = [];
    return [];
  }
}

function buildOrganicPrompt(
  userQuery: string,
  holyGrailPairs: string[],
): string {
  const holyGrailHint =
    holyGrailPairs.length > 0
      ? `

These "holy grail" pairings (from The Flavor Bible) are especially prized. When the user's query matches one of these, prefer suggesting that pairing:
${holyGrailPairs.map((p) => `- ${p}`).join("\n")}
`
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
      generationConfig: {
        temperature,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      res.status === 429 ? "Rate limit exceeded" : errText.slice(0, 200),
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

export async function buildGeminiPrompt(userQuery: string): Promise<string> {
  const holyGrailPairs = await loadHolyGrailPairings();
  return `${buildOrganicPrompt(userQuery, holyGrailPairs)}\n\nUser query: "${userQuery}"`;
}

export async function searchWithGemini(
  userQuery: string,
  nodes: GraphNode[],
): Promise<SearchResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { node: null, error: "GEMINI_API_KEY not configured" };
  }

  if (!nodes?.length) {
    return { node: null, error: "No nodes provided for matching" };
  }

  try {
    const holyGrailPairs = await loadHolyGrailPairings();
    // 1. Organic first call
    const organicPrompt = `${buildOrganicPrompt(userQuery, holyGrailPairs)}\n\nUser query: "${userQuery}"`;
    console.log(LOG, "Organic request:", { query: userQuery });
    const organicResponse = await callGemini(apiKey, organicPrompt);
    console.log(LOG, "Organic response:", organicResponse);

    if (!organicResponse) {
      return { node: null };
    }

    // 2. Parse pipe-separated ingredients (up to MAX_INGREDIENTS)
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
      console.log(
        LOG,
        "Multi-ingredient matched:",
        matchedNodes.map((n) => n.id),
      );
      return {
        node: matchedNodes[0],
        nodes: matchedNodes,
      };
    }

    // 3. Try to match as single ingredient (fallback for non-pipe format)
    const matched = matchOrganicToNode(organicResponse, nodes);
    if (matched) {
      console.log(LOG, "Matched locally:", {
        organicResponse,
        matchedId: matched.id,
        matchedName: matched.name,
      });
      return { node: matched };
    }

    // 4. No match: re-prompt with candidate nodes
    const candidates = getCandidateNodesForPick(
      organicResponse,
      userQuery,
      nodes,
      15,
    );

    if (candidates.length === 0) {
      return { node: null };
    }

    console.log(
      LOG,
      "No local match, re-prompting with",
      candidates.length,
      "candidates",
    );
    const pickPrompt = buildPickFromPrompt(
      candidates,
      userQuery,
      organicResponse,
    );
    const pickResponse = await callGemini(apiKey, pickPrompt, 0.1);

    // 5. Parse picked id
    const pickedId = pickResponse
      .trim()
      .toLowerCase()
      .replace(/^["']|["']$/g, "")
      .split(/\s+/)[0];

    const pickedNode = candidates.find(
      (n) =>
        n.id.toLowerCase() === pickedId || n.name.toLowerCase() === pickedId,
    );

    if (pickedNode) {
      console.log(LOG, "Picked from re-prompt:", {
        pickedId: pickedNode.id,
        pickedName: pickedNode.name,
      });
      return { node: pickedNode };
    }

    return { node: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gemini request failed";
    console.error(LOG, "Error:", err);
    return {
      node: null,
      error: message,
      rateLimited: message.includes("Rate limit"),
    };
  }
}
