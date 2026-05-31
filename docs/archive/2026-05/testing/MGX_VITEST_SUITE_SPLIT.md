# MGX Vitest Suite Split

## Purpose

MGX keeps the normal unit/component regression gate separate from the heavy AI evaluation checks. The AI evaluation tests exercise counterfactual replay, divergence scoring, and replay audit paths that can use more than 1 GB heap per worker. Running those files in the default parallel Vitest suite can produce worker exits under memory pressure even when the tests pass in serial.

## Commands

### Normal Regression

```bash
npm run test:unit
```

Use this for normal development, gameplay regression, UI/component regression, and pre-commit checks. It runs the regular Vitest suite while excluding the heavy AI evaluation tests listed below.

`npm test` uses the same exclusion set so the default unit gate stays stable.

### AI Evaluation

```bash
npm run test:ai-evaluation
```

Use this for counterfactual, divergence, and replay audit verification. This command runs the heavy AI evaluation tests serially with a single fork worker. It is expected to take longer than the normal unit suite.

Included files:

- `src/ai/evaluation/__tests__/runCounterfactualDivergenceScoreCliRunner.test.js`
- `src/ai/evaluation/__tests__/runCounterfactualDivergenceScoreCli.test.js`
- `src/ai/evaluation/__tests__/counterfactualReplay.test.js`
- `src/ai/evaluation/__tests__/auditReplayDeterminismCliRunner.test.js`

### Full Serial Check

```bash
npm run test:all:serial
```

Use this before release, in nightly verification, or when investigating cross-suite behavior. It runs the normal unit suite serially first, then runs the heavy AI evaluation suite serially.

## Exclusion Rule

The heavy AI evaluation tests are not skipped. They are excluded only from the normal unit gate and remain covered by `npm run test:ai-evaluation` and `npm run test:all:serial`.

Do not use `test.skip` or weaker assertions to keep the normal gate green. If an AI evaluation test is too slow or memory-heavy, keep it in the AI evaluation suite and tune the dedicated evaluation command or CI shard instead.
