"use client";

import type { GraphNode } from "@/types/graph";

interface NodeImageCardProps {
  /** Shown when multiple nodes are highlighted from a multi-ingredient search */
  highlightedNodes: GraphNode[];
  /** Shown when a single node is selected and has an image */
  selectedNode: GraphNode | null;
  /** Controls left offset to stay clear of the left sidebar */
  sidebarCollapsed: boolean;
}

export function NodeImageCard({
  highlightedNodes,
  selectedNode,
  sidebarCollapsed,
}: NodeImageCardProps) {
  const leftClass = sidebarCollapsed ? "left-14" : "left-56";

  if (highlightedNodes.length > 0) {
    return (
      <aside
        className={`absolute top-20 z-10 w-40 max-h-[70vh] overflow-y-auto border border-slate-600 bg-slate-800/95 backdrop-blur rounded-lg shadow-xl flex flex-col gap-2 p-2 transition-[left] duration-200 ${leftClass}`}
      >
        {highlightedNodes.map((n) => (
          <div key={n.id} className="shrink-0">
            <div className="aspect-square w-full bg-slate-700 rounded overflow-hidden">
              {n.image ? (
                <img
                  src={n.image}
                  alt={n.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                  —
                </div>
              )}
            </div>
            <p
              className="px-2 py-1 text-xs font-medium text-gray-200 truncate"
              title={n.name}
            >
              {n.name}
            </p>
          </div>
        ))}
      </aside>
    );
  }

  if (selectedNode?.image) {
    return (
      <aside
        className={`absolute top-20 z-10 w-40 border border-slate-600 bg-slate-800/95 backdrop-blur rounded-lg shadow-xl overflow-hidden transition-[left] duration-200 ${leftClass}`}
      >
        <div className="aspect-square w-full bg-slate-700">
          <img
            src={selectedNode.image}
            alt={selectedNode.name ?? ""}
            className="w-full h-full object-cover"
          />
        </div>
        <p
          className="px-3 py-2 text-sm font-medium text-gray-200 truncate"
          title={selectedNode.name}
        >
          {selectedNode.name}
        </p>
      </aside>
    );
  }

  return null;
}
