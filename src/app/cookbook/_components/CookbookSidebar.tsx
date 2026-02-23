"use client";

import Link from "next/link";
import type { Recipe, SavedNode } from "@/types/recipe";
import { hashToColor } from "@/utils/graph";

type View = "list" | "create" | "edit" | "view";

interface CookbookSidebarProps {
  recipes: Recipe[];
  savedNodes: SavedNode[];
  selectedId: string | null;
  view: View;
  onViewRecipe: (id: string) => void;
  onCreate: () => void;
  onDeleteRecipe: (id: string) => void;
  onUnbookmark: (nodeId: string) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function CookbookSidebar({
  recipes,
  savedNodes,
  selectedId,
  view,
  onViewRecipe,
  onCreate,
  onDeleteRecipe,
  onUnbookmark,
  onExport,
  onImport,
}: CookbookSidebarProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-600 bg-slate-800/95 flex flex-col min-h-0">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-600">
        <span className="text-xl" aria-hidden>
          📖
        </span>
        <h1 className="font-bold text-gray-100 text-base">Cookbook</h1>
      </div>

      <Link
        href="/"
        className="flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200 hover:underline px-4 py-2.5"
      >
        ← Flavor Network
      </Link>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white transition-colors"
        >
          + New Recipe
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-5">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 mb-2">
            Recipes ({recipes.length})
          </p>
          {recipes.length === 0 ? (
            <p className="text-xs text-gray-500 px-1">No recipes yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {recipes.map((r) => (
                <li key={r.id} className="flex items-center group">
                  <button
                    type="button"
                    onClick={() => onViewRecipe(r.id)}
                    className={`flex-1 text-left text-sm px-2 py-1.5 rounded truncate transition-colors ${
                      selectedId === r.id && (view === "view" || view === "edit")
                        ? "bg-slate-700 text-sky-300 font-medium"
                        : "text-gray-200 hover:bg-slate-700"
                    }`}
                  >
                    {r.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRecipe(r.id)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-gray-500 hover:text-red-400 px-1.5 py-1 text-xs transition-opacity"
                    title="Delete recipe"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 mb-2">
            Saved Ingredients ({savedNodes.length})
          </p>
          {savedNodes.length === 0 ? (
            <p className="text-xs text-gray-500 px-1">
              Bookmark ingredients from the Flavor Network using the ☆ button.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {savedNodes.map((n) => (
                <li key={n.id} className="flex items-center group">
                  <span className="flex-1 flex items-center gap-1.5 text-sm px-2 py-1.5 text-gray-300 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: hashToColor(n.nodeCategory ?? "other", true),
                      }}
                      aria-hidden
                    />
                    {n.nodeName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnbookmark(n.nodeId)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-gray-500 hover:text-red-400 px-1.5 py-1 text-xs transition-opacity"
                    title="Remove bookmark"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="border-t border-slate-600 px-3 py-3 flex gap-2">
        <button
          type="button"
          onClick={onExport}
          className="flex-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-700 py-1.5 rounded transition-colors"
        >
          Export
        </button>
        <label className="flex-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-slate-700 py-1.5 rounded transition-colors text-center cursor-pointer">
          Import
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={onImport}
          />
        </label>
      </div>
    </aside>
  );
}
