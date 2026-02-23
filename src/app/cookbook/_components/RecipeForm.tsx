"use client";

import { useState, useCallback, useMemo } from "react";
import type { GraphData, GraphNode } from "@/types/graph";
import type { RecipeIngredient } from "@/types/recipe";
import { IngredientTag } from "./IngredientTag";
import { IngredientSearch } from "./IngredientSearch";

interface RecipeFormValues {
  title: string;
  ingredients: RecipeIngredient[];
  instructions: string;
  notes: string;
}

interface RecipeFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<RecipeFormValues>;
  graphData: GraphData | null;
  graphLoading: boolean;
  onSave: (data: RecipeFormValues) => void;
  onCancel: () => void;
}

export function RecipeForm({
  mode,
  initialValues,
  graphData,
  graphLoading,
  onSave,
  onCancel,
}: RecipeFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initialValues?.ingredients ?? [],
  );
  const [instructions, setInstructions] = useState(initialValues?.instructions ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");

  const excludeIds = useMemo(
    () => new Set(ingredients.map((i) => i.nodeId)),
    [ingredients],
  );

  const handleAddIngredient = useCallback((node: GraphNode) => {
    setIngredients((prev) => [
      ...prev,
      { nodeId: node.id, name: node.name ?? node.id, category: node.category },
    ]);
  }, []);

  const handleRemoveIngredient = useCallback((nodeId: string) => {
    setIngredients((prev) => prev.filter((i) => i.nodeId !== nodeId));
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-8 py-6 max-w-2xl mx-auto w-full">
        <h2 className="text-lg font-bold text-gray-100 mb-6">
          {mode === "create" ? "New Recipe" : "Edit Recipe"}
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lemon Garlic Pasta"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-sky-400 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Ingredients
            </label>
            {ingredients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ingredients.map((ing) => (
                  <IngredientTag
                    key={ing.nodeId}
                    ingredient={ing}
                    onRemove={() => handleRemoveIngredient(ing.nodeId)}
                  />
                ))}
              </div>
            )}
            <IngredientSearch
              graphData={graphData}
              loading={graphLoading}
              excludeIds={excludeIds}
              onSelect={handleAddIngredient}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="How to prepare this recipe…"
              rows={6}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-sky-400 placeholder-gray-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — variations, substitutions, tips…"
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-sky-400 placeholder-gray-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onSave({ title, ingredients, instructions, notes })}
              disabled={!title.trim()}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save Recipe
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
