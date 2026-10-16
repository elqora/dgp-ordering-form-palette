// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import type { ComponentAdapter, OrderingInputState } from "@elqora/dgp-ordering";
import type { UseFieldReturn } from "@timeax/form-palette";

import { useOrderingField } from "./field.js";
import { useFormPaletteOrdering } from "./provider.js";
import type { FormPaletteAdapterContext, FormPaletteInputDescriptor } from "./registry.js";

type ProductField = Parameters<ComponentAdapter<unknown>["create"]>[0];
type FieldOption = NonNullable<ProductField["options"]>[number];
type JsonValue = OrderingInputState["values"][string];

function filterOptions(options: readonly FieldOption[] | undefined, allowed?: ReadonlySet<string>): FieldOption[] | undefined {
  if (options === undefined || allowed === undefined) return options === undefined ? undefined : [...options];
  return options.flatMap((option) => {
    const children = filterOptions(option.children, allowed);
    if (!allowed.has(option.id) && (children?.length ?? 0) === 0) return [];
    return [{ ...option, ...(children === undefined ? {} : { children }) }];
  });
}

function safePath(context: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").map((part) => part.trim()).filter(Boolean);
  let current: unknown = context;
  for (const part of parts) {
    if (["__proto__", "prototype", "constructor"].includes(part)) return undefined;
    if (typeof current !== "object" || current === null || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function literal(raw: string, context: Record<string, unknown>): unknown {
  const value = raw.trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  const numeric = Number(value);
  if (value !== "" && !Number.isNaN(numeric)) return numeric;
  return safePath(context, value);
}

function miniExpression(raw: string, context: Record<string, unknown>): string {
  const expression = raw.trim();
  const nullish = expression.indexOf("??");
  const or = expression.indexOf("||");
  const split = nullish >= 0 ? { index: nullish, operator: "??" } : or >= 0 ? { index: or, operator: "||" } : undefined;
  const left = split === undefined ? expression : expression.slice(0, split.index).trim();
  const right = split === undefined ? "" : expression.slice(split.index + 2).trim();
  const candidate = safePath(context, left);
  const fallback = split?.operator === "??" ? candidate === null || candidate === undefined
    : split?.operator === "||" ? !candidate : false;
  const value = fallback ? literal(right, context) : candidate;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value) ?? ""; } catch { return ""; }
}

function templateUnknown(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{([^}]+)\}/g, (_match, expression: string) => miniExpression(expression, context));
  }
  if (Array.isArray(value)) return value.map((entry) => templateUnknown(entry, context));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) result[key] = templateUnknown(entry, context);
    return result;
  }
  return value;
}

export function templateFormPaletteProps<T>(value: T, context: Record<string, unknown>): T {
  return templateUnknown(value, context) as T;
}

export interface OrderingInputProps {
  field: ProductField;
  disabled?: boolean;
  className?: string;
  extra_props?: Record<string, unknown>;
  template_strings?: boolean;
  template_context?: Record<string, unknown>;
}

interface InputViewProps extends OrderingInputProps {
  descriptor: FormPaletteInputDescriptor;
  fieldBinding?: UseFieldReturn<JsonValue>;
}

function InputView({
  field,
  descriptor,
  fieldBinding,
  disabled = false,
  className,
  extra_props: extraProps = {},
  template_strings: templateStrings = true,
  template_context: localTemplateContext = {},
}: InputViewProps): React.ReactElement {
  const { session, state, definition, snapshot, snapshot_result: snapshotResult, template_context: providerTemplateContext } = useFormPaletteOrdering();
  const context = session.get_context();
  const allowedIds = context?.visibility.optionsByFieldId[field.id];
  const renderedOptions = filterOptions(field.options, allowedIds === undefined ? undefined : new Set(allowedIds));
  const Component = descriptor.Component;
  const renderedField: ProductField = {
    ...field,
    ...(renderedOptions === undefined ? {} : { options: renderedOptions }),
  };
  const adapterContext: FormPaletteAdapterContext = {
    field: renderedField,
    ...(definition === undefined ? {} : { definition }),
  };
  const adapter = descriptor.adapter;
  const currentValue = fieldBinding?.value ?? state.values[field.id] ?? field.default_value ?? null;
  const valueProp = adapter.value_prop ?? "value";
  const changeProp = adapter.change_prop ?? "onChange";
  const errorProp = adapter.error_prop ?? "errorText";
  const optionIds = new Set((allowedIds ?? []).map(String));

  const onChange = (change: unknown): void => {
    const value = adapter.get_value?.(change, currentValue, adapterContext)
      ?? (typeof change === "object" && change !== null && "value" in change ? change.value : change);
    fieldBinding?.setValue((value ?? null) as JsonValue);
    session.set_value(field.id, (value ?? null) as JsonValue);
    if (field.options !== undefined) {
      if (adapter.get_selected_option_ids === undefined) {
        throw new Error(`Form Palette adapter for ${field.id} (${field.type}) must map selected option IDs.`);
      }
      const selected = [...new Set(adapter.get_selected_option_ids(change, value, adapterContext).map(String))]
        .filter((id) => allowedIds === undefined || optionIds.has(id));
      session.set_selected_option_ids(field.id, selected);
    } else if (field.button === true) {
      const active = adapter.is_active?.(value, adapterContext) ?? Boolean(value);
      const current = session.get_trigger_ids().filter((id) => id !== field.id);
      session.set_trigger_ids(active ? [...current, field.id] : current);
    }
  };

  const templateContext = {
    ...providerTemplateContext,
    ...localTemplateContext,
    field: adapterContext.field,
    definition,
    ordering: context,
    state,
    snapshot,
    snapshot_result: snapshotResult,
    value: currentValue,
    error: fieldBinding?.error ?? "",
  };
  const defaults = { ...descriptor.default_props, ...(field.defaults ?? {}) };
  const renderedDefaults = templateStrings ? templateFormPaletteProps(defaults, templateContext) : defaults;
  const renderedExtraProps = templateStrings ? templateFormPaletteProps(extraProps, templateContext) : extraProps;
  const fieldProps = adapter.get_input_props_from_field?.(adapterContext) ?? {};
  const hostProps: Record<string, unknown> = {
    ...fieldProps,
    ...renderedDefaults,
    ...renderedExtraProps,
    id: field.id,
    label: field.label,
    description: field.description,
    required: fieldBinding?.required ?? field.required === true,
    disabled: disabled || fieldBinding?.disabled === true,
    options: renderedOptions,
  };
  if (descriptor.field_binding === "wrapper") {
    hostProps["field"] = adapterContext.field;
    hostProps["fieldKey"] = field.id;
  }
  if (descriptor.field_binding === "component") hostProps["name"] = field.id;
  hostProps["variant"] = descriptor.palette_variant;
  hostProps[valueProp] = currentValue;
  hostProps[changeProp] = onChange;
  hostProps[errorProp] = fieldBinding?.error ?? "";

  return <div ref={fieldBinding?.ref as React.Ref<HTMLDivElement> | undefined} className={className}><Component {...hostProps} /></div>;
}

function WrapperBoundInput(props: OrderingInputProps & { descriptor: FormPaletteInputDescriptor }): React.ReactElement {
  const field = useOrderingField(props.field, props.disabled);
  return <InputView {...props} fieldBinding={field} />;
}

export function OrderingInput(props: OrderingInputProps): React.ReactElement | null {
  const { field } = props;
  const { session, registry } = useFormPaletteOrdering();
  const context = session.get_context();
  if (context === undefined || !context.visibility.fieldIds.includes(field.id)) return null;
  const descriptor = registry.resolve(field.type, field.variant);
  if (descriptor === undefined) return null;
  return descriptor.field_binding === "wrapper"
    ? <WrapperBoundInput {...props} descriptor={descriptor} />
    : <InputView {...props} descriptor={descriptor} />;
}
