"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components";
import { getCursorApiKey, COMPOSER_1_5_MODEL } from "@/constants/cursor";
import * as cursorApi from "@/services/cursorApi";
import type { Agent, AgentStatus, ConversationMessage } from "@/types/cursor";

const STATUS_COLORS: Record<AgentStatus, string> = {
  CREATING: "bg-gray-400",
  RUNNING: "bg-green-500",
  FINISHED: "bg-primary",
  STOPPED: "bg-orange-500",
  FAILED: "bg-red-500",
};

export default function ComposerPage() {
  const [apiKeySet, setApiKeySet] = useState<boolean | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model] = useState(COMPOSER_1_5_MODEL);
  const [models, setModels] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);

  const hasKey = !!getCursorApiKey();

  useEffect(() => {
    setApiKeySet(hasKey);
    if (hasKey) {
      cursorApi
        .listModels()
        .then((r) => setModels(r.models || []))
        .catch(() => setModels([COMPOSER_1_5_MODEL]));
    }
  }, [hasKey]);

  const loadAgents = useCallback(async () => {
    if (!hasKey) return;
    setLoading(true);
    try {
      const res = await cursorApi.listAgents({ limit: 20 });
      setAgents(res.agents || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load agents";
      window.alert(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasKey]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAgents();
  }, [loadAgents]);

  const loadConversation = useCallback(
    async (id: string) => {
      if (!hasKey) return;
      setConversationLoading(true);
      setSelectedAgentId(id);
      try {
        const res = await cursorApi.getAgentConversation(id);
        setConversation(res.messages || []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load conversation";
        setConversation([]);
        window.alert(msg);
      } finally {
        setConversationLoading(false);
      }
    },
    [hasKey]
  );

  const handleLaunch = useCallback(async () => {
    if (!hasKey) {
      window.alert(
        "API key required. Set NEXT_PUBLIC_CURSOR_API_KEY in .env (see README)."
      );
      return;
    }
    const repo = repoUrl.trim();
    const text = prompt.trim();
    if (!repo || !text) {
      window.alert("Enter a GitHub repo URL and a prompt.");
      return;
    }
    setLaunching(true);
    try {
      const agent = await cursorApi.launchAgent({
        prompt: { text },
        model: model || undefined,
        source: { repository: repo },
        target: { autoCreatePr: false },
      });
      setAgents((prev) => [agent, ...prev]);
      setPrompt("");
      setSelectedAgentId(agent.id);
      setConversation([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to launch agent";
      window.alert(msg);
    } finally {
      setLaunching(false);
    }
  }, [hasKey, repoUrl, prompt, model]);

  if (apiKeySet === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="bg-surface rounded-xl p-6 max-w-lg">
          <h2 className="text-xl font-bold mb-2">Cursor Composer 1.5</h2>
          <p className="text-gray-600 text-sm mb-4">
            Add your Cursor API key to use the Cloud Agents API (Composer 1.5).
          </p>
          <p className="text-sm text-gray-600">
            Create a key at Cursor Dashboard → Integrations, then set{" "}
            <code className="font-mono font-semibold">
              NEXT_PUBLIC_CURSOR_API_KEY
            </code>{" "}
            in a <code className="font-mono font-semibold">.env</code> file in
            the project root.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 p-6 pb-16">
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            Launch agent (Composer 1.5)
          </h2>
          <input
            type="url"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="GitHub repo URL (e.g. https://github.com/org/repo)"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <textarea
            className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="What should the agent do? (e.g. Add a README with installation steps)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
          {models.length > 0 && (
            <p className="text-xs text-gray-500 mb-2">
              Model: {model || COMPOSER_1_5_MODEL}
            </p>
          )}
          <Button
            title={launching ? "Launching…" : "Launch agent"}
            onClick={handleLaunch}
            disabled={launching}
            className="mt-2"
          />
        </section>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your agents</h2>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-gray-600 text-sm">No agents yet. Launch one above.</p>
          ) : (
            <div className="space-y-4">
              {agents.map((a) => (
                <div
                  key={a.id}
                  className="bg-surface rounded-lg p-4 border border-gray-100"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-2 h-2 rounded-full ${STATUS_COLORS[a.status]}`}
                    />
                    <span className="font-semibold truncate flex-1">
                      {a.name || a.id}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {a.status} · {new Date(a.createdAt).toLocaleString()}
                  </p>
                  {a.summary && (
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                      {a.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      title="View conversation"
                      variant="secondary"
                      onClick={() => loadConversation(a.id)}
                      className="py-2 px-3 text-sm"
                    />
                    {a.target?.url && (
                      <Button
                        title="Open in Cursor"
                        variant="secondary"
                        onClick={() => window.open(a.target!.url!, "_blank")}
                        className="py-2 px-3 text-sm"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {selectedAgentId && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Conversation</h2>
            {conversationLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversation.length === 0 ? (
              <p className="text-gray-600 text-sm">
                No messages yet or still running.
              </p>
            ) : (
              <div className="space-y-3">
                {conversation.map((m) => (
                  <div
                    key={m.id}
                    className={`p-4 rounded-lg ${
                      m.type === "user_message"
                        ? "bg-surface border-l-4 border-primary"
                        : "bg-surface"
                    }`}
                  >
                    <p className="text-xs font-semibold text-gray-500 mb-1">
                      {m.type === "user_message" ? "You" : "Composer"}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
