"use client";

import { useState, useEffect } from "react";
import type { GraphData } from "@/types/graph";

interface UseGraphDataResult {
  graphData: GraphData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the flavor graph data from /api/graph-data.
 * Shared between the home page and cookbook page to avoid duplicate fetch logic.
 */
export function useGraphData(): UseGraphDataResult {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/graph-data")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load graph data");
        return res.json();
      })
      .then((data: GraphData) => {
        setGraphData(data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to load graph data",
        );
        setGraphData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { graphData, loading, error };
}
