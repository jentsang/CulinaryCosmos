/**
 * Cursor Cloud Agents search provider.
 * Uses the data repository (CURSOR_AGENT_REPO) for context.
 */

import { CATEGORIES, extractNodeFromText, type SearchResult } from "./parse";

const CURSOR_API_BASE = "https://api.cursor.com";
const POLL_INTERVAL_MS = 4000;
const MAX_WAIT_MS = 120000;
const LOG = "[CursorAgent]";

export function buildCursorPrompt(userQuery: string): string {
  return `You are working in a repository that contains flavor/ingredient data. The main data file is flavor_pairings.json (nodes have id, label, category; edges have source, target).

TASK: Given the user query below, find the BEST MATCHING existing node from flavor_pairings.json in this repository. Use the actual nodes in the file - prefer exact or close matches. If no good match exists, infer a new node using the same schema.

IMPORTANT - Interpret the query intent:
- If the user asks about PAIRINGS (e.g. "good pairings with apple", "what goes with chocolate"): return ONE flavor that pairs well with the mentioned ingredient from the edges in the data. Do NOT return the ingredient itself.
- If the user names a specific ingredient: return that ingredient.

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
  if (body) headers["Content-Type"] = "application/json";

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
    console.error(LOG, `${method} ${path} failed:`, res.status, msg);
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export async function searchWithCursor(userQuery: string): Promise<SearchResult> {
  const apiKey = process.env.CURSOR_API_KEY;
  const repoUrl = process.env.CURSOR_AGENT_REPO;

  if (!apiKey) {
    return { node: null, error: "CURSOR_API_KEY not configured" };
  }
  if (!repoUrl) {
    return { node: null, error: "CURSOR_AGENT_REPO not configured" };
  }

  try {
    console.log(LOG, "Launching agent:", { query: userQuery, repo: repoUrl });
    const agent = (await cursorRequest<{ id: string; status?: string }>(
      apiKey,
      "POST",
      "/v0/agents",
      {
        prompt: { text: buildCursorPrompt(userQuery) },
        source: { repository: repoUrl },
        model: "composer-1.5",
      }
    )) as { id: string; status?: string };

    const agentId = agent.id;
    if (!agentId) {
      return { node: null, error: "Cursor API did not return agent ID" };
    }

    let status: string = agent.status ?? "CREATING";
    const start = Date.now();
    let pollCount = 0;

    while (!["FINISHED", "FAILED", "STOPPED"].includes(status)) {
      if (Date.now() - start > MAX_WAIT_MS) {
        console.warn(LOG, "Agent timed out:", { agentId, pollCount });
        return { node: null, error: "Agent timed out" };
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      pollCount++;

      const polled = (await cursorRequest<{ status: string }>(
        apiKey,
        "GET",
        `/v0/agents/${agentId}`
      )) as { status: string };
      status = polled.status;
      console.log(LOG, `Poll #${pollCount}:`, status);
    }

    if (status !== "FINISHED") {
      return { node: null, error: `Agent ended with status: ${status}` };
    }

    const conv = (await cursorRequest<{
      messages?: Array<{ type: string; text: string }>;
    }>(apiKey, "GET", `/v0/agents/${agentId}/conversation`)) as {
      messages?: Array<{ type: string; text: string }>;
    };

    const messages = conv?.messages ?? [];
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.type === "assistant_message");
    const text = lastAssistant?.text ?? "";

    const node = extractNodeFromText(text);
    if (node) {
      console.log(LOG, "Parsed node:", node);
      return { node };
    }

    return { node: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cursor agent failed";
    console.error(LOG, "Error:", err);
    const is429 =
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status?: number }).status === 429;
    return {
      node: null,
      error: is429
        ? "Rate limit exceeded. Please wait a moment and try again."
        : message,
      rateLimited: is429 ? true : undefined,
    };
  }
}
