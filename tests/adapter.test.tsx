// SPDX-License-Identifier: GPL-3.0-only
// @vitest-environment jsdom

import * as React from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { createOrderingSession } from "@elqora/dgp-ordering";
import { beforeEach, describe, expect, it, vi } from "vitest";

const palette = vi.hoisted(() => ({
  core: {
    values: () => ({}),
    submit: () => ({ values: {}, valid: true }),
  },
}));

vi.mock("@timeax/form-palette", () => ({
  Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  InputField: () => null,
  useCore: () => palette.core,
  useField: () => ({}),
}));

import {
  FormPaletteOrderingProvider,
  OrderingInput,
  createDefaultFormPaletteRegistry,
  createFormPaletteDescriptor,
  createFormPaletteInputRegistry,
  useFormPaletteOrderSubmission,
} from "../src/index.js";

type Definition = Parameters<typeof createOrderingSession>[0];

function definition(): Definition {
  return {
    id: "product",
    name: "Product",
    schema_version: "1",
    filters: [{ id: "root", label: "Root" }],
    fields: [{
      id: "package",
      type: "select",
      label: "Package",
      bind_id: "root",
      options: [{ id: "basic", label: "Basic" }, { id: "premium", label: "Premium" }],
    }],
    order_for_tags: {}, includes_for_buttons: {}, excludes_for_buttons: {},
    option_effects_for_buttons: {}, value_effects_for_triggers: {},
    fallbacks: null, description: null, notices: [], meta: {},
  };
}

describe("Form Palette descriptor registry", () => {
  it("provides built-ins and extracts current Form Palette change details", () => {
    const registry = createDefaultFormPaletteRegistry();
    const descriptor = registry.resolve("multiselect");
    expect(descriptor?.cardinality).toBe("multiple");
    expect(descriptor?.value_from_change({ value: ["basic"] })).toEqual(["basic"]);
    expect(descriptor?.selected_option_ids_from_change({
      detail: { selectedOptions: [{ id: "basic" }, { id: "premium" }] },
    })).toEqual(["basic", "premium"]);
  });
});

describe("OrderingInput", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes values and selected option IDs through the Ordering session", () => {
    const session = createOrderingSession(definition(), "root");
    const descriptor = createFormPaletteDescriptor("select", "single");
    descriptor.Component = (props) => (
      <button
        data-testid="input"
        onClick={() => (props["onChange"] as (change: unknown) => void)({
          value: "premium",
          detail: { selectedOptions: [{ id: "premium" }] },
        })}
      />
    );
    const registry = createFormPaletteInputRegistry([descriptor]);
    const field = definition().fields[0];
    if (field === undefined) throw new Error("missing test field");

    render(
      <FormPaletteOrderingProvider session={session} registry={registry}>
        <OrderingInput field={field} />
      </FormPaletteOrderingProvider>,
    );
    fireEvent.click(screen.getByTestId("input"));
    expect(session.store.get()).toMatchObject({
      values: { package: "premium" },
      selections: { package: ["premium"] },
    });
  });

  it("surfaces structured Ordering failures without producing a snapshot", () => {
    const product = definition();
    product.fields = [{
      id: "quantity",
      type: "number",
      label: "Quantity",
      bind_id: "root",
      quantity: {
        value_by: "eval",
        expression: { language: "javascript", body: "return 'invalid'" },
      },
    }];
    const session = createOrderingSession(product, "root", { values: { quantity: 1 }, selections: {} });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FormPaletteOrderingProvider session={session}>{children}</FormPaletteOrderingProvider>
    );
    const { result } = renderHook(() => useFormPaletteOrderSubmission({
      definition: product,
      filter_id: "root",
      services: [],
    }), { wrapper });
    const submission = result.current();
    expect(submission).toMatchObject({
      ok: false,
      kind: "host_configuration",
      failure: { code: "expression_result_invalid" },
    });
    expect("snapshot" in submission).toBe(false);
  });
});
