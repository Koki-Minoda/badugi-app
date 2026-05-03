/**
 * Locale copy for MGX main menu.
 */

export const MGX_LOCALES = {
  en: {
    title: {
      modeSelect: "Mode Select",
      heading: "Poker Platform",
      description:
        "Choose a mode and start playing. MGX supports cash games, tournaments, friend matches, mixed formats, and CPU practice.",
    },
    menu: {
      cash: "CASH GAME",
      variantSelect: "SELECT VARIANT",
      tournament: "TOURNAMENT",
      friend: "FRIEND MATCH",
      handHistory: "HAND HISTORY",
      settings: "SETTINGS",
    },
    modal: {
      close: "Close",
      variantEyebrow: "Cash Game",
      variantTitle: "Select a Variant",
      available: "Available",
      comingSoon: "Coming soon",
      jumpIn: "Jump in immediately",
      settingsTitle: "Settings",
      settingsBody:
        "Settings will be added later. Use table overlays for quick toggles. Language switching is available below.",
      rulesTitle: "Game Rules",
      rulesBody: "Detailed rules for each variant will appear here in a future update.",
      language: "Language",
    },
    common: {
      mainMenu: "Game Select",
      backToMenu: "Back to Game Select",
      logout: "Logout",
      loggingOut: "Logging out...",
      refresh: "Refresh",
      back: "Back",
      search: "Search",
      filter: "Filter",
    },
    header: {
      mainMenu: "Game Select",
      settings: "Settings",
      profile: "Profile",
      history: "History",
      leaderboard: "Leaderboard",
      globalRating: "Global Rating",
      skill: "Skill",
      mixed: "Mixed",
    },
    info: {
      defaultTitle: "Need a refresher?",
      defaultBody:
        "Rules and strategy tips will appear in the overlay accessible via the ? icon. Settings hold audio, table, and animation preferences.",
      cashTitle: "Cash Game",
      cashBody: "Play stack-based cash games and choose from supported variants.",
      tournamentTitle: "Tournament",
      tournamentBody: "Enter store tournament ladders starting with Badugi.",
      friendTitle: "Friend Match",
      friendBody: "Configure and host a private table for friends.",
      settingsTitle: "Settings",
      settingsBody: "Adjust table layout, audio, HUD information, and language.",
      historyTitle: "Hand History",
      historyBody: "Review your latest hands, inspect blinds, and jump into replays.",
    },
  },
  ja: {
    title: {
      modeSelect: "モード選択",
      heading: "ポーカープラットフォーム",
      description:
        "遊びたいモードを選んでください。MGXではキャッシュゲーム、トーナメント、フレンドマッチ、ミックスゲーム、CPU練習を遊べます。",
    },
    menu: {
      cash: "キャッシュゲーム",
      variantSelect: "ゲームを選択",
      tournament: "トーナメント",
      friend: "フレンドマッチ",
      handHistory: "ハンド履歴",
      settings: "設定",
    },
    modal: {
      close: "閉じる",
      variantEyebrow: "キャッシュゲーム",
      variantTitle: "ゲームを選択",
      available: "プレイ可能",
      comingSoon: "準備中",
      jumpIn: "すぐに開始",
      settingsTitle: "設定",
      settingsBody:
        "詳細設定は今後追加予定です。現在はテーブル上のクイック設定を利用できます。言語はここで切り替えられます。",
      rulesTitle: "ゲームルール",
      rulesBody: "各ゲームの詳しいルールは今後この画面に追加予定です。",
      language: "言語",
    },
    common: {
      mainMenu: "ゲーム選択",
      backToMenu: "ゲーム選択へ戻る",
      logout: "ログアウト",
      loggingOut: "ログアウト中...",
      refresh: "更新",
      back: "戻る",
      search: "検索",
      filter: "絞り込み",
    },
    header: {
      mainMenu: "ゲーム選択",
      settings: "設定",
      profile: "プロフィール",
      history: "履歴",
      leaderboard: "ランキング",
      globalRating: "総合レート",
      skill: "スキル",
      mixed: "ミックス",
    },
    info: {
      defaultTitle: "ヘルプ",
      defaultBody:
        "ルールや戦略のヒントは、左上の「?」アイコンから開くオーバーレイに表示されます。サウンドやテーブル、アニメーションなどは設定から変更できます。",
      cashTitle: "キャッシュゲーム",
      cashBody: "スタックを持って参加する通常卓です。対応済みのゲームを選んでプレイできます。",
      tournamentTitle: "トーナメント",
      tournamentBody: "Badugi を起点にした店舗トーナメントラダーに参加します。",
      friendTitle: "フレンドマッチ",
      friendBody: "友人だけの専用テーブルを作成し、プライベートに対戦できます。",
      settingsTitle: "設定",
      settingsBody: "テーブルレイアウト、サウンド、HUD 情報、言語などを変更します。",
      historyTitle: "ハンド履歴",
      historyBody: "直近のハンドを確認し、ブラインドやリプレイを振り返れます。",
    },
  },
};

export const MGX_DEFAULT_LOCALE = "ja";
export const LANGUAGE_STORAGE_KEY = "mgx_language";
