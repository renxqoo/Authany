import type React from "react";

export type ResourceKey =
  | "applications"
  | "agents"
  | "runtimes"
  | "target-resources"
  | "target-connections"
  | "access-grants"
  | "audit-events"
  | "keys";

export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "json"
  | "readonly"
  | "boolean"
  | "number"
  | "datetime-local"
  | "string-array";

export type ValueKind =
  | "text"
  | "mono"
  | "multiline"
  | "status"
  | "date"
  | "boolean"
  | "json"
  | "count"
  | "string-array";

export interface SelectOption {
  label: string;
  value: string;
}

export interface OptionSource {
  endpoint: string;
  valueKey: string;
  labelKeys?: string[];
  queryParamField?: string;
  queryValueField?: string;
}

export interface ResourceValueDefinition {
  getValue?: (record: Record<string, unknown>) => unknown;
  key?: string;
  kind?: ValueKind;
  label: string;
}

export interface ResourceColumn extends ResourceValueDefinition {
  className?: string;
}

export interface ResourceFilter {
  getValue: (record: Record<string, unknown>) => string | undefined;
  key: string;
  label: string;
  options?: SelectOption[];
  optionSource?: OptionSource;
}

export interface ResourceField {
  dependsOn?: {
    field: string;
    values: string[];
  };
  description?: string;
  getInitialValue?: (record: Record<string, unknown>) => unknown;
  hiddenOnCreate?: boolean;
  hiddenOnEdit?: boolean;
  label: string;
  name: string;
  optionSource?: OptionSource;
  options?: SelectOption[];
  placeholder?: string;
  required?: boolean;
  type?: FieldType;
  validate?: (value: boolean | string | undefined, values: Record<string, string | boolean>) => string | undefined;
}

export interface ResourceSection {
  description?: string;
  fields: ResourceValueDefinition[];
  title: string;
}

export interface ResourceAction {
  buildBody?: (record: Record<string, unknown>, confirmValue?: string) => Record<string, unknown>;
  confirmDescription?: string;
  confirmLabel?: string;
  confirmMatchValue?: (record: Record<string, unknown>) => string | undefined;
  confirmTitle?: string;
  endpoint: (id: string, record: Record<string, unknown>) => string;
  label: string;
  method?: "PATCH" | "POST";
  redirectToListOnSuccess?: boolean;
  variant?: "primary" | "secondary" | "danger";
}

export interface ResourceDefinition {
  createFields?: ResourceField[];
  createLabel?: string;
  dangerAction?: ResourceAction;
  description: string;
  detailActions?: ResourceAction[];
  detailSections: ResourceSection[];
  editFields?: ResourceField[];
  emptyState: string;
  endpoint: string;
  extraSections?: (record: Record<string, unknown>, refresh: () => Promise<void>) => React.ReactNode;
  filters?: ResourceFilter[];
  key: ResourceKey;
  listColumns: ResourceColumn[];
  path: string;
  searchValues: (record: Record<string, unknown>) => Array<string | null | undefined>;
  status?: (record: Record<string, unknown>) => string | undefined;
  subtitle?: (record: Record<string, unknown>) => string | undefined;
  title: string;
  titleValue: (record: Record<string, unknown>) => string;
}
