// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Form, useCore, type CoreContext, type Dict } from "@timeax/form-palette";
import { buildOrderSnapshot, type BuildOrderSnapshotOptions, type BuildOrderSnapshotResult, type OrderingInputState, type OrderingSession } from "@elqora/dgp-ordering";

import { createDefaultFormPaletteRegistry, type FormPaletteInputRegistry } from "./registry.js";

type Definition = BuildOrderSnapshotOptions["definition"];
type SnapshotOptions = Omit<BuildOrderSnapshotOptions, "definition" | "state">;
type JsonValue = OrderingInputState["values"][string];
type OrderSnapshot = Extract<BuildOrderSnapshotResult, { ok: true }>["snapshot"];

export interface FormPaletteFormApi {
  get(field_id: string): unknown;
  set(field_id: string, value: JsonValue): void;
  snapshot(): Readonly<Record<string, unknown>>;
  subscribe(listener: () => void): () => void;
  submit(): { values: Dict; valid: boolean };
  set_field_error(field_id: string, message: React.ReactNode): void;
  set_errors(errors: Record<string, React.ReactNode>): void;
}

export interface FormPaletteOrderingContextValue {
  session: OrderingSession;
  registry: FormPaletteInputRegistry;
  core_ref: React.MutableRefObject<CoreContext<Dict> | null>;
  state: Readonly<OrderingInputState>;
  definition?: Definition;
  snapshot?: OrderSnapshot;
  snapshot_result?: BuildOrderSnapshotResult;
  template_context: Readonly<Record<string, unknown>>;
  field_errors: Readonly<Record<string, React.ReactNode>>;
  field_error_messages: Readonly<Record<string, string>>;
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
  /** Build a live OrderSnapshot for templates from the current Ordering state. */
  snapshot_options?: SnapshotOptions;
  registry?: FormPaletteInputRegistry;
  children: React.ReactNode;
  form_props?: Record<string, unknown>;
  template_context?: Record<string, unknown>;
}

export function FormPaletteOrderingProvider({
  session,
  definition,
  snapshot_options: snapshotOptions,
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
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, React.ReactNode>>({});
  const [fieldErrorMessages, setFieldErrorMessages] = React.useState<Record<string, string>>({});
  const valueBag = React.useMemo(() => ({ ...state.values }), [state.values]);
  const orderSnapshotResult = React.useMemo(
    () => definition === undefined || snapshotOptions === undefined
      ? undefined
      : buildOrderSnapshot({ ...snapshotOptions, definition, state }),
    [definition, snapshotOptions, state],
  );
  const orderSnapshot = orderSnapshotResult?.ok === true ? orderSnapshotResult.snapshot : undefined;

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
    set_field_error(fieldId, message) {
      if (typeof message === "string") {
        setFieldErrors((current) => {
          if (!(fieldId in current)) return current;
          const next = { ...current };
          delete next[fieldId];
          return next;
        });
        setFieldErrorMessages((current) => {
          if (message === "") {
            if (!(fieldId in current)) return current;
            const next = { ...current };
            delete next[fieldId];
            return next;
          }
          return current[fieldId] === message ? current : { ...current, [fieldId]: message };
        });
        if (message === "") {
          const field = coreRef.current?.getBind(fieldId);
          if (field !== undefined) field.error = "";
        } else {
          coreRef.current?.error(fieldId, message);
        }
        return;
      }
      setFieldErrors((current) => {
        if (message === null || message === undefined) {
          if (!(fieldId in current)) return current;
          const next = { ...current };
          delete next[fieldId];
          return next;
        }
        return current[fieldId] === message ? current : { ...current, [fieldId]: message };
      });
    },
    set_errors(errors) {
      const paletteErrors: Record<string, string> = {};
      const clearMessageIds = Object.entries(errors)
        .flatMap(([fieldId, message]) => typeof message === "string" && message === "" ? [fieldId] : []);
      setFieldErrors((current) => {
        let next = current;
        for (const [fieldId, message] of Object.entries(errors)) {
          if (typeof message === "string") {
            if (fieldId in next) {
              if (next === current) next = { ...current };
              delete next[fieldId];
            }
            if (message !== "") paletteErrors[fieldId] = message;
          } else if (message === null || message === undefined) {
            if (fieldId in next) {
              if (next === current) next = { ...current };
              delete next[fieldId];
            }
          } else {
            if (next[fieldId] !== message) {
              if (next === current) next = { ...current };
              next[fieldId] = message;
            }
          }
        }
        return next;
      });
      setFieldErrorMessages((current) => {
        let next = current;
        for (const [fieldId, message] of Object.entries(errors)) {
          if (typeof message !== "string") continue;
          if (message === "") {
            if (fieldId in next) {
              if (next === current) next = { ...current };
              delete next[fieldId];
            }
          } else if (next[fieldId] !== message) {
            if (next === current) next = { ...current };
            next[fieldId] = message;
          }
        }
        return next;
      });
      for (const fieldId of clearMessageIds) {
        const field = coreRef.current?.getBind(fieldId);
        if (field !== undefined) field.error = "";
      }
      if (Object.keys(paletteErrors).length > 0) coreRef.current?.error(paletteErrors);
    },
  }), [session]);

  const context = React.useMemo<FormPaletteOrderingContextValue>(() => ({
    session,
    registry,
    core_ref: coreRef,
    state,
    ...(definition === undefined ? {} : { definition }),
    ...(orderSnapshot === undefined ? {} : { snapshot: orderSnapshot }),
    ...(orderSnapshotResult === undefined ? {} : { snapshot_result: orderSnapshotResult }),
    template_context: templateContext,
    field_errors: fieldErrors,
    field_error_messages: fieldErrorMessages,
    form,
  }), [definition, fieldErrorMessages, fieldErrors, form, orderSnapshot, orderSnapshotResult, registry, session, state, templateContext]);

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
