# Agent guidance: DGP Ordering Form Palette

Read and follow `../AGENTS.md` before working in this repository.

## Role

This repository is the optional React integration between sibling `dgp-ordering` and `@timeax/form-palette`. It supplies the official batteries-included form experience without making Form Palette a dependency of any base package.

## Dependencies

- May depend on sibling `dgp-ordering`, React, React DOM, and `@timeax/form-palette`.
- Consume Ordering contracts; never redefine them locally.
- Must not become a dependency of Spec, Core, Validation, Ordering, Workspace, or SDK.
- Studio may consume this package optionally.

## Owned behavior

- Form Palette implementations of neutral Ordering form-store and field-binding contracts.
- The useful Wrapper interaction experience, re-expressed through canonical v1 Ordering contracts.
- The `Form`, `useCore`, and `useField` bridge for values, errors, subscriptions, persistence, and submission.
- Built-in `InputField` descriptors, UI metadata, the default registry factory, entry registration, and a convenience provider.

## Boundaries

- Do not own selection, visibility, quantity, expression execution, customer-validation, utility calculation, or `OrderSnapshot` semantics.
- Do not define `ProductDefinition`, service capabilities, Workspace state, Studio panels, pricing, charges, or backend behavior.
- Keep host-provided registries and custom input components supported; built-ins are defaults, not protocol requirements.
- Do not expose legacy Wrapper APIs, legacy wire fields, aliases, adapters, or compatibility modes. Preserve accepted UX behavior, not compatibility.
- Surface Ordering's structured expression failures without converting them into valid submissions or snapshots.

## Evidence and references

- Ordering authority: sibling `../dgp-ordering`.
- Legacy Wrapper evidence: `D:\Projects\GitHub\digital-service-ui-builder\src\react\inputs\wrapper.tsx`.
- Legacy bridge and descriptor evidence: `D:\Projects\GitHub\digital-service-ui-builder\src\react\inputs\form-context.tsx`, `src\react\inputs\entries`, and the order-flow provider.
- Studio consumer: sibling `../dgp-studio`.
- Siblings: `../dgp-spec`, `../dgp-core`, `../dgp-validation`, `../dgp-workspace`, and `../dgp-sdk`.

This repository remains GPL-3.0.
