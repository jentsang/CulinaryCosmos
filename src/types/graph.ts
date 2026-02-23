/**
 * Graph types for flavour pairing network.
 */

export interface GraphNode {
  id: string;
  name: string;
  group?: number;
  category?: string;
  image?: string;
  /** Pre-computed layout coordinates (assigned before passing to ForceGraph3D). */
  x?: number;
  y?: number;
  z?: number;
  /** Pinned coordinates — prevent the force simulation from moving nodes. */
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  value?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
