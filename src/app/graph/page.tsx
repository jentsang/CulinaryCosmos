"use client";

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { GraphNode, GraphLink, GraphData } from "@/types/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const NODE_COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE"];

function getPairings(nodeId: string, links: GraphLink[], nodes: GraphNode[]): GraphNode[] {
  const ids = new Set<string>();
  for (const link of links) {
    const src = typeof link.source === "string" ? link.source : (link.source as { id?: string }).id ?? "";
    const tgt = typeof link.target === "string" ? link.target : (link.target as { id?: string }).id ?? "";
    if (src === nodeId) ids.add(tgt);
    if (tgt === nodeId) ids.add(src);
  }
  return nodes.filter((n) => ids.has(n.id));
}

export default function GraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    fetch("/api/graph-data")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load graph data");
        return res.json();
      })
      .then((data) => {
        setGraphData({ nodes: data.nodes, links: data.links });
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load graph data");
        setGraphData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const pairings = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    return getPairings(selectedNode.id, graphData.links, graphData.nodes);
  }, [selectedNode, graphData]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions((prev) => {
          if (Math.round(prev.width) === Math.round(width) && Math.round(prev.height) === Math.round(height))
            return prev;
          return { width, height };
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleNodeClick = useCallback(
    (node: { id?: string | number; name?: string; x?: number; y?: number } | null) => {
      if (!node || !graphData) {
        setSelectedNode(null);
        return;
      }
      const graphNode = graphData.nodes.find((n) => n.id === String(node.id) || n.name === node.name);
      if (graphNode) {
        setSelectedNode(graphNode);
      }
    },
    [graphData]
  );

  const nodeColorFn = useCallback(
    (node: unknown) => {
      const n = node as GraphNode;
      const isSelected = selectedNode && n.id === selectedNode.id;
      const isPairing = selectedNode && pairings.some((p) => p.id === n.id);
      if (isSelected) return "#FF3B30";
      if (isPairing) return "#34C759";
      const g = n.group ?? 0;
      return NODE_COLORS[g % NODE_COLORS.length];
    },
    [selectedNode, pairings]
  );

  const nodeValFn = useCallback(
    (node: unknown) => {
      const n = node as GraphNode;
      const isSelected = selectedNode && n.id === selectedNode.id;
      return isSelected ? 14 : 8 + n.name.length;
    },
    [selectedNode]
  );

  const linkColorFn = useCallback(
    (link: { source?: unknown; target?: unknown } & Record<string, unknown>) => {
      if (!selectedNode) return "rgba(0,0,0,0.2)";
      const src = typeof link.source === "string" ? link.source : (link.source as { id?: string })?.id;
      const tgt = typeof link.target === "string" ? link.target : (link.target as { id?: string })?.id;
      const connected = src === selectedNode.id || tgt === selectedNode.id;
      return connected ? "rgba(52, 199, 89, 0.6)" : "rgba(0,0,0,0.1)";
    },
    [selectedNode]
  );

  const linkWidthFn = useCallback(
    (link: { source?: unknown; target?: unknown } & Record<string, unknown>) => {
      if (!selectedNode) return 1;
      const src = typeof link.source === "string" ? link.source : (link.source as { id?: string })?.id;
      const tgt = typeof link.target === "string" ? link.target : (link.target as { id?: string })?.id;
      return src === selectedNode.id || tgt === selectedNode.id ? 2.5 : 1;
    },
    [selectedNode]
  );

  const graphDataStable = useMemo(() => graphData!, [graphData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-gray-600">Loading graph data...</p>
      </div>
    );
  }

  if (error || !graphData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <p className="text-red-600 font-medium">{error ?? "Failed to load graph data"}</p>
        <p className="mt-2 text-sm text-gray-600">
          Ensure <code className="font-mono">data/nodes.csv</code> and{" "}
          <code className="font-mono">data/edges.csv</code> exist.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Flavour Pairing Network</h1>
          <p className="text-sm text-gray-600 mt-1">
            Click a node to select • Drag to rearrange • Hover for tooltip
          </p>
        </div>
        {selectedNode && (
          <button
            onClick={() => setSelectedNode(null)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear selection
          </button>
        )}
      </div>
      <div className="flex flex-1 min-h-0">
        <div ref={containerRef} className="flex-1 min-w-0 bg-gray-50 relative">
          <ForceGraph2D
            graphData={graphDataStable}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel={(node) => (node as GraphNode).name}
            nodeColor={nodeColorFn}
            nodeVal={nodeValFn}
            linkColor={linkColorFn}
            linkWidth={linkWidthFn}
            linkDirectionalParticles={0}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => setSelectedNode(null)}
            cooldownTicks={100}
            d3AlphaDecay={0.08}
            d3VelocityDecay={0.4}
          />
        </div>
        {selectedNode && (
          <aside className="w-72 border-l border-gray-200 bg-white p-4 overflow-y-auto shrink-0">
            <h2 className="font-bold text-lg mb-2">{selectedNode.name}</h2>
            <p className="text-sm text-gray-600 mb-4">Pairs well with:</p>
            <ul className="space-y-2">
              {pairings.length > 0 ? (
                pairings.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        const node = graphData.nodes.find((n) => n.id === p.id);
                        if (node) setSelectedNode(node);
                      }}
                      className="text-primary font-medium hover:underline text-left"
                    >
                      {p.name}
                    </button>
                  </li>
                ))
              ) : (
                <li className="text-gray-500 text-sm">No pairings in dataset</li>
              )}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
