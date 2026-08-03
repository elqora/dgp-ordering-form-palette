// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Form, useCore, type CoreContext, type Dict } from "@timeax/form-palette";
import type { OrderingInputState, OrderingSession } from "@elqora/dgp-ordering";

import { createDefaultFormPaletteRegistry, type FormPaletteInputRegistry } from "./registry.js";

interface AdapterContextValue {
  session: OrderingSession;
  registry: FormPaletteInputRegistry;
  core_ref: React.MutableRefObject<CoreContext<Dict> | null>;
  state: Readonly<OrderingInputState>;
}

const AdapterContext = React.createContext<AdapterContextValue | null>(null);

export function useFormPaletteOrdering(): AdapterContextValue {
  const value = React.useContext(AdapterContext);
  if (value === null) throw new Error("useFormPaletteOrdering must be used within FormPaletteOrderingProvider.");
  return value;
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
  registry?: FormPaletteInputRegistry;
  children: React.ReactNode;
  form_props?: Record<string, unknown>;
}

export function FormPaletteOrderingProvider({
  session,
  registry: suppliedRegistry,
  children,
  form_props: formProps = {},
}: FormPaletteOrderingProviderProps): React.ReactElement {
  const registry = React.useMemo(() => suppliedRegistry ?? createDefaultFormPaletteRegistry(), [suppliedRegistry]);
  const coreRef = React.useRef<CoreContext<Dict> | null>(null);
  const subscribe = React.useCallback((listener: () => void) => session.store.subscribe(listener), [session]);
  const getSnapshot = React.useCallback(() => session.store.get(), [session]);
  const state = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const context = React.useMemo(() => ({ session, registry, core_ref: coreRef, state }), [registry, session, state]);
  const valueBag = React.useMemo(() => ({ ...state.values }), [state.values]);

  const onChange = React.useCallback((form: CoreContext<Dict>, current: { name?: string }): void => {
    if (current.name === undefined || current.name === "") return;
    const value = form.values()[current.name];
    session.set_value(current.name, (value ?? null) as OrderingInputState["values"][string]);
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
  const { core_ref: coreRef, session } = useFormPaletteOrdering();
  return React.useCallback(() => {
    const submitted = coreRef.current?.submit();
    if (submitted?.valid === true) {
      for (const [fieldId, value] of Object.entries(submitted.values)) {
        session.set_value(fieldId, (value ?? null) as OrderingInputState["values"][string]);
      }
    }
    return { valid: submitted?.valid === true, state: session.store.get() };
  }, [coreRef, session]);
}
