"use client";

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { GraphNode, GraphData } from "@/types/graph";
import { SearchBar } from "@/components/SearchBar";
import { useSearch } from "@/hooks/useSearch";
import { forceX, forceY } from "d3-force";
import {
  hashToColor,
  getPairingsWithLevel,
  spreadNodesByCategory,
  CATEGORY_LABELS,
  getCategoryCenter,
  getCategoryIndex,
} from "@/utils/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const NODE_COLORS = ["#3B82F6", "#22C55E", "#F97316", "#A855F7"];

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
  const [highlightedNodes, setHighlightedNodes] = useState<GraphNode[]>([]);
  const [showHolyGrailPanel, setShowHolyGrailPanel] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [sidebarLeftCollapsed, setSidebarLeftCollapsed] = useState(false);
  const [sidebarRightCollapsed, setSidebarRightCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/graph-data")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load graph data");
        return res.json();
      })
      .then((data) => {
        const nodes = spreadNodesByCategory(data.nodes as GraphNode[]);
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

  useEffect(() => {
    setExpandedCategories(new Set());
  }, [selectedNode?.id, highlightedNodes]);

  const clearHighlight = useCallback(() => {
    setSelectedNode(null);
    setHighlightedNodes([]);
  }, []);

  const highlightedNodeIds = useMemo(
    () => new Set(highlightedNodes.map((n) => n.id)),
    [highlightedNodes],
  );

  const graphDataFiltered = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    const visibleIds =
      hiddenCategories.size === 0
        ? new Set(graphData.nodes.map((n) => n.id))
        : new Set(
            graphData.nodes
              .filter((n) => !hiddenCategories.has(n.category ?? "other"))
              .map((n) => n.id),
          );
    const nodes = graphData.nodes.filter((n) => visibleIds.has(n.id));
    const links = graphData.links.filter((link) => {
      const src =
        typeof link.source === "string"
          ? link.source
          : (link.source as { id?: string })?.id ?? "";
      const tgt =
        typeof link.target === "string"
          ? link.target
          : (link.target as { id?: string })?.id ?? "";
      return visibleIds.has(src) && visibleIds.has(tgt);
    });
    return { nodes, links };
  }, [graphData, hiddenCategories]);

  const { nodeDegrees: nodeDegreesFull, maxDegree: maxDegreeFull } =
    useMemo(() => {
      if (!graphData) return { nodeDegrees: new Map<string, number>(), maxDegree: 1 };
      const degrees = new Map<string, number>();
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
    if (!selectedNode || !graphDataFiltered.nodes.length) return;
    const stillVisible = graphDataFiltered.nodes.some((n) => n.id === selectedNode.id);
    if (!stillVisible) {
      setSelectedNode(null);
      setHighlightedNodes([]);
    }
  }, [graphDataFiltered.nodes, selectedNode]);

  const pairingsWithLevel = useMemo(() => {
    if (!selectedNode || !graphDataFiltered.nodes.length) return [];
    return getPairingsWithLevel(
      selectedNode.id,
      graphDataFiltered.links,
      graphDataFiltered.nodes,
    );
  }, [selectedNode, graphDataFiltered]);

  const pairings = useMemo(
    () => pairingsWithLevel.map((p) => p.node),
    [pairingsWithLevel],
  );

  const holyGrailPairings = useMemo(() => {
    if (!graphDataFiltered.nodes.length) return [];
    const nodeMap = new Map(graphDataFiltered.nodes.map((n) => [n.id, n]));
    return graphDataFiltered.links
      .filter((link) => (link as { value?: number }).value === 4)
      .map((link) => {
        const src =
          typeof link.source === "string"
            ? link.source
            : (link.source as { id?: string })?.id ?? "";
        const tgt =
          typeof link.target === "string"
            ? link.target
            : (link.target as { id?: string })?.id ?? "";
        const srcNode = nodeMap.get(src);
        const tgtNode = nodeMap.get(tgt);
        return srcNode && tgtNode
          ? { source: srcNode, target: tgtNode }
          : null;
      })
      .filter((p): p is { source: GraphNode; target: GraphNode } => p !== null);
  }, [graphDataFiltered]);

  const pairingsByCategory = useMemo(() => {
    const groups = new Map<string, { node: GraphNode; level: number }[]>();
    for (const p of pairingsWithLevel) {
      const cat = p.node.category ?? "other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(p);
    }
    return Array.from(groups.entries())
      .map(([cat, items]) => {
        const sorted = [...items].sort((a, b) => b.level - a.level);
        const highLevelCount = sorted.filter((i) => i.level >= 3).length;
        return {
          category: cat,
          label: CATEGORY_LABELS[cat] ?? cat,
          items: sorted,
          highLevelCount,
        };
      })
      .sort((a, b) => b.highLevelCount - a.highLevelCount);
  }, [pairingsWithLevel]);

  const search = useSearch(graphDataFiltered.nodes, graphDataFiltered.links);

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
        clearHighlight();
        return;
      }
      const graphNode = graphDataFiltered.nodes.find(
        (n) => n.id === String(node.id) || n.name === node.name,
      );
      if (graphNode) {
        setHighlightedNodes([]);
        setSelectedNode(graphNode);
      }
    },
    [graphDataFiltered, clearHighlight],
  );

  const nodeColorFn = useCallback(
    (node: unknown) => {
      const n = node as GraphNode;
      const isHighlighted = highlightedNodeIds.has(n.id ?? "");
      const isSelected = selectedNode && n.id === selectedNode.id;
      const isPairing = selectedNode && pairings.some((p) => p.id === n.id);
      if (isHighlighted) return "#FF3B30";
      if (isSelected) return "#FF3B30";
      if (isPairing) return "#34C759";
      if (n.category) return hashToColor(n.category, true);
      const g = n.group ?? 0;
      return NODE_COLORS[g % NODE_COLORS.length];
    },
    [selectedNode, pairings, highlightedNodeIds],
  );

  const nodeValFn = useCallback(
    (node: unknown) => {
      const n = node as GraphNode;
      const isHighlighted = highlightedNodeIds.has(n.id ?? "");
      const isSelected = selectedNode && n.id === selectedNode.id;
      if (isHighlighted || isSelected) return 12;
      const degree = nodeDegreesFull.get(n.id ?? "") ?? 0;
      return 3 + 9 * (degree / maxDegreeFull);
    },
    [selectedNode, highlightedNodeIds, nodeDegreesFull, maxDegreeFull],
  );

  const linkVisibilityFn = useCallback(
    (link: { source?: unknown; target?: unknown } & Record<string, unknown>) => {
      const val = link.value as number | undefined;
      const isLevel4 = val === 4;
      const src =
        typeof link.source === "string"
          ? link.source
          : (link.source as { id?: string })?.id;
      const tgt =
        typeof link.target === "string"
          ? link.target
          : (link.target as { id?: string })?.id;
      if (highlightedNodes.length > 0) {
        const srcHighlighted = highlightedNodeIds.has(src ?? "");
        const tgtHighlighted = highlightedNodeIds.has(tgt ?? "");
        return (srcHighlighted && tgtHighlighted) || isLevel4;
      }
      if (!selectedNode) return isLevel4;
      return src === selectedNode.id || tgt === selectedNode.id;
    },
    [selectedNode, highlightedNodes.length, highlightedNodeIds],
  );

  const linkColorFn = useCallback(
    (
      link: { source?: unknown; target?: unknown } & Record<string, unknown>,
    ) => {
      const val = link.value as number | undefined;
      const isLevel4 = val === 4;
      const src =
        typeof link.source === "string"
          ? link.source
          : (link.source as { id?: string })?.id;
      const tgt =
        typeof link.target === "string"
          ? link.target
          : (link.target as { id?: string })?.id;
      if (highlightedNodes.length > 0) {
        const srcHighlighted = highlightedNodeIds.has(src ?? "");
        const tgtHighlighted = highlightedNodeIds.has(tgt ?? "");
        return srcHighlighted && tgtHighlighted
          ? "rgba(255, 59, 48, 0.9)"
          : isLevel4
            ? "rgba(148, 163, 184, 0.6)"
            : "rgba(0,0,0,0)";
      }
      if (!selectedNode) return isLevel4 ? "rgba(148, 163, 184, 0.6)" : "rgba(0,0,0,0)";
      const connected = src === selectedNode.id || tgt === selectedNode.id;
      return connected ? "rgba(74, 222, 128, 0.7)" : "rgba(0,0,0,0)";
    },
    [selectedNode, highlightedNodes.length, highlightedNodeIds],
  );

  const linkWidthFn = useCallback(
    (
      link: { source?: unknown; target?: unknown } & Record<string, unknown>,
    ) => {
      const val = link.value as number | undefined;
      const isLevel4 = val === 4;
      const src =
        typeof link.source === "string"
          ? link.source
          : (link.source as { id?: string })?.id;
      const tgt =
        typeof link.target === "string"
          ? link.target
          : (link.target as { id?: string })?.id;
      if (highlightedNodes.length > 0) {
        const srcHighlighted = highlightedNodeIds.has(src ?? "");
        const tgtHighlighted = highlightedNodeIds.has(tgt ?? "");
        return srcHighlighted && tgtHighlighted ? 3 : isLevel4 ? 1 : 0;
      }
      if (!selectedNode) return isLevel4 ? 1 : 0;
      return src === selectedNode.id || tgt === selectedNode.id ? 2.5 : 1;
    },
    [selectedNode, highlightedNodes.length, highlightedNodeIds],
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
      (fg as { zoom?: (k: number) => void }).zoom?.(1.0);

      const numCategories = Object.keys(CATEGORY_LABELS).length;
      fg.d3Force(
        "x",
        forceX((d: unknown) => {
          const n = d as GraphNode;
          const center = getCategoryCenter(getCategoryIndex(n.category), numCategories);
          return center.x;
        }).strength(0.04),
      );
      fg.d3Force(
        "y",
        forceY((d: unknown) => {
          const n = d as GraphNode;
          const center = getCategoryCenter(getCategoryIndex(n.category), numCategories);
          return center.y;
        }).strength(0.04),
      );

      const charge = fg.d3Force("charge") as {
        strength?: (v: number | ((n: unknown, i: number, nodes: unknown[]) => number)) => unknown;
      };
      if (charge?.strength) {
        charge.strength((node: unknown) => {
          const n = node as { id?: string };
          const degree = nodeDegreesFull.get(n.id ?? "") ?? 0;
          const base = -12;
          const extra = -36 * (degree / maxDegreeFull);
          return base + extra;
        });
      }
      const link = fg.d3Force("link") as {
        distance?: (v: number) => unknown;
        strength?: (v: number | ((l: unknown, i: number, links: unknown[]) => number)) => unknown;
      };
      if (link?.distance) link.distance(55);
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
          const d1 = nodeDegreesFull.get(srcId) ?? 0;
          const d2 = nodeDegreesFull.get(tgtId) ?? 0;
          const avgDegree = (d1 + d2) / 2;
          const ratio = avgDegree / maxDegreeFull;
          return 0.5 + 0.1 * Math.pow(ratio, 1.2);
        });
      }
      fg.d3ReheatSimulation?.();
    }, 0);
    return () => clearTimeout(id);
  }, [graphDataFiltered, nodeDegreesFull, maxDegreeFull]);

  useEffect(() => {
    if (!graphRef.current || !graphDataFiltered.nodes.length) return;
    const fg = graphRef.current;
    if (highlightedNodes.length > 0) {
      (fg as { zoomToFit?: (ms?: number, padding?: number, nodeFilter?: (n: unknown) => boolean) => void }).zoomToFit?.(
        400,
        50,
        (node) => highlightedNodeIds.has((node as GraphNode).id ?? ""),
      );
      return;
    }
    if (selectedNode) {
      const node = graphDataFiltered.nodes.find((n) => n.id === selectedNode.id);
      const n = (node ?? selectedNode) as { x?: number; y?: number };
      if (typeof n.x === "number" && typeof n.y === "number") {
        (fg as { centerAt?: (a: number, b: number, c?: number) => void }).centerAt?.(n.x, n.y, 400);
        (fg as { zoom?: (k: number, ms?: number) => void }).zoom?.(4, 400);
      }
      return;
    }
    (fg as { centerAt?: (a: number, b: number, c?: number) => void }).centerAt?.(0, 0, 400);
    (fg as { zoom?: (k: number, ms?: number) => void }).zoom?.(1.0, 400);
  }, [selectedNode, highlightedNodes, graphDataFiltered]);

  if (loading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen px-6'>
        <div className='w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin' />
        <p className='mt-4 text-gray-400'>Loading graph data...</p>
      </div>
    );
  }

  if (error || !graphData) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen px-6'>
        <p className='text-red-400 font-medium'>
          {error ?? "Failed to load graph data"}
        </p>
        <p className='mt-2 text-sm text-gray-400'>
          Ensure <code className='font-mono'>data/flavor_pairings.csv</code> or{" "}
          <code className='font-mono'>data/nodes.csv</code> +{" "}
          <code className='font-mono'>edges.csv</code> exist.
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-screen w-screen overflow-hidden relative'>
      <aside
        className={`absolute left-0 top-0 bottom-0 z-10 flex flex-col border-r border-slate-600 bg-slate-800/95 backdrop-blur shadow-xl transition-[width] duration-200 ${
          sidebarLeftCollapsed ? "w-10" : "w-52"
        }`}
      >
        <button
          type='button'
          onClick={() => setSidebarLeftCollapsed((c) => !c)}
          className='absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 flex items-center justify-center rounded-r-lg border border-l-0 border-slate-600 bg-slate-800/95 shadow-sm hover:bg-slate-700 z-20'
          aria-label={sidebarLeftCollapsed ? "Expand categories" : "Collapse categories"}
        >
          <span className='text-gray-400 text-xs'>
            {sidebarLeftCollapsed ? "▶" : "◀"}
          </span>
        </button>
        {!sidebarLeftCollapsed && (
          <div className='flex-1 flex flex-col min-h-0 overflow-hidden py-4'>
            <p className='text-xs font-semibold text-gray-300 px-3 py-2'>
              Categories
            </p>
            <div className='flex gap-1 px-2 py-1.5 border-y border-slate-600'>
              <button
                type='button'
                onClick={() => setHiddenCategories(new Set())}
                className='flex-1 text-xs text-primary font-medium hover:underline'
              >
                Select all
              </button>
              <span className='text-slate-400'>|</span>
              <button
                type='button'
                onClick={() => setHiddenCategories(new Set(Object.keys(CATEGORY_LABELS)))}
                className='flex-1 text-xs text-primary font-medium hover:underline'
              >
                Deselect all
              </button>
            </div>
            <div className='flex-1 min-h-0 overflow-y-auto py-1'>
              {Object.entries(CATEGORY_LABELS).map(([id, label]) => {
                const isHidden = hiddenCategories.has(id);
                return (
                  <label
                    key={id}
                    className='flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 cursor-pointer'
                  >
                    <input
                      type='checkbox'
                      checked={!isHidden}
                      onChange={() => {
                        setHiddenCategories((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        });
                      }}
                      className='rounded border-slate-500'
                    />
                    <span
                      className='w-3 h-3 rounded-full shrink-0'
                      style={{ backgroundColor: hashToColor(id) }}
                      aria-hidden
                    />
                    <span className='text-xs text-gray-300 truncate'>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </aside>
      {highlightedNodes.length > 0 ? (
        <aside
          className={`absolute top-20 z-10 w-40 max-h-[70vh] overflow-y-auto border border-slate-600 bg-slate-800/95 backdrop-blur rounded-lg shadow-xl flex flex-col gap-2 p-2 transition-[left] duration-200 ${
            sidebarLeftCollapsed ? "left-14" : "left-56"
          }`}
        >
          {highlightedNodes.map((n) => (
            <div key={n.id} className='shrink-0'>
              <div className='aspect-square w-full bg-slate-700 rounded overflow-hidden'>
                {n.image ? (
                  <img
                    src={n.image}
                    alt={n.name}
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <div className='w-full h-full flex items-center justify-center text-gray-400 text-2xl'>
                    —
                  </div>
                )}
              </div>
              <p className='px-2 py-1 text-xs font-medium text-gray-200 truncate' title={n.name}>
                {n.name}
              </p>
            </div>
          ))}
        </aside>
      ) : selectedNode?.image ? (
        <aside
          className={`absolute top-20 z-10 w-40 border border-slate-600 bg-slate-800/95 backdrop-blur rounded-lg shadow-xl overflow-hidden transition-[left] duration-200 ${
            sidebarLeftCollapsed ? "left-14" : "left-56"
          }`}
        >
          <div className='aspect-square w-full bg-slate-700'>
            <img
              src={selectedNode?.image ?? ""}
              alt={selectedNode?.name ?? ""}
              className='w-full h-full object-cover'
            />
          </div>
          <p className='px-3 py-2 text-sm font-medium text-gray-200 truncate' title={selectedNode?.name}>
            {selectedNode?.name}
          </p>
        </aside>
      ) : null}
      <div
        className={`absolute top-4 z-20 transition-[left] duration-200 ${
          sidebarLeftCollapsed ? "left-14" : "left-56"
        }`}
      >
        <SearchBar
        query={search.query}
        onQueryChange={search.setQuery}
        focused={search.focused}
        onFocusChange={search.setFocused}
        results={search.fuzzyResults}
        onSelectNode={(node) => {
          setHighlightedNodes([]);
          setSelectedNode(node);
        }}
        onSubmit={() =>
          search.submitSearch(
            (node) => {
              setHighlightedNodes([]);
              setSelectedNode(node);
            },
            (result) => {
              if (result.type === "prompt") {
                // TODO: handle LLM result when integrated
              }
            },
            (nodes) => {
              setSelectedNode(null);
              setHighlightedNodes(nodes);
            },
            (source, target) => {
              setSelectedNode(null);
              setHighlightedNodes([source, target]);
            },
          )
        }
        isSearching={search.isSearching}
        promptError={search.promptError}
        useCursor={search.useCursor}
        onUseCursorChange={search.setUseCursor}
        />
      </div>
      <div className='flex flex-1 min-h-0 relative'>
        <div ref={containerRef} className='flex-1 min-w-0 min-h-0 bg-slate-900 relative w-full h-full'>
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
            nodeRelSize={1}
            linkVisibility={linkVisibilityFn}
            linkColor={linkColorFn}
            linkWidth={linkWidthFn}
            linkDirectionalParticles={0}
            onNodeClick={handleNodeClick}
            onBackgroundClick={clearHighlight}
            cooldownTicks={800}
            d3AlphaDecay={0.018}
            d3VelocityDecay={0.7}
          />
          )}
        </div>
        <aside
          className={`absolute right-0 top-0 bottom-0 z-10 flex flex-col border-l border-slate-600 bg-slate-800/95 backdrop-blur shadow-xl transition-[width] duration-200 ${
            sidebarRightCollapsed ? "w-10" : "w-56"
          }`}
        >
          <button
            type='button'
            onClick={() => setSidebarRightCollapsed((c) => !c)}
            className='absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-12 flex items-center justify-center rounded-l-lg border border-r-0 border-slate-600 bg-slate-800/95 shadow-sm hover:bg-slate-700 z-20'
            aria-label={sidebarRightCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className='text-gray-400 text-xs'>
              {sidebarRightCollapsed ? "◀" : "▶"}
            </span>
          </button>
          {!sidebarRightCollapsed && (
            <div className='flex-1 flex flex-col min-h-0 overflow-hidden'>
              <div className='flex-1 min-h-0 overflow-y-auto px-3 py-4'>
                {highlightedNodes.length > 0 ? (
                  <>
                    <div className='flex items-center justify-between mb-3'>
                      <h2 className='font-bold text-sm pr-2 text-gray-100'>
                        {highlightedNodes.map((n) => n.name).join(" + ")}
                      </h2>
                      <button
                        onClick={clearHighlight}
                        className='text-sm text-gray-400 hover:text-gray-200 shrink-0'
                      >
                        ✕
                      </button>
                    </div>
                    <p className='text-xs text-gray-400 mb-2'>
                      Suggested ingredients from your search
                    </p>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(
                        highlightedNodes.map((n) => n.name).join(" ") + " recipes",
                      )}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center gap-1.5 text-xs text-sky-300 font-medium hover:underline'
                    >
                      Search popular recipes
                      <span aria-hidden>↗</span>
                    </a>
                  </>
                ) : selectedNode ? (
                  <>
                    <div className='flex items-center justify-between mb-3'>
                      <h2 className='font-bold text-sm truncate pr-2 text-gray-100'>{selectedNode.name}</h2>
                      <button
                        onClick={() => setSelectedNode(null)}
                        className='text-sm text-gray-400 hover:text-gray-200 shrink-0'
                      >
                        ✕
                      </button>
                    </div>
                    <p className='text-xs text-gray-400 mb-2'>Pairs well with:</p>
                    {pairingsByCategory.length > 0 ? (
                      <div className='space-y-1'>
                        {pairingsByCategory.map(({ category, label, items }) => {
                          const isExpanded = expandedCategories.has(category);
                          return (
                            <div key={category} className='border-b border-slate-600 last:border-0'>
                              <button
                                type='button'
                                onClick={() => {
                                  setExpandedCategories((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(category)) next.delete(category);
                                    else next.add(category);
                                    return next;
                                  });
                                }}
                                className='w-full flex items-center justify-between py-2 text-left hover:bg-slate-700 rounded px-1 -mx-1'
                              >
                                <span className='text-xs font-semibold text-gray-300 uppercase tracking-wide'>
                                  {label}
                                </span>
                                <span className='text-gray-400 text-xs'>
                                  {isExpanded ? "▼" : "▶"} {items.length}
                                </span>
                              </button>
                              {isExpanded && (
                                <ul className='space-y-1 pb-2 pl-1'>
                                  {items.map(({ node, level }) => (
                                    <li key={node.id}>
                                      <button
                                        onClick={() => {
                                          const n = graphDataFiltered.nodes.find(
                                            (x) => x.id === node.id,
                                          );
                                          if (n) setSelectedNode(n);
                                        }}
                                        className='text-sky-200 font-medium hover:text-sky-100 hover:underline text-left text-sm'
                                      >
                                        {node.name}
                                        {level >= 3 && (
                                          <span className='text-amber-500 ml-0.5' aria-label={level === 4 ? 'Most highly recommended' : 'Very highly recommended'}>
                                            {level === 4 ? '★★' : '★'}
                                          </span>
                                        )}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className='text-gray-400 text-xs'>No pairings in dataset</p>
                    )}
                  </>
                ) : (
                  <>
                    <label className='flex items-center gap-2 cursor-pointer mb-3'>
                      <input
                        type='checkbox'
                        checked={showHolyGrailPanel}
                        onChange={(e) => setShowHolyGrailPanel(e.target.checked)}
                        className='rounded border-slate-500'
                      />
                      <span className='text-xs font-medium text-gray-300'>
                        Holy Grail pairings
                      </span>
                    </label>
                    {showHolyGrailPanel && (
                      <>
                        <h2 className='font-bold text-sm mb-1 text-gray-100'>Holy Grail Pairings</h2>
                        <p className='text-xs text-gray-400 mb-3'>
                          Most highly recommended from The Flavor Bible
                        </p>
                        {holyGrailPairings.length > 0 ? (
                          <ul className='space-y-1.5'>
                            {holyGrailPairings.map(({ source, target }) => (
                              <li key={`${source.id}-${target.id}`}>
                                <button
                                  onClick={() => {
                                    setSelectedNode(null);
                                    setHighlightedNodes([source, target]);
                                  }}
                                  className='text-sky-200 font-medium hover:text-sky-100 hover:underline text-left text-sm block w-full'
                                >
                                  {source.name} — {target.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className='text-gray-400 text-xs'>No holy grail pairings</p>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
