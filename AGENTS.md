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

## Protocol lifecycle and operations

- Spec owns shared representation, Ordering owns ordering behavior, and this adapter owns only Form Palette integration behavior.
- Ratified means the versioned plain TypeScript contract, required JSON fixtures, rationale, and stable status are merged into `dgp-spec/main`; generated JSON Schemas must also be current once tooling exists. Released means that ratified Spec version is tagged and published.
- Update this adapter only after affected Spec, Core/SDK, Validation, and Ordering changes. Commit and release it independently after Ordering.
- The adapter may implement against ratified unreleased contracts, but stable releases require released versions of its protocol dependencies.
- The package supports Node.js 22 or newer. Use `npm install`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run check:boundaries`; `npm run check` is the completion command.
- No generated outputs are committed. Boundary checks must keep Form Palette and React here, prevent independently authored shared contracts, and preserve the one-way dependency on Ordering.

## Evidence and references

- Ordering authority: sibling `../dgp-ordering`.
- Shared-contract guide: sibling `../dgp-spec/CONTRACTS.md`.
- Legacy Wrapper evidence: `D:\Projects\GitHub\digital-service-ui-builder\src\react\inputs\wrapper.tsx`.
- Legacy bridge and descriptor evidence: `D:\Projects\GitHub\digital-service-ui-builder\src\react\inputs\form-context.tsx`, `src\react\inputs\entries`, and the order-flow provider.
- Studio consumer: sibling `../dgp-studio`.
- Siblings: `../dgp-spec`, `../dgp-core`, `../dgp-validation`, `../dgp-workspace`, and `../dgp-sdk`.

This repository remains GPL-3.0-only. Future manifests and source headers must use that exact SPDX identifier.
