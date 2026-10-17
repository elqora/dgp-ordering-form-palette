// SPDX-License-Identifier: GPL-3.0-only
// @vitest-environment jsdom

import * as React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { createOrderingSession } from "@elqora/dgp-ordering";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FormPaletteOrderingProvider,
  OrderingInput,
  createDefaultFormPaletteRegistry,
  createFormPaletteDescriptor,
  createFormPaletteInputRegistry,
  templateFormPaletteProps,
  useFormPaletteForm,
  useFormPaletteOrdering,
  useFormPaletteOrderSubmission,
  useFormPaletteSubmit,
} from "../src/index.js";

type Definition = Parameters<typeof createOrderingSession>[0];

afterEach(cleanup);

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
      required: true,
      options: [
        { id: "basic", label: "Basic" },
        { id: "premium", label: "Premium", children: [{ id: "priority", label: "Priority" }] },
      ],
    }],
    order_for_tags: {}, includes_for_buttons: {}, excludes_for_buttons: {},
    option_effects_for_buttons: {}, value_effects_for_triggers: {},
    fallbacks: null, description: null, notices: [], meta: {},
  };
}

function firstField(product: Definition): Definition["fields"][number] {
  const field = product.fields[0];
  if (field === undefined) throw new Error("missing test field");
  return field;
}

function provider(session: ReturnType<typeof createOrderingSession>, product: Definition, registry = createDefaultFormPaletteRegistry()) {
  return function Provider({ children }: { children: React.ReactNode }): React.ReactElement {
    return <FormPaletteOrderingProvider session={session} definition={product} registry={registry}>{children}</FormPaletteOrderingProvider>;
  };
}

describe("Form Palette descriptor registry", () => {
  it("resolves exact variants and falls back to the default descriptor", () => {
    const Default = () => <div />;
    const Cards = () => <div />;
    const descriptors = [
      createFormPaletteDescriptor("choice", "single", {}, { Component: Default, field_binding: "wrapper" }),
      createFormPaletteDescriptor("choice", "multiple", {}, {
        variant: "cards", Component: Cards, field_binding: "wrapper", options: true,
      }),
    ];
    const registry = createFormPaletteInputRegistry();
    registry.register_many(descriptors);
    expect(registry.resolve("choice", "cards")?.Component).toBe(Cards);
    expect(registry.resolve("choice", "missing")?.Component).toBe(Default);
    registry.unregister("choice", "cards");
    expect(registry.resolve("choice", "cards")?.Component).toBe(Default);
  });

  it("publishes accurate option, recursive-option, multi, and UI metadata", () => {
    const registry = createDefaultFormPaletteRegistry();
    expect(registry.resolve("select")).toMatchObject({ cardinality: "single", options: true });
    expect(registry.resolve("treeselect")).toMatchObject({
      cardinality: "multiple", options: true, recursive_options: true,
      option_capability: { supported: true, children: { supported: true } },
      multi_capability: { supported: true },
    });
    expect(registry.resolve("checkbox")).toMatchObject({ default_props: { single: true }, option_capability: { supported: false } });
    expect(registry.resolve("checkbox", "options")).toMatchObject({
      cardinality: "multiple", default_props: { single: false }, option_capability: { supported: true },
    });
    expect(registry.resolve("multiselect")).toMatchObject({ palette_variant: "multi-select" });
    expect(registry.resolve("chips")).toMatchObject({ cardinality: "scalar", options: false });
    expect(registry.resolve("text")?.ui).toMatchObject({
      sublabel: { type: "string", label: "Sublabel" },
      fullWidth: { type: "boolean", label: "Full Width" },
      joinControls: { type: "boolean" },
      extendBoxToControls: { type: "boolean" },
      labelPlacement: { type: "anyOf", items: [{ value: "top" }, { value: "left" }, { value: "right" }, { value: "hidden" }] },
      density: { type: "anyOf", items: [{ value: "compact" }, { value: "comfortable" }, { value: "loose" }] },
      tags: {
        type: "array",
        item: { type: "object", fields: {
          label: { type: "string" }, className: { type: "string" },
          color: { type: "string", variant: "color" }, bgColor: { type: "string", variant: "color" },
        } },
      },
    });
    expect(registry.resolve("chips")?.ui).toMatchObject({
      maxChips: { type: "number" }, separators: { type: "array", item: { type: "string" } },
    });
    expect(registry.resolve("editor")?.ui).toMatchObject({
      format: { type: "anyOf", items: [{ value: "html" }, { value: "markdown" }] },
    });
  });

  it("maps canonical field and recursive option notices into Form Palette tags", () => {
    const product = definition();
    product.notices = [
      { id: "field-notice", type: "public", kind: "label", severity: "info", target: { scope: "node", node_kind: "field", node_id: "package" }, title: "Featured" },
      { id: "option-notice", type: "public", kind: "warning", severity: "warning", target: { scope: "node", node_kind: "option", node_id: "priority" }, title: "Limited" },
    ];
    const descriptor = createDefaultFormPaletteRegistry().resolve("select");
    const props = descriptor?.adapter.get_input_props_from_field?.({ field: firstField(product), definition: product });
    expect(props?.["tags"]).toMatchObject([{ label: "Featured" }]);
    const options = props?.["options"] as Array<{ children?: Array<{ tags: Array<{ label: string }> }> }>;
    expect(options[1]?.children?.[0]?.tags).toMatchObject([{ label: "Limited" }]);
  });

  it("extracts values and both supported Form Palette selection event shapes", () => {
    const descriptor = createFormPaletteDescriptor("select", "single");
    const context = { field: firstField(definition()) };
    expect(descriptor.adapter.get_value?.({ value: "basic" }, null, context)).toBe("basic");
    expect(descriptor.adapter.get_selected_option_ids?.({
      value: "premium", detail: { selectedOptions: [{ id: "premium" }, { id: 7 }] },
    }, "premium", context)).toEqual(["premium", "7"]);
    expect(descriptor.adapter.get_selected_option_ids?.({ value: [{ id: "basic" }] }, null, context)).toEqual(["basic"]);
  });
});

describe("safe wrapper templating", () => {
  it("templates nested props with paths, nullish/or fallbacks, and no evaluation", () => {
    const result = templateFormPaletteProps({
      title: "Buy {customer.name}",
      nested: ["{missing ?? 'fallback'}", "{count || 4}", "{payload}"],
      blocked: "{constructor.constructor('return 1')}",
    }, { customer: { name: "Ada" }, count: 0, payload: { safe: true } });
    expect(result).toEqual({
      title: "Buy Ada", nested: ["fallback", "4", "{\"safe\":true}"], blocked: "",
    });
  });
});

describe("OrderingInput", () => {
  it("uses the real InputField lifecycle to write a text value", async () => {
    const product = definition();
    product.fields = [{ id: "name", type: "text", label: "Name", bind_id: "root", required: true }];
    const session = createOrderingSession(product, "root");
    render(<FormPaletteOrderingProvider session={session} definition={product}><OrderingInput field={firstField(product)} /></FormPaletteOrderingProvider>);
    const input = screen.getByRole("textbox", { name: /Name/ });
    fireEvent.change(input, { target: { value: "Ada" } });
    await waitFor(() => expect(session.store.get().values).toEqual({ name: "Ada" }));
  });

  it("renders rich validation content in the Form Palette error slot and marks the field invalid", async () => {
    const product = definition();
    product.fields = [{ id: "quantity", type: "number", label: "Quantity", bind_id: "root" }];
    const session = createOrderingSession(product, "root");
    let api: ReturnType<typeof useFormPaletteForm> | undefined;
    function Probe(): null { api = useFormPaletteForm(); return null; }

    const view = render(
      <FormPaletteOrderingProvider session={session} definition={product}>
        <OrderingInput
          field={firstField(product)}
          validation_error={<ul><li>Quantity must be at least 10.</li><li>Quantity must be at most 20000.</li></ul>}
        />
        <Probe />
      </FormPaletteOrderingProvider>,
    );

    act(() => api?.set_field_error("quantity", "Quantity must be at least 10."));
    expect(await screen.findByText("Quantity must be at least 10.")).toBeTruthy();
    expect(screen.getByText("Quantity must be at most 20000.")).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: /Quantity/ }).getAttribute("aria-invalid")).toBe("true");

    view.rerender(
      <FormPaletteOrderingProvider session={session} definition={product}>
        <OrderingInput field={firstField(product)} />
        <Probe />
      </FormPaletteOrderingProvider>,
    );
    act(() => api?.set_field_error("quantity", ""));
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: /Quantity/ }).getAttribute("aria-invalid")).not.toBe("true"));
    expect(screen.queryByText("Quantity must be at most 20000.")).toBeNull();
  });

  it("accepts rich field errors through the form API and reveals an underlying string error when cleared", async () => {
    const product = definition();
    product.fields = [{ id: "quantity", type: "number", label: "Quantity", bind_id: "root" }];
    const session = createOrderingSession(product, "root");
    let api: ReturnType<typeof useFormPaletteForm> | undefined;
    function Probe(): null { api = useFormPaletteForm(); return null; }

    render(
      <FormPaletteOrderingProvider session={session} definition={product}>
        <OrderingInput field={firstField(product)} />
        <Probe />
      </FormPaletteOrderingProvider>,
    );

    act(() => api?.set_field_error("quantity", "Underlying Form Palette error."));
    expect(await screen.findByText("Underlying Form Palette error.")).toBeTruthy();

    act(() => api?.set_field_error("quantity", (
      <ul>
        <li>Quantity must be at least 10.</li>
        <li>Quantity must be at most 20000.</li>
      </ul>
    )));
    expect(await screen.findByText("Quantity must be at least 10.")).toBeTruthy();
    expect(screen.getByText("Quantity must be at most 20000.")).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: /Quantity/ }).getAttribute("aria-invalid")).toBe("true");

    act(() => api?.set_field_error("quantity", null));
    expect(await screen.findByText("Underlying Form Palette error.")).toBeTruthy();
    expect(screen.queryByText("Quantity must be at most 20000.")).toBeNull();
  });

  it("applies rich error maps partially and clears only fields explicitly set to null", async () => {
    const product = definition();
    product.fields = [
      { id: "quantity", type: "number", label: "Quantity", bind_id: "root" },
      { id: "target", type: "text", label: "Target", bind_id: "root" },
    ];
    const session = createOrderingSession(product, "root");
    let api: ReturnType<typeof useFormPaletteForm> | undefined;
    function Probe(): null { api = useFormPaletteForm(); return null; }

    render(
      <FormPaletteOrderingProvider session={session} definition={product}>
        {product.fields.map((field) => <OrderingInput key={field.id} field={field} />)}
        <Probe />
      </FormPaletteOrderingProvider>,
    );

    act(() => api?.set_errors({
      quantity: <ul><li>Minimum is 10.</li><li>Maximum is 20000.</li></ul>,
      target: <span>Enter a target URL.</span>,
    }));
    expect(await screen.findByText("Minimum is 10.")).toBeTruthy();
    expect(screen.getByText("Maximum is 20000.")).toBeTruthy();
    expect(screen.getByText("Enter a target URL.")).toBeTruthy();

    act(() => api?.set_errors({ quantity: null }));
    await waitFor(() => expect(screen.queryByText("Minimum is 10.")).toBeNull());
    expect(screen.getByText("Enter a target URL.")).toBeTruthy();
  });

  it("maps values, selected options, descriptor props, variants, and deep templates", () => {
    const product = definition();
    const productField = firstField(product);
    productField.variant = "cards";
    productField.defaults = { placeholder: "Choose {customer.name}" };
    const seen: Record<string, unknown>[] = [];
    const Component = (props: Record<string, unknown>) => {
      seen.push(props);
      return <button data-testid="custom" onClick={() => (props["setModel"] as (value: unknown) => void)({
        value: "premium", detail: { selectedOptions: [{ id: "premium" }, { id: "hidden" }] },
      })} />;
    };
    const descriptor = createFormPaletteDescriptor("select", "single", { caption: "For {customer.name}" }, {
      variant: "cards", palette_variant: "select", Component, field_binding: "wrapper", options: true,
      adapter: {
        value_prop: "model",
        change_prop: "setModel",
        error_prop: "validation",
        get_input_props_from_field: ({ field }) => ({ fieldLabel: field.label }),
      },
    });
    const registry = createFormPaletteInputRegistry([descriptor]);
    const session = createOrderingSession(product, "root", undefined, registry);
    render(
      <FormPaletteOrderingProvider session={session} definition={product} registry={registry} template_context={{ customer: { name: "Ada" } }}>
        <OrderingInput field={productField} extra_props={{ help: "Hello {customer.name}" }} />
      </FormPaletteOrderingProvider>,
    );
    expect(seen.at(-1)).toMatchObject({
      model: null, variant: "select", fieldLabel: "Package", caption: "For Ada",
      placeholder: "Choose Ada", help: "Hello Ada", required: true,
    });
    fireEvent.click(screen.getByTestId("custom"));
    expect(session.store.get()).toMatchObject({ values: { package: "premium" }, selections: { package: ["premium"] } });
  });

  it("provides the live OrderSnapshot and build result to template contexts", () => {
    const product = definition();
    product.fields = [{ id: "name", name: "name", type: "text", label: "Name", bind_id: "root", required: true }];
    const seen: Record<string, unknown>[] = [];
    const descriptor = createFormPaletteDescriptor("text", "scalar", {
      snapshotVersion: "{snapshot.version}",
      snapshotQuantity: "{snapshot.quantity}",
      snapshotInput: "{snapshot.inputs.form.name}",
      snapshotStatus: "{snapshot_result.kind}",
    }, {
      Component: (props) => { seen.push(props); return <div />; }, field_binding: "wrapper",
    });
    const session = createOrderingSession(product, "root");
    render(
      <FormPaletteOrderingProvider
        session={session}
        definition={product}
        snapshot_options={{ filter_id: "root", services: [] }}
        registry={createFormPaletteInputRegistry([descriptor])}
      >
        <OrderingInput field={firstField(product)} />
      </FormPaletteOrderingProvider>,
    );
    expect(seen.at(-1)).toMatchObject({ snapshotVersion: "", snapshotQuantity: "", snapshotInput: "", snapshotStatus: "customer_input" });
    act(() => session.set_value("name", "Ada"));
    expect(seen.at(-1)).toMatchObject({ snapshotVersion: "1", snapshotQuantity: "1", snapshotInput: "Ada", snapshotStatus: "", value: "Ada" });
  });

  it("retains ancestors while filtering recursive visible options", () => {
    const product = definition();
    const productField = firstField(product);
    productField.type = "treeselect";
    product.fields.push({ id: "show-priority", type: "toggle", label: "Show priority", bind_id: "root", button: true });
    product.option_effects_for_buttons = { "show-priority": { package: { include: ["priority"] } } };
    const seen: Record<string, unknown>[] = [];
    const descriptor = createFormPaletteDescriptor("treeselect", "multiple", {}, {
      Component: (props) => { seen.push(props); return <div />; }, field_binding: "wrapper", options: true, recursive_options: true,
    });
    const registry = createFormPaletteInputRegistry([descriptor]);
    const session = createOrderingSession(product, "root", undefined, registry);
    session.set_trigger_ids(["show-priority"]);
    render(<FormPaletteOrderingProvider session={session} definition={product} registry={registry}><OrderingInput field={productField} /></FormPaletteOrderingProvider>);
    const options = seen.at(-1)?.["options"] as Array<{ id: string; children?: Array<{ id: string }> }>;
    expect(options.flatMap((option) => [option.id, ...(option.children ?? []).map((child) => child.id)])).not.toContain("hidden");
    expect(options.some((option) => option.id === "premium" && option.children?.[0]?.id === "priority")).toBe(true);
  });

  it("maps option-less action input activity to Ordering trigger state", () => {
    const product = definition();
    product.fields = [{ id: "refresh", type: "toggle", label: "Refresh", bind_id: "root", button: true }];
    const Component = (props: Record<string, unknown>) => (
      <button data-testid="action" onClick={() => (props["onChange"] as (change: unknown) => void)({ value: true })} />
    );
    const descriptor = createFormPaletteDescriptor("toggle", "scalar", {}, { Component, field_binding: "wrapper" });
    const registry = createFormPaletteInputRegistry([descriptor]);
    const session = createOrderingSession(product, "root", undefined, registry);
    render(<FormPaletteOrderingProvider session={session} definition={product} registry={registry}><OrderingInput field={firstField(product)} /></FormPaletteOrderingProvider>);
    fireEvent.click(screen.getByTestId("action"));
    expect(session.get_trigger_ids()).toContain("refresh");
  });
});

describe("real Form Palette form bridge", () => {
  it("maps wrapper-bound refs, errors, required, and disabled state into a raw custom component", async () => {
    const product = definition();
    product.fields = [{ id: "name", type: "custom", label: "Name", bind_id: "root", required: true }];
    const seen: Record<string, unknown>[] = [];
    const descriptor = createFormPaletteDescriptor("custom", "scalar", {}, {
      palette_variant: "text",
      Component: (props) => { seen.push(props); return <input data-testid="raw" disabled={Boolean(props["disabled"])} />; },
      field_binding: "wrapper",
      adapter: { error_prop: "validation" },
    });
    const registry = createFormPaletteInputRegistry([descriptor]);
    const session = createOrderingSession(product, "root", undefined, registry);
    let api: ReturnType<typeof useFormPaletteForm> | undefined;
    let ordering: ReturnType<typeof useFormPaletteOrdering> | undefined;
    function Probe(): null { api = useFormPaletteForm(); ordering = useFormPaletteOrdering(); return null; }
    const view = render(
      <FormPaletteOrderingProvider session={session} definition={product} registry={registry}>
        <OrderingInput field={firstField(product)} disabled className="field-root" />
        <Probe />
      </FormPaletteOrderingProvider>,
    );
    expect(seen.at(-1)).toMatchObject({ required: true, disabled: true, validation: "" });
    expect(ordering?.core_ref.current?.fields[0]?.ref?.current).toBe(view.container.querySelector(".field-root"));
    act(() => api?.set_field_error("name", "Required custom value"));
    await waitFor(() => expect(seen.at(-1)?.["validation"]).toBe("Required custom value"));
  });

  it("exposes programmatic get/set, snapshots, subscriptions, and error channels", async () => {
    const product = definition();
    product.fields = [{ id: "name", type: "text", label: "Name", bind_id: "root" }];
    const session = createOrderingSession(product, "root");
    let api: ReturnType<typeof useFormPaletteForm> | undefined;
    function Probe(): null { api = useFormPaletteForm(); return null; }
    render(<FormPaletteOrderingProvider session={session} definition={product}><OrderingInput field={firstField(product)} /><Probe /></FormPaletteOrderingProvider>);
    if (api === undefined) throw new Error("missing form API");
    const listener = vi.fn();
    const unsubscribe = api.subscribe(listener);
    act(() => api?.set("name", "Grace"));
    await waitFor(() => expect(api?.get("name")).toBe("Grace"));
    expect(api.snapshot()).toMatchObject({ name: "Grace" });
    expect(listener).toHaveBeenCalled();
    act(() => api?.set_field_error("name", "Already used"));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Name/ }).getAttribute("aria-invalid")).toBe("true"));
    unsubscribe();
  });

  it("retains session-backed values after a Form Palette field unmounts", async () => {
    const product = definition();
    product.filters.push({ id: "other", label: "Other" });
    product.fields = [{ id: "name", type: "text", label: "Name", bind_id: "root" }];
    const session = createOrderingSession(product, "root", { values: { name: "Persisted" }, selections: {} });
    let api: ReturnType<typeof useFormPaletteForm> | undefined;
    function Probe(): null { api = useFormPaletteForm(); return null; }
    render(<FormPaletteOrderingProvider session={session} definition={product}><OrderingInput field={firstField(product)} /><Probe /></FormPaletteOrderingProvider>);
    expect(screen.getByRole("textbox", { name: /Name/ })).toBeTruthy();
    act(() => session.set_filter_id("other"));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: /Name/ })).toBeNull());
    expect(api?.snapshot()).toMatchObject({ name: "Persisted" });
  });

  it("validates required fields through the real Form Palette submit lifecycle", () => {
    const product = definition();
    product.fields = [{ id: "name", type: "text", label: "Name", bind_id: "root", required: true }];
    const session = createOrderingSession(product, "root");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FormPaletteOrderingProvider session={session} definition={product}>
        <OrderingInput field={firstField(product)} />
        {children}
      </FormPaletteOrderingProvider>
    );
    const { result } = renderHook(() => useFormPaletteSubmit(), { wrapper });
    expect(result.current()).toMatchObject({ valid: false });
    act(() => session.set_value("name", "Ada"));
    expect(result.current()).toMatchObject({ valid: true, state: { values: { name: "Ada" } } });
  });

  it("surfaces structured Ordering failures without producing a snapshot", () => {
    const product = definition();
    product.fields = [{
      id: "quantity", type: "number", label: "Quantity", bind_id: "root",
      quantity: { value_by: "eval", expression: { language: "javascript", body: "return 'invalid'" } },
    }];
    const session = createOrderingSession(product, "root", { values: { quantity: 1 }, selections: {} });
    const wrapper = provider(session, product);
    const { result } = renderHook(() => useFormPaletteOrderSubmission({ definition: product, filter_id: "root", services: [] }), { wrapper });
    const submission = result.current();
    expect(submission).toMatchObject({ ok: false, kind: "host_configuration", failure: { code: "expression_result_invalid" } });
    expect("snapshot" in submission).toBe(false);
  });
});
