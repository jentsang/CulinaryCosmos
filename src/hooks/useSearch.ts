"use client";

import { useCallback, useState, useMemo } from "react";
import {
  fuzzyMatchNode,
  fuzzyMatchNodes,
  search,
  type SearchResult,
} from "@/services/searchService";
import type { GraphNode } from "@/types/graph";

export function useSearch(nodes: GraphNode[]) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
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
        const result = await search(trimmed, nodes);
        if (result.type === "node") {
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
    [query, nodes],
  );

  return {
    query,
    setQuery,
    focused,
    setFocused,
    fuzzyResults,
    submitSearch,
    isSearching,
    promptError,
  };
}
