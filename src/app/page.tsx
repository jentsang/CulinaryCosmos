"use client";

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { GraphNode, GraphData } from "@/types/graph";
import { SearchBar } from "@/components/SearchBar";
import { useSearch } from "@/hooks/useSearch";
import { hashToColor, getPairings, spreadNodes } from "@/utils/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const NODE_COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE"];

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
  const [affinity, setAffinity] = useState(0);

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

  const graphDataFiltered = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    const minDegree = (affinity / 100) * maxDegree;
    const links = graphData.links.filter((link) => {
      const src =
        typeof link.source === "string"
          ? link.source
          : (link.source as { id?: string })?.id ?? "";
      const tgt =
        typeof link.target === "string"
          ? link.target
          : (link.target as { id?: string })?.id ?? "";
      const d1 = nodeDegrees.get(src) ?? 0;
      const d2 = nodeDegrees.get(tgt) ?? 0;
      return d1 >= minDegree && d2 >= minDegree;
    });
    return { nodes: graphData.nodes, links };
  }, [graphData, affinity, maxDegree, nodeDegrees]);

  const { nodeDegrees: nodeDegreesFiltered, maxDegree: maxDegreeFiltered } =
    useMemo(() => {
      const degrees = new Map<string, number>();
      for (const link of graphDataFiltered.links) {
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
    }, [graphDataFiltered]);

  const pairings = useMemo(() => {
    if (!selectedNode || !graphDataFiltered.nodes.length) return [];
    return getPairings(
      selectedNode.id,
      graphDataFiltered.links,
      graphDataFiltered.nodes,
    );
  }, [selectedNode, graphDataFiltered]);

  const search = useSearch(graphDataFiltered.nodes);

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
      if (!node || !graphDataFiltered.nodes.length) {
        setSelectedNode(null);
        return;
      }
      const graphNode = graphDataFiltered.nodes.find(
        (n) => n.id === String(node.id) || n.name === node.name,
      );
      if (graphNode) {
        setSelectedNode(graphNode);
      }
    },
    [graphDataFiltered],
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
      const degree = nodeDegreesFiltered.get(n.id ?? "") ?? 0;
      return 6 + 18 * (degree / maxDegreeFiltered);
    },
    [selectedNode, nodeDegreesFiltered, maxDegreeFiltered],
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

  const graphDataStable = useMemo(
    () => graphDataFiltered,
    [graphDataFiltered],
  );

  useEffect(() => {
    if (!graphDataFiltered.nodes.length) return;
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
          const degree = nodeDegreesFiltered.get(n.id ?? "") ?? 0;
          const base = -20;
          const extra = -60 * (degree / maxDegreeFiltered);
          return base + extra;
        });
      }
      const link = fg.d3Force("link") as {
        distance?: (v: number) => unknown;
        strength?: (v: number | ((l: unknown, i: number, links: unknown[]) => number)) => unknown;
      };
      if (link?.distance) link.distance(40);
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
          const d1 = nodeDegreesFiltered.get(srcId) ?? 0;
          const d2 = nodeDegreesFiltered.get(tgtId) ?? 0;
          const avgDegree = (d1 + d2) / 2;
          const ratio = avgDegree / maxDegreeFiltered;
          return 0.85 + 0.15 * Math.pow(ratio, 1.2);
        });
      }
      fg.d3ReheatSimulation?.();
    }, 0);
    return () => clearTimeout(id);
  }, [graphDataFiltered, nodeDegreesFiltered, maxDegreeFiltered]);

  useEffect(() => {
    if (!selectedNode || !graphRef.current || !graphDataFiltered.nodes.length)
      return;
    const node = graphDataFiltered.nodes.find((n) => n.id === selectedNode.id);
    const n = (node ?? selectedNode) as { x?: number; y?: number };
    if (typeof n.x !== "number" || typeof n.y !== "number") return;
    const fg = graphRef.current;
    (fg as { centerAt?: (a: number, b: number, c?: number) => void }).centerAt?.(
      n.x,
      n.y,
      400,
    );
    (fg as { zoom?: (k: number, ms?: number) => void }).zoom?.(4, 400);
  }, [selectedNode, graphDataFiltered]);

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
      <div className='absolute top-4 right-4 z-20 w-56'>
        <label className='block text-xs font-medium text-gray-600 mb-1.5'>
          Affinity (min connections)
        </label>
        <input
          type='range'
          min={0}
          max={100}
          value={affinity}
          onChange={(e) => setAffinity(Number(e.target.value))}
          className='w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-primary'
        />
        <p className='text-xs text-gray-500 mt-1'>
          {affinity}% — showing links between ingredients with ≥{" "}
          {Math.ceil((affinity / 100) * maxDegree)} connections
        </p>
      </div>
      <SearchBar
        query={search.query}
        onQueryChange={search.setQuery}
        focused={search.focused}
        onFocusChange={search.setFocused}
        results={search.fuzzyResults}
        onSelectNode={setSelectedNode}
        onSubmit={() =>
          search.submitSearch(setSelectedNode, (result) => {
            if (result.type === "prompt") {
              // TODO: handle LLM result when integrated
            }
          })
        }
        isSearching={search.isSearching}
        promptError={search.promptError}
      />
      <div className='flex flex-1 min-h-0 relative'>
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
            cooldownTicks={500}
            d3AlphaDecay={0.018}
            d3VelocityDecay={0.25}
          />
          )}
        </div>
        {selectedNode && (
          <aside className='absolute right-4 top-1/2 -translate-y-1/2 w-52 max-h-[50vh] border border-gray-200 bg-white/95 backdrop-blur px-3 py-4 overflow-y-auto flex flex-col rounded-lg shadow-xl z-10'>
            <div className='flex items-center justify-between mb-3'>
              <h2 className='font-bold text-sm truncate pr-2'>{selectedNode.name}</h2>
              <button
                onClick={() => setSelectedNode(null)}
                className='text-sm text-gray-500 hover:text-gray-700 shrink-0'
              >
                ✕
              </button>
            </div>
            <p className='text-xs text-gray-600 mb-2'>Pairs well with:</p>
            <ul className='space-y-1.5'>
              {pairings.length > 0 ? (
                pairings.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        const node = graphDataFiltered.nodes.find(
                          (n) => n.id === p.id,
                        );
                        if (node) setSelectedNode(node);
                      }}
                      className='text-primary font-medium hover:underline text-left text-sm'
                    >
                      {p.name}
                    </button>
                  </li>
                ))
              ) : (
                <li className='text-gray-500 text-xs'>
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
