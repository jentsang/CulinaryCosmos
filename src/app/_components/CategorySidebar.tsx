"use client";

import { hashToColor, CATEGORY_LABELS } from "@/utils/graph";

interface CategorySidebarProps {
  collapsed: boolean;
  hiddenCategories: Set<string>;
  onToggleCollapse: () => void;
  onToggleCategory: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function CategorySidebar({
  collapsed,
  hiddenCategories,
  onToggleCollapse,
  onToggleCategory,
  onSelectAll,
  onDeselectAll,
}: CategorySidebarProps) {
  return (
    <aside
      className={`absolute left-0 top-0 bottom-0 z-10 flex flex-col border-r border-slate-600 bg-slate-800/95 backdrop-blur shadow-xl transition-[width] duration-200 ${
        collapsed ? "w-10" : "w-52"
      }`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 flex items-center justify-center rounded-r-lg border border-l-0 border-slate-600 bg-slate-800/95 shadow-sm hover:bg-slate-700 z-20"
        aria-label={collapsed ? "Expand categories" : "Collapse categories"}
      >
        <span className="text-gray-400 text-xs">{collapsed ? "▶" : "◀"}</span>
      </button>

      {!collapsed && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden py-4">
          <p className="text-xs font-semibold text-gray-300 px-3 py-2">Categories</p>
          <div className="flex gap-1 px-2 py-1.5 border-y border-slate-600">
            <button
              type="button"
              onClick={onSelectAll}
              className="flex-1 text-xs text-primary font-medium hover:underline"
            >
              Select all
            </button>
            <span className="text-slate-400">|</span>
            <button
              type="button"
              onClick={onDeselectAll}
              className="flex-1 text-xs text-primary font-medium hover:underline"
            >
              Deselect all
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto py-1">
            {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
              <label
                key={id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!hiddenCategories.has(id)}
                  onChange={() => onToggleCategory(id)}
                  className="rounded border-slate-500"
                />
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: hashToColor(id) }}
                  aria-hidden
                />
                <span className="text-xs text-gray-300 truncate">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
