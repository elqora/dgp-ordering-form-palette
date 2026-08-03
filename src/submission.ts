// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import {
  buildOrderSnapshot,
  type BuildOrderSnapshotOptions,
  type BuildOrderSnapshotResult,
  type OrderingInputState,
} from "@elqora/dgp-ordering";

import { useFormPaletteOrdering, useFormPaletteSubmit } from "./provider.js";

export interface FormPaletteValidationFailure {
  ok: false;
  kind: "form_palette";
  state: Readonly<OrderingInputState>;
}

export type FormPaletteOrderingSubmissionResult = BuildOrderSnapshotResult | FormPaletteValidationFailure;

export type FormPaletteSnapshotOptions = Omit<BuildOrderSnapshotOptions, "state">;

export function useFormPaletteOrderSubmission(
  options: FormPaletteSnapshotOptions,
): () => FormPaletteOrderingSubmissionResult {
  const submitForm = useFormPaletteSubmit();
  const { session } = useFormPaletteOrdering();
  return React.useCallback(() => {
    const form = submitForm();
    if (!form.valid) return { ok: false, kind: "form_palette", state: form.state };
    return buildOrderSnapshot({ ...options, state: session.store.get() });
  }, [options, session, submitForm]);
}
