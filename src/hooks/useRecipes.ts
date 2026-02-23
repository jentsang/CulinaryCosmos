"use client";

import { useState, useCallback, useEffect } from "react";
import type { Recipe, SavedNode } from "@/types/recipe";
import * as storage from "@/services/recipeStorage";

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [savedNodes, setSavedNodes] = useState<SavedNode[]>([]);

  useEffect(() => {
    setRecipes(storage.getRecipes());
    setSavedNodes(storage.getSavedNodes());
  }, []);

  const addRecipe = useCallback(
    (data: Omit<Recipe, "id" | "createdAt" | "updatedAt">): Recipe => {
      const recipe = storage.createRecipe(data);
      setRecipes(storage.getRecipes());
      return recipe;
    },
    [],
  );

  const editRecipe = useCallback(
    (id: string, data: Partial<Omit<Recipe, "id" | "createdAt">>): Recipe | null => {
      const updated = storage.updateRecipe(id, data);
      setRecipes(storage.getRecipes());
      return updated;
    },
    [],
  );

  const removeRecipe = useCallback((id: string): void => {
    storage.deleteRecipe(id);
    setRecipes(storage.getRecipes());
  }, []);

  const bookmarkNode = useCallback(
    (nodeId: string, nodeName: string, nodeCategory?: string): void => {
      storage.saveNode(nodeId, nodeName, nodeCategory);
      setSavedNodes(storage.getSavedNodes());
    },
    [],
  );

  const unbookmarkNode = useCallback((nodeId: string): void => {
    storage.unsaveNode(nodeId);
    setSavedNodes(storage.getSavedNodes());
  }, []);

  const isBookmarked = useCallback(
    (nodeId: string): boolean => savedNodes.some((n) => n.nodeId === nodeId),
    [savedNodes],
  );

  return {
    recipes,
    savedNodes,
    addRecipe,
    editRecipe,
    removeRecipe,
    bookmarkNode,
    unbookmarkNode,
    isBookmarked,
  };
}
