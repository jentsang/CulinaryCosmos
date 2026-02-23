"use client";

import type { Recipe } from "@/types/recipe";
import { hashToColor } from "@/utils/graph";

interface RecipeGridProps {
  recipes: Recipe[];
  onView: (id: string) => void;
  onCreate: () => void;
}

export function RecipeGrid({ recipes, onView, onCreate }: RecipeGridProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-100">My Recipes</h2>
            {recipes.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {recipes.length} recipe{recipes.length !== 1 ? "s" : ""} saved locally
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white transition-colors"
          >
            + New Recipe
          </button>
        </div>

        {recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="text-5xl mb-4" aria-hidden>
              🍳
            </div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No recipes yet</h3>
            <p className="text-gray-500 max-w-sm text-sm mb-6">
              Build recipes using ingredients from the Flavor Network and see how their
              flavors connect. Saved locally — no account needed.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white transition-colors"
            >
              + Create your first recipe
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onView(r.id)}
                  className="w-full text-left rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700/60 hover:border-slate-500 p-4 flex flex-col gap-3 transition-colors group"
                >
                  <h3 className="font-semibold text-gray-100 text-sm leading-snug group-hover:text-sky-300 transition-colors line-clamp-2">
                    {r.title}
                  </h3>
                  {r.ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.ingredients.slice(0, 4).map((ing) => (
                        <span
                          key={ing.nodeId}
                          className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-gray-300"
                          style={{
                            borderLeft: `2px solid ${hashToColor(ing.category ?? "other", true)}`,
                          }}
                        >
                          {ing.name}
                        </span>
                      ))}
                      {r.ingredients.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-gray-500">
                          +{r.ingredients.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                  {r.instructions && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {r.instructions}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-auto">
                    {new Date(r.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
