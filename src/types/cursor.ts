/**
 * Types for Cursor Cloud Agents API
 * @see https://cursor.com/docs/cloud-agent/api/endpoints
 */

export type AgentStatus = "CREATING" | "RUNNING" | "FINISHED" | "STOPPED" | "FAILED";

export interface AgentSource {
  repository: string;
  ref?: string;
  prUrl?: string;
}

export interface AgentTarget {
  branchName?: string;
  url?: string;
  prUrl?: string | null;
  autoCreatePr?: boolean;
  openAsCursorGithubApp?: boolean;
  skipReviewerRequest?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  source: AgentSource;
  target: AgentTarget;
  summary?: string;
  createdAt: string;
}

export interface AgentListResponse {
  agents: Agent[];
  nextCursor?: string;
}

export type MessageType = "user_message" | "assistant_message";

export interface ConversationMessage {
  id: string;
  type: MessageType;
  text: string;
}

export interface AgentConversationResponse {
  id: string;
  messages: ConversationMessage[];
}

export interface LaunchAgentParams {
  prompt: { text: string; images?: Array<{ data: string; dimension: { width: number; height: number } }> };
  model?: string;
  source: AgentSource;
  target?: Partial<AgentTarget>;
  webhook?: { url: string; secret?: string };
}

export interface CursorApiError {
  error: string;
  message: string;
}
