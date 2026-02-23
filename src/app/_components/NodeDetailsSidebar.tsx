"use client";

import { useState, useEffect } from "react";
import type { GraphNode } from "@/types/graph";
import type { PairingWithLevel } from "@/utils/graph";

interface PairingsByCategory {
  category: string;
  label: string;
  items: PairingWithLevel[];
  highLevelCount: number;
}

interface NodeDetailsSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;

  // Multi-highlight state (AI ingredient search results)
  highlightedNodes: GraphNode[];
  hasSyntheticLinks: boolean;
  onClearHighlight: () => void;

  // Single selected node state
  selectedNode: GraphNode | null;
  isSelectedNodeSaved: boolean;
  onToggleSaveNode: () => void;
  pairingsByCategory: PairingsByCategory[];
  onSelectPairing: (node: GraphNode) => void;

  // Default state (no selection)
  holyGrailPairings: { source: GraphNode; target: GraphNode }[];
  onHighlightPair: (source: GraphNode, target: GraphNode) => void;
}

export function NodeDetailsSidebar({
  collapsed,
  onToggleCollapse,
  highlightedNodes,
  hasSyntheticLinks,
  onClearHighlight,
  selectedNode,
  isSelectedNodeSaved,
  onToggleSaveNode,
  pairingsByCategory,
  onSelectPairing,
  holyGrailPairings,
  onHighlightPair,
}: NodeDetailsSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showHolyGrailPanel, setShowHolyGrailPanel] = useState(true);

  // Reset expanded accordion whenever the active node/highlight changes
  useEffect(() => {
    setExpandedCategories(new Set());
  }, [selectedNode?.id, highlightedNodes]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <aside
      className={`absolute right-0 top-0 bottom-0 z-10 flex flex-col border-l border-slate-600 bg-slate-800/95 backdrop-blur shadow-xl transition-[width] duration-200 ${
        collapsed ? "w-10" : "w-56"
      }`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-12 flex items-center justify-center rounded-l-lg border border-r-0 border-slate-600 bg-slate-800/95 shadow-sm hover:bg-slate-700 z-20"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <span className="text-gray-400 text-xs">{collapsed ? "◀" : "▶"}</span>
      </button>

      {!collapsed && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
            {highlightedNodes.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-sm pr-2 text-gray-100">
                    {highlightedNodes.map((n) => n.name).join(" + ")}
                  </h2>
                  <button
                    onClick={onClearHighlight}
                    className="text-sm text-gray-400 hover:text-gray-200 shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  Suggested ingredients from your search
                </p>
                {hasSyntheticLinks && (
                  <p className="text-xs text-sky-400 mb-2 flex items-center gap-1">
                    <span aria-hidden>—</span>
                    Dotted blue lines indicate pairings suggested by Gemini (not in
                    database)
                  </p>
                )}
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(
                    highlightedNodes.map((n) => n.name).join(" ") + " recipes",
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-sky-300 font-medium hover:underline"
                >
                  Search popular recipes
                  <span aria-hidden>↗</span>
                </a>
              </>
            ) : selectedNode ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-sm truncate pr-2 text-gray-100">
                    {selectedNode.name}
                  </h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={onToggleSaveNode}
                      title={
                        isSelectedNodeSaved
                          ? "Remove from Cookbook"
                          : "Save to Cookbook"
                      }
                      className="text-base leading-none text-gray-400 hover:text-amber-300 transition-colors px-1"
                    >
                      {isSelectedNodeSaved ? "★" : "☆"}
                    </button>
                    <button
                      onClick={onClearHighlight}
                      className="text-sm text-gray-400 hover:text-gray-200"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-2">Pairs well with:</p>
                {pairingsByCategory.length > 0 ? (
                  <div className="space-y-1">
                    {pairingsByCategory.map(({ category, label, items }) => {
                      const isExpanded = expandedCategories.has(category);
                      return (
                        <div
                          key={category}
                          className="border-b border-slate-600 last:border-0"
                        >
                          <button
                            type="button"
                            onClick={() => toggleCategory(category)}
                            className="w-full flex items-center justify-between py-2 text-left hover:bg-slate-700 rounded px-1 -mx-1"
                          >
                            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                              {label}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {isExpanded ? "▼" : "▶"} {items.length}
                            </span>
                          </button>
                          {isExpanded && (
                            <ul className="space-y-1 pb-2 pl-1">
                              {items.map(({ node, level }) => (
                                <li key={node.id}>
                                  <button
                                    onClick={() => onSelectPairing(node)}
                                    className="text-sky-200 font-medium hover:text-sky-100 hover:underline text-left text-sm"
                                  >
                                    {node.name}
                                    {level >= 3 && (
                                      <span
                                        className="text-amber-500 ml-0.5"
                                        aria-label={
                                          level === 4
                                            ? "Most highly recommended"
                                            : "Very highly recommended"
                                        }
                                      >
                                        {level === 4 ? "★★" : "★"}
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
                  <p className="text-gray-400 text-xs">No pairings in dataset</p>
                )}
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={showHolyGrailPanel}
                    onChange={(e) => setShowHolyGrailPanel(e.target.checked)}
                    className="rounded border-slate-500"
                  />
                  <span className="text-xs font-medium text-gray-300">
                    Holy Grail pairings
                  </span>
                </label>
                {showHolyGrailPanel && (
                  <>
                    <h2 className="font-bold text-sm mb-1 text-gray-100">
                      Holy Grail Pairings
                    </h2>
                    <p className="text-xs text-gray-400 mb-3">
                      Most highly recommended from The Flavor Bible
                    </p>
                    {holyGrailPairings.length > 0 ? (
                      <ul className="space-y-1.5">
                        {holyGrailPairings.map(({ source, target }) => (
                          <li key={`${source.id}-${target.id}`}>
                            <button
                              onClick={() => onHighlightPair(source, target)}
                              className="text-sky-200 font-medium hover:text-sky-100 hover:underline text-left text-sm block w-full"
                            >
                              {source.name} — {target.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-xs">No holy grail pairings</p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
