# Bug Fixes Instructions

1. **修正着手前に `docs/bug_fixes.md` を更新すること**  
   - 対象 Bug ID、対応内容、関係ファイル、状態（✅/🟡/⛔）を追記・更新する。  
   - 途中の場合は「Pending / Follow-up」にタスクを残す。

2. **コード変更時の共通ルール**
   - 仕様書（`specs/.vscode/badugi-bugs.code-snippets`）に沿って原因・対策を整理し、可能なら該当セクションへも追記する。  
   - 既存フラグ（例: `isBusted`, `hasActedThisRound`）を追加・拡張した際は、初期化ロジックと state リセットを忘れず調整する。  
   - ログや履歴 (`recordActionToLog`, `utils/history_rl`) を触る場合は、必ずフォーマット変更内容をこのファイルと `docs/bug_fixes.md` 双方へ反映させる。

3. **Bug ごとの特記事項**
   - **Bug-02/04**: `hasActedThisRound`, `lastAggressor` を必ず同期させる。BET 終了判定を変更したら、その条件と理由を `docs/bug_fixes.md` に記載。  
   - **Bug-05**: Badugi 評価は `games/badugi/utils/badugiEvaluator.js` を唯一のソースとする。UI で表示する際も `rankType` / `ranks` を使用し、`score` は利用しない。  
   - **Bug-06/07**: Player レイアウトを変更する場合は、各デバイス幅でのスクリーンショット or 期待図を添付し、必要なら `specs/` にモックを追加。  
   - **Bug-08**: アクションログを追加したら `recordActionToLog` / `utils/history_rl` の仕様（フィールド一覧）を更新し、保存形式を明記する。

4. **未完了タスクの扱い**
   - 実装途中で終了する場合、`docs/bug_fixes.md` の該当 Bug に「残作業」と「担当ファイル」を必ず追記。  
   - 作業ブランチに未反映の修正は `git status` で確認し、必要に応じて `TODO:` コメントで根拠を残す。
