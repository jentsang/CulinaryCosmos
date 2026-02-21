/**
 * Search API: integrates with Cursor Cloud Agents API (Composer 1.5)
 * to map user queries to flavor nodes using the data repository context.
 */

import { NextResponse } from "next/server";
import type { GraphNode } from "@/types/graph";

const CURSOR_API_BASE = "https://api.cursor.com";
const POLL_INTERVAL_MS = 4000;
const MAX_WAIT_MS = 120000; // 2 minutes

const CATEGORIES =
  "beverages, cuisine, dairy_cheese, fruits, grains_starches, herbs_spices, legumes, meat_poultry, nuts_seeds, oils_vinegars, other, sauces_condiments, seafood, sweets_desserts, techniques_dishes, vegetables";

function buildPrompt(userQuery: string): string {
  return `You are working in a repository that contains flavor/ingredient data. The main data file is flavor_pairings.json (nodes have id, label, category; edges have source, target).

TASK: Given the user query below, find the BEST MATCHING existing node from flavor_pairings.json in this repository. Use the actual nodes in the file - prefer exact or close matches. If no good match exists, infer a new node using the same schema.

Output ONLY a valid JSON object with this exact structure. No markdown, no code blocks, no explanation:
{"id":"lowercase-id","name":"Display Name","category":"one_of_below"}

Categories (use exactly one): ${CATEGORIES}

User query: "${userQuery}"

Rules: id and name must match an existing node when possible; otherwise use lowercase, hyphenated format. Use category "other" only when the query is ambiguous or not a food/flavor.`;
}

function getAuthHeader(apiKey: string): string {
  const encoded = Buffer.from(`${apiKey}:`).toString("base64");
  return `Basic ${encoded}`;
}

async function cursorRequest<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${CURSOR_API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: getAuthHeader(apiKey),
  };
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `Cursor API error: ${res.status}`;
    try {
      const err = (await res.json()) as { message?: string; error?: string };
      msg = err.message ?? err.error ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

interface AgentResponse {
  id: string;
  status: "CREATING" | "RUNNING" | "FINISHED" | "STOPPED" | "FAILED";
}

interface ConversationMessage {
  type: "user_message" | "assistant_message";
  text: string;
}

interface ConversationResponse {
  messages: ConversationMessage[];
}

function extractNodeFromText(text: string): GraphNode | null {
  // Extract JSON object - try code fence first, then any {...}
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

export async function POST(request: Request) {
  try {
    const { prompt } = (await request.json()) as { prompt?: string };
    const userQuery = prompt?.trim();
    if (!userQuery) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const apiKey = process.env.CURSOR_API_KEY;
    const repoUrl = process.env.CURSOR_AGENT_REPO;

    if (!apiKey) {
      return NextResponse.json(
        { error: "CURSOR_API_KEY not configured" },
        { status: 500 }
      );
    }
    if (!repoUrl) {
      return NextResponse.json(
        { error: "CURSOR_AGENT_REPO not configured" },
        { status: 500 }
      );
    }

    // Launch agent
    const agent = (await cursorRequest<{ id: string; status?: string }>(
      apiKey,
      "POST",
      "/v0/agents",
      {
        prompt: { text: buildPrompt(userQuery) },
        source: { repository: repoUrl },
        model: "composer-1.5",
      }
    )) as { id: string; status?: string };

    const agentId = agent.id;
    if (!agentId) {
      return NextResponse.json(
        { error: "Cursor API did not return agent ID", node: null, prompt: userQuery },
        { status: 500 }
      );
    }

    // Poll until finished
    const start = Date.now();
    let status: string = agent.status ?? "CREATING";

    while (!["FINISHED", "FAILED", "STOPPED"].includes(status)) {
      if (Date.now() - start > MAX_WAIT_MS) {
        return NextResponse.json({
          node: null,
          prompt: userQuery,
          error: "Agent timed out",
        });
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const polled = (await cursorRequest<AgentResponse>(
        apiKey,
        "GET",
        `/v0/agents/${agentId}`
      )) as AgentResponse;
      status = polled.status;
    }

    if (status !== "FINISHED") {
      return NextResponse.json({
        node: null,
        prompt: userQuery,
        error: `Agent ended with status: ${status}`,
      });
    }

    // Get conversation and parse response
    const conv = (await cursorRequest<ConversationResponse>(
      apiKey,
      "GET",
      `/v0/agents/${agentId}/conversation`
    )) as ConversationResponse;

    const messages = conv?.messages ?? [];
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.type === "assistant_message");
    const text = lastAssistant?.text ?? "";

    const node = extractNodeFromText(text);
    if (node) {
      return NextResponse.json({ node });
    }

    return NextResponse.json({ node: null, prompt: userQuery });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json(
      { error: message, node: null, prompt: "" },
      { status: 500 }
    );
  }
}
