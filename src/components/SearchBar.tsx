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
  geminiApiKey?: string;
  onAddGeminiKey?: () => void;
  onRemoveGeminiKey?: () => void;
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
  geminiApiKey,
  onAddGeminiKey,
  onRemoveGeminiKey,
}: SearchBarProps) {
  const showDropdown = focused && (query.trim() || geminiApiKey !== undefined);

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
      {showDropdown && (
        <div className='absolute top-full left-0 right-0 mt-1 rounded-lg border border-slate-600 bg-slate-800 shadow-lg overflow-hidden max-h-60 overflow-y-auto'>
          {query.trim() && (
            results.length > 0 ? (
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
              <div className='px-4 py-3 text-sm text-gray-400 border-b border-slate-600'>
                {isSearching ? (
                  "Searching..."
                ) : promptError ? (
                  <span className='text-red-400'>{promptError}</span>
                ) : (
                  "No matches — press Enter to get AI suggestions"
                )}
              </div>
            )
          )}
          {geminiApiKey ? (
            <button
              type='button'
              onMouseDown={(e) => e.preventDefault()}
              onClick={onRemoveGeminiKey}
              className='w-full px-4 py-2.5 text-left text-xs text-emerald-400 hover:bg-slate-700 flex items-center gap-2'
            >
              <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0' aria-hidden />
              Gemini AI active · click to remove key
            </button>
          ) : (
            <button
              type='button'
              onMouseDown={(e) => e.preventDefault()}
              onClick={onAddGeminiKey}
              className='w-full px-4 py-2.5 text-left text-xs text-sky-400 hover:bg-slate-700 flex items-center gap-1.5'
            >
              <span aria-hidden>✦</span>
              Add Gemini key for AI search
            </button>
          )}
        </div>
      )}
    </div>
  );
}
