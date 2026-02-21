"use client";

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { GraphNode, GraphLink, GraphData } from "@/types/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const NODE_COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE"];

function hashToColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function getPairings(
  nodeId: string,
  links: GraphLink[],
  nodes: GraphNode[],
): GraphNode[] {
  const ids = new Set<string>();
  for (const link of links) {
    const src =
      typeof link.source === "string"
        ? link.source
        : ((link.source as { id?: string }).id ?? "");
    const tgt =
      typeof link.target === "string"
        ? link.target
        : ((link.target as { id?: string }).id ?? "");
    if (src === nodeId) ids.add(tgt);
    if (tgt === nodeId) ids.add(src);
  }
  return nodes.filter((n) => ids.has(n.id));
}

function spreadNodes(
  nodes: GraphNode[],
): (GraphNode & { x: number; y: number })[] {
  const n = nodes.length;
  const cols = Math.ceil(Math.sqrt(n));
  const spacing = 70;
  const offset = (cols * spacing) / 2;
  const jitter = spacing * 0.6;
  return nodes.map((node, i) => ({
    ...node,
    x:
      (i % cols) * spacing -
      offset +
      (Math.random() - 0.5) * jitter,
    y:
      Math.floor(i / cols) * spacing -
      offset +
      (Math.random() - 0.5) * jitter,
  }));
}

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<
    | {
        d3Force: (name: string, fn?: unknown) => unknown;
        d3ReheatSimulation?: () => void;
      }
    | undefined
  >(undefined);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    fetch("/api/graph-data")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load graph data");
        return res.json();
      })
      .then((data) => {
        const nodes = spreadNodes(data.nodes as GraphNode[]);
        setGraphData({ nodes, links: data.links });
        setError(null);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load graph data",
        );
        setGraphData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const pairings = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    return getPairings(selectedNode.id, graphData.links, graphData.nodes);
  }, [selectedNode, graphData]);

  const { nodeDegrees, maxDegree } = useMemo(() => {
    const degrees = new Map<string, number>();
    if (!graphData) return { nodeDegrees: degrees, maxDegree: 1 };
    for (const link of graphData.links) {
      const src =
        typeof link.source === "string"
          ? link.source
          : (link.source as { id?: string })?.id ?? "";
      const tgt =
        typeof link.target === "string"
          ? link.target
          : (link.target as { id?: string })?.id ?? "";
      degrees.set(src, (degrees.get(src) ?? 0) + 1);
      degrees.set(tgt, (degrees.get(tgt) ?? 0) + 1);
    }
    const max = Math.max(1, ...degrees.values());
    return { nodeDegrees: degrees, maxDegree: max };
  }, [graphData]);

  useEffect(() => {
    if (!graphData) return;
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const { width, height } = el.getBoundingClientRect();
      setDimensions((prev) => {
        if (
          Math.round(prev.width) === Math.round(width) &&
          Math.round(prev.height) === Math.round(height)
        )
          return prev;
        return { width, height };
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [graphData]);

  const handleNodeClick = useCallback(
    (
      node: {
        id?: string | number;
        name?: string;
        x?: number;
        y?: number;
      } | null,
    ) => {
      if (!node || !graphData) {
        setSelectedNode(null);
        return;
      }
      const graphNode = graphData.nodes.find(
        (n) => n.id === String(node.id) || n.name === node.name,
      );
      if (graphNode) {
        setSelectedNode(graphNode);
      }
    },
    [graphData],
  );

  const nodeColorFn = useCallback(
    (node: unknown) => {
      const n = node as GraphNode;
      const isSelected = selectedNode && n.id === selectedNode.id;
      const isPairing = selectedNode && pairings.some((p) => p.id === n.id);
      if (isSelected) return "#FF3B30";
      if (isPairing) return "#34C759";
      if (n.category) return hashToColor(n.category);
      const g = n.group ?? 0;
      return NODE_COLORS[g % NODE_COLORS.length];
    },
    [selectedNode, pairings],
  );

  const nodeValFn = useCallback(
    (node: unknown) => {
      const n = node as GraphNode;
      const isSelected = selectedNode && n.id === selectedNode.id;
      if (isSelected) return 20;
      const degree = nodeDegrees.get(n.id ?? "") ?? 0;
      return 6 + 18 * (degree / maxDegree);
    },
    [selectedNode, nodeDegrees, maxDegree],
  );

  const linkVisibilityFn = useCallback(
    (link: { source?: unknown; target?: unknown } & Record<string, unknown>) => {
      if (!selectedNode) return false;
      const src =
        typeof link.source === "string"
          ? link.source
          : (link.source as { id?: string })?.id;
      const tgt =
        typeof link.target === "string"
          ? link.target
          : (link.target as { id?: string })?.id;
      return src === selectedNode.id || tgt === selectedNode.id;
    },
    [selectedNode],
  );

  const linkColorFn = useCallback(
    (
      link: { source?: unknown; target?: unknown } & Record<string, unknown>,
    ) => {
      if (!selectedNode) return "rgba(0,0,0,0)";
      const src =
        typeof link.source === "string"
          ? link.source
          : (link.source as { id?: string })?.id;
      const tgt =
        typeof link.target === "string"
          ? link.target
          : (link.target as { id?: string })?.id;
      const connected = src === selectedNode.id || tgt === selectedNode.id;
      return connected ? "rgba(52, 199, 89, 0.6)" : "rgba(0,0,0,0)";
    },
    [selectedNode],
  );

  const linkWidthFn = useCallback(
    (
      link: { source?: unknown; target?: unknown } & Record<string, unknown>,
    ) => {
      if (!selectedNode) return 1;
      const src =
        typeof link.source === "string"
          ? link.source
          : (link.source as { id?: string })?.id;
      const tgt =
        typeof link.target === "string"
          ? link.target
          : (link.target as { id?: string })?.id;
      return src === selectedNode.id || tgt === selectedNode.id ? 2.5 : 1;
    },
    [selectedNode],
  );

  const graphDataStable = useMemo(() => graphData!, [graphData]);

  useEffect(() => {
    if (!graphData) return;
    const id = setTimeout(() => {
      const fg = graphRef.current;
      if (!fg) return;
      (fg as { zoom?: (k: number) => void }).zoom?.(1.8);
      const charge = fg.d3Force("charge") as {
        strength?: (v: number | ((n: unknown, i: number, nodes: unknown[]) => number)) => unknown;
      };
      if (charge?.strength) {
        charge.strength((node: unknown) => {
          const n = node as { id?: string };
          const degree = nodeDegrees.get(n.id ?? "") ?? 0;
          const base = -80;
          const extra = -200 * (degree / maxDegree);
          return base + extra;
        });
      }
      const link = fg.d3Force("link") as {
        distance?: (v: number) => unknown;
        strength?: (v: number | ((l: unknown, i: number, links: unknown[]) => number)) => unknown;
      };
      if (link?.distance) link.distance(100);
      if (link?.strength) {
        link.strength((l: unknown) => {
          const linkObj = l as { source?: { id?: string } | string; target?: { id?: string } | string };
          const srcId =
            typeof linkObj.source === "string"
              ? linkObj.source
              : linkObj.source?.id ?? "";
          const tgtId =
            typeof linkObj.target === "string"
              ? linkObj.target
              : linkObj.target?.id ?? "";
          const d1 = nodeDegrees.get(srcId) ?? 0;
          const d2 = nodeDegrees.get(tgtId) ?? 0;
          const avgDegree = (d1 + d2) / 2;
          const ratio = avgDegree / maxDegree;
          return 0.03 + 0.92 * Math.pow(ratio, 1.5);
        });
      }
      fg.d3ReheatSimulation?.();
    }, 0);
    return () => clearTimeout(id);
  }, [graphData, nodeDegrees, maxDegree]);

  useEffect(() => {
    if (!selectedNode || !graphRef.current || !graphData) return;
    const node = graphData.nodes.find((n) => n.id === selectedNode.id);
    const n = (node ?? selectedNode) as { x?: number; y?: number };
    if (typeof n.x !== "number" || typeof n.y !== "number") return;
    const fg = graphRef.current;
    (fg as { centerAt?: (a: number, b: number, c?: number) => void }).centerAt?.(
      n.x,
      n.y,
      400,
    );
    (fg as { zoom?: (k: number, ms?: number) => void }).zoom?.(4, 400);
  }, [selectedNode, graphData]);

  const searchResults = useMemo(() => {
    if (!graphData || !searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return graphData.nodes
      .filter((n) => n.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [graphData, searchQuery]);

  if (loading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen px-6'>
        <div className='w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin' />
        <p className='mt-4 text-gray-600'>Loading graph data...</p>
      </div>
    );
  }

  if (error || !graphData) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen px-6'>
        <p className='text-red-600 font-medium'>
          {error ?? "Failed to load graph data"}
        </p>
        <p className='mt-2 text-sm text-gray-600'>
          Ensure <code className='font-mono'>data/flavor_pairings.csv</code> or{" "}
          <code className='font-mono'>data/nodes.csv</code> +{" "}
          <code className='font-mono'>edges.csv</code> exist.
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-screen w-screen overflow-hidden relative'>
      <div className='absolute top-4 left-4 z-10 w-72'>
        <input
          type='text'
          placeholder='Search flavours...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          className='w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white/95 backdrop-blur shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm'
        />
        {searchFocused && searchQuery.trim() && (
          <div className='absolute top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden max-h-60 overflow-y-auto'>
            {searchResults.length > 0 ? (
              searchResults.map((node) => (
                <button
                  key={node.id}
                  type='button'
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelectedNode(node);
                    setSearchQuery("");
                    setSearchFocused(false);
                  }}
                  className='w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0'
                >
                  {node.name}
                </button>
              ))
            ) : (
              <div className='px-4 py-3 text-sm text-gray-500'>No matches</div>
            )}
          </div>
        )}
      </div>
      <div className='flex flex-1 min-h-0'>
        <div ref={containerRef} className='flex-1 min-w-0 min-h-0 bg-gray-50 relative w-full h-full'>
          {dimensions.width > 0 && dimensions.height > 0 && (
          <ForceGraph2D
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref={graphRef as any}
            graphData={graphDataStable}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel={(node) => (node as GraphNode).name}
            nodeColor={nodeColorFn}
            nodeVal={nodeValFn}
            nodeRelSize={2}
            linkVisibility={linkVisibilityFn}
            linkColor={linkColorFn}
            linkWidth={linkWidthFn}
            linkDirectionalParticles={0}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => setSelectedNode(null)}
            cooldownTicks={300}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
          )}
        </div>
        {selectedNode && (
          <aside className='w-72 border-l border-gray-200 bg-white p-4 overflow-y-auto shrink-0 flex flex-col'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='font-bold text-lg'>{selectedNode.name}</h2>
              <button
                onClick={() => setSelectedNode(null)}
                className='text-sm text-gray-500 hover:text-gray-700'
              >
                ✕
              </button>
            </div>
            <p className='text-sm text-gray-600 mb-2'>Pairs well with:</p>
            <ul className='space-y-2'>
              {pairings.length > 0 ? (
                pairings.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        const node = graphData.nodes.find((n) => n.id === p.id);
                        if (node) setSelectedNode(node);
                      }}
                      className='text-primary font-medium hover:underline text-left'
                    >
                      {p.name}
                    </button>
                  </li>
                ))
              ) : (
                <li className='text-gray-500 text-sm'>
                  No pairings in dataset
                </li>
              )}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
