"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { DialogFrame } from "./dialog-frame";
import { loadRemoteOptions } from "./resource-client";
import type { ResourceField, SelectOption } from "./types";

type OptionMap = Record<string, SelectOption[]>;

export function ResourceFormDialog({
  fields,
  initialRecord,
  mode,
  onClose,
  onSubmit,
  title
}: {
  fields: ResourceField[];
  initialRecord?: Record<string, unknown>;
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  title: string;
}) {
  const baseFields = useMemo(
    () => fields.filter((field) => (mode === "create" ? !field.hiddenOnCreate : !field.hiddenOnEdit)),
    [fields, mode],
  );
  const [values, setValues] = useState<Record<string, string | boolean>>(() => createInitialValues(baseFields, initialRecord));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<OptionMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const renderableFields = useMemo(
    () => baseFields.filter((field) => isFieldVisible(field, values)),
    [baseFields, values],
  );

  useEffect(() => {
    setValues(createInitialValues(baseFields, initialRecord));
    setErrors({});
    setError("");
  }, [baseFields, initialRecord]);

  useEffect(() => {
    const remoteFields = renderableFields.filter((field) => field.optionSource && isRemoteFieldReady(field, values));
    if (remoteFields.length === 0) {
      return;
    }
    void Promise.all(
      remoteFields.map(async (field) => [
        field.name,
        await loadRemoteOptions(field.optionSource!, resolveQueryValue(field, values))
      ] as const),
    )
      .then((entries) => setOptions((current) => ({ ...current, ...Object.fromEntries(entries) })))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load form options."));
  }, [renderableFields, values]);

  useEffect(() => {
    const hiddenFields = baseFields.filter((field) => !isFieldVisible(field, values));
    if (hiddenFields.length === 0) {
      return;
    }
    const visibleNames = new Set(renderableFields.map((field) => field.name));
    setValues((current) => {
      let changed = false;
      const next = { ...current };
      for (const field of hiddenFields) {
        if (visibleNames.has(field.name)) {
          continue;
        }
        const resetValue = formatInitialValue(field, undefined);
        if (next[field.name] !== resetValue) {
          next[field.name] = resetValue;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [baseFields, renderableFields, values]);

  async function submit() {
    const nextErrors = validateFields(renderableFields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(buildPayload(renderableFields, values));
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogFrame title={title}>
      <div className="space-y-5">
        {error ? <Alert>{error}</Alert> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {renderableFields.map((field) => (
            <label
              className={field.type === "textarea" || field.type === "json" || field.type === "string-array" ? "md:col-span-2" : ""}
              htmlFor={field.name}
              key={`${field.name}:${field.label}`}
            >
              <div className="text-sm font-medium text-slate-800">
                {field.label}
                {field.required === false ? null : <span className="ml-1 text-red-600">*</span>}
              </div>
              {field.description ? <div className="mt-1 text-xs leading-5 text-slate-500">{field.description}</div> : null}
              <FieldInput
                field={field}
                id={field.name}
                options={field.options ?? options[field.name] ?? []}
                value={values[field.name]}
                onChange={(nextValue) => setValues((current) => ({ ...current, [field.name]: nextValue }))}
              />
              {errors[field.name] ? <div className="mt-2 text-xs text-red-600">{errors[field.name]}</div> : null}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
          <Button disabled={submitting} onClick={() => void submit()} type="button">
            {submitting ? "Saving..." : mode === "create" ? "Create" : "Save changes"}
          </Button>
        </div>
      </div>
    </DialogFrame>
  );
}

function FieldInput({
  field,
  id,
  onChange,
  options,
  value
}: {
  field: ResourceField;
  id: string;
  onChange: (value: boolean | string) => void;
  options: SelectOption[];
  value: boolean | string | undefined;
}) {
  const inputClassName = "mt-2";
  if (field.type === "textarea") {
    return (
      <Textarea
        aria-label={field.label}
        className={inputClassName}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : ""}
      />
    );
  }
  if (field.type === "json") {
    return (
      <Textarea
        aria-label={field.label}
        className={`${inputClassName} font-mono`}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : "{}"}
      />
    );
  }
  if (field.type === "string-array") {
    return (
      <Textarea
        aria-label={field.label}
        className={inputClassName}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder ?? "One value per line"}
        value={typeof value === "string" ? value : ""}
      />
    );
  }
  if (field.type === "select") {
    return (
      <Select
        aria-label={field.label}
        className={inputClassName}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={typeof value === "string" ? value : ""}
      >
        <option value="">{field.placeholder ?? `Select ${field.label}`}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    );
  }
  if (field.type === "readonly") {
    return (
      <Input
        aria-label={field.label}
        className={`${inputClassName} cursor-not-allowed bg-slate-50 text-slate-500`}
        id={id}
        readOnly
        value={typeof value === "string" ? value : ""}
      />
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" htmlFor={id}>
        <input
          aria-label={field.placeholder ?? field.label}
          checked={Boolean(value)}
          id={id}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="text-sm text-slate-700">{field.placeholder ?? field.label}</span>
      </label>
    );
  }
  return (
    <Input
      aria-label={field.label}
      className={inputClassName}
      id={id}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      type={field.type === "number" ? "number" : field.type === "datetime-local" ? "datetime-local" : "text"}
      value={typeof value === "string" ? value : ""}
    />
  );
}

function createInitialValues(fields: ResourceField[], record?: Record<string, unknown>) {
  return Object.fromEntries(fields.map((field) => [field.name, formatInitialValue(field, record)]));
}

function isFieldVisible(field: ResourceField, values: Record<string, string | boolean>) {
  if (!field.dependsOn) {
    return true;
  }
  const current = values[field.dependsOn.field];
  return typeof current === "string" && field.dependsOn.values.includes(current);
}

function isRemoteFieldReady(field: ResourceField, values: Record<string, string | boolean>) {
  if (!field.optionSource?.queryParamField) {
    return true;
  }
  return Boolean(resolveQueryValue(field, values));
}

function resolveQueryValue(field: ResourceField, values: Record<string, string | boolean>) {
  if (!field.optionSource?.queryParamField) {
    return undefined;
  }
  const sourceField = field.optionSource.queryValueField ?? field.dependsOn?.field;
  if (!sourceField) {
    return undefined;
  }
  const value = values[sourceField];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function formatInitialValue(field: ResourceField, record?: Record<string, unknown>) {
  const value = field.getInitialValue?.(record ?? {}) ?? record?.[field.name];
  if (field.type === "boolean") {
    return Boolean(value);
  }
  if (field.type === "json") {
    return value === undefined ? "{}" : JSON.stringify(value, null, 2);
  }
  if (field.type === "string-array") {
    return Array.isArray(value) ? value.join("\n") : "";
  }
  if (field.type === "datetime-local") {
    if (!value) {
      return "";
    }
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
  }
  return value === undefined || value === null ? "" : String(value);
}

function validateFields(fields: ResourceField[], values: Record<string, string | boolean>) {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const customError = field.validate?.(values[field.name], values);
    if (customError) {
      errors[field.name] = customError;
      continue;
    }
    if (field.required === false) {
      continue;
    }
    const value = values[field.name];
    if (field.type === "boolean") {
      continue;
    }
    if (field.type === "string-array") {
      const items = String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
      if (items.length === 0) {
        errors[field.name] = `${field.label} is required.`;
      }
      continue;
    }
    if (field.type === "json") {
      if (!String(value ?? "").trim()) {
        errors[field.name] = `${field.label} is required.`;
        continue;
      }
      try {
        JSON.parse(String(value));
      } catch {
        errors[field.name] = `${field.label} must be valid JSON.`;
      }
      continue;
    }
    if (!String(value ?? "").trim()) {
      errors[field.name] = `${field.label} is required.`;
    }
  }
  return errors;
}

function buildPayload(fields: ResourceField[], values: Record<string, string | boolean>) {
  return Object.fromEntries(fields.map((field) => [field.name, parseValue(field, values[field.name])]));
}

function parseValue(field: ResourceField, rawValue: boolean | string | undefined) {
  if (field.type === "boolean") {
    return Boolean(rawValue);
  }
  if (field.type === "readonly") {
    return String(rawValue ?? "").trim();
  }
  const value = String(rawValue ?? "");
  if (field.type === "json") {
    return value.trim() ? JSON.parse(value) : undefined;
  }
  if (field.type === "string-array") {
    return value.trim() ? value.split("\n").map((item) => item.trim()).filter(Boolean) : undefined;
  }
  if (field.type === "number") {
    return value.trim() ? Number(value) : undefined;
  }
  if (field.type === "datetime-local") {
    return value ? new Date(value).toISOString() : null;
  }
  return value.trim();
}
