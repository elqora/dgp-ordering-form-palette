// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import type { ComponentAdapter, OrderingInputState } from "@elqora/dgp-ordering";

import { useFormPaletteOrdering } from "./provider.js";

type ProductField = Parameters<ComponentAdapter<unknown>["create"]>[0];
type FieldOption = NonNullable<ProductField["options"]>[number];

function filterOptions(options: readonly FieldOption[] | undefined, allowed: ReadonlySet<string>): FieldOption[] | undefined {
  if (options === undefined) return undefined;
  return options.flatMap((option) => {
    const children = filterOptions(option.children, allowed);
    if (!allowed.has(option.id) && (children?.length ?? 0) === 0) return [];
    return [{ ...option, ...(children === undefined ? {} : { children }) }];
  });
}

export interface OrderingInputProps {
  field: ProductField;
  disabled?: boolean;
  className?: string;
  extra_props?: Record<string, unknown>;
}

export function OrderingInput({ field, disabled = false, className, extra_props: extraProps = {} }: OrderingInputProps): React.ReactElement | null {
  const { session, registry, state } = useFormPaletteOrdering();
  const context = session.get_context();
  if (context === undefined || !context.visibility.fieldIds.includes(field.id)) return null;
  const descriptor = registry.resolve(field.type);
  if (descriptor === undefined) return null;
  const allowed = new Set(context.visibility.optionsByFieldId[field.id] ?? []);
  const renderedOptions = filterOptions(field.options, allowed);
  const Component = descriptor.Component;

  const onChange = (change: unknown): void => {
    const value = descriptor.value_from_change(change);
    session.set_value(field.id, (value ?? null) as OrderingInputState["values"][string]);
    if (field.options !== undefined) {
      session.set_selected_option_ids(field.id, descriptor.selected_option_ids_from_change(change));
    } else if (field.button === true) {
      const active = Boolean(value);
      const current = session.get_trigger_ids().filter((id) => id !== field.id);
      session.set_trigger_ids(active ? [...current, field.id] : current);
    }
  };

  const props: Record<string, unknown> = {
    ...descriptor.default_props,
    ...field.defaults,
    ...extraProps,
    name: field.id,
    variant: descriptor.variant,
    value: state.values[field.id] ?? field.default_value ?? null,
    label: field.label,
    description: field.description,
    required: field.required,
    disabled,
    options: renderedOptions,
    onChange,
  };
  return <div className={className}><Component {...props} /></div>;
}
