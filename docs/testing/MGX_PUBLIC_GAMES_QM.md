# MGX public games quality management

## Managed product scope

The public, no-preview game scope is owned by `PUBLIC_PLAYABLE_VARIANTS` in
`src/games/config/variantAvailability.js`. As of 2026-08-31 it contains Badugi,
2-7 Triple Draw, A-5 Triple Draw, 2-7 Single Draw and A-5 Single Draw.

A pull request fails when the public manifest and the `alpha_playable` product
availability set differ, or when the browser QA matrix lacks metadata for a
public game. Preview and coming-soon games are deliberately excluded until a
separate promotion decision changes the product manifest.

An explicit release candidate can be exercised without changing that manifest
by setting `MGX_ALL_LIVE_CASH_VARIANTS`. NL Hold'em uses this path to run the
same 10-hand Desktop/Android lifecycle contract while remaining preview-only.
Variant metadata keeps rule-specific assertions honest: NLH must expose no Draw
action and preserve fixed cash blinds, while the public draw games must
exercise Draw and their configured ring blind progression.

## Release gate

Every pull request runs the public-scope contract together with the existing
Core5 cash, tournament, history/replay, Android layout and iPhone WebKit gates.
Deployment remains manual and is unavailable until every required job passes.

## Nightly production gate

Every night, each public game is played for at least ten physical hands on
Desktop Chromium and Android Chromium. A run passes only when all ten expected
game/device cases exist and every case proves:

- at least ten settled hands and nine successful Next Hand transitions;
- real Hero button presses and at least one Draw action;
- a visible blind-level and big-blind increase;
- ten replay-ready, deterministically audited history records;
- a working replay settlement and cash-out return to game selection;
- no fatal browser error, failed application response, clipped action, blocked
  action centre or horizontal overflow.

`qm-summary.json` fails closed for missing, malformed or below-threshold
evidence. Reports, screenshots and browser traces are retained for 30 days.

## Incident and promotion rules

1. Any missing case or P0/P1 failure blocks release and marks the public game
   unhealthy; do not narrow the matrix to make the build green.
2. Fix the product or explicitly demote the affected variant from the public
   manifest through review. A preview flag is not a production-quality pass.
3. Re-run the full ten-case matrix after a fix; a single-game rerun is useful
   for diagnosis but cannot close the incident.
4. Add a regression assertion for every escaped defect before merging its fix.
5. A preview game may be promoted only after it satisfies the same ten-hand,
   two-device, settlement, history/replay and cash-out contract.
