"use client";

import { hashToColor } from "@/utils/graph";
import type { RecipeIngredient } from "@/types/recipe";

interface IngredientTagProps {
  ingredient: RecipeIngredient;
  onRemove?: () => void;
}

export function IngredientTag({ ingredient, onRemove }: IngredientTagProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-gray-200"
      style={{ borderLeft: `3px solid ${hashToColor(ingredient.category ?? "other", true)}` }}
    >
      {ingredient.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-400 ml-0.5 leading-none"
          aria-label={`Remove ${ingredient.name}`}
        >
          ✕
        </button>
      )}
    </span>
  );
}
