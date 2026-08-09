// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Form, useCore, type CoreContext, type Dict } from "@timeax/form-palette";
import type { BuildOrderSnapshotOptions, OrderingInputState, OrderingSession } from "@elqora/dgp-ordering";

import { createDefaultFormPaletteRegistry, type FormPaletteInputRegistry } from "./registry.js";

type Definition = BuildOrderSnapshotOptions["definition"];
type JsonValue = OrderingInputState["values"][string];

export interface FormPaletteFormApi {
  get(field_id: string): unknown;
  set(field_id: string, value: JsonValue): void;
  snapshot(): Readonly<Record<string, unknown>>;
  subscribe(listener: () => void): () => void;
  submit(): { values: Dict; valid: boolean };
  set_field_error(field_id: string, message: string): void;
  set_errors(errors: Record<string, string>): void;
}

export interface FormPaletteOrderingContextValue {
  session: OrderingSession;
  registry: FormPaletteInputRegistry;
  core_ref: React.MutableRefObject<CoreContext<Dict> | null>;
  state: Readonly<OrderingInputState>;
  definition?: Definition;
  template_context: Readonly<Record<string, unknown>>;
  form: FormPaletteFormApi;
}

const AdapterContext = React.createContext<FormPaletteOrderingContextValue | null>(null);

export function useFormPaletteOrdering(): FormPaletteOrderingContextValue {
  const value = React.useContext(AdapterContext);
  if (value === null) throw new Error("useFormPaletteOrdering must be used within FormPaletteOrderingProvider.");
  return value;
}

export function useFormPaletteForm(): FormPaletteFormApi {
  return useFormPaletteOrdering().form;
}

function CoreBridge({ coreRef }: { coreRef: React.MutableRefObject<CoreContext<Dict> | null> }): null {
  const core = useCore();
  React.useEffect(() => {
    coreRef.current = core;
    return () => { coreRef.current = null; };
  }, [core, coreRef]);
  return null;
}

export interface FormPaletteOrderingProviderProps {
  session: OrderingSession;
  /** Supplies the full authored definition to descriptor field adapters and templates. */
  definition?: Definition;
  registry?: FormPaletteInputRegistry;
  children: React.ReactNode;
  form_props?: Record<string, unknown>;
  template_context?: Record<string, unknown>;
}

export function FormPaletteOrderingProvider({
  session,
  definition,
  registry: suppliedRegistry,
  children,
  form_props: formProps = {},
  template_context: templateContext = {},
}: FormPaletteOrderingProviderProps): React.ReactElement {
  const registry = React.useMemo(() => suppliedRegistry ?? createDefaultFormPaletteRegistry(), [suppliedRegistry]);
  const coreRef = React.useRef<CoreContext<Dict> | null>(null);
  const subscribe = React.useCallback((listener: () => void) => session.store.subscribe(listener), [session]);
  const getSnapshot = React.useCallback(() => session.store.get(), [session]);
  const state = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const valueBag = React.useMemo(() => ({ ...state.values }), [state.values]);

  const form = React.useMemo<FormPaletteFormApi>(() => ({
    get(fieldId) {
      const live = coreRef.current?.values();
      return live !== undefined && fieldId in live ? live[fieldId] : session.store.get().values[fieldId];
    },
    set(fieldId, value) {
      coreRef.current?.setValue(fieldId, value);
      session.set_value(fieldId, value);
    },
    snapshot() {
      return { ...session.store.get().values, ...(coreRef.current?.values() ?? {}) };
    },
    subscribe(listener) { return session.store.subscribe(listener); },
    submit() {
      const submitted = coreRef.current?.submit();
      return submitted ?? { values: {}, valid: false };
    },
    set_field_error(fieldId, message) { coreRef.current?.error(fieldId, message); },
    set_errors(errors) { coreRef.current?.error(errors); },
  }), [session]);

  const context = React.useMemo<FormPaletteOrderingContextValue>(() => ({
    session,
    registry,
    core_ref: coreRef,
    state,
    ...(definition === undefined ? {} : { definition }),
    template_context: templateContext,
    form,
  }), [definition, form, registry, session, state, templateContext]);

  const onChange = React.useCallback((formCore: CoreContext<Dict>, current: { name?: string }): void => {
    if (current.name === undefined || current.name === "") return;
    const value = formCore.values()[current.name];
    session.set_value(current.name, (value ?? null) as JsonValue);
  }, [session]);

  return (
    <AdapterContext.Provider value={context}>
      <Form
        {...formProps}
        adapter="local"
        persist
        valueBag={valueBag}
        formRef={coreRef}
        onChange={onChange}
      >
        <CoreBridge coreRef={coreRef} />
        {children}
      </Form>
    </AdapterContext.Provider>
  );
}

export interface FormPaletteSubmitResult {
  valid: boolean;
  state: Readonly<OrderingInputState>;
}

export function useFormPaletteSubmit(): () => FormPaletteSubmitResult {
  const { form, session } = useFormPaletteOrdering();
  return React.useCallback(() => {
    const submitted = form.submit();
    if (submitted.valid) {
      for (const [fieldId, value] of Object.entries(submitted.values)) {
        session.set_value(fieldId, (value ?? null) as JsonValue);
      }
    }
    return { valid: submitted.valid, state: session.store.get() };
  }, [form, session]);
}
