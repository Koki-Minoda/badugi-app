# MGX Mobile Portrait Badugi UI Verification

Date: 2026-05-23

## Scope

- React/Vite frontend UI only.
- No changes to game engine, roundFlow, CPU behavior, RL endpoints, hand log, or backend.
- Additional verification focuses on Badugi mobile portrait controls, DRAW phase accent, desktop layout smoke, and mobile landscape action visibility.

## Commands Run

```bash
npm run test -- src/ui/__tests__/drawControls.test.jsx src/ui/game/__tests__/tablePhaseColors.test.js src/ui/components/__tests__/TableSummaryPanel.test.jsx
npm run build
npx playwright test tests/e2e/mobile-tournament-landscape-action-buttons.spec.ts --project=badugi-flow
npx playwright test tests/e2e/badugi-portrait-mobile-layout.spec.ts --project=badugi-flow
npx playwright test tests/e2e/badugi-tournament-bet-to-draw-regression.spec.ts --project=badugi-flow
npx playwright test tests/e2e/responsive-layout-separation.spec.ts --project=badugi-flow
```

## Results

- Unit/UI tests: 3 files, 22 tests passed.
- Production build: passed.
- Mobile action buttons E2E: 4 tests passed.
  - 844x390 landscape: pass.
  - 844x360 tight landscape: pass.
  - 375x812 portrait: pass.
  - 390x844 portrait: pass.
- Badugi portrait mobile layout E2E: 3 tests passed.
  - 375x812: pass, no horizontal overflow, controls visible through one-hand flow.
  - 390x844: pass.
  - 430x932: pass.
- Badugi BET to DRAW regression: passed.
  - DRAW transition displays `DRAW RUSHER`.
  - Table badge and compact strip both carry red classes.
  - Root phase tone is `draw`.
- Responsive desktop/mobile smoke: 3 tests passed.
  - Desktop keeps non-mobile chrome and table ratio in the expected wide range.
  - Mobile landscape keeps fixed mobile root without horizontal/vertical overflow.

## 375x812 Metrics

From `reports/ui/mobile-tournament-landscape-action-buttons.json`:

- viewport: 375x812.
- decision panel: `x=8`, `y=641`, `width=359`, `height=165`.
- Fold: `x=13`, `y=747`, `width=112.328125`, `height=46`.
- Call: `x=131.328125`, `y=747`, `width=112.328125`, `height=46`.
- Raise: `x=249.65625`, `y=747`, `width=112.34375`, `height=46`.
- horizontal overflow: `0`.
- vertical overflow: `0`.

## DRAW Accent Coverage

- `getTablePhaseColors()` now has regression coverage for `DRAW`, `draw`, and `DRAWING`.
- `TableSummaryPanel` now has regression coverage ensuring `DRAW RUSHER` appears only for draw phases.
- `BET`, `SHOWDOWN`, and `WAITING` are covered to prevent stale DRAW red accent leakage.
- The Badugi BET to DRAW E2E now asserts the real DOM badge/strip/root phase tone after transition.

## Known Out Of Scope

- `npm run test` full-suite previously failed in `src/ai/evaluation/__tests__/counterfactualReplay.test.js` at `limits replay samples and respects bucket filters`.
- The failure is a 60s timeout inside `runCounterfactualDivergenceScore()` over AI evaluation replay samples and is unrelated to the React mobile UI changes.
- This verification did not alter the counterfactual replay test, AI evaluation pipeline, RL, or backend.

## Remaining Visual Risk

- 375x812 passes automated bounds/clickability checks, but real iOS browser chrome can still reduce visual viewport dynamically during address-bar collapse/expand.
- The tested safeguards are the visual viewport sizing hook, safe-area bottom padding, no horizontal overflow checks, and trial-click checks on Fold/Call/Raise.
