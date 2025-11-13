import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface ColumnInfo {
  column_name: string;
  column_type: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  sourceFile: string;
  isView?: boolean;
  dependencies?: string[];
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  group: 'file' | 'table' | 'view';
  name: string;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  error?: string;
  executionTime: number;
}

export interface Project {
    id: string;
    name: string;
}

export interface PersistedFile {
    name: string;
    buffer: ArrayBuffer;
    webkitRelativePath?: string;
}

export interface PersistedView {
    name: string;
    sql: string;
}

export type ChartType = 'hist' | 'bar' | 'scatter' | 'line';

export interface Visualization {
  type: ChartType;
  data: QueryResult;
  query: string;
}

