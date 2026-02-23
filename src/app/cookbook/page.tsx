"use client";

import { useState, useMemo } from "react";
import type { Recipe } from "@/types/recipe";
import type { GraphLink } from "@/types/graph";
import { useRecipes } from "@/hooks/useRecipes";
import { useGraphData } from "@/hooks/useGraphData";
import { importCookbook } from "@/services/recipeStorage";
import { CookbookSidebar } from "./_components/CookbookSidebar";
import { RecipeGrid } from "./_components/RecipeGrid";
import { RecipeForm } from "./_components/RecipeForm";
import { RecipeDetail } from "./_components/RecipeDetail";

type View = "list" | "create" | "edit" | "view";

function getLinkEndpointId(endpoint: unknown): string {
  if (typeof endpoint === "string") return endpoint;
  return (endpoint as { id?: string })?.id ?? "";
}

export default function CookbookPage() {
  const { recipes, savedNodes, addRecipe, editRecipe, removeRecipe, unbookmarkNode } =
    useRecipes();
  const { graphData, loading: graphLoading } = useGraphData();

  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedId) ?? null,
    [recipes, selectedId],
  );

  const recipeGraphData = useMemo(() => {
    if (!selectedRecipe || !graphData) return { nodes: [], links: [] as GraphLink[] };
    const ids = new Set(selectedRecipe.ingredients.map((i) => i.nodeId));
    const nodes = graphData.nodes.filter((n) => ids.has(n.id));
    const links = graphData.links.filter((link) => {
      const src = getLinkEndpointId(link.source);
      const tgt = getLinkEndpointId(link.target);
      return ids.has(src) && ids.has(tgt);
    });
    return { nodes, links };
  }, [selectedRecipe, graphData]);

  function openCreate() {
    setView("create");
    setSelectedId(null);
  }

  function openEdit(recipe: Recipe) {
    setSelectedId(recipe.id);
    setView("edit");
  }

  function openView(id: string) {
    setSelectedId(id);
    setView("view");
  }

  function handleSave(data: Omit<Recipe, "id" | "createdAt" | "updatedAt">) {
    if (view === "create") {
      const r = addRecipe(data);
      openView(r.id);
    } else if (view === "edit" && selectedId) {
      editRecipe(selectedId, data);
      setView("view");
    }
  }

  function handleDelete(id: string) {
    removeRecipe(id);
    if (selectedId === id) {
      setSelectedId(null);
      setView("list");
    }
  }

  function handleExport() {
    const blob = new Blob(
      [JSON.stringify({ recipes, savedNodes }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "culinary-cosmos-cookbook.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importCookbook(ev.target?.result as string);
        window.location.reload();
      } catch {
        // invalid JSON — silently ignore
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-gray-100">
      <CookbookSidebar
        recipes={recipes}
        savedNodes={savedNodes}
        selectedId={selectedId}
        view={view}
        onViewRecipe={openView}
        onCreate={openCreate}
        onDeleteRecipe={handleDelete}
        onUnbookmark={unbookmarkNode}
        onExport={handleExport}
        onImport={handleImport}
      />

      <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        {view === "list" && (
          <RecipeGrid recipes={recipes} onView={openView} onCreate={openCreate} />
        )}

        {(view === "create" || view === "edit") && (
          <RecipeForm
            key={view === "edit" ? selectedId : "create"}
            mode={view}
            initialValues={
              view === "edit" && selectedRecipe
                ? {
                    title: selectedRecipe.title,
                    ingredients: [...selectedRecipe.ingredients],
                    instructions: selectedRecipe.instructions,
                    notes: selectedRecipe.notes ?? "",
                  }
                : undefined
            }
            graphData={graphData}
            graphLoading={graphLoading}
            onSave={handleSave}
            onCancel={() => {
              if (view === "edit" && selectedId) {
                setView("view");
              } else {
                setView("list");
                setSelectedId(null);
              }
            }}
          />
        )}

        {view === "view" && selectedRecipe && (
          <RecipeDetail
            recipe={selectedRecipe}
            recipeGraphData={recipeGraphData}
            onBack={() => {
              setSelectedId(null);
              setView("list");
            }}
            onEdit={() => openEdit(selectedRecipe)}
            onDelete={() => handleDelete(selectedRecipe.id)}
          />
        )}
      </main>
    </div>
  );
}
