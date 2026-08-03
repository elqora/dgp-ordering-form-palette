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

## Status

Repository scaffold only. Adapter implementation and history-preserving migration will be planned after the neutral DGP Ordering contracts exist.

## License

GPL-3.0-only.
