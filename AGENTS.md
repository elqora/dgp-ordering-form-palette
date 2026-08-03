# Agent guidance: DGP Ordering Form Palette

Read and follow `../AGENTS.md` before working in this repository.

## Role

This repository is the optional React integration between sibling `dgp-ordering` and `@timeax/form-palette`. It supplies the official batteries-included Form Palette experience without making Form Palette a dependency of DGP Ordering or any other base package.

## Dependencies

- May depend on sibling `dgp-ordering`, React, React DOM, and `@timeax/form-palette`.
- Consume ordering contracts from `dgp-ordering`; do not redefine them locally.
- Must not become a dependency of `dgp-spec`, `dgp-core`, `dgp-validation`, `dgp-ordering`, `dgp-workspace`, or `dgp-sdk`.
- DGP Studio may consume this package optionally.

## Owned behavior

- Form Palette implementations of neutral ordering form-store and field-binding contracts.
- Existing Wrapper behavior that calls `useField` and synchronizes Form Palette state with ordering selections.
- The `Form` and `useCore` bridge used for values, errors, subscriptions, persistence, and validation submission.
- Built-in `InputField` descriptors, their UI metadata, the default registry factory, and entry registration.
- A convenience provider that composes DGP Ordering with the Form Palette integration.

## Boundaries

- Do not own selection, visibility, quantity, expression, customer-validation, pricing, or `OrderSnapshot` semantics; those belong to `dgp-ordering`.
- Do not define canonical schemas, service capabilities, workspace state, Studio panels, or backend behavior.
- Keep host-provided registries and custom input components supported; the built-in registry is a default, not a protocol requirement.
- Preserve the current Wrapper behavior during migration unless an explicit compatibility decision changes it.

## Migration sources

- `D:\Projects\GitHub\digital-service-ui-builder\src\react\inputs\wrapper.tsx`
- `D:\Projects\GitHub\digital-service-ui-builder\src\react\inputs\form-context.tsx`
- `D:\Projects\GitHub\digital-service-ui-builder\src\react\inputs\entries` and registry code
- The Form Palette bridge inside `D:\Projects\GitHub\digital-service-ui-builder\src\react\hooks\order-flow-provider.tsx`

Do not copy implementation into this documentation scaffold. Plan the adapter migration after neutral DGP Ordering contracts are established.

## References

- Ordering authority: sibling `../dgp-ordering`.
- Studio consumer: sibling `../dgp-studio`.
- Sibling repositories: `../dgp-spec`, `../dgp-core`, `../dgp-validation`, `../dgp-workspace`, and `../dgp-sdk`.
- Legacy engine: `D:\Projects\GitHub\digital-service-ui-builder`.
