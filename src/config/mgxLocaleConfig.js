/**
 * Locale copy for MGX main menu.
 */

export const MGX_LOCALES = {
  en: {
    title: {
      modeSelect: "Mode Select",
      heading: "Choose a game",
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
        "Choose your display language.",
      rulesTitle: "Game Rules",
      rulesBody: "Check how each game is played.",
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
        "Open Game Rules to check the rules for each game.",
      cashTitle: "Cash Game",
      cashBody: "Play stack-based cash games and choose from supported variants.",
      tournamentTitle: "Tournament",
      tournamentBody: "Enter store tournament ladders starting with Badugi.",
      friendTitle: "Friend Match",
      friendBody: "Configure and host a private table for friends.",
      settingsTitle: "Settings",
      settingsBody: "Change your display language and player profile.",
      historyTitle: "Hand History",
      historyBody: "Review your latest hands, inspect blinds, and jump into replays.",
    },
  },
  ja: {
    title: {
      modeSelect: "モード選択",
      heading: "ゲームを選ぶ",
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
        "表示言語を選んでください。",
      rulesTitle: "ゲームルール",
      rulesBody: "種目ごとの勝ち方と進め方を確認できます。",
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
        "ルール画面で種目ごとの勝ち方と進め方を確認できます。",
      cashTitle: "キャッシュゲーム",
      cashBody: "スタックを持って参加する通常卓です。対応済みのゲームを選んでプレイできます。",
      tournamentTitle: "トーナメント",
      tournamentBody: "Badugi を起点にした店舗トーナメントラダーに参加します。",
      friendTitle: "フレンドマッチ",
      friendBody: "友人だけの専用テーブルを作成し、プライベートに対戦できます。",
      settingsTitle: "設定",
      settingsBody: "表示言語やプレイヤー情報を変更します。",
      historyTitle: "ハンド履歴",
      historyBody: "直近のハンドを確認し、ブラインドやリプレイを振り返れます。",
    },
  },
};

export const MGX_DEFAULT_LOCALE = "ja";
export const LANGUAGE_STORAGE_KEY = "mgx_language";
