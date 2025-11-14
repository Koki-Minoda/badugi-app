# トーナメントストラクチャ設定画面指示

## 新規ファイル
- src/ui/screens/TournamentStructureScreen.jsx
- src/ui/components/TournamentLevelRow.jsx

## フォーマット
```json
[
  { "level": 1, "smallBlind": 10, "bigBlind": 20, "ante": 0, "durationMinutes": 20 }
]
```

## 機能
- 行追加・削除
- プリセット読み込み
- localStorage 保存
- トーナメント開始時に読み込む

## Continue 指示
- 上記仕様通りに UI を実装する
- 既存の App.jsx などは diff で提示
