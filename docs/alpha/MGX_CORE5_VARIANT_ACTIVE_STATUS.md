# MGX Core 5 Variant Active Status

Date: 2026-05-16

## Result

`PASS`

`tests/e2e/core5-variant-active-status.spec.ts` verifies the Core 5 menu labels, launchability, direct routes, and build-info exposure.

| Game | variantId | UI Label | availability | Launchable | Notes |
| ---- | --------- | -------- | ------------ | ---------- | ----- |
| Badugi | `badugi` | Badugi | `preview_only` | no by default | Preview/dev flag required until physical mobile QA clears |
| 2-7 Triple Draw | `D01` | 2-7 Triple Draw | `alpha_playable` | yes | Gameplay alpha-active; RL teacher/D01 exclusion remains separate |
| A-5 Triple Draw | `D02` | A-5 Triple Draw | `alpha_playable` | yes | Existing alpha candidate |
| 2-7 Single Draw | `S01` | 2-7 Single Draw | `alpha_playable` | yes | Existing alpha candidate |
| A-5 Single Draw | `S02` | A-5 Single Draw | `alpha_playable` | yes | Existing alpha candidate |

## Evidence

```txt
npx playwright test tests/e2e/core5-variant-active-status.spec.ts --project=badugi-flow
```

Result: 6 passed.
