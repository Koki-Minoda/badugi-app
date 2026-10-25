const COPY = {
  en: {
    eliminated: "You are eliminated",
    finishedPlace: (place, suffix) => `You finished in ${place}${suffix} place`,
    eliminatedSummary: "You have been eliminated",
    payout: (amount) => `Payout: ${amount}`,
    payoutRow: (amount) => `Payout ${amount}`,
    inTheMoney: "In the Money",
    players: (count) => `${count} players`,
    noPayouts: "No payouts",
    noPaidPlayers: "No players reached the payout positions.",
    stack: (amount) => `Stack: ${amount}`,
    backToMenu: "Back to Menu",
    enterTournament: "Enter New Tournament",
    inTheMoneyResults: "In-the-money Results",
    tournamentResults: "Tournament Results",
    tournamentComplete: "Tournament Complete",
    champion: "Champion",
    championPrefix: "Champion:",
    firstPlace: "1st Place",
    prize: "Prize",
    entrants: "Entrants",
    finalStack: "Final Stack",
    knockouts: "Knockouts",
  },
  ja: {
    eliminated: "大会から脱落しました",
    finishedPlace: (place) => `${place}位で終了`,
    eliminatedSummary: "大会から脱落しました",
    payout: (amount) => `賞金: ${amount}`,
    payoutRow: (amount) => `賞金 ${amount}`,
    inTheMoney: "入賞者",
    players: (count) => `${count}人`,
    noPayouts: "入賞者なし",
    noPaidPlayers: "賞金を獲得したプレイヤーはいません。",
    stack: (amount) => `持ち点: ${amount}`,
    backToMenu: "メニューへ戻る",
    enterTournament: "次の大会へ",
    inTheMoneyResults: "入賞結果",
    tournamentResults: "大会結果",
    tournamentComplete: "大会終了",
    champion: "優勝",
    championPrefix: "優勝:",
    firstPlace: "1位",
    prize: "賞金",
    entrants: "参加者",
    finalStack: "最終持ち点",
    knockouts: "脱落させた人数",
  },
};

export function getTournamentResultCopy(language) {
  return COPY[language === "ja" ? "ja" : "en"];
}

const JAPANESE_BUILTIN_TITLES = {
  "Store Tournament": "店舗大会",
  "Local Tournament": "地方大会",
  "National Championship": "全国大会",
  "World Championship": "世界大会",
  "Tournament Results": "大会結果",
};

export function displayTournamentTitle(title, language, fallback) {
  if (!title) return fallback;
  return language === "ja" ? JAPANESE_BUILTIN_TITLES[title] ?? title : title;
}
