# Game controller and App decomposition

### GameController (core abstraction)
- File: `src/games/core/GameController.js`
- Describes the variant-agnostic API the UI will call.
- Methods cover hand initialization, legal-action queries, action application, street/hand completion, winner resolution, and optional RL encoding.
- Concrete controllers now cover the public Board, Draw, Stud, Dramaha and
  Chinese Poker families through the registry/factory boundary.

### Variant registry
- File: `src/games/core/variants.js`
- Central map of supported variants keyed by `variantId`.
- Each entry exposes a `controllerFactory` returning the appropriate `GameController`.
- The registry is no longer Badugi-only. Availability remains a separate
  product decision: a registered controller does not by itself make a variant
  public.

### Current App boundaries

`src/ui/App.jsx` remains the integration orchestrator, but reusable logic must
not be added back to it. The first explicit slices are:

- `src/ui/app/gameProgressSupport.js`: snapshot compatibility, legal-action
  fallback, immutable player-state cloning, seat rotation/profile application,
  and cash CPU bust/reseat transformations;
- `src/ui/app/tournamentSupport.js`: blind-level normalization plus placement
  and opponent-profile projections;
- `src/ui/app/historySupport.js`: history cloning, hand identifiers and Hero
  outcome projection;
- `src/ui/app/aiSupport.js`: legacy NPC draw heuristic.

Controller construction is isolated in `src/ui/game/createAppGameController.js`.
Screens and overlays already live outside App. New work should add hooks or
domain services behind these boundaries instead of another App-local helper.

### Next safe phases

1. Extract tournament lifecycle effects as a reducer with persisted snapshot
   contract tests.
2. Extract hand-history recording as a hook around the existing store accessors.
3. Extract CPU inference scheduling after its deadline/fallback telemetry can be
   tested without React timers.
4. Remove the remaining compatibility controller only after every public
   variant's cash and tournament replay gates pass on the same factory.

Large controller or effect moves must remain separate PRs. A line-count decrease
is not acceptance evidence; Tier1, public-game QM, tournament champion/review,
P2P, and mobile WebKit gates must stay green after every slice.
