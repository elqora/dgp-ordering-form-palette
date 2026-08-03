// SPDX-License-Identifier: GPL-3.0-only

import { useField, type UseFieldReturn, type VariantKey } from "@timeax/form-palette";
import type { ComponentAdapter, OrderingInputState } from "@elqora/dgp-ordering";

import { useFormPaletteOrdering } from "./provider.js";

type ProductField = Parameters<ComponentAdapter<unknown>["create"]>[0];
type JsonValue = OrderingInputState["values"][string];

export function useOrderingField(field: ProductField, disabled = false): UseFieldReturn<JsonValue> {
  const { session, state } = useFormPaletteOrdering();
  return useField<JsonValue>({
    name: field.id,
    variant: field.type as VariantKey,
    required: field.required === true,
    disabled,
    value: state.values[field.id] ?? field.default_value ?? null,
    onValueChange(next) { session.set_value(field.id, next ?? null); },
  });
}
