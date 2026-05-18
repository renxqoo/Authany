import { HttpStatus } from "@nestjs/common";
import { apiError } from "../../../shared/http/http-errors";

interface RequiredStringField<T extends string> {
  key: T;
  label?: string;
}

export function requireNonEmptyStrings<T extends string>(
  input: Record<string, unknown>,
  fields: Array<RequiredStringField<T>>,
) {
  const values: Partial<Record<T, string>> = {};
  for (const field of fields) {
    const value = input[field.key];
    if (typeof value !== "string" || value.trim() === "") {
      throw requiredFieldError(field.key, field.label);
    }
    values[field.key] = value.trim();
  }
  return values as Record<T, string>;
}

export function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function requireNonEmptyStringArray(input: Record<string, unknown>, key: string, label?: string) {
  const value = input[key];
  if (!Array.isArray(value)) {
    throw requiredFieldError(key, label);
  }
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0 || items.length !== value.length) {
    throw requiredFieldError(key, label);
  }
  return items;
}

function requiredFieldError(field: string, label = field) {
  return apiError(HttpStatus.BAD_REQUEST, "validation_required", `${label} is required.`, { field });
}
