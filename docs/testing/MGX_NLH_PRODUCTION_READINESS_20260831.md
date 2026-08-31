# MGX NL Hold'em cash production readiness (2026-08-31)

## Decision

NL Hold'em now passes the same cash lifecycle contract used by public MGX
games, with variant-correct expectations. It remains `preview_only`; this work
does not silently expand the public manifest. Promotion still requires an
explicit review of tournament and iPhone/WebKit parity.

## Proven scope

The production cash harness accepts `nlh` as an explicit release candidate and
runs it on Desktop Chromium and Android Chromium without weakening the public
game matrix. Each device proves:

- 10 settled hands from real Hero action buttons;
- 9 successful Next Hand transitions;
- strict B01 result, pot, evaluator-winner and chip-conservation checks through
  the shared 36-game progression/settlement gate;
- fixed 10/20 cash blinds across the session (NLH cash does not inherit the
  escalating draw-game ring structure);
- 10 replay-ready history records with deterministic replay audit;
- replay UI navigation to the final awarded-pot frame;
- cash-out summary reporting 10 hands and return to game selection;
- no clipped/blocked action control, horizontal overflow, fatal browser error,
  or failed application response.

## Evidence

| Device | Hands | Next Hand | Hero button clicks | History | Replay | Cash-out | Result |
|---|---:|---:|---:|---:|---|---|---|
| Desktop Chromium | 10 | 9 | 21 | 10/10 | final settlement verified | PASS | PASS |
| Android Chromium landscape (844x390) | 10 | 9 | 21 | 10/10 | final settlement verified | PASS | PASS |

Command:

```text
MGX_ALL_LIVE_CASH_QA=1 MGX_ALL_LIVE_CASH_VARIANTS=nlh \
MGX_ALL_LIVE_CASH_DEVICES=desktop,android MGX_ALL_LIVE_CASH_HANDS=10 \
npx playwright test tests/e2e/all-live-core5-cash-production.spec.ts \
  --project=badugi-flow --workers=1
```

## Remaining promotion work

1. Tournament full lifecycle parity for NLH.
2. iPhone/WebKit cash lifecycle and action-layout parity.
3. Explicit product review before adding NLH to `PUBLIC_PLAYABLE_VARIANTS`.

