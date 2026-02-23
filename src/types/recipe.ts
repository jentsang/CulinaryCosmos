/**
 * Types for the localStorage-backed personal cookbook.
 */

export interface RecipeIngredient {
  nodeId: string;
  name: string;
  category?: string;
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: RecipeIngredient[];
  instructions: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedNode {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeCategory?: string;
  savedAt: string;
}
