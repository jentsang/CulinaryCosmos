"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Recipe } from "@/types/recipe";
import type { GraphData, GraphNode } from "@/types/graph";
import { hashToColor } from "@/utils/graph";
import { IngredientTag } from "./IngredientTag";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const GRAPH_HEIGHT = 320;

interface RecipeDetailProps {
  recipe: Recipe;
  recipeGraphData: GraphData;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function RecipeDetail({
  recipe,
  recipeGraphData,
  onBack,
  onEdit,
  onDelete,
}: RecipeDetailProps) {
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphWidth, setGraphWidth] = useState(0);

  useEffect(() => {
    const el = graphContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setGraphWidth(el.getBoundingClientRect().width);
    });
    ro.observe(el);
    setGraphWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-8 py-6 max-w-2xl mx-auto w-full">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 hover:underline mb-5"
        >
          ← All Recipes
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-100 leading-tight flex-1">
            {recipe.title}
          </h2>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-red-900/60 text-gray-300 hover:text-red-300 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Ingredients ({recipe.ingredients.length})
          </h3>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-gray-500">No ingredients added.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recipe.ingredients.map((ing) => (
                <IngredientTag key={ing.nodeId} ingredient={ing} />
              ))}
            </div>
          )}
        </section>

        {recipe.ingredients.length >= 2 && (
          <section className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Flavor Connections
            </h3>
            <div
              ref={graphContainerRef}
              className="relative w-full rounded-xl border border-slate-600 bg-slate-800/60 overflow-hidden"
              style={{ height: GRAPH_HEIGHT }}
            >
              {graphWidth > 0 && (
                <ForceGraph2D
                  graphData={recipeGraphData}
                  width={graphWidth}
                  height={GRAPH_HEIGHT}
                  nodeLabel={(n) => (n as GraphNode).name ?? (n as GraphNode).id}
                  nodeColor={(n) =>
                    hashToColor((n as GraphNode).category ?? "other", true)
                  }
                  nodeVal={10}
                  nodeRelSize={1}
                  linkColor={() => "rgba(148,163,184,0.55)"}
                  linkWidth={1.5}
                  backgroundColor="#1e293b"
                  cooldownTicks={200}
                />
              )}
              {recipeGraphData.nodes.length > 0 &&
                recipeGraphData.links.length === 0 && (
                  <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
                    <span className="text-xs text-gray-500 bg-slate-900/80 border border-slate-600 px-3 py-1 rounded-full">
                      No recorded connections between these ingredients
                    </span>
                  </div>
                )}
            </div>
          </section>
        )}

        {recipe.instructions && (
          <section className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Instructions
            </h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {recipe.instructions}
            </p>
          </section>
        )}

        {recipe.notes && (
          <section className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Notes
            </h3>
            <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">
              {recipe.notes}
            </p>
          </section>
        )}

        <p className="text-xs text-gray-600">
          Created {new Date(recipe.createdAt).toLocaleDateString()}
          {recipe.updatedAt !== recipe.createdAt && (
            <> · Updated {new Date(recipe.updatedAt).toLocaleDateString()}</>
          )}
        </p>
      </div>
    </div>
  );
}
