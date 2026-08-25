# MGX AI Feedback Status Audit

Date: 2026-05-24

Scope: AI feedback UI, CPU strategy, Pro overlay, teacher/learning pipeline, RL endpoint/model routing, telemetry, and evaluation reports. This is a planning/audit-only document. No gameplay, engine, backend, RL, deploy, or UI behavior was changed.

## 1. Executive Summary

MGX already has three separate AI-related surfaces, but they are not yet one connected product experience.

1. User-visible AI feedback exists mainly as a session-level hand-history feature. The user can request "AIフィードバック作成" after 30+ completed hands, scoped by variant, authenticated through the backend, and the response is stored locally and in `play_feedback_results`.
2. Replay analysis exists in the live UI as a local sample-based recommendation panel. It estimates alternatives from recent hand history, not from the Pro overlay or RL model.
3. Coaching, replay annotations, recap history, telemetry loop, and learning dashboard exist as preview-only work behind `mgxPreview=coaching` / `VITE_MGX_COACHING_PREVIEW` / localStorage. They are not promoted production UX.
4. CPU strength has a richer internal stack than the UI exposes: tiers, model registry, ONNX adapters, Pro overlay, standard policy router, deterministic safe fallback, decision telemetry, and evaluation reports.
5. The Pro overlay is materially implemented for Badugi and 5-card draw lowball. Hold'em, Omaha, Stud, and split-pot overlay strategy modules currently return `null`, so those families fall through to candidate/standard/safe fallback paths.
6. Frontend ONNX is documented as the primary RL inference path, but the inspected UI path does not directly call `inferBetActionWithOnnx` or `/api/badugi/rl/decision` in normal gameplay. The backend RL endpoint is a schema-checked deterministic-safe comparison/fallback endpoint, not a live model server.
7. The latest evaluation reports show Badugi/D01/D02/S01/S02 can complete Pro-vs-Standard runs with no freezes or illegal actions, but Standard is still classified as rule/fallback in those reports and live telemetry still has source/identity gaps.

Bottom line: AI foundations are broad, but production-facing coaching is still thin. The next best work is to unify the AI contract around action source, legal actions, variant, model, observation schema, explanation, and persisted telemetry, then promote one narrow feedback loop for the Core 5 variants.

## 2. 現在実装済みのAI機能

| Feature | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Session play feedback | Implemented, production-visible with login and 30+ hand gate | `src/ui/screens/HandHistoryScreen.jsx`, `src/ui/feedback/*`, `backend/app/api/analysis_chatgpt.py` | Cash-oriented UI payload currently calls `buildPlayFeedbackPayload({ mode: "cash" })`; backend schema accepts cash/tournament/mixed. |
| Feedback persistence | Implemented | `backend/app/models/play_feedback.py`, `src/ui/feedback/playFeedbackStore.js` | Backend stores sanitized payload/response. Frontend also stores latest responses in localStorage. |
| Replay analysis panel | Implemented as local training-index recommendation | `src/ui/screens/ReplayScreen.jsx` | Shows "Recommended action", EV, alternatives, confidence, closest matches when enough local samples exist. |
| Tournament result coaching preview | Implemented but preview/fixture-driven | `src/ui/components/TournamentResultOverlay.jsx`, `CoachingPreviewCard`, `CoachingSummaryPanel` | Requires `coachingPreview` data from the app path. |
| Replay coaching overlay | Implemented but preview/annotation-driven | `src/ui/components/ReplayCoachingOverlay.jsx` | Displays EV delta, severity, copy, helpful/not helpful actions. |
| Learning dashboard preview | Implemented, flag-gated | `src/ui/components/LearningDashboardPreview.jsx`, `src/ui/screens/LearningDashboardPreviewScreen.jsx` | Preview-only dashboard with variant filter, EV reviewed, repeated leaks, replay queue. |
| Coaching telemetry loop | Implemented as local preview telemetry | `src/ui/coaching/telemetry/*` | `previewOnly: true`, `upload: false`, `pii: false`. |
| CPU tiers | Implemented | `src/ai/tierManager.js`, `src/config/ai/tiers.json` | Stage/difficulty maps to standard/pro/iron/worldmaster. |
| Model registry and routing | Implemented | `src/ai/modelRouter.js`, `src/config/ai/modelRegistry.json` | Exact variant+tier lookup before fallback. |
| Pro overlay | Implemented for Badugi and draw lowball | `src/ai/pro/proDecisionOverlay.js`, `badugiProStrategy.js`, `drawLowballProStrategy.js` | Validates against legal actions and falls back safely. |
| CPU action normalization | Implemented | `src/ai/normalizeCpuAction.js` | Handles `type` vs `action`, fixed-limit bet/raise aliasing, illegal/invalid fallback reasons. |
| CPU decision telemetry utilities | Implemented | `src/ai/qa/cpuDecisionTraceCore.js`, `src/ai/qa/cpuDecisionPersistence.js`, `src/ui/qa/mobileQaSession.js` | Browser trace and QA session export exist; live DB persistence still has gaps. |
| RL schema tests/safety gates | Implemented | `docs/testing/MGX_RL_PIPELINE_AUDIT_LEDGER.md`, `docs/testing/MGX_RL_RESUME_SAFETY_GATE.md` | Badugi/Draw canonical vector size is 96. |
| Evaluation pipeline | Implemented | `src/ai/evaluation/*`, `scripts/runAiProEvaluation.mjs`, `scripts/runAiCounterfactual.mjs` | Pro-vs-Standard, divergence, counterfactual, replay determinism, action-value dataset tooling. |

## 3. 未実装/未接続のAI機能

| Gap | Current State | Risk |
| --- | --- | --- |
| Hero action immediate feedback | No general live post-action coaching surface in gameplay | Users do not see "why this action was good/bad" during play. |
| CPU action explanation | CPU decisions carry source/reason internally, but the table UI does not explain CPU actions | "賢くなった"ことがユーザーに見えない. |
| Hand-end review | Session feedback and replay exist, but normal hand result does not consistently show AI review | Feedback loop is delayed until hand history or preview paths. |
| Pro overlay to feedback UI bridge | Pro overlay reasons are not directly converted into user-facing coaching cards | Internal expertise is not surfaced. |
| ONNX/RL live routing visibility | ONNX adapter exists, but normal UI path search found no direct `inferBetActionWithOnnx` usage | RL model utilization is hard to verify from user behavior. |
| Backend RL live inference | `/api/badugi/rl/decision` returns deterministic-safe fallback | Endpoint is schema guard/future hook, not a strong live policy. |
| Board/Stud/Split Pro overlay | Strategy modules return `null` | 35-variant Pro experience would be uneven. |
| Variant-wide feedback contract | No single cross-variant AI feedback schema tying observation, legal actions, explanation, model, and persisted source | Variant expansion can drift silently. |

## 4. Badugiの状態

Badugi is the most mature poker AI path.

| Area | Status | Notes |
| --- | --- | --- |
| CPU policy | Standard policy router plus controller safe fallback and Pro overlay path | App path records decision source/reason/fallback metadata for BET; DRAW path has controller first and legacy fallback. |
| Pro overlay | Strongest coverage | Badugi strategy handles pat, draw-one, weak redraw, value raise/bet, final-round pot control, weak draw fold/check, and expensive-call folds. |
| ONNX models | Registered for pro, iron, worldmaster, standard v1-v3, beginner legacy | Current D03 entries use 96-dim input and 6 outputs. |
| RL endpoint | Backend schema/fallback only | `/api/badugi/rl/decision` validates 96-vector and legal actions, returns deterministic-safe. |
| Telemetry | Exists but live DB still partially unknown | Recent live DB audit had `DECISION_SOURCE_AVAILABLE`, but many rows had source `unknown` and earlier sessionId gaps. |
| Evaluation | Pro-vs-Standard reports pass freeze/illegal-action checks | Latest extracted report: D03 PASS, 40 hands, completion 1, freeze 0, illegal 0. |
| User feedback | Session feedback and replay analysis apply if history exists | No Badugi-specific visible CPU explanation in table UI. |

Key Badugi weakness: the Pro overlay can be internally correct while the user only sees generic gameplay. The missing bridge is "CPU chose X because Y" and "Hero spot review because Pro/teacher would prefer Z".

## 5. 2-7/A-5 draw lowball系の状態

D01/D02/S01/S02 are now a coherent AI family in the internal stack.

| Area | Status | Notes |
| --- | --- | --- |
| CPU policy | Standard policy router and draw-lowball Pro overlay | Draw lowball overlay infers low type, draw rounds, pair discard, 2-7 straight/flush penalty breaks, pat thresholds, and value/defense decisions. |
| Pro overlay | Implemented | `inferFamily` maps D01/D02/S01/S02 to `draw-lowball`. |
| ONNX models | Registered for beginner/standard/pro and bootstrap iron | 2-7 models cover D01/S01; A-5 models cover D02/S02; all inspected active entries are 96-dim, output 11. |
| RL schema | Implemented | Draw schema covers D01/D02/S01/S02 with 96 slots and variant-specific low/draw-round config. |
| Evaluation | Reports pass for D01/D02/S01/S02 | Latest 40-hand report has completion 1, freeze 0, illegal 0 for all four. |
| Feedback UI | Generic session feedback/replay analysis applies | No lowball-specific promoted coaching UX, although preview coaching history uses D02/S02 examples heavily. |

Known tension: draw lowball has better model breadth than visible UX. The user cannot currently tell whether a decision came from Standard, Pro overlay, ONNX, or safe fallback.

## 6. RL endpoint/model状態

| Item | Current State | Risk |
| --- | --- | --- |
| Canonical schema | Badugi and Draw are 96-dim | Good. Docs and tests agree. |
| Backend endpoint | `/api/badugi/rl/decision`, authenticated, 96-vector, schema version `badugi-observation-v1`, legal actions required | It returns deterministic-safe only; not live model intelligence. |
| Frontend ONNX adapter | Feature builders and inference wrappers exist | Runtime wiring to normal gameplay was not found by `rg` outside tests. |
| Models | ONNX files exist in `public/models` for Badugi, 2-7, A-5, board, stud/razz | Registry/model availability is ahead of visible AI UX. |
| Old 22-dim drift | Historical compatibility still exists in Python env comments/tools, but docs identify 96 as canonical | Do not revive 22-dim in new contracts. |
| Fallback priority | ONNX -> rule-based -> deterministic-safe documented | Need production telemetry to prove actual source usage by variant. |

Practical conclusion: treat the backend RL endpoint as a contract/safety hook, not as proof that live CPU uses RL. Before saying "RL-powered" in UX, add source telemetry assertions and a visible source audit.

## 7. Pro overlay/教師AI状態

| Family | Pro Overlay | Teacher/Eval Signal | Notes |
| --- | --- | --- | --- |
| Badugi | Implemented | Pro-vs-Standard, Badugi value pressure audit, live DB audit | Strongest hand-specific overlay. |
| 2-7TD / 2-7SD | Implemented as draw-lowball | Pro-vs-Standard, counterfactual/replay samples, action-value dataset work | Pro overlay and models exist; feedback UX not promoted. |
| A-5TD / A-5SD | Implemented as draw-lowball | Strongest coaching preview examples appear around S02/D02 | Good candidate for first promoted coaching loop. |
| NLH/FLH | ONNX model entries exist for beginner/standard; Pro overlay module returns `null` | Board model bootstrap reports exist | No true Pro overlay yet. |
| PLO/PLO8 | ONNX model entries exist for beginner/standard; Pro overlay module returns `null` | Board bootstrap reports exist | Needs family-specific evaluator/explanation. |
| Stud/Razz/Stud8 | ONNX model entries exist for beginner/standard; Pro overlay module returns `null` | Stud bootstrap reports exist | Needs visible-card/bring-in/street-aware teacher contract. |
| Split-pot families | Pro overlay module returns `null` | Some split result QA exists, but AI layer is not mature | High risk for 35 variants. |

Teacher AI is present mostly as offline/evaluation/governance tooling: Pro-vs-Standard, counterfactual divergence, action-value dataset, replay determinism, Iron bootstrap reports, and coaching material extraction. It is not yet one live teacher service.

## 8. AI feedback UI状態

| UI Surface | Visible by Default | Mode | Variant Scope | What User Sees |
| --- | --- | --- | --- | --- |
| Hand History "プレイフィードバック" | Yes, if logged in and 30+ hands | Currently built as cash in `HandHistoryScreen` | Explicit variant/mixed scope options | Japanese advice text, source, key hands, replay links. |
| Replay "Show Analysis" | Yes on replay screen | Any replay with enough local samples | Depends on hand-history samples | Phase/actor/pot/to-call, recommended action, EV, alternatives, confidence. |
| Tournament result coaching preview | Only when coaching data is passed and preview flow enabled | Tournament result | Preview fixtures / app-supplied coachingPreview | Lesson cards or summary panel with replay/helpful actions. |
| Replay coaching overlay | Only when annotation is supplied | Replay | Preview annotation | EV delta, severity, coaching copy, feedback buttons. |
| Learning Dashboard Preview | No, flag gated | Preview-only | Variant filter | EV reviewed, repeated leak, replay queue, local preview data. |
| Mobile QA debug panel | QA-only | Gameplay QA | CPU trace session | Decision source/fallback summaries for debug, not normal user coaching. |

Important limitation: normal gameplay does not currently show a Pro overlay explanation, CPU decision reason, or immediate Hero action critique.

## 9. Telemetry/DB状態

| Telemetry | Status | Gap |
| --- | --- | --- |
| Action log DB | `badugi_action_logs` persists phase, action, seat, stack/bet before/after, metadata JSON | CPU identity and session/source have been inconsistent in live reports. |
| CPU decision trace | Browser trace rows include decision source, legal actions, fallback reason, hand strength, RL request flags | Mostly QA/runtime memory unless explicitly exported or persisted through action metadata. |
| CPU decision persistence helper | Normalizes source/policy/fallback/legal actions and value telemetry | Need guarantee every CPU path uses it with variant/session IDs. |
| Feedback results DB | `play_feedback_results` stores sanitized payload/response, source, session key, mode, variant scope | Does not connect directly to CPU decision source or Pro overlay reason. |
| Coaching telemetry | Preview-only local store with `upload: false` and no PII | Not production analytics. |
| Live audit reports | Present under `reports/ai` | Latest audits still show unknown decision sources and live/local differences. |

Live DB audit highlights:

- `live-db-cpu-action-audit-v2`: 2087 actions, 500 recent hands, decision source available but 2001 actions were `unknown`; rows with sessionId were 0.
- `live-db-badugi-pro-overlay-normalization-audit`: session-filtered source markers improved, but still had mixed `pro-overlay` and `unknown`, with legal action availability 1.0 for that session.
- `tournament-ai-feedback-audit`: D01/D02/S01/S02 Node tournament sanity had 100/100 hands completed each, 0 freezes, 0 invalid actions; Badugi was not Node-measured due JSX/browser path limitations.

## 10. 既知課題

| Issue | Priority | Evidence | Suggested Direction |
| --- | --- | --- | --- |
| User-visible AI is delayed/session-level, not hand/action-level | P1 | Hand History feedback only after 30+ hands | Add a narrow post-hand review for Core 5 using existing replay/keyHands. |
| CPU decision source not consistently persisted | P1 | Live DB audit still has many `unknown` rows | Make decision source/fallback/legal actions required action metadata for CPU actions. |
| ONNX/RL runtime usage not proven in normal gameplay | P1 | Search found ONNX inference wrappers mostly in tests/tooling | Add source telemetry and E2E assertions before claiming live RL. |
| Backend RL endpoint is deterministic-safe only | P1 | `badugi_rl.py` returns safe policy | Keep as safety/comparison hook or wire real model explicitly with a gate. |
| Board/Stud/Split Pro overlay missing | P1 for 35 variants | Strategy modules return `null` | Define family-level teacher contracts before exposing Pro across all variants. |
| Pro overlay can be invisible to users | P2 | Reasons are internal metadata | Convert safe reasons into short user-facing explanation copy. |
| Counterfactual replay can be slow | P2 | `counterfactualReplay.test.js` has 60s/120s tests | Split smoke vs heavy evaluation jobs; keep heavy reports outside PR critical path. |
| Feedback UI mode mismatch risk | P2 | HandHistoryScreen currently builds feedback with `mode: "cash"` | Tournament-specific feedback needs a distinct surfaced path and payload source. |
| Action-value dataset docs/reports are dirty in current worktree | P2 | `git status` shows modified AI docs/reports | Do not mix audit commits with existing uncommitted evaluation work. |
| Variant-specific coaching examples over-index on D02/S02 | P2 | Preview coaching/history tests use D02/S02 heavily | Add Badugi/D01/S01 examples before promotion. |

## 11. 次に着手すべきTop10

1. Define a single AI decision contract for CPU and teacher outputs: `variantId`, `mode`, `phase`, `actorSeat`, `legalActions`, `selectedAction`, `finalAction`, `source`, `modelId`, `tierId`, `fallbackReason`, `explanationKey`, `observationSchema`, `schemaVersion`.
2. Make CPU action telemetry source/legal/fallback mandatory for Core 5 and fail QA if `unknown` exceeds a small threshold.
3. Promote one post-hand review surface for Core 5 that reuses keyHands/replay links and can show "Pro would prefer X" only when source confidence is known.
4. Connect Pro overlay reasons to user-safe explanation copy for Badugi and draw-lowball.
5. Add live source audit E2E/QA: prove whether gameplay used Pro overlay, ONNX, policy-router, or safe fallback.
6. Decide whether `/api/badugi/rl/decision` remains comparison-only or becomes a real model endpoint. Document this in product language.
7. Split counterfactual tests into fast smoke and heavy scheduled evaluation.
8. Add feedback payload support for tournament summaries through a first-class tournament history/result path, not a cash-only hand history assumption.
9. Fill Board/Stud/Split Pro overlay family contracts with `null` strategy modules explicitly marked unsupported in UI/telemetry.
10. Add per-variant AI readiness gate for 35 variants before launch: model present, schema validated, legal action mask, source persisted, explanation copy, eval report.

## 12. Alpha releaseまでに必要なAI/feedback minimum

Minimum for alpha should be narrower than the internal AI stack.

| Requirement | Minimum |
| --- | --- |
| User-facing feedback | Session feedback after 30+ hands, scoped by variant, with replay/key-hand links. |
| Core 5 CPU source telemetry | No `unknown` source for CPU actions in QA export; legal actions and fallback reason captured. |
| Pro overlay claims | Only claim Pro/teacher support for Badugi and D01/D02/S01/S02 unless other family overlays are implemented. |
| RL claims | Do not market gameplay as live RL unless source telemetry proves ONNX/RL use. |
| Replay coaching | Preview-only unless deterministic replay annotations are generated from real hand history. |
| Learning dashboard | Preview-only until persisted, privacy-reviewed, and verified across Safari/PWA. |
| Reports | Keep `npm run test:ai:pro`, `npm run test:rl:safety`, and a Core 5 CPU source audit green. |

## 13. 将来の理想構成

The target architecture should separate policy, teacher, explanation, and telemetry without duplicating variant rules:

1. Policy layer: CPU chooses legal actions through a variant-family adapter, with explicit source priority.
2. Teacher layer: offline/online evaluator compares Hero action to Pro/teacher candidates and returns stable explanation keys.
3. Explanation layer: maps internal reasons to concise localized coaching copy.
4. Feedback layer: session and hand-end review pull from the same normalized action/replay data.
5. Telemetry layer: every CPU/Hero reviewed decision stores source, legal actions, observation schema, model id, fallback reason, and replay reference.
6. Governance layer: evaluation reports and physical QA evidence decide whether each variant family can expose coaching, Pro labels, or RL labels.

## Variant AI Readiness Matrix

| Variant | CPU Policy | Pro Overlay | RL Endpoint | Model File | Feedback UI | Telemetry | Evaluation Report | Release Readiness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Badugi / D03 | Standard policy + controller fallback | Yes, Badugi-specific | Backend deterministic-safe only | Badugi pro/iron/worldmaster/standard/beginner ONNX present | Generic session/replay; preview coaching possible | Present, but live source gaps remain | PASS in Pro-vs-Standard; live audits exist | Alpha OK for gameplay; AI feedback needs source hardening |
| 2-7TD / D01 | Standard policy + draw controller | Yes, draw-lowball | No variant-specific backend endpoint found | 27draw beginner/standard/pro/iron ONNX present | Generic session/replay | Present via CPU trace/audits | PASS in Pro-vs-Standard and tournament AI audit | Alpha OK; feedback/explanation not promoted |
| A-5TD / D02 | Standard policy + draw controller | Yes, draw-lowball | No variant-specific backend endpoint found | a5draw beginner/standard/pro/iron ONNX present | Generic session/replay; preview examples common | Present via CPU trace/audits | PASS in Pro-vs-Standard and tournament AI audit | Strong candidate for first coaching promotion |
| 2-7SD / S01 | Standard policy + draw controller | Yes, draw-lowball | No variant-specific backend endpoint found | 27draw beginner/standard/pro/iron ONNX reused | Generic session/replay | Present via CPU trace/audits | PASS in Pro-vs-Standard and tournament AI audit | Alpha OK; needs single-draw explanation copy |
| A-5SD / S02 | Standard policy + draw controller | Yes, draw-lowball | No variant-specific backend endpoint found | a5draw beginner/standard/pro/iron ONNX reused | Generic session/replay; strongest preview coaching examples | Present via CPU trace/audits | PASS in Pro-vs-Standard and many Iron reports | Best teacher-AI pilot |
| NLH/FLH | Standard/beginner ONNX models exist | No, module returns `null` | No family endpoint found | nlh/flh ONNX present | Generic session/replay only | Basic action telemetry path | Not run in latest Pro-vs-Standard report | Preview only for AI claims |
| PLO/PLO8 | Standard/beginner ONNX models exist | No, module returns `null` | No family endpoint found | plo/plo8 ONNX present | Generic session/replay only | Basic action telemetry path | Not run in latest Pro-vs-Standard report | Preview only for AI claims |
| Stud/Razz/Stud8 | Standard/beginner ONNX models exist | No, module returns `null` | No family endpoint found | stud/razz/stud8 ONNX present | Generic session/replay only | Basic action telemetry path | Not run in latest Pro-vs-Standard report | Preview only for AI claims |
| Split-pot/hybrid variants | Partial family support elsewhere | No, module returns `null` | No family endpoint found | Mixed by family, not uniformly proven | Generic session/replay only | Sparse | Not enough evidence | Not AI-release ready |

## Required Explicit Answers

### 今ユーザーに見えているAIフィードバックは何か

- Hand Historyの「プレイフィードバック」: 30+ completed hands, login required, variant scope required, backend `/analysis/play-feedback` response displayed as Japanese advice with key hands/replay links.
- Replay screenの「Show Analysis」: local hand-history training indexから推奨アクション、EV、代替案、confidenceを表示する。
- Preview flag有効時だけ: tournament result coaching cards, replay coaching overlay, learning dashboard preview.

### 内部にはあるがUIに出ていないものは何か

- Pro overlay reason/confidence/blockedAction/fallbackReasonCategory.
- ONNX model registry, input/output shape, feature set, model id, checksum/training status.
- CPU decision source normalization, adapter mismatch, illegal action rejection, legal action list.
- Counterfactual replay, divergence samples, action-value dataset, Iron bootstrap governance, replay determinism reports.
- Backend RL deterministic-safe comparison endpoint metadata.

### CPUを賢くするために次にやるべきこと

1. First make source telemetry complete: no strategy improvement is trustworthy if `decisionSource` is still often `unknown`.
2. Route Core 5 CPU through one explicit source-priority contract: Pro overlay, ONNX candidate, standard policy, deterministic safe fallback.
3. Use Pro overlay reasons and counterfactual/action-value reports to tune only the concrete leak buckets with evaluation gates.
4. Promote Badugi and A-5SD/S02 as the first teacher-AI pilots because they have the strongest current evidence.
5. Add source-aware E2E/live audits that assert CPU actions are legal, source-labeled, and non-fallback unless expected.

### 35 variant化前に必須のAI contract

Each variant family needs a single AI contract before expansion:

```txt
variantId
layoutGroup / gameFamily / aiFamily
mode
phase
street
drawRound / betRound
actorSeat
actorStatus
legalActions
selectedAction
finalAction
amount / discardIndexes
sourcePriority
decisionSource
modelId
tierId
observationSchema
schemaVersion
stateVectorSize
fallbackReason
explanationKey
confidence
replayRef
sessionId
handId
telemetryVersion
```

Stop line: a variant may be playable without Pro/teacher/RL labels, but it should not expose AI coaching or Pro branding until this contract is populated, persisted, and covered by evaluation plus QA evidence.
