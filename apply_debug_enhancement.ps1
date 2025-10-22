# ================================
# Badugi Debug Enhancement Setup Script
# ================================

Write-Host "🔧 Debug enhancement setup started..."

# --- 1️⃣ src/utils/debugLog.js 新規作成 ---
$debugLog = @'
export const debugEnabled = true;

/**
 * 統一デバッグログ出力関数（色付き）
 * @param {string} tag ログカテゴリ
 * @param {string} msg メッセージ
 * @param {object} [obj] 追加データ
 */
export function debugLog(tag, msg, obj = null) {
  if (!debugEnabled) return;
  const time = new Date().toISOString().split("T")[1].slice(0, 8);

  // 色設定
  const color =
    tag.includes("BET") ? "color: #00ffcc;" :
    tag.includes("DRAW") ? "color: #ffcc00;" :
    tag.includes("STACK") ? "color: #00ff00;" :
    tag.includes("FLOW") ? "color: #ffaaff;" :
    "color: #ffffff;";

  const full = `%c[${time}] ${tag} ${msg}`;
  if (obj !== null) console.log(full, color, obj);
  else console.log(full, color);
}
'@

New-Item -Force -ItemType File -Path "src/utils/debugLog.js" -Value $debugLog | Out-Null
Write-Host "✅ src/utils/debugLog.js created."

# --- 2️⃣ roundFlow.js に debugLog 追記 ---
$roundFlowPath = "src/gameLogic/roundFlow.js"
if (Test-Path $roundFlowPath) {
  (Get-Content $roundFlowPath) |
  ForEach-Object {
    $_ -replace '(^// ラウンド制御の純関数群)',
      "`$1`r`nimport { debugLog } from `"../utils/debugLog`";"
  } |
  Set-Content $roundFlowPath
  Write-Host "✅ roundFlow.js: import追記済み。"
} else {
  Write-Host "⚠ roundFlow.jsが見つかりません。"
}

# --- 3️⃣ drawRound.js に debugLog 追記 ---
$drawRoundPath = "src/gameLogic/drawRound.js"
if (Test-Path $drawRoundPath) {
  (Get-Content $drawRoundPath) |
  ForEach-Object {
    $_ -replace 'import { createDeck, shuffleDeck } from "../utils/deck";',
      "import { createDeck, shuffleDeck } from `"../utils/deck`";`r`nimport { nextAliveFrom } from `"./roundFlow`";`r`nimport { debugLog } from `"../utils/debugLog`";"
  } |
  Set-Content $drawRoundPath
  Write-Host "✅ drawRound.js: debugLog追記済み。"
} else {
  Write-Host "⚠ drawRound.jsが見つかりません。"
}

# --- 4️⃣ App.jsx にデバッグ出力＆stack変動ログ追加 ---
$appPath = "src/App.jsx"
if (Test-Path $appPath) {
  $content = Get-Content $appPath -Raw

  # import debugLog
  if ($content -notmatch "debugLog") {
    $content = $content -replace 'import { saveHandHistory } from "./utils/history";',
      "import { saveHandHistory } from `"./utils/history`";`r`nimport { debugLog } from `"./utils/debugLog`";"
  }

  # useEffectで状態監視ログ
  if ($content -notmatch "debugLog.*phase=") {
    $content = $content -replace '(const \[betHead, setBetHead\].*?\n)',
      "`$1`n  // 状態遷移ログ監視`n  useEffect(() => {`n    debugLog(`[STATE]`, `phase=${phase}, drawRound=${drawRound}, turn=${turn}, currentBet=${currentBet}`);`n  }, [phase, drawRound, turn, currentBet]);`n"
  }

  # stack変動監視
  if ($content -notmatch "prevStacksRef") {
    $inject = @'
  // 🟢 スタック変動監視
  const prevStacksRef = useRef([]);
  useEffect(() => {
    if (prevStacksRef.current.length === players.length) {
      players.forEach((p, i) => {
        const diff = p.stack - prevStacksRef.current[i];
        if (diff !== 0) {
          const sign = diff > 0 ? "+" : "";
          debugLog("[STACK]", `${p.name} stack change: ${sign}${diff} → ${p.stack}`);
        }
      });
    }
    prevStacksRef.current = players.map(p => p.stack);
  }, [players]);
'@
    $content = $content -replace '(const \[showNextButton, setShowNextButton\].*?\n)', "`$1`n$inject`n"
  }

  Set-Content $appPath $content
  Write-Host "✅ App.jsx: debugLog＋stack変動追記完了。"
} else {
  Write-Host "⚠ App.jsxが見つかりません。"
}

Write-Host ""
Write-Host "🎉 Debug enhancement script completed successfully."
