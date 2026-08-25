# Archive Index — 2026-05

**作成日:** 2026-05-31  
**Phase:** docs整理 Phase 1  
**移動総数:** 181 ファイル  
**内容変更:** なし（ファイルはすべて原文のまま移動）

---

## 移動サマリー

| カテゴリ | 移動元 | 移動先 | 件数 |
|---|---|---|---|
| Iron Bootstrap Step 1〜57 | `docs/ai/` | `ai/iron-bootstrap/` | 59 |
| Pro Step4 B〜X + 付随 deepdive | `docs/ai/` | `ai/pro-step4/` | 55 |
| MAJOR_10_PRO シリーズ | `docs/ai/` | `ai/major10/` | 4 |
| 完了済み testing audit | `docs/testing/` | `testing/` | 31 |
| 完了済み alpha release evidence | `docs/alpha/` | `alpha/` | 30 |
| 完了済み UI audit | `docs/ui/` | `ui/` | 2 |

---

## カテゴリ別詳細

### ai/iron-bootstrap/ — Iron Bootstrap Step 1〜57

Iron RL ガバナンス監査トレール。Step58 が現行基準。Step1〜57 は完了済みステップ。  
再生成不可だが、ガバナンス証跡として保持。

| 移動前パス | 移動後パス | 移動理由 |
|---|---|---|
| `docs/ai/MGX_IRON_BOOTSTRAP_STEP1_PLAN.md` | `ai/iron-bootstrap/MGX_IRON_BOOTSTRAP_STEP1_PLAN.md` | Step1 計画書。完了済み |
| `docs/ai/MGX_IRON_BOOTSTRAP_STEP1_REPORT.md` | `ai/iron-bootstrap/MGX_IRON_BOOTSTRAP_STEP1_REPORT.md` | 完了済みステップ報告 |
| `docs/ai/MGX_IRON_BOOTSTRAP_STEP2_DATASET_EXPANSION_PLAN.md` | `ai/iron-bootstrap/MGX_IRON_BOOTSTRAP_STEP2_DATASET_EXPANSION_PLAN.md` | Step2 拡張計画。完了済み |
| `docs/ai/MGX_IRON_BOOTSTRAP_STEP2_REPORT.md` | `ai/iron-bootstrap/MGX_IRON_BOOTSTRAP_STEP2_REPORT.md` | 完了済みステップ報告 |
| `docs/ai/MGX_IRON_BOOTSTRAP_STEP3_REPORT.md` 〜 `STEP26_REPORT.md` | `ai/iron-bootstrap/` | 完了済みステップ報告 (Step3〜26) |
| `docs/ai/MGX_IRON_BOOTSTRAP_STEP27_COVERAGE_AUDIT_REPORT.md` | `ai/iron-bootstrap/` | Step27 カバレッジ監査報告。完了済み |
| `docs/ai/MGX_IRON_BOOTSTRAP_STEP28_REPORT.md` | `ai/iron-bootstrap/` | 完了済みステップ報告 |
| `docs/ai/MGX_IRON_BOOTSTRAP_STEP29_FORCED_REPLAY_REPORT.md` | `ai/iron-bootstrap/` | Step29 強制リプレイ報告。完了済み |
| `docs/ai/MGX_IRON_BOOTSTRAP_STEP30_REPORT.md` 〜 `STEP57_REPORT.md` | `ai/iron-bootstrap/` | 完了済みステップ報告 (Step30〜57) |

**除外（Keep）:** `MGX_IRON_BOOTSTRAP_STEP58_REPORT.md` — 現行最新ステップ  
**除外（Keep）:** `MGX_IRON_BOOTSTRAP_CANDIDATE.md` — アクティブな候補トラッキング

---

### ai/pro-step4/ — Pro Step4 B〜X シリーズ

Pro AI 改善パイプラインの評価履歴。Step4Y/Z が現行基準。Step4B〜X は完了済み。  
Step4Y/Z の判断根拠トレールとして保持。

| 移動前パス | 移動後パス | 移動理由 |
|---|---|---|
| `docs/ai/MGX_PRO_STEP4_IMPROVEMENT_REPORT.md` | `ai/pro-step4/` | Step4 ベースライン改善報告。完了済み |
| `docs/ai/MGX_PRO_STEP4B_LEAK_CLASSIFICATION.md` | `ai/pro-step4/` | Step4B リーク分類。完了済み |
| `docs/ai/MGX_PRO_STEP4B_REPORT.md` | `ai/pro-step4/` | Step4B 報告。完了済み |
| `docs/ai/MGX_PRO_STEP4C_EV_ACTION_ATTRIBUTION.md` | `ai/pro-step4/` | Step4C EV attribution 分析。完了済み |
| `docs/ai/MGX_PRO_STEP4C_REPORT.md` 〜 `STEP4X_*.md` | `ai/pro-step4/` | Step4C〜X 全報告・deepdive。完了済み |
| `docs/ai/MGX_PRO_STEP4W_COUNTERFACTUAL_CORPUS_REPORT.md` | `ai/pro-step4/` | Step4W 反実仮想コーパス報告。完了済み |
| `docs/ai/MGX_PRO_STEP4X_REPORT.md` | `ai/pro-step4/` | Step4X 報告。完了済み |
| `docs/ai/MGX_PRO_STEP4X_STABLE_BUCKET_FIXES.md` | `ai/pro-step4/` | Step4X 安定バケット修正。完了済み |

**除外（Keep）:** `MGX_PRO_STEP4Y_REPORT.md`、`MGX_PRO_STEP4Y_FRESH_VS_HISTORICAL_CORPUS.md` — 現行評価  
**除外（Keep）:** `MGX_STEP4Y_PRO_VS_IRON_NEXT_ACTION.md` — 現在有効なルーティング決定  
**除外（Keep）:** `MGX_PRO_STEP4Z_REPORT.md` — 最新完了ステップ

---

### ai/major10/ — MAJOR_10_PRO シリーズ

Step4 シリーズ以前の Pro 改善評価シリーズ。Step4 シリーズに引き継がれ完了。

| 移動前パス | 移動後パス | 移動理由 |
|---|---|---|
| `docs/ai/MGX_MAJOR_10_PRO_STEP1_REPORT.md` | `ai/major10/` | 旧 Pro 評価 Step1。Step4 系に引き継ぎ完了 |
| `docs/ai/MGX_MAJOR_10_PRO_STEP2_REPORT.md` | `ai/major10/` | 旧 Pro 評価 Step2。完了済み |
| `docs/ai/MGX_MAJOR_10_PRO_STEP3_EVALUATION_REPORT.md` | `ai/major10/` | 旧 Pro 評価 Step3。完了済み |
| `docs/ai/MGX_MAJOR_10_PRO_TARGETS.md` | `ai/major10/` | 旧 Pro ターゲット一覧。Step4 系で更新済み |

---

### testing/ — 完了済み testing audit

ゲーム・AI・RL・ブラウザ各カテゴリの完了した coverage audit、failure analysis、RL トレーニング台帳。

| 移動前パス | 移動後パス | 移動理由 |
|---|---|---|
| `docs/testing/MGX_BROWSER_GAMEPLAY_BADUGI_1HAND_FAILURE_ANALYSIS.md` | `testing/` | 完了済み failure analysis |
| `docs/testing/MGX_BROWSER_GAMEPLAY_INVARIANT_AUDIT.md` | `testing/` | 完了済み invariant 監査 |
| `docs/testing/MGX_CORE5_BROWSER_GAMEPLAY_MATRIX_AUDIT.md` | `testing/` | 完了済み matrix 監査 |
| `docs/testing/MGX_CORE5_BROWSER_MATRIX_STEPB_FAILURE_ANALYSIS.md` | `testing/` | 完了済み failure analysis |
| `docs/testing/MGX_CORE5_BROWSER_SOAK_RUNTIME_CLASSIFICATION.md` | `testing/` | 完了済みランタイム分類 |
| `docs/testing/MGX_CORE5_FULL_LIFECYCLE_INVARIANT_AUDIT.md` | `testing/` | 完了済みライフサイクル監査 |
| `docs/testing/MGX_BADUGI_TEST_COVERAGE_AUDIT.md` | `testing/` | 完了済みカバレッジ監査 |
| `docs/testing/MGX_2_7TD_TEST_COVERAGE_AUDIT.md` | `testing/` | 完了済みカバレッジ監査 |
| `docs/testing/MGX_A5TD_TEST_COVERAGE_AUDIT.md` | `testing/` | 完了済みカバレッジ監査 |
| `docs/testing/MGX_SINGLE_DRAW_TEST_COVERAGE_AUDIT.md` | `testing/` | 完了済みカバレッジ監査 |
| `docs/testing/MGX_CORE5_TEST_COVERAGE_AUDIT.md` | `testing/` | 完了済みカバレッジ監査 |
| `docs/testing/MGX_ALPHA_TEST_COVERAGE_GAP_AUDIT.md` | `testing/` | 完了済みギャップ監査 |
| `docs/testing/MGX_BADUGI_BETTING_CLOSURE_TEST_GAP_AUDIT.md` | `testing/` | 完了済みギャップ監査 |
| `docs/testing/MGX_VARIANT_FAMILY_COVERAGE_REPORT.md` | `testing/` | 完了済みカバレッジ報告 |
| `docs/testing/MGX_GAME_PROGRESS_ADDON_REPORT.md` | `testing/` | 完了済み追加報告 |
| `docs/testing/MGX_EV_INTEGRITY_REPORT.md` | `testing/` | 完了済み EV 整合性報告 |
| `docs/testing/MGX_RL_DATA_PIPELINE_AUDIT_REPORT.md` | `testing/` | 完了済み RL パイプライン監査 |
| `docs/testing/MGX_RL_ENV_DIFF_AUDIT.md` | `testing/` | 完了済み RL 環境差分監査 |
| `docs/testing/MGX_RL_RESUME_READINESS_REPORT.md` | `testing/` | 完了済み RL 再開準備報告 |
| `docs/testing/MGX_RL_8_10GAME_TRAINING_LEDGER.md` | `testing/` | 完了済み RL トレーニング台帳 |
| `docs/testing/MGX_10GAME_RL_READINESS_REPORT.md` | `testing/` | 完了済み 10ゲーム RL 準備報告 |
| `docs/testing/MGX_DRAW_OPENING_ACTOR_ORDER_AUDIT.md` | `testing/` | 完了済み actor 順序監査 |
| `docs/testing/MGX_VITEST_SUITE_SPLIT.md` | `testing/` | 完了済み Vitest スイート分割 |
| `docs/testing/MGX_LIVE_CPU_ACTION_DB_AUDIT.md` | `testing/` | 完了済み CPU アクション DB 監査 |
| `docs/testing/MGX_PHYSICAL_QA_EXECUTION_PLAN.md` | `testing/` | 完了済み physical QA 実行計画 |
| `docs/testing/stud_razz_beginner_onnx_eval.json` | `testing/` | 旧 Stud/Razz ONNX 評価データ |
| `docs/testing/stud_razz_standard_onnx_eval.json` | `testing/` | 旧 ONNX 評価データ |
| `docs/testing/stud_stud8_beginner_onnx_eval.json` | `testing/` | 旧 ONNX 評価データ |
| `docs/testing/stud_stud8_standard_onnx_eval.json` | `testing/` | 旧 ONNX 評価データ |
| `docs/testing/stud_stud_beginner_onnx_eval.json` | `testing/` | 旧 ONNX 評価データ |
| `docs/testing/stud_stud_standard_onnx_eval.json` | `testing/` | 旧 ONNX 評価データ |

**除外（Needs Confirmation）:** `MGX_CORE5_BROWSER_GAMEPLAY_MATRIX_GATE.md`、`MGX_CORE5_CPU_STRATEGY_SANITY_AUDIT.md` — Phase 2 で確認後判断

---

### alpha/ — 完了済み alpha release evidence

alpha ローンチ証拠・デプロイ検証・実機 QA 結果・リリース準備確認。すべて完了済み。

| 移動前パス | 移動後パス | 移動理由 |
|---|---|---|
| `docs/alpha/MGX_2_7TD_IMPLEMENTATION_MAPPING_AUDIT.md` | `alpha/` | 完了済み実装マッピング監査 |
| `docs/alpha/MGX_2_7TD_RELEASE_READINESS.md` | `alpha/` | 完了済みリリース準備確認 |
| `docs/alpha/MGX_2_7TD_VARIANT_MAPPING_AUDIT.md` | `alpha/` | 完了済み variant マッピング監査 |
| `docs/alpha/MGX_A5TD_IMPLEMENTATION_MAPPING_AUDIT.md` | `alpha/` | 完了済み実装マッピング監査 |
| `docs/alpha/MGX_A5TD_RELEASE_READINESS.md` | `alpha/` | 完了済みリリース準備確認 |
| `docs/alpha/MGX_A5TD_VARIANT_MAPPING_AUDIT.md` | `alpha/` | 完了済み variant マッピング監査 |
| `docs/alpha/MGX_ALPHA_MOBILE_MANUAL_QA.md` | `alpha/` | 完了済みモバイル手動 QA |
| `docs/alpha/MGX_ALPHA_PHYSICAL_MOBILE_QA_CHECKLIST.md` | `alpha/` | 旧 QA チェックリスト（現行は `docs/qa/` に移行済み） |
| `docs/alpha/MGX_ALPHA_PHYSICAL_MOBILE_QA_RESULT.md` | `alpha/` | 完了済み physical QA 結果 |
| `docs/alpha/MGX_ALPHA_PLAYABLE_DESKTOP_SMOKE.md` | `alpha/` | 完了済みスモークテスト結果 |
| `docs/alpha/MGX_ALPHA_PLAYABLE_MOBILE_EMULATION_SMOKE.md` | `alpha/` | 完了済みスモークテスト結果 |
| `docs/alpha/MGX_ALPHA_POST_DEPLOY_BROWSER_SMOKE.md` | `alpha/` | 完了済みデプロイ後スモーク |
| `docs/alpha/MGX_ALPHA_POST_DEPLOY_CORE5_TOURNAMENT_SMOKE.md` | `alpha/` | 完了済みトーナメントスモーク |
| `docs/alpha/MGX_ALPHA_PRE_DEPLOY_CORE5_TOURNAMENT_LAYOUT_BASELINE.md` | `alpha/` | 完了済みベースライン |
| `docs/alpha/MGX_ALPHA_PRE_DEPLOY_MOBILE_FIX_BASELINE.md` | `alpha/` | 完了済みベースライン |
| `docs/alpha/MGX_ALPHA_PREVIEW_DEPLOY_BASELINE.md` | `alpha/` | 完了済みプレビューベースライン |
| `docs/alpha/MGX_ALPHA_VARIANT_AVAILABILITY_AUDIT.md` | `alpha/` | 完了済み variant 可用性監査 |
| `docs/alpha/MGX_BADUGI_IMPLEMENTATION_MAPPING_AUDIT.md` | `alpha/` | 完了済み実装マッピング監査 |
| `docs/alpha/MGX_BADUGI_MANUAL_QA_CHECKLIST.md` | `alpha/` | 旧 Badugi QA チェックリスト |
| `docs/alpha/MGX_BADUGI_PORTRAIT_MOBILE_ACCEPTANCE.md` | `alpha/` | 完了済み受入テスト |
| `docs/alpha/MGX_BADUGI_PORTRAIT_MOBILE_FAILURE_AUDIT.md` | `alpha/` | 完了済み障害監査 |
| `docs/alpha/MGX_BADUGI_RELEASE_READINESS.md` | `alpha/` | 完了済みリリース準備確認 |
| `docs/alpha/MGX_CORE5_FIRST_ACTOR_ORDER_AUDIT.md` | `alpha/` | 完了済み actor 順序監査 |
| `docs/alpha/MGX_CORE5_PHYSICAL_MOBILE_QA_RESULT.md` | `alpha/` | 完了済み physical QA 結果 |
| `docs/alpha/MGX_CORE5_UI_LAYOUT_AUDIT.md` | `alpha/` | 完了済み UI レイアウト監査 |
| `docs/alpha/MGX_PHYSICAL_MOBILE_QA_RESULT.md` | `alpha/` | 完了済み physical QA 結果 |
| `docs/alpha/MGX_SINGLE_DRAW_IMPLEMENTATION_MAPPING_AUDIT.md` | `alpha/` | 完了済み実装マッピング監査 |
| `docs/alpha/MGX_SINGLE_DRAW_RELEASE_READINESS.md` | `alpha/` | 完了済みリリース準備確認 |
| `docs/alpha/MGX_SINGLE_DRAW_VARIANT_MAPPING_AUDIT.md` | `alpha/` | 完了済み variant マッピング監査 |
| `docs/alpha/MGX_TRIPLE_DRAW_VARIANT_RULE_MAPPING_AUDIT.md` | `alpha/` | 完了済み Triple Draw ルールマッピング監査 |

**除外（Keep）:** `MGX_FRIEND_ALPHA_GO_NO_GO.md`、`MGX_FRIEND_ALPHA_LAUNCH_SCOPE_FREEZE.md`、`MGX_ALPHA_FRIEND_LAUNCH_SCOPE.md`、`MGX_FRIEND_ALPHA_TESTER_GUIDE.md`、`MGX_IOS_SAFARI_PWA_PLAY_GUIDE.md`、`MGX_CORE5_VARIANT_ACTIVE_STATUS.md`、`MGX_CORE5_ORIENTATION_POLICY.md`、`MGX_CORE5_MOBILE_TOURNAMENT_LAYOUT_POLICY.md`、`MGX_PHYSICAL_MOBILE_QA_RECHECK_STEPS.md`、`MGX_ALPHA_PRODUCT_HARDENING_READINESS.md`、`MGX_CORE5_UI_ACCEPTANCE_CRITERIA.md`  
**除外（Needs Confirmation）:** `MGX_BADUGI_ALPHA_AVAILABILITY_DECISION.md`、`MGX_BADUGI_ALPHA_RESTORE_CRITERIA.md` — ガバナンス決定として Phase 2 で確認

---

### ui/ — 完了済み UI audit

| 移動前パス | 移動後パス | 移動理由 |
|---|---|---|
| `docs/ui/MGX_REPLAY_TABLE_READABILITY_AUDIT.md` | `ui/` | 完了済みリプレイ表示監査 |
| `docs/ui/MGX_MOBILE_PORTRAIT_BADUGI_VERIFICATION.md` | `ui/` | 完了済みモバイル縦向き検証 |

**除外（Needs Confirmation）:** `MGX_REPLAY_UX_REDESIGN_PROPOSAL.md`、`MGX_TABLE_UX_REDESIGN_ROADMAP.md` — 採用/棄却状況を Phase 2 で確認

---

## リンク切れ確認結果

Phase 1 移動後に残存 `docs/` ファイルから移動済みファイルへの参照を確認した。

### 軽微（soft reference — backtick/plain text 引用）

内容変更禁止のため修正なし。アーカイブ内にファイルは存在するため参照先は失われていない。

| 参照元 | 参照しているファイル | 種別 |
|---|---|---|
| `docs/bugs/ACTIVE_BLOCKERS.md` | `MGX_CORE5_PHYSICAL_MOBILE_QA_RESULT.md`、`MGX_LIVE_CPU_ACTION_DB_AUDIT.md` | backtick soft reference |
| `docs/bugs/RELEASE_GATES.md` | `MGX_EV_INTEGRITY_REPORT.md`、`MGX_LIVE_CPU_ACTION_DB_AUDIT.md` | plain text path reference |
| `docs/planning/MGX_ACTIVE_TECH_DEBT_AUDIT.md` | `MGX_RL_DATA_PIPELINE_AUDIT_REPORT.md`、`MGX_ALPHA_TEST_COVERAGE_GAP_AUDIT.md`、`MGX_LIVE_CPU_ACTION_DB_AUDIT.md` | plain text reference（ACTIVE_TECH_DEBT_AUDIT 自体も Phase 2 archive 候補） |
| `docs/badugi_rl_and_variant_status.md` | `MGX_10GAME_RL_READINESS_REPORT.md`、`MGX_EV_INTEGRITY_REPORT.md`、`MGX_RL_RESUME_READINESS_REPORT.md`、`MGX_RL_8_10GAME_TRAINING_LEDGER.md` | plain text reference |
| `docs/alpha/MGX_BADUGI_ALPHA_RESTORE_CRITERIA.md` | `MGX_BADUGI_MANUAL_QA_CHECKLIST.md` | plain text reference |

### 注意（actual markdown hyperlink）

`docs/ai/MGX_STEP4_READINESS.md` が Pro Step4O/P/Q/U/V/W/X の各ファイルへの絶対パスリンクを含む。  
絶対パス形式（`/home/mgx/badugi-app/docs/ai/...`）で記述されており、移動前から環境依存で非ポータブルだった。  
内容変更禁止のため修正なし。

| 参照元 | 壊れたリンク数 | 対象 |
|---|---|---|
| `docs/ai/MGX_STEP4_READINESS.md` | 8 | Step4O, Step4P, Step4Q, Step4U, Step4V, Step4W, Step4X の deepdive・corpus 各ファイル |

**推奨対応（Phase 2）:** `MGX_STEP4_READINESS.md` 内のリンクを相対パスに更新し、archive パスへ変更する。

---

## Phase 2 へ持ち越す作業

| 項目 | 対象 |
|---|---|
| Needs Confirmation ファイルの判断 | `MGX_CORE5_BROWSER_GAMEPLAY_MATRIX_GATE.md`、`MGX_CORE5_CPU_STRATEGY_SANITY_AUDIT.md`、`MGX_BADUGI_ALPHA_AVAILABILITY_DECISION.md`、`MGX_BADUGI_ALPHA_RESTORE_CRITERIA.md`、`MGX_REPLAY_UX_REDESIGN_PROPOSAL.md`、`MGX_TABLE_UX_REDESIGN_ROADMAP.md` など |
| `MGX_STEP4_READINESS.md` リンク修正 | archive パスへの相対パス更新 |
| `docs/ai/` Iron early-phase discovery 系の移動判断 | `MGX_IRON_STEP3_*`〜`MGX_IRON_STEP9_*` (8 件) |
| `reports/` git 管理方針の決定 | 最新世代のみ管理 vs 全件管理 |
| 削除候補の確認 | `reports/ai-eval/replay-determinism-audit-iron-step7.json` (27 bytes)、`docs/bugs/HISTORICAL_ARCHIVE.md` |
