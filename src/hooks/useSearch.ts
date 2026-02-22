"use client";

import { useCallback, useState, useMemo, useRef } from "react";
import {
  fuzzyMatchNode,
  fuzzyMatchNodes,
  search,
  GEMINI_KEY_REQUIRED,
  type SearchResult,
} from "@/services/searchService";
import type { GraphNode, GraphLink } from "@/types/graph";

function loadStoredKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("geminiApiKey") ?? "";
}

export function useSearch(
  nodes: GraphNode[],
  links: GraphLink[] = [],
  holyGrailPairs: string[] = [],
) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [useCursor, setUseCursor] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>(loadStoredKey);
  const [showGeminiKeyModal, setShowGeminiKeyModal] = useState(false);

  // Callbacks captured when we need to show the modal mid-search
  const pendingCallbacks = useRef<{
    onNodeSelect: (node: GraphNode) => void;
    onPromptResult?: (result: SearchResult) => void;
    onNodesSelect?: (nodes: GraphNode[]) => void;
    onPairingSelect?: (source: GraphNode, target: GraphNode) => void;
  } | null>(null);
  const pendingQuery = useRef<string>("");

  const saveGeminiApiKey = useCallback(
    (key: string) => {
      localStorage.setItem("geminiApiKey", key);
      setGeminiApiKeyState(key);
      setShowGeminiKeyModal(false);

      // Auto-retry the search that triggered the modal
      if (pendingQuery.current && pendingCallbacks.current) {
        const cbs = pendingCallbacks.current;
        const q = pendingQuery.current;
        pendingCallbacks.current = null;
        pendingQuery.current = "";

        setIsSearching(true);
        setPromptError(null);
        search(q, nodes, links, "gemini", key, holyGrailPairs)
          .then((result) => {
            if (result.type === "nodes" && cbs.onNodesSelect) {
              cbs.onNodesSelect(result.nodes);
              setQuery("");
              setFocused(false);
            } else if (result.type === "pairing" && cbs.onPairingSelect) {
              cbs.onPairingSelect(result.source, result.target);
              setQuery("");
              setFocused(false);
            } else if (result.type === "node") {
              cbs.onNodeSelect(result.node);
              setQuery("");
              setFocused(false);
            } else {
              cbs.onPromptResult?.(result);
            }
          })
          .catch((err) => {
            setPromptError(err instanceof Error ? err.message : "Search failed");
          })
          .finally(() => setIsSearching(false));
      }
    },
    [nodes, links, holyGrailPairs],
  );

  const dismissGeminiKeyModal = useCallback(() => {
    setShowGeminiKeyModal(false);
    pendingCallbacks.current = null;
    pendingQuery.current = "";
  }, []);

  const clearGeminiApiKey = useCallback(() => {
    localStorage.removeItem("geminiApiKey");
    setGeminiApiKeyState("");
  }, []);

  const fuzzyResults = useMemo(
    () => fuzzyMatchNodes(query, nodes, 10),
    [query, nodes],
  );

  const submitSearch = useCallback(
    async (
      onNodeSelect: (node: GraphNode) => void,
      onPromptResult?: (result: SearchResult) => void,
      onNodesSelect?: (nodes: GraphNode[]) => void,
      onPairingSelect?: (source: GraphNode, target: GraphNode) => void,
    ) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      const matched = fuzzyMatchNode(trimmed, nodes);
      if (matched) {
        onNodeSelect(matched);
        setQuery("");
        setFocused(false);
        return;
      }

      setIsSearching(true);
      setPromptError(null);
      try {
        const provider = useCursor ? "cursor" : "gemini";
        const result = await search(
          trimmed,
          nodes,
          links,
          provider,
          provider === "gemini" ? geminiApiKey || undefined : undefined,
          provider === "gemini" ? holyGrailPairs : undefined,
        );
        if (result.type === "nodes" && onNodesSelect) {
          onNodesSelect(result.nodes);
          setQuery("");
          setFocused(false);
        } else if (result.type === "pairing" && onPairingSelect) {
          onPairingSelect(result.source, result.target);
          setQuery("");
          setFocused(false);
        } else if (result.type === "node") {
          onNodeSelect(result.node);
          setQuery("");
          setFocused(false);
        } else {
          onPromptResult?.(result);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
        if (message === GEMINI_KEY_REQUIRED) {
          // Capture the search context and show the modal
          pendingQuery.current = trimmed;
          pendingCallbacks.current = { onNodeSelect, onPromptResult, onNodesSelect, onPairingSelect };
          setShowGeminiKeyModal(true);
        } else {
          setPromptError(message);
        }
      } finally {
        setIsSearching(false);
      }
    },
    [query, nodes, links, useCursor, geminiApiKey, holyGrailPairs],
  );

  const openGeminiKeyModal = useCallback(() => {
    setShowGeminiKeyModal(true);
  }, []);

  return {
    query,
    setQuery,
    focused,
    setFocused,
    useCursor,
    setUseCursor,
    fuzzyResults,
    submitSearch,
    isSearching,
    promptError,
    geminiApiKey,
    showGeminiKeyModal,
    openGeminiKeyModal,
    saveGeminiApiKey,
    dismissGeminiKeyModal,
    clearGeminiApiKey,
  };
}
