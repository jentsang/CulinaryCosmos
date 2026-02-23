"use client";

import { useState, useMemo } from "react";
import type { GraphData, GraphNode } from "@/types/graph";
import { hashToColor, CATEGORY_LABELS } from "@/utils/graph";

interface IngredientSearchProps {
  graphData: GraphData | null;
  loading: boolean;
  excludeIds: Set<string>;
  onSelect: (node: GraphNode) => void;
}

export function IngredientSearch({
  graphData,
  loading,
  excludeIds,
  onSelect,
}: IngredientSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim() || !graphData) return [];
    const q = query.toLowerCase();
    return graphData.nodes
      .filter(
        (n) =>
          !excludeIds.has(n.id) &&
          (n.name?.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [query, graphData, excludeIds]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={loading ? "Loading ingredients…" : "Search ingredients…"}
        disabled={loading}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-sky-400 placeholder-gray-500 disabled:opacity-50"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-700 border border-slate-500 rounded-lg shadow-xl overflow-hidden">
          {results.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onMouseDown={() => {
                  onSelect(n);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-600 flex items-center gap-2 transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: hashToColor(n.category ?? "other", true) }}
                  aria-hidden
                />
                <span className="text-gray-200 flex-1">{n.name ?? n.id}</span>
                <span className="text-xs text-gray-400">
                  {CATEGORY_LABELS[n.category ?? ""] ?? n.category}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
