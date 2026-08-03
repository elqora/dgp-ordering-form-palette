# Form Palette adapter migration evidence

| Concern | Legacy evidence | DGP v1 disposition |
| --- | --- | --- |
| Form lifetime | `src/react/inputs/form-context.tsx` | Retain Form Palette persistence, validation, subscriptions, and submission through the current `Form`/`useCore` API. Retire the compatibility selection bag. |
| Field bridge | `src/react/inputs/wrapper.tsx` | Retain descriptor-driven value and selected-option extraction. Write canonical state only through `OrderingSession`. |
| Visible options | Wrapper and Core option helpers | Retain recursive option filtering using Core visibility exposed by Ordering. |
| Built-ins | `src/react/inputs/entries` | Retain the published Form Palette `InputField` variants as default descriptors while allowing complete host registry replacement. |
| Custom inputs | legacy registry/provider | Retain runtime registration and unregistration with typed component, cardinality, change-value, and selected-option adapters. |
| Submission | form context and order-flow provider | Form Palette validates mounted inputs; Ordering constructs snapshots. Structured Ordering failures pass through unchanged and never become valid submissions. |

Retired: legacy Wrapper exports, compatibility selection tokens, direct order-flow
ownership, duplicate visibility/quantity/service logic, Studio metadata, and
frontend pricing decisions.
