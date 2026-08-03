// SPDX-License-Identifier: GPL-3.0-only

import type { ComponentType } from "react";
import { InputField } from "@timeax/form-palette";
import type { InputCardinality, InputDescriptor, InputRegistry } from "@elqora/dgp-ordering";

export interface FormPaletteInputDescriptor extends InputDescriptor {
  variant: string;
  Component: ComponentType<Record<string, unknown>>;
  default_props: Record<string, unknown>;
  value_from_change(change: unknown): unknown;
  selected_option_ids_from_change(change: unknown): string[];
}

export interface FormPaletteInputRegistry extends InputRegistry {
  resolve(type: string): FormPaletteInputDescriptor | undefined;
  unregister(type: string): void;
}

function eventValue(change: unknown): unknown {
  if (typeof change === "object" && change !== null && "value" in change) return change.value;
  return change;
}

function eventSelections(change: unknown): string[] {
  if (typeof change !== "object" || change === null || !("detail" in change)) {
    const value = eventValue(change);
    const id = (entry: unknown): string | undefined => {
      if (typeof entry === "string" || typeof entry === "number") return String(entry);
      if (typeof entry === "object" && entry !== null && "id" in entry && (typeof entry.id === "string" || typeof entry.id === "number")) return String(entry.id);
      return undefined;
    };
    return (Array.isArray(value) ? value : [value]).flatMap((entry) => {
      const resolved = id(entry);
      return resolved === undefined ? [] : [resolved];
    });
  }
  const detail: unknown = change.detail;
  if (typeof detail !== "object" || detail === null || !("selectedOptions" in detail)) return [];
  const selectedOptions: unknown = detail.selectedOptions;
  if (!Array.isArray(selectedOptions)) return [];
  return selectedOptions.flatMap((option: unknown) => {
    if (typeof option === "object" && option !== null && "id" in option && (typeof option.id === "string" || typeof option.id === "number")) return [String(option.id)];
    return [];
  });
}

export function createFormPaletteDescriptor(
  type: string,
  cardinality: InputCardinality,
  defaultProps: Record<string, unknown> = {},
): FormPaletteInputDescriptor {
  return {
    type,
    cardinality,
    variant: type,
    Component: InputField as unknown as ComponentType<Record<string, unknown>>,
    default_props: { variant: type, ...defaultProps },
    value_from_change: eventValue,
    selected_option_ids_from_change: eventSelections,
  };
}

export function createFormPaletteInputRegistry(
  initial: readonly FormPaletteInputDescriptor[] = [],
): FormPaletteInputRegistry {
  const entries = new Map(initial.map((descriptor) => [descriptor.type, descriptor]));
  return {
    register(descriptor) {
      if (!("Component" in descriptor)) throw new Error(`Form Palette descriptor ${descriptor.type} must define a Component.`);
      entries.set(descriptor.type, descriptor as FormPaletteInputDescriptor);
    },
    resolve: (type) => entries.get(type),
    unregister(type) { entries.delete(type); },
  };
}

const cardinality: Record<string, InputCardinality> = {
  select: "single", radio: "single", "toggle-group": "single",
  multiselect: "multiple", treeselect: "multiple", chips: "multiple",
};

export const BUILT_IN_INPUT_TYPES = [
  "text", "textarea", "number", "password", "phone", "date", "color",
  "checkbox", "toggle", "toggle-group", "radio", "select", "multiselect",
  "treeselect", "chips", "slider", "file", "editor", "json-editor",
  "keyvalue", "lister", "icon", "image-icon",
] as const;

export function createDefaultFormPaletteRegistry(): FormPaletteInputRegistry {
  return createFormPaletteInputRegistry(
    BUILT_IN_INPUT_TYPES.map((type) => createFormPaletteDescriptor(type, cardinality[type] ?? "scalar")),
  );
}
