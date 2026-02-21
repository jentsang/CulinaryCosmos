/**
 * Cursor Cloud Agents API client
 * Uses Composer 1.5 and other models. Auth: Basic with API key from Dashboard → Integrations.
 */
import { CURSOR_API_BASE, getCursorApiKey, COMPOSER_1_5_MODEL } from "@/constants/cursor";
import type {
  Agent,
  AgentListResponse,
  AgentConversationResponse,
  LaunchAgentParams,
  CursorApiError,
} from "@/types/cursor";

function getAuthHeader(): string {
  const key = getCursorApiKey();
  if (!key) throw new Error("Cursor API key not set. Add NEXT_PUBLIC_CURSOR_API_KEY to .env");
  return "Basic " + btoa(key + ":");
}

async function cursorFetch<T>(
  path: string,
  options: RequestInit & { method?: string; body?: string } = {}
): Promise<T> {
  const { method = "GET", body, ...rest } = options;
  const res = await fetch(`${CURSOR_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...(rest.headers as Record<string, string>),
    },
    ...(body !== undefined && { body: body }),
    ...rest,
  });

  const text = await res.text();
  let data: T | CursorApiError;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(res.ok ? "Invalid response" : text || res.statusText);
  }

  if (!res.ok) {
    const err = data as CursorApiError;
    throw new Error(err?.message || err?.error || `API error ${res.status}`);
  }

  return data as T;
}

/** List available models (e.g. composer-1.5, claude-4-sonnet-thinking) */
export async function listModels(): Promise<{ models: string[] }> {
  return cursorFetch<{ models: string[] }>("/v0/models");
}

/** List your cloud agents */
export async function listAgents(params?: { limit?: number; cursor?: string; prUrl?: string }): Promise<AgentListResponse> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.cursor) q.set("cursor", params.cursor);
  if (params?.prUrl) q.set("prUrl", params.prUrl);
  const query = q.toString();
  return cursorFetch<AgentListResponse>("/v0/agents" + (query ? "?" + query : ""));
}

/** Get a single agent's status */
export async function getAgent(id: string): Promise<Agent> {
  return cursorFetch<Agent>(`/v0/agents/${encodeURIComponent(id)}`);
}

/** Get agent conversation (user + assistant messages) */
export async function getAgentConversation(id: string): Promise<AgentConversationResponse> {
  return cursorFetch<AgentConversationResponse>(`/v0/agents/${encodeURIComponent(id)}/conversation`);
}

/**
 * Launch a cloud agent (optionally with Composer 1.5).
 * Requires source.repository (e.g. https://github.com/org/repo) and prompt.text.
 */
export async function launchAgent(params: LaunchAgentParams): Promise<Agent> {
  const model = params.model ?? COMPOSER_1_5_MODEL;
  return cursorFetch<Agent>("/v0/agents", {
    method: "POST",
    body: JSON.stringify({
      ...params,
      model,
    }),
  });
}

/** Send a follow-up prompt to an existing agent */
export async function followUpAgent(
  id: string,
  prompt: { text: string; images?: LaunchAgentParams["prompt"]["images"] }
): Promise<{ id: string }> {
  return cursorFetch<{ id: string }>(`/v0/agents/${encodeURIComponent(id)}/followup`, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

/** Stop a running agent */
export async function stopAgent(id: string): Promise<{ id: string }> {
  return cursorFetch<{ id: string }>(`/v0/agents/${encodeURIComponent(id)}/stop`, {
    method: "POST",
  });
}

/** Verify API key and get key info */
export async function getMe(): Promise<{ apiKeyName: string; createdAt: string; userEmail: string }> {
  return cursorFetch("/v0/me");
}
