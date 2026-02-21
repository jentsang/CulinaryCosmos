"use client";

import { useCallback, useState, useMemo } from "react";
import {
  fuzzyMatchNode,
  fuzzyMatchNodes,
  search,
  type SearchResult,
} from "@/services/searchService";
import type { GraphNode, GraphLink } from "@/types/graph";

export function useSearch(nodes: GraphNode[], links: GraphLink[] = []) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [useCursor, setUseCursor] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  const fuzzyResults = useMemo(
    () => fuzzyMatchNodes(query, nodes, 10),
    [query, nodes],
  );

  const submitSearch = useCallback(
    async (
      onNodeSelect: (node: GraphNode) => void,
      onPromptResult?: (result: SearchResult) => void,
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
        const result = await search(trimmed, nodes, links, useCursor ? "cursor" : "gemini");
        console.log("[useSearch] result", {
          type: result.type,
          ...(result.type === "pairing"
            ? { source: result.source?.id, target: result.target?.id }
            : result.type === "node"
              ? { nodeId: result.node?.id }
              : {}),
        });
        if (result.type === "pairing" && onPairingSelect) {
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
        setPromptError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [query, nodes, links, useCursor],
  );

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
  };
}
