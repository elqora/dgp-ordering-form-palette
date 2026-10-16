// SPDX-License-Identifier: GPL-3.0-only

import type { ComponentType } from "react";
import { InputField, registerCoreVariants, type VariantKey } from "@timeax/form-palette";
import type {
  BuildOrderSnapshotOptions,
  ComponentAdapter,
  InputCardinality,
  InputDescriptor,
  InputRegistry,
} from "@elqora/dgp-ordering";

type Definition = BuildOrderSnapshotOptions["definition"];
type ProductField = Parameters<ComponentAdapter<unknown>["create"]>[0];

export interface FormPaletteAdapterContext {
  field: ProductField;
  definition?: Definition;
}

export interface FormPaletteChangeAdapter {
  value_prop?: string;
  change_prop?: string;
  error_prop?: string;
  get_value?(change: unknown, current: unknown, context: FormPaletteAdapterContext): unknown;
  get_selected_option_ids?(change: unknown, stored: unknown, context: FormPaletteAdapterContext): string[];
  is_active?(stored: unknown, context: FormPaletteAdapterContext): boolean;
  get_input_props_from_field?(context: FormPaletteAdapterContext): Record<string, unknown>;
}

export interface ChildOptionCapability {
  supported?: boolean;
  auto_create?: boolean;
  default_label?: string;
  default_value?: string | number;
}

export interface OptionCapability {
  supported?: boolean;
  auto_create?: boolean;
  default_label?: string;
  default_value?: string | number;
  children?: ChildOptionCapability;
}

export interface MultiCapability {
  supported?: boolean;
  auto_enable?: boolean;
}

export interface FormPaletteInputDescriptor extends InputDescriptor {
  /** Canonical product-field registry variant. */
  variant?: string;
  /** Form Palette rendering variant. */
  palette_variant: VariantKey;
  Component: ComponentType<Record<string, unknown>>;
  /** `component` is for InputField-like components; `wrapper` binds a raw component with useField. */
  field_binding: "component" | "wrapper";
  default_props: Record<string, unknown>;
  adapter: FormPaletteChangeAdapter;
  ui?: Record<string, Record<string, unknown>>;
  option_capability?: OptionCapability;
  multi_capability?: MultiCapability;
}

export interface FormPaletteInputRegistry extends InputRegistry {
  resolve(type: string, variant?: string): FormPaletteInputDescriptor | undefined;
  unregister(type: string, variant?: string): void;
  register_many(descriptors: readonly FormPaletteInputDescriptor[]): void;
}

function eventValue(change: unknown): unknown {
  if (typeof change === "object" && change !== null && "value" in change) return change.value;
  return change;
}

function idOf(entry: unknown): string | undefined {
  if (typeof entry === "string" || typeof entry === "number") return String(entry);
  if (typeof entry === "object" && entry !== null && "id" in entry
    && (typeof entry.id === "string" || typeof entry.id === "number")) return String(entry.id);
  return undefined;
}

function eventSelections(change: unknown): string[] {
  if (typeof change === "object" && change !== null && "detail" in change) {
    const detail: unknown = change.detail;
    if (typeof detail === "object" && detail !== null && "selectedOptions" in detail
      && Array.isArray(detail.selectedOptions)) {
      return detail.selectedOptions.flatMap((option) => {
        const id = idOf(option);
        return id === undefined ? [] : [id];
      });
    }
  }
  const value = eventValue(change);
  return (Array.isArray(value) ? value : [value]).flatMap((entry) => {
    const id = idOf(entry);
    return id === undefined ? [] : [id];
  });
}

export interface CreateFormPaletteDescriptorOptions {
  variant?: string;
  palette_variant?: VariantKey;
  Component?: ComponentType<Record<string, unknown>>;
  field_binding?: "component" | "wrapper";
  adapter?: FormPaletteChangeAdapter;
  options?: boolean;
  recursive_options?: boolean;
  option_capability?: OptionCapability;
  multi_capability?: MultiCapability;
  ui?: Record<string, Record<string, unknown>>;
}

export function createFormPaletteDescriptor(
  type: string,
  cardinality: InputCardinality,
  defaultProps: Record<string, unknown> = {},
  options: CreateFormPaletteDescriptorOptions = {},
): FormPaletteInputDescriptor {
  const paletteVariant = options.palette_variant ?? type as VariantKey;
  const supportsOptions = options.options ?? options.option_capability?.supported;
  const supportsRecursiveOptions = options.recursive_options ?? options.option_capability?.children?.supported;
  return {
    type,
    variant: options.variant ?? "default",
    cardinality,
    ...(supportsOptions === undefined ? {} : { options: supportsOptions }),
    ...(supportsRecursiveOptions === undefined ? {} : { recursive_options: supportsRecursiveOptions }),
    palette_variant: paletteVariant,
    Component: options.Component ?? InputField as unknown as ComponentType<Record<string, unknown>>,
    field_binding: options.field_binding ?? "component",
    default_props: { ...defaultProps },
    adapter: {
      get_value: (change) => eventValue(change),
      get_selected_option_ids: (change) => eventSelections(change),
      ...options.adapter,
    },
    ...(options.option_capability === undefined ? {} : { option_capability: options.option_capability }),
    ...(options.multi_capability === undefined ? {} : { multi_capability: options.multi_capability }),
    ...(options.ui === undefined ? {} : { ui: options.ui }),
  };
}

export function createFormPaletteInputRegistry(
  initial: readonly FormPaletteInputDescriptor[] = [],
): FormPaletteInputRegistry {
  const key = (type: string, variant: string): string => `${type}\u0000${variant}`;
  const entries = new Map(initial.map((descriptor) => [key(descriptor.type, descriptor.variant ?? "default"), descriptor]));
  const register = (descriptor: InputDescriptor): void => {
    if (!("Component" in descriptor)) throw new Error(`Form Palette descriptor ${descriptor.type} must define a Component.`);
    const paletteDescriptor = descriptor as FormPaletteInputDescriptor;
    entries.set(key(paletteDescriptor.type, paletteDescriptor.variant ?? "default"), paletteDescriptor);
  };
  return {
    register,
    resolve(type, variant = "default") {
      return entries.get(key(type, variant)) ?? entries.get(key(type, "default"));
    },
    unregister(type, variant = "default") { entries.delete(key(type, variant)); },
    register_many(descriptors) { for (const descriptor of descriptors) register(descriptor); },
  };
}

export const BUILT_IN_INPUT_TYPES = [
  "text", "textarea", "number", "password", "phone", "date", "color",
  "checkbox", "toggle", "toggle-group", "radio", "select", "multiselect",
  "treeselect", "chips", "slider", "file", "editor", "json-editor",
  "keyvalue", "lister", "icon", "image-icon",
] as const;

const optionDefaults: OptionCapability = {
  supported: true,
  auto_create: true,
  default_label: "Option label",
  default_value: "option",
};

const builtInDefaults: Partial<Record<(typeof BUILT_IN_INPUT_TYPES)[number], Record<string, unknown>>> = {
  text: { stripPrefix: true, stripSuffix: true, slotChar: "_" },
  number: { mode: "decimal", useGrouping: true, format: true, allowEmpty: true, step: 1 },
  password: { revealToggle: true, meterStyle: "simple" },
  date: { mode: "single", kind: "date", clearable: true },
  color: { showPreview: true, showPickerToggle: true, previewSize: 18 },
  checkbox: { single: true, tristate: false, size: "md" },
  "toggle-group": { multiple: false, design: "default", layout: "horizontal", gridCols: 2, fillWidth: false, autoCap: false },
  radio: { autoCap: false },
  select: { searchable: true, clearable: true, autoCap: false, joinControls: true },
  multiselect: { searchable: true, clearable: true, autoCap: false, joinControls: true },
  treeselect: { multiple: true, searchable: true, clearable: true, expandAll: false, leafOnly: false },
  chips: { addOnEnter: true, addOnTab: true, addOnBlur: true, allowDuplicates: false, backspaceRemovesLast: true },
  slider: { min: 0, max: 100, step: 1, showValue: true, valuePlacement: "end", joinControls: true, extendBoxToControls: true },
  file: { multiple: false, mergeMode: "append", showDropArea: false, showCheckboxes: true, custom: false },
  editor: { height: "400px", previewStyle: "vertical", editType: "wysiwyg", useCommandShortcut: true },
  keyvalue: { min: 0, max: Number.POSITIVE_INFINITY },
};

const commonUiKeys = [
  "sublabel", "description", "helpText", "labelPlacement", "sublabelPlacement",
  "descriptionPlacement", "helpTextPlacement", "errorTextPlacement", "tagPlacement",
  "tags", "disabled", "readOnly", "inline", "fullWidth", "size", "density",
] as const;

const variantUiKeys: Partial<Record<(typeof BUILT_IN_INPUT_TYPES)[number], readonly string[]>> = {
  text: ["stripPrefix", "stripSuffix", "slotChar", "mask", "prefix", "suffix", "joinControls", "extendBoxToControls", "px", "py", "ps", "pe", "pt", "pb"],
  textarea: ["autoResize", "maxRows", "rows", "px", "py", "ps", "pe", "pt", "pb"],
  phone: ["defaultCountry", "showCountry", "showFlag", "showSelectedLabel", "showSelectedDial", "showDialInList", "px", "py", "ps", "pe", "pt", "pb"],
  number: ["mode", "min", "max", "step", "useGrouping", "format", "allowEmpty", "currency", "locale", "px", "py", "ps", "pe", "pt", "pb"],
  password: ["revealToggle", "meterStyle", "minLength", "requireUppercase", "requireLowercase", "requireNumber", "requireSymbol", "px", "py", "ps", "pe", "pt", "pb"],
  slider: ["min", "max", "step", "showValue", "valuePlacement", "joinControls", "extendBoxToControls"],
  toggle: ["controlPlacement", "onText", "offText"],
  "toggle-group": ["options", "multiple", "design", "layout", "gridCols", "fillWidth", "autoCap"],
  treeselect: ["options", "multiple", "searchable", "searchPlaceholder", "emptySearchText", "clearable", "expandAll", "leafOnly", "optionLabel", "optionValue", "optionDisabled"],
  multiselect: ["options", "searchable", "searchPlaceholder", "emptySearchText", "clearable", "autoCap", "optionLabel", "optionValue", "optionDisabled", "optionDescription", "joinControls"],
  select: ["options", "searchable", "searchPlaceholder", "emptySearchText", "clearable", "autoCap", "optionLabel", "optionValue", "optionDisabled", "optionDescription", "joinControls"],
  radio: ["options", "autoCap", "optionLabel", "optionValue", "optionDisabled", "optionDescription", "layout", "columns"],
  checkbox: ["single", "tristate", "options", "layout", "columns", "itemGapPx"],
  chips: ["addOnEnter", "addOnTab", "addOnBlur", "allowDuplicates", "backspaceRemovesLast", "maxChips", "separators"],
  color: ["showPreview", "showPickerToggle", "previewSize", "px", "py", "ps", "pe", "pt", "pb"],
  date: ["mode", "kind", "clearable", "formatSingle", "formatRange", "locale", "px", "py", "ps", "pe", "pt", "pb"],
  file: ["multiple", "accept", "mergeMode", "showDropArea", "showCheckboxes", "custom", "maxFiles"],
  editor: ["height", "previewStyle", "editType", "useCommandShortcut", "format"],
  "json-editor": ["mode"],
  keyvalue: ["min", "max", "keyPlaceholder", "valuePlaceholder"],
  lister: ["mode", "searchable", "clearable", "pageSize", "valueKey", "labelKey", "disabledKey"],
};

function title(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

type UiPropertySchema = Record<string, unknown>;

function stringProperty(variant?: string): UiPropertySchema {
  return { type: "string", ...(variant === undefined ? {} : { variant }) };
}

function numberProperty(): UiPropertySchema {
  return { type: "number" };
}

function booleanProperty(): UiPropertySchema {
  return { type: "boolean" };
}

function choiceProperty(values: readonly (string | number)[]): UiPropertySchema {
  return { type: "anyOf", items: values.map((value) => ({ value, title: String(value) })) };
}

const stringKeys = [
  "sublabel", "description", "helpText", "slotChar", "mask", "prefix", "suffix",
  "defaultCountry", "currency", "locale", "onText", "offText", "searchPlaceholder",
  "emptySearchText", "optionLabel", "optionValue", "optionDisabled", "optionDescription",
  "keyPlaceholder", "valuePlaceholder", "valueKey", "labelKey", "disabledKey", "height",
  "formatSingle", "formatRange", "accept",
] as const;
const booleanKeys = [
  "disabled", "readOnly", "inline", "fullWidth", "stripPrefix", "stripSuffix", "joinControls",
  "extendBoxToControls", "autoResize", "showCountry", "showFlag", "showSelectedLabel",
  "showSelectedDial", "showDialInList", "useGrouping", "format", "allowEmpty", "revealToggle",
  "requireUppercase", "requireLowercase", "requireNumber", "requireSymbol", "showValue",
  "multiple", "fillWidth", "autoCap", "searchable", "clearable", "expandAll", "leafOnly",
  "single", "tristate", "addOnEnter", "addOnTab", "addOnBlur", "allowDuplicates",
  "backspaceRemovesLast", "showPreview", "showPickerToggle", "showDropArea", "showCheckboxes",
  "custom", "useCommandShortcut",
] as const;
const numberKeys = [
  "px", "py", "ps", "pe", "pt", "pb", "maxRows", "rows", "min", "max", "step",
  "minLength", "gridCols", "columns", "itemGapPx", "maxChips", "previewSize", "maxFiles",
  "pageSize",
] as const;
const choiceValues: Record<string, readonly (string | number)[]> = {
  labelPlacement: ["top", "left", "right", "hidden"],
  sublabelPlacement: ["left", "right", "above", "below", "hidden"],
  descriptionPlacement: ["left", "right", "above", "below", "hidden"],
  helpTextPlacement: ["left", "right", "above", "below", "hidden"],
  errorTextPlacement: ["left", "right", "above", "below", "hidden"],
  tagPlacement: ["left", "right", "above", "below", "hidden"],
  size: ["sm", "md", "lg"],
  density: ["compact", "comfortable", "loose"],
  mode: ["decimal", "currency", "single", "range", "accordion", "popover", "multiple"],
  meterStyle: ["simple", "rules"],
  valuePlacement: ["start", "end"],
  controlPlacement: ["left", "right"],
  design: ["default", "outline"],
  layout: ["horizontal", "vertical", "grid", "list"],
  kind: ["date", "datetime", "time", "hour", "monthYear", "year"],
  mergeMode: ["append", "replace"],
  previewStyle: ["vertical", "tab"],
  editType: ["wysiwyg", "markdown"],
  format: ["html", "markdown"],
};

function propertySchema(key: string, inputType: (typeof BUILT_IN_INPUT_TYPES)[number]): UiPropertySchema {
  if (key === "tags") {
    return {
      type: "array",
      item: {
        type: "object",
        fields: {
          label: stringProperty(),
          className: stringProperty(),
          color: stringProperty("color"),
          bgColor: stringProperty("color"),
        },
      },
    };
  }
  if (key === "density") {
    return choiceProperty(inputType === "toggle"
      ? ["default", "dense"]
      : inputType === "textarea"
        ? ["compact", "normal", "relaxed", "dense", "loose"]
        : ["compact", "comfortable", "loose"]);
  }
  if (key === "mode") {
    const values = inputType === "number" ? ["decimal", "currency"]
      : inputType === "date" ? ["single", "range"]
        : inputType === "json-editor" ? ["accordion", "popover"]
          : ["single", "multiple"];
    return choiceProperty(values);
  }
  if (key === "layout") {
    return choiceProperty(inputType === "radio" || inputType === "checkbox"
      ? ["list", "grid"]
      : ["horizontal", "vertical", "grid"]);
  }
  if (key === "format") {
    return inputType === "number" ? booleanProperty() : choiceProperty(["html", "markdown"]);
  }
  if (["design", "kind", "mergeMode", "meterStyle", "previewStyle", "editType", "valuePlacement", "controlPlacement"].includes(key)) {
    return choiceProperty(choiceValues[key] ?? []);
  }
  if (["labelPlacement", "sublabelPlacement", "descriptionPlacement", "helpTextPlacement", "errorTextPlacement", "tagPlacement", "size"].includes(key)) {
    return choiceProperty(choiceValues[key] ?? []);
  }
  if (key === "separators") return { type: "array", item: { type: "string" } };
  if ((stringKeys as readonly string[]).includes(key)) return stringProperty();
  if ((booleanKeys as readonly string[]).includes(key)) return booleanProperty();
  if ((numberKeys as readonly string[]).includes(key)) return numberProperty();
  if (key === "options") return { type: "array", item: { type: "object", fields: {} } };
  throw new Error(`Missing Form Palette UI metadata schema for ${inputType}.${key}.`);
}

function uiMetadata(type: (typeof BUILT_IN_INPUT_TYPES)[number]): Record<string, Record<string, unknown>> {
  const keys = [...commonUiKeys, ...(variantUiKeys[type] ?? [])];
  return Object.fromEntries([...new Set(keys)].map((key) => [key, {
    ...propertySchema(key, type),
    label: title(key),
    description: `Form Palette ${type} property: ${key}.`,
  }]));
}

function noticeProps({ field, definition }: FormPaletteAdapterContext): Record<string, unknown> {
  const notices = definition?.notices ?? [];
  const classes = {
    info: "border-blue-200 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    warning: "border-amber-200 bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
    error: "border-red-200 bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  } as const;
  const tagsFor = (id: string) => notices
    .filter((notice) => notice.target.scope === "node" && notice.target.node_id === id)
    .map((notice) => ({
      label: notice.title,
      className: `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${classes[notice.severity]}`,
      ...(typeof notice.meta?.["color"] === "string" ? { bgColor: notice.meta["color"] } : {}),
    }));
  const mapOption = (option: NonNullable<typeof field.options>[number]): typeof option & { tags: ReturnType<typeof tagsFor> } => ({
    ...option,
    tags: tagsFor(option.id),
    ...(option.children === undefined ? {} : { children: option.children.map(mapOption) }),
  });
  return {
    label: field.label,
    required: field.required === true,
    tags: tagsFor(field.id),
    ...(field.options === undefined ? {} : { options: field.options.map(mapOption) }),
  };
}

export function createDefaultFormPaletteRegistry(): FormPaletteInputRegistry {
  registerCoreVariants();
  const descriptors = BUILT_IN_INPUT_TYPES.map((type) => {
    const multiple = ["multiselect", "treeselect"].includes(type);
    const optionBased = ["select", "radio", "toggle-group", "multiselect", "treeselect"].includes(type);
    const supportsMultiple = ["toggle-group", "multiselect", "treeselect"].includes(type);
    const recursive = type === "treeselect";
    return createFormPaletteDescriptor(type, multiple ? "multiple" : optionBased ? "single" : "scalar", builtInDefaults[type] ?? {}, {
      palette_variant: (type === "multiselect" ? "multi-select" : type) as VariantKey,
      options: optionBased,
      recursive_options: recursive,
      option_capability: optionBased ? {
        ...optionDefaults,
        ...(recursive ? { children: { supported: true, auto_create: true, default_label: "Child option", default_value: "child" } } : {}),
      } : { supported: false },
      multi_capability: optionBased ? { supported: supportsMultiple, auto_enable: multiple } : { supported: false },
      ui: uiMetadata(type),
      adapter: { get_input_props_from_field: noticeProps },
    });
  });
  descriptors.push(
    createFormPaletteDescriptor("checkbox", "scalar", builtInDefaults.checkbox, {
      option_capability: { supported: false },
      multi_capability: { supported: false },
      ui: uiMetadata("checkbox"),
      adapter: { get_input_props_from_field: noticeProps },
    }),
    createFormPaletteDescriptor("checkbox", "multiple", {
      single: false, tristate: false, layout: "list", columns: 2, itemGapPx: 8, size: "md", density: "comfortable",
    }, {
      variant: "options",
      palette_variant: "checkbox",
      options: true,
      option_capability: optionDefaults,
      multi_capability: { supported: true, auto_enable: true },
      ui: uiMetadata("checkbox"),
      adapter: { get_input_props_from_field: noticeProps },
    }),
  );
  return createFormPaletteInputRegistry(descriptors);
}
