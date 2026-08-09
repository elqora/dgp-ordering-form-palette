# DGP Ordering Form Palette

DGP Ordering Form Palette is the optional batteries-included React integration between DGP Ordering and `@timeax/form-palette`. It preserves the existing Form Palette ordering experience while allowing DGP Ordering itself to remain light, configurable, and independent of any particular form library or input collection.

Hosts may use this package as the default integration, combine its form binding with custom registered inputs, or omit it and provide their own form adapter and field registry.

## Responsibilities

- Adapt Form Palette `Form`, `useCore`, and `useField` APIs to neutral DGP Ordering contracts
- Preserve the existing Wrapper behavior over the Form Palette field binding
- Supply built-in `InputField` descriptors and a default registry factory
- Provide a convenience ordering provider for Form Palette hosts
- Translate Form Palette values, errors, disabled state, refs, submission, and subscriptions without owning ordering semantics

DGP Ordering remains authoritative for customer input orchestration, selections, visibility integration, quantity resolution, browser JavaScript expressions, customer validation, and `OrderSnapshot` construction.

## Ecosystem

- [DGP Spec](https://github.com/elqora/dgp-spec) owns canonical contracts.
- [DGP Core](https://github.com/elqora/dgp-core) interprets product definitions.
- [DGP Validation](https://github.com/elqora/dgp-validation) validates definitions for ingestion and publication.
- [DGP Ordering](https://github.com/elqora/dgp-ordering) supplies neutral ordering behavior and integration contracts.
- [DGP Workspace](https://github.com/elqora/dgp-workspace) supplies headless editorial session infrastructure.
- [DGP Studio](https://github.com/elqora/dgp-studio) may consume this package for its default Form Palette experience.
- [DGP SDK](https://github.com/elqora/dgp-sdk) defines backend handler and fulfillment contracts.
- [Digital Service Engine](https://github.com/timeax/digital-service-engine) contains the legacy Wrapper and Form Palette integration behavior.

## Usage

Create an `OrderingSession`, then provide it to the adapter. `OrderingInput`
resolves the registered descriptor, filters options using Ordering visibility,
and synchronizes Form Palette changes back into the session.

```tsx
const session = createOrderingSession(definition, "root");

<FormPaletteOrderingProvider session={session}>
  {definition.fields.map((field) => (
    <OrderingInput key={field.id} field={field} />
  ))}
</FormPaletteOrderingProvider>
```

`createDefaultFormPaletteRegistry()` registers Form Palette's core variants and
supplies the standard `InputField` descriptors, established defaults,
capability declarations, and authoring UI metadata. Canonical field variants
fall back to the descriptor's `default` variant; `palette_variant` independently
selects the Form Palette renderer.

Hosts can replace descriptors or register custom components. Use
`field_binding: "component"` for a component such as `InputField` that owns its
Form Palette field, or `field_binding: "wrapper"` for a raw component that must
be registered by `useOrderingField`. Descriptor adapters can map value, change,
error, selected-option, action-state, and field-derived props.

`useFormPaletteForm()` provides programmatic `get`, `set`, `snapshot`,
`subscribe`, error, and submit access. `OrderingInput` also supports safe deep
templating for descriptor defaults and host props through provider and local
template contexts.

`useFormPaletteOrderSubmission()` first runs Form Palette validation and then
delegates snapshot construction to Ordering. Expression and host-configuration
failures are returned unchanged, and no snapshot is returned after failure.

## Toolchain

The adapter supports Node.js 22 or newer. React, React DOM, and Form Palette are
peer dependencies.

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run check:boundaries
npm run build
npm run check
```

No generated outputs are committed. `npm run check` is the repository
completion command.

## License

GPL-3.0-only.
