"use client";

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { GraphNode, GraphData } from "@/types/graph";
import { SearchBar } from "@/components/SearchBar";
import { GeminiKeyModal } from "@/components/GeminiKeyModal";
import { useSearch } from "@/hooks/useSearch";
import { useGraphData } from "@/hooks/useGraphData";
import {
  hashToColor,
  hasLinkBetween,
  getPairingsWithLevel,
  spreadNodesByCategory,
  CATEGORY_LABELS,
} from "@/utils/graph";
import { saveNode, unsaveNode, isNodeSaved } from "@/services/recipeStorage";
import { CategorySidebar } from "./_components/CategorySidebar";
import { NodeDetailsSidebar } from "./_components/NodeDetailsSidebar";
import { NodeImageCard } from "./_components/NodeImageCard";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

const NODE_COLORS = ["#3B82F6", "#22C55E", "#F97316", "#A855F7"];

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [is3D, setIs3D] = useState(true);

  const graphRef = useRef<
    | {
        // 2D methods
        centerAt?: (x: number, y: number, ms?: number) => void;
        zoom?: (k: number, ms?: number) => void;
        // 3D methods
        cameraPosition?: (
          position: { x?: number; y?: number; z?: number },
          lookAt?: { x?: number; y?: number; z?: number },
          transitionMs?: number,
        ) => void;
        // shared
        zoomToFit?: (ms?: number, padding?: number, nodeFilter?: (n: unknown) => boolean) => void;
        d3Force?: (name: string, fn?: unknown) => unknown;
      }
    | undefined
  >(undefined);

  const { graphData: rawGraphData, loading, error } = useGraphData();
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  // Spread nodes in 3D, resolve overlaps, then pin — no simulation drift.
  useEffect(() => {
    if (!rawGraphData) return;
    const nodes = spreadNodesByCategory(rawGraphData.nodes as GraphNode[]) as (GraphNode & { x: number; y: number; z: number })[];

    // Iterative 3D collision resolution.
    const COLLISION_R = 6;
    const ITERS = 20;
    for (let iter = 0; iter < ITERS; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          const minDist = COLLISION_R * 2;
          if (distSq < minDist * minDist && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const pushAmt = (minDist - dist) * 0.02;
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;
            a.x -= nx * pushAmt;
            a.y -= ny * pushAmt;
            a.z -= nz * pushAmt;
            b.x += nx * pushAmt;
            b.y += ny * pushAmt;
            b.z += nz * pushAmt;
          }
        }
      }
    }

    // Pin every node so ForceGraph3D never moves them.
    const pinned = nodes.map((n) => ({ ...n, fx: n.x, fy: n.y, fz: n.z }));
    settledRef.current = true;
    setGraphData({ nodes: pinned, links: rawGraphData.links });
  }, [rawGraphData]);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<GraphNode[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [sidebarLeftCollapsed, setSidebarLeftCollapsed] = useState(false);
  const [sidebarRightCollapsed, setSidebarRightCollapsed] = useState(false);
  const settledRef = useRef(false);
  const [isSelectedNodeSaved, setIsSelectedNodeSaved] = useState(false);

  useEffect(() => {
    setIsSelectedNodeSaved(selectedNode ? isNodeSaved(selectedNode.id) : false);
  }, [selectedNode?.id]);

  const clearHighlight = useCallback(() => {
    setSelectedNode(null);
    setHighlightedNodes([]);
  }, []);

  const handleToggleSaveNode = useCallback(() => {
    if (!selectedNode) return;
    if (isSelectedNodeSaved) {
      unsaveNode(selectedNode.id);
      setIsSelectedNodeSaved(false);
    } else {
      saveNode(selectedNode.id, selectedNode.name, selectedNode.category);
      setIsSelectedNodeSaved(true);
    }
  }, [selectedNode, isSelectedNodeSaved]);

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

  const { nodeDegrees: nodeDegreesFull, maxDegree: maxDegreeFull } = useMemo(() => {
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

  // Deselect node if its category is hidden
  useEffect(() => {
    if (!selectedNode || !graphDataFiltered.nodes.length) return;
    if (!graphDataFiltered.nodes.some((n) => n.id === selectedNode.id)) {
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
        return srcNode && tgtNode ? { source: srcNode, target: tgtNode } : null;
      })
      .filter((p): p is { source: GraphNode; target: GraphNode } => p !== null);
  }, [graphDataFiltered]);

  const holyGrailPairStrings = useMemo(
    () => holyGrailPairings.map(({ source, target }) => `${source.id} + ${target.id}`),
    [holyGrailPairings],
  );

  const search = useSearch(
    graphDataFiltered.nodes,
    graphDataFiltered.links,
    holyGrailPairStrings,
  );

  // Resize observer for graph container
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
    (node: { id?: string | number; name?: string; x?: number; y?: number; z?: number } | null) => {
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
      if (
        (highlightedNodes.length > 0 || selectedNode) &&
        !isHighlighted &&
        !isSelected &&
        !isPairing
      )
        return "#9CA3AF";
      if (isHighlighted) return "#FF3B30";
      if (isSelected) return "#FF3B30";
      if (n.category) return hashToColor(n.category, true);
      const g = n.group ?? 0;
      return NODE_COLORS[g % NODE_COLORS.length];
    },
    [selectedNode, pairings, highlightedNodeIds, highlightedNodes.length],
  );

  const nodeValFn = useCallback(
    (node: unknown) => {
      const n = node as GraphNode;
      const degree = nodeDegreesFull.get(n.id ?? "") ?? 0;
      return 1 + 20 * (degree / maxDegreeFull);
    },
    [nodeDegreesFull, maxDegreeFull],
  );

  // Build a stable node-category lookup so linkVisibilityFn can filter hidden nodes.
  const nodeCategoryMap = useMemo(() => {
    if (!graphData) return new Map<string, string>();
    return new Map(graphData.nodes.map((n) => [n.id, n.category ?? "other"]));
  }, [graphData]);

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
      // Hide links connected to nodes in hidden categories
      if (
        hiddenCategories.has(nodeCategoryMap.get(src ?? "") ?? "") ||
        hiddenCategories.has(nodeCategoryMap.get(tgt ?? "") ?? "")
      )
        return false;
      if (highlightedNodes.length > 0) {
        return (
          (highlightedNodeIds.has(src ?? "") && highlightedNodeIds.has(tgt ?? "")) ||
          isLevel4
        );
      }
      if (!selectedNode) return isLevel4;
      return src === selectedNode.id || tgt === selectedNode.id;
    },
    [selectedNode, highlightedNodes.length, highlightedNodeIds, hiddenCategories, nodeCategoryMap],
  );

  const linkColorFn = useCallback(
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
        const srcH = highlightedNodeIds.has(src ?? "");
        const tgtH = highlightedNodeIds.has(tgt ?? "");
        if (srcH && tgtH) {
          return (link as { isSynthetic?: boolean }).isSynthetic
            ? "rgba(59, 130, 246, 0.9)"
            : "rgba(255, 59, 48, 0.9)";
        }
        return isLevel4 ? "rgba(148, 163, 184, 0.6)" : "rgba(0,0,0,0)";
      }
      if (!selectedNode) return isLevel4 ? "rgba(148, 163, 184, 0.6)" : "rgba(0,0,0,0)";
      const connected = src === selectedNode.id || tgt === selectedNode.id;
      return connected ? "rgba(74, 222, 128, 0.7)" : "rgba(0,0,0,0)";
    },
    [selectedNode, highlightedNodes.length, highlightedNodeIds],
  );

  const linkWidthFn = useCallback(
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
        const srcH = highlightedNodeIds.has(src ?? "");
        const tgtH = highlightedNodeIds.has(tgt ?? "");
        return srcH && tgtH ? 3 : isLevel4 ? 1 : 0;
      }
      if (!selectedNode) return isLevel4 ? 1 : 0;
      return src === selectedNode.id || tgt === selectedNode.id ? 2.5 : 1;
    },
    [selectedNode, highlightedNodes.length, highlightedNodeIds],
  );


  const linkLineDashFn = useCallback(
    (link: { source?: unknown; target?: unknown } & Record<string, unknown>) => {
      if ((link as { isSynthetic?: boolean }).isSynthetic) return [4, 4];
      return null;
    },
    [],
  );

  // nodeVisibility: hide nodes whose category is toggled off.
  // This replaces filtering graphData (which would restart the simulation).
  const nodeVisibilityFn = useCallback(
    (node: unknown) => {
      const n = node as GraphNode;
      return !hiddenCategories.has(n.category ?? "other");
    },
    [hiddenCategories],
  );

  // Add synthetic dotted links between multi-highlighted nodes with no existing pairing.
  // Always based on the full graphData so the data reference never changes on category toggles.
  const graphDataForDisplay = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    if (highlightedNodes.length < 2) return graphData;
    const { links } = graphData;
    const syntheticLinks: { source: string; target: string; isSynthetic?: boolean }[] = [];
    for (let i = 0; i < highlightedNodes.length; i++) {
      for (let j = i + 1; j < highlightedNodes.length; j++) {
        const a = highlightedNodes[i];
        const b = highlightedNodes[j];
        if (!hasLinkBetween(a.id, b.id, links)) {
          syntheticLinks.push({ source: a.id, target: b.id, isSynthetic: true });
        }
      }
    }
    return { nodes: graphData.nodes, links: [...links, ...syntheticLinks] };
  }, [graphData, highlightedNodes]);

  const hasSyntheticLinks =
    graphDataForDisplay.links.length > (graphData?.links.length ?? 0);


  // Camera/viewport navigation to selected or highlighted nodes
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || !graphDataFiltered.nodes.length) return;
    if (highlightedNodes.length > 0) {
      fg.zoomToFit?.(400, 80, (node) =>
        highlightedNodeIds.has((node as GraphNode).id ?? ""),
      );
      return;
    }
    if (selectedNode) {
      const node = graphDataFiltered.nodes.find((n) => n.id === selectedNode.id);
      const n = (node ?? selectedNode) as { x?: number; y?: number; z?: number };
      if (is3D) {
        if (typeof n.x === "number" && typeof n.y === "number" && typeof n.z === "number") {
          fg.cameraPosition?.(
            { x: n.x, y: n.y, z: n.z + 80 },
            { x: n.x, y: n.y, z: n.z },
            400,
          );
        }
      } else {
        if (typeof n.x === "number" && typeof n.y === "number") {
          fg.centerAt?.(n.x, n.y, 400);
          fg.zoom?.(4, 400);
        }
      }
    }
  }, [selectedNode, highlightedNodes, is3D]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-gray-400">Loading graph data...</p>
      </div>
    );
  }

  if (error || !graphData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <p className="text-red-400 font-medium">{error ?? "Failed to load graph data"}</p>
        <p className="mt-2 text-sm text-gray-400">
          Ensure <code className="font-mono">data/flavor_pairings.csv</code> or{" "}
          <code className="font-mono">data/nodes.csv</code> +{" "}
          <code className="font-mono">data/edges.csv</code> exist.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden relative">
      {search.showGeminiKeyModal && (
        <GeminiKeyModal
          onSubmit={search.saveGeminiApiKey}
          onDismiss={search.dismissGeminiKeyModal}
        />
      )}

      <CategorySidebar
        collapsed={sidebarLeftCollapsed}
        hiddenCategories={hiddenCategories}
        onToggleCollapse={() => setSidebarLeftCollapsed((c) => !c)}
        onToggleCategory={(id) => {
          setHiddenCategories((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onSelectAll={() => setHiddenCategories(new Set())}
        onDeselectAll={() =>
          setHiddenCategories(new Set(Object.keys(CATEGORY_LABELS)))
        }
      />

      <NodeImageCard
        highlightedNodes={highlightedNodes}
        selectedNode={selectedNode}
        sidebarCollapsed={sidebarLeftCollapsed}
      />

      <div
        className={`absolute top-4 z-20 flex items-center gap-2 transition-[right] duration-200 ${
          sidebarRightCollapsed ? "right-[72px]" : "right-64"
        }`}
      >
        <button
          onClick={() => setIs3D((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-200 bg-slate-800/95 border border-slate-600 backdrop-blur shadow-sm hover:bg-slate-700 transition-colors"
          title={is3D ? "Switch to 2D view" : "Switch to 3D view"}
        >
          <span>{is3D ? "2D" : "3D"}</span>
          <span className="text-xs text-gray-400">{is3D ? "flat" : "space"}</span>
        </button>

        <a
          href="/cookbook"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-200 bg-slate-800/95 border border-slate-600 backdrop-blur shadow-sm hover:bg-slate-700"
        >
          <span>📖</span>
          <span>Cookbook</span>
        </a>
      </div>

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
          geminiApiKey={search.geminiApiKey || undefined}
          onAddGeminiKey={search.openGeminiKeyModal}
          onRemoveGeminiKey={search.clearGeminiApiKey}
        />
      </div>

      <div className="flex flex-1 min-h-0 relative">
        <div
          ref={containerRef}
          className="flex-1 min-w-0 min-h-0 bg-slate-900 relative w-full h-full"
        >
          {dimensions.width > 0 && dimensions.height > 0 && (
            is3D ? (
              <ForceGraph3D
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={graphRef as any}
                graphData={graphDataForDisplay}
                nodeVisibility={nodeVisibilityFn}
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
                cooldownTicks={0}
                backgroundColor="#0f172a"
              />
            ) : (
              <ForceGraph2D
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={graphRef as any}
                graphData={graphDataForDisplay}
                nodeVisibility={nodeVisibilityFn}
                width={dimensions.width}
                height={dimensions.height}
                nodeLabel={(node) => (node as GraphNode).name}
                nodeColor={nodeColorFn}
                nodeVal={nodeValFn}
                nodeRelSize={1}
                linkVisibility={linkVisibilityFn}
                linkColor={linkColorFn}
                linkWidth={linkWidthFn}
                linkLineDash={linkLineDashFn}
                linkDirectionalParticles={0}
                onNodeClick={handleNodeClick}
                onBackgroundClick={clearHighlight}
                cooldownTicks={0}
              />
            )
          )}
        </div>

        <NodeDetailsSidebar
          collapsed={sidebarRightCollapsed}
          onToggleCollapse={() => setSidebarRightCollapsed((c) => !c)}
          highlightedNodes={highlightedNodes}
          hasSyntheticLinks={hasSyntheticLinks}
          onClearHighlight={clearHighlight}
          selectedNode={selectedNode}
          isSelectedNodeSaved={isSelectedNodeSaved}
          onToggleSaveNode={handleToggleSaveNode}
          pairingsByCategory={pairingsByCategory}
          onSelectPairing={(node) => {
            const n = graphDataFiltered.nodes.find((x) => x.id === node.id);
            if (n) setSelectedNode(n);
          }}
          holyGrailPairings={holyGrailPairings}
          onHighlightPair={(source, target) => {
            setSelectedNode(null);
            setHighlightedNodes([source, target]);
          }}
        />
      </div>
    </div>
  );
}
