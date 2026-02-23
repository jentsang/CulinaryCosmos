/**
 * localStorage-backed persistence for recipes and saved ingredient nodes.
 *
 * Uses module-level write-through caches so localStorage is parsed at most
 * once per session. Every read after the first hits memory; every write
 * updates the cache then serialises once to localStorage.
 *
 * All functions are SSR-safe — they return empty values when `window` is
 * not available.
 */

import type { Recipe, SavedNode } from "@/types/recipe";

const RECIPES_KEY = "culinary_cosmos_recipes";
const SAVED_NODES_KEY = "culinary_cosmos_saved_nodes";

// Module-level caches — null means "not yet loaded from localStorage".
let recipesCache: Recipe[] | null = null;
let savedNodesCache: SavedNode[] | null = null;

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export function getRecipes(): Recipe[] {
  if (typeof window === "undefined") return [];
  if (recipesCache !== null) return recipesCache;
  try {
    const raw = localStorage.getItem(RECIPES_KEY);
    recipesCache = raw ? (JSON.parse(raw) as Recipe[]) : [];
  } catch {
    recipesCache = [];
  }
  return recipesCache;
}

function persistRecipes(recipes: Recipe[]): void {
  recipesCache = recipes;
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
}

export function createRecipe(
  data: Omit<Recipe, "id" | "createdAt" | "updatedAt">,
): Recipe {
  const now = new Date().toISOString();
  const recipe: Recipe = { ...data, id: genId(), createdAt: now, updatedAt: now };
  persistRecipes([...getRecipes(), recipe]);
  return recipe;
}

export function updateRecipe(
  id: string,
  data: Partial<Omit<Recipe, "id" | "createdAt">>,
): Recipe | null {
  const recipes = getRecipes();
  const idx = recipes.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated: Recipe = {
    ...recipes[idx],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  // Mutate the cached array in-place, then persist the same reference.
  recipes[idx] = updated;
  persistRecipes(recipes);
  return updated;
}

export function deleteRecipe(id: string): void {
  persistRecipes(getRecipes().filter((r) => r.id !== id));
}

// ---------------------------------------------------------------------------
// Saved ingredient nodes
// ---------------------------------------------------------------------------

export function getSavedNodes(): SavedNode[] {
  if (typeof window === "undefined") return [];
  if (savedNodesCache !== null) return savedNodesCache;
  try {
    const raw = localStorage.getItem(SAVED_NODES_KEY);
    savedNodesCache = raw ? (JSON.parse(raw) as SavedNode[]) : [];
  } catch {
    savedNodesCache = [];
  }
  return savedNodesCache;
}

function persistSavedNodes(nodes: SavedNode[]): void {
  savedNodesCache = nodes;
  localStorage.setItem(SAVED_NODES_KEY, JSON.stringify(nodes));
}

export function saveNode(
  nodeId: string,
  nodeName: string,
  nodeCategory?: string,
): SavedNode {
  const existing = getSavedNodes();
  const already = existing.find((n) => n.nodeId === nodeId);
  if (already) return already;
  const saved: SavedNode = {
    id: genId(),
    nodeId,
    nodeName,
    nodeCategory,
    savedAt: new Date().toISOString(),
  };
  persistSavedNodes([...existing, saved]);
  return saved;
}

export function unsaveNode(nodeId: string): void {
  persistSavedNodes(getSavedNodes().filter((n) => n.nodeId !== nodeId));
}

export function isNodeSaved(nodeId: string): boolean {
  return getSavedNodes().some((n) => n.nodeId === nodeId);
}

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

export function exportCookbook(): string {
  return JSON.stringify({ recipes: getRecipes(), savedNodes: getSavedNodes() }, null, 2);
}

export function importCookbook(json: string): void {
  const data = JSON.parse(json) as { recipes?: Recipe[]; savedNodes?: SavedNode[] };
  if (Array.isArray(data.recipes)) persistRecipes(data.recipes);
  if (Array.isArray(data.savedNodes)) persistSavedNodes(data.savedNodes);
}
