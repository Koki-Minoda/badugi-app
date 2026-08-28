# App controller construction boundary

`src/ui/App.jsx` must not import concrete game controllers. Runtime controller
construction belongs to `src/ui/game/createAppGameController.js`, which delegates
all registered games to `src/games/core/variants.js` and keeps the Chinese Poker
adapter behind the same boundary.

This is the first safe extraction from the large App component. It does not
pretend that the two Badugi controller layers are already unified: the public
registry still owns the compatibility wrapper while the legacy implementation
remains internal to that wrapper.

## Invariants

- An unknown variant returns `null`; it never silently starts Badugi.
- Board, Stud, and Dramaha controllers receive the canonical table config.
- Draw controllers receive draw/session config.
- Badugi receives its blind structure and evaluator config.
- Adding a playable variant requires a registry factory and factory-boundary
  coverage before App can construct it.

Future App extractions should depend on this boundary instead of adding another
concrete controller import or variant-specific constructor branch.
