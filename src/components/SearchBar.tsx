"use client";

import type { GraphNode } from "@/types/graph";

export interface SearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  results: GraphNode[];
  onSelectNode: (node: GraphNode) => void;
  onSubmit: () => void;
  isSearching?: boolean;
  promptError?: string | null;
  useCursor?: boolean;
  onUseCursorChange?: (checked: boolean) => void;
}

export function SearchBar({
  query,
  onQueryChange,
  focused,
  onFocusChange,
  results,
  onSelectNode,
  onSubmit,
  isSearching = false,
  promptError = null,
  useCursor = false,
  onUseCursorChange,
}: SearchBarProps) {
  return (
    <div className='absolute top-4 left-4 z-10 w-72'>
      <input
        type='text'
        placeholder='Search flavours...'
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => onFocusChange(true)}
        onBlur={() => setTimeout(() => onFocusChange(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        className='w-full px-4 py-2.5 rounded-lg border border-slate-600 bg-slate-800/95 backdrop-blur shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-gray-100 placeholder-gray-400'
      />
      {focused && query.trim() && (
        <div className='absolute top-full left-0 right-0 mt-1 rounded-lg border border-slate-600 bg-slate-800 shadow-lg overflow-hidden max-h-60 overflow-y-auto'>
          {results.length > 0 ? (
            results.map((node) => (
              <button
                key={node.id}
                type='button'
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectNode(node);
                  onQueryChange("");
                  onFocusChange(false);
                }}
                className='w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-slate-700 border-b border-slate-600 last:border-0'
              >
                {node.name}
              </button>
            ))
          ) : (
            <div className='px-4 py-3 text-sm text-gray-400'>
              {isSearching ? (
                "Searching..."
              ) : promptError ? (
                <span className='text-red-400'>{promptError}</span>
              ) : (
                "No matches — press Enter to search"
              )}
            </div>
          )}
        </div>
      )}
      {/* {onUseCursorChange && (
        <label className='flex items-center gap-2 mt-2 text-xs text-gray-600 cursor-pointer'>
          <input
            type='checkbox'
            checked={useCursor}
            onChange={(e) => onUseCursorChange(e.target.checked)}
            className='rounded border-gray-300 text-primary focus:ring-primary'
          />
          Use Cursor Cloud Agents
        </label>
      )} */}
    </div>
  );
}
