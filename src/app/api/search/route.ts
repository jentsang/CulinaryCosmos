/**
 * Search API: maps user queries to flavor nodes.
 * Uses Cursor Cloud Agents primarily; Gemini available as fallback (deprecated).
 */

import { NextResponse } from "next/server";
import type { GraphNode } from "@/types/graph";
import {
  searchWithCursor,
  searchWithGemini,
  buildCursorPrompt,
  buildGeminiPrompt,
} from "@/lib/search";

// --- GET handler: preview prompt without calling API ---

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { error: "Query param 'q' required (e.g. ?q=chocolate)" },
      { status: 400 }
    );
  }
  return NextResponse.json({
    provider: "cursor",
    query: q,
    prompt: buildCursorPrompt(q),
    geminiPrompt: await buildGeminiPrompt(q),
  });
}

// --- POST handler ---

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      provider?: string;
      nodes?: GraphNode[];
    };
    const userQuery = body.prompt?.trim();
    const provider = body.provider === "cursor" ? "cursor" : "gemini";
    const nodes = body.nodes ?? [];

    if (!userQuery) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    // Use provider from request (default: gemini)
    if (provider === "cursor" && process.env.CURSOR_API_KEY && process.env.CURSOR_AGENT_REPO) {
      const result = await searchWithCursor(userQuery);
      if (result.error && !result.node) {
        return NextResponse.json(
          { error: result.error, node: null, prompt: userQuery },
          { status: result.rateLimited ? 429 : 500 }
        );
      }
      return NextResponse.json({
        node: result.node ?? null,
        prompt: result.node ? undefined : userQuery,
      });
    }

    // Default: Gemini (requires nodes for match/re-prompt flow)
    if (process.env.GEMINI_API_KEY) {
      const result = await searchWithGemini(userQuery, nodes);
      if (result.error && !result.node) {
        return NextResponse.json(
          { error: result.error, node: null, prompt: userQuery },
          { status: result.rateLimited ? 429 : 500 }
        );
      }
      return NextResponse.json({
        node: result.node ?? null,
        queryIngredient: result.queryIngredient ?? undefined,
        nodes: result.nodes ?? undefined,
        prompt: result.node ? undefined : userQuery,
      });
    }

    return NextResponse.json(
      {
        error:
          provider === "cursor"
            ? "Cursor not configured. Set CURSOR_API_KEY and CURSOR_AGENT_REPO."
            : "Gemini not configured. Set GEMINI_API_KEY.",
        node: null,
        prompt: userQuery,
      },
      { status: 500 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    console.error("[Search]", "Error:", err);
    return NextResponse.json(
      { error: message, node: null, prompt: "" },
      { status: 500 }
    );
  }
}
