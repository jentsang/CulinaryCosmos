/**
 * Search API: receives prompt, will eventually integrate with LLM gateway.
 * Placeholder implementation - returns empty for now.
 */

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { prompt } = (await request.json()) as { prompt?: string };
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    // TODO: integrate with LLM gateway
    // For now, return empty - no node match from LLM
    return NextResponse.json({ node: null, prompt: prompt.trim() });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    );
  }
}
