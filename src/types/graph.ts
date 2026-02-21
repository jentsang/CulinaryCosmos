/**
 * Graph types for flavour pairing network.
 */

export interface GraphNode {
  id: string;
  name: string;
  group?: number;
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
