import type { TObject } from "typebox";
import type { StyleProfiles } from "./validate.js";

export type { StyleProfiles };

export interface LocalRecord {
  id: string;
  agent: string;
  type: string;
  filename: string;
  timestamp: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ListFilters {
  type?: string;
  session_id?: string;
  since?: string;
}

export interface WorkproductHandle {
  read(id: string, ctx?: any): LocalRecord | null;
  updateMetadata(id: string, metadata: Record<string, unknown>, ctx?: any): boolean;
  list(filters?: ListFilters, ctx?: any): LocalRecord[];
}

export interface KindDef {
  schema: TObject;
  subdir: string;
  label: string;
  description: string;
  filename: (params: Record<string, any>) => string;
  content: (params: Record<string, any>) => string;
  metadata: (params: Record<string, any>, sessionId: string) => Record<string, unknown>;
  summary: (id: string, params: Record<string, any>) => string;
  promptSnippet?: string;
  beforeWrite?: (params: Record<string, any>) => Record<string, any>;
  validate?: (params: Record<string, any>) => { errors: string[]; warnings: string[] } | null;
  sources?: (params: Record<string, any>) => Record<string, unknown>[];
  details?: (id: string, params: Record<string, any>) => Record<string, unknown>;
}

export interface ExtraFilterDef {
  name: string;
  schema: any;
  filter: (rec: LocalRecord, value: any) => boolean;
}

export interface QueryToolDef {
  name: string;
  label: string;
  description: string;
  kinds?: string[];
  extraFilters?: ExtraFilterDef[];
  noMatchText?: string;
  formatLine: (rec: LocalRecord) => string;
}

export interface GetToolDef {
  name: string;
  label: string;
  description: string;
  kinds?: string[];
  formatResult?: (rec: LocalRecord) => { text: string; details?: Record<string, unknown> };
}

export interface ExtraToolDef {
  name: string;
  label: string;
  description: string;
  parameters: TObject;
  promptSnippet?: string;
  execute: (
    handle: WorkproductHandle,
    toolCallId: string,
    params: Record<string, any>,
    signal?: AbortSignal,
    onUpdate?: any,
    ctx?: any,
  ) => Promise<any>;
}

export interface WorkproductConfig {
  agentName: string;
  kinds: Record<string, KindDef>;
  profiles: StyleProfiles;
  queryTool: QueryToolDef;
  getTool: GetToolDef;
  extraTools?: ExtraToolDef[];
}
