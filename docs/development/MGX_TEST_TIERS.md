# MGX Test Tiers

## Clean-clone quality gate

Run the following from a clean checkout:

```bash
npm ci --legacy-peer-deps
npm run lint
npm test
npm run test:mgx:safety
npm run build
```

`npm test` contains suites that are reproducible from Git-tracked source and
fixtures. It must pass in a clean clone and must not require local AI corpora.

## Local AI artifact validation

Run this only after restoring or regenerating the ignored AI datasets and
reports referenced by the Step 37–51 evaluation pipeline:

```bash
npm run test:artifacts
```

These suites are kept separate because `.gitignore` intentionally excludes
large or generated files under `data/ai/**/*.jsonl`,
`reports/ai-iron/**/*.json`, and `reports/ai-iron/**/*.jsonl`. A missing local
corpus is an artifact-readiness failure, not a clean-clone source regression.
The artifact gate must still pass before promoting or routing an AI model.
