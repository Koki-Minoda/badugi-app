/**
 * Locale copy for MGX main menu.
 */

export const MGX_LOCALES = {
  en: {
    title: {
      modeSelect: "Mode Select",
      heading: "Poker Platform",
      description:
        "Choose a mode and dive into your preferred variant. MGX supports mixed formats, RL-ready CPUs, and store tournament ladders, so you can jump between ring, tournament, and sandbox modes in seconds.",
    },
    menu: {
      cash: "CASH GAME",
      tournament: "TOURNAMENT",
      friend: "FRIEND MATCH",
      settings: "SETTINGS",
    },
    info: {
      defaultTitle: "Need a refresher?",
      defaultBody:
        "Rules and strategy tips will appear in the overlay accessible via the ? icon. Settings hold audio, table, and animation preferences.",
      cashTitle: "Cash Game",
      cashBody: "Play ring games with multiple variants and stack-based formats.",
      tournamentTitle: "Tournament",
      tournamentBody: "Enter store tournament ladders starting with Badugi.",
      friendTitle: "Friend Match",
      friendBody: "Configure and host a private table for friends.",
      settingsTitle: "Settings",
      settingsBody: "Adjust table layout, audio, HUD information, and language.",
    },
  },
  ja: {
    title: {
      modeSelect: "モード選択",
      heading: "ポーカープラットフォーム",
      description:
        "遊びたいゲームモードを選択してください。MGX はミックスゲーム、RL 対応 CPU、店舗トーナメントなどに対応し、リング戦・トナメ・練習モードをシームレスに行き来できます。",
    },
    menu: {
      cash: "キャッシュゲーム",
      tournament: "トーナメント",
      friend: "フレンドマッチ",
      settings: "設定",
    },
    info: {
      defaultTitle: "ヘルプ",
      defaultBody:
        "ルールや戦略のヒントは、左上の「?」アイコンから開くオーバーレイに表示されます。サウンドやテーブル、アニメーションなどは設定から変更できます。",
      cashTitle: "キャッシュゲーム",
      cashBody: "スタック制のリングゲーム。複数のバリアントを切り替えてプレイできます。",
      tournamentTitle: "トーナメント",
      tournamentBody: "Badugi を起点にした店舗トーナメントラダーに参加します。",
      friendTitle: "フレンドマッチ",
      friendBody: "友人だけの専用テーブルを作成し、プライベートに対戦できます。",
      settingsTitle: "設定",
      settingsBody: "テーブルレイアウト、サウンド、HUD 情報、言語などを変更します。",
    },
  },
};

export const MGX_DEFAULT_LOCALE = "ja";
export const LANGUAGE_STORAGE_KEY = "mgx_language";
