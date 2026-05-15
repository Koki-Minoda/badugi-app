# MGX Preview Deploy Readiness

Date: 2026-05-15

## Scope

Step48-58 coaching / replay / learning dashboard work is ready for preview deployment behind a preview-only feature flag.

This is not a production rollout. It does not promote Iron, change routing, mutate gameplay, write production datasets, enable live RL, or add backend analytics.

## Feature Flag

| Item | Result |
| ---- | ------ |
| Preview flag | `mgxPreview=coaching` query, `VITE_MGX_COACHING_PREVIEW`, or localStorage preview key |
| Flag OFF production UI | PASS |
| Flag ON dashboard route | PASS |
| localStorage unavailable | PASS |
| Preview-only | true |

## Readiness Gates

| Gate | Result |
| ---- | ------ |
| Build | PASS |
| Coaching / replay Playwright previews | PASS |
| Learning dashboard Playwright previews | PASS |
| Step58 feature flag Playwright | PASS |
| AI Iron tests | PASS |
| AI Pro tests | PASS |
| RL safety tests | PASS |
| Governance freeze | PASS |

## Governance

| Item | Result |
| ---- | ------ |
| promoted | false |
| routingChanged | false |
| gameplayMutation | false |
| liveRLMutation | false |
| modelRegistryMutation | false |
| productionDatasetOverwrite | false |
| externalAnalytics | false |
| backendAnalytics | false |
| networkTelemetry | false |
| D01 included | false |

## Commit Units

1. Preview feature flag and guarded Learning Dashboard Preview route.
2. Coaching / replay / dashboard preview UI, local fixtures, and local-only stores.
3. Step48-58 reports, visual evidence, governance checks, and deploy readiness docs.

Because the worktree contains earlier untracked bootstrap artifacts, commits should stage these groups explicitly rather than using `git add .`.

## Deploy Decision

`READY_FOR_PREVIEW_DEPLOY`

Preview deploy is acceptable with the feature flag OFF by default. Enable with query/local flag for QA only.

## Residual Risks

| Risk | Mitigation |
| ---- | ---------- |
| Large existing bundle warning | Existing Vite warning only; preview route is guarded. Code splitting can be a later performance task. |
| localStorage blocked | Safe storage wrapper and fallback tests pass. |
| Preview route accidentally exposed | Flag OFF hides menu entry and redirects guarded route. |
| Broad dirty worktree | Commit with explicit path groups; avoid staging unrelated historical files. |

## Rollback

1. Disable `VITE_MGX_COACHING_PREVIEW`.
2. Remove `mgxPreview=coaching` query/localStorage preview key.
3. If needed, revert the preview route/menu commit only.
4. No dataset, routing, model registry, or gameplay rollback is required.
