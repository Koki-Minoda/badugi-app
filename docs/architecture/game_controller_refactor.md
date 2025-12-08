## Game Controller Refactor (Phase 1)

### GameController (core abstraction)
- File: `src/games/core/GameController.js`
- Describes the variant-agnostic API the UI will call.
- Methods cover hand initialization, legal-action queries, action application, street/hand completion, winner resolution, and optional RL encoding.
- Concrete controllers (Badugi now, NLH/PLO later) will extend or implement this interface so `App.jsx` and future GameScreen components no longer need variant-specific logic.

### Variant registry
- File: `src/games/core/variants.js`
- Central map of supported variants keyed by `variantId`.
- Each entry exposes a `controllerFactory` returning the appropriate `GameController`.
- Currently only `"badugi"` is defined; additional variants (e.g., `"nlh"`, `"plo"`, `"stud"`) can be added by supplying their controller factories once implemented.

### Next phases
- Phase 2 will implement `BadugiGameController` and replace the placeholder factory.
- Later phases will wire the registry into `App.jsx` and introduce a reusable `GameScreen` so the UI consumes controller snapshots instead of direct engine calls.
