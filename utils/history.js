// --- トーナメント開始時に新規作成 ---
export function startTournament(tournamentInfo) {
  const key = "badugi_tournaments";
  const existing = JSON.parse(localStorage.getItem(key) || "[]");

  const newTournament = {
    tournamentId: tournamentInfo.id,
    mode: tournamentInfo.mode || "HU",
    players: tournamentInfo.players,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    hands: [],
    result: null
  };

  existing.push(newTournament);
  localStorage.setItem(key, JSON.stringify(existing));
}

// --- ハンド終了ごとに追加 ---
export function addHandToTournament(tournamentId, handResult) {
  const key = "badugi_tournaments";
  const tournaments = JSON.parse(localStorage.getItem(key) || "[]");

  const t = tournaments.find(t => t.tournamentId === tournamentId);
  if (t) {
    t.hands.push(handResult);
    localStorage.setItem(key, JSON.stringify(tournaments));
  }
}

// --- トーナメント終了時に結果を更新 ---
export function finishTournament(tournamentId, finalResult) {
  const key = "badugi_tournaments";
  const tournaments = JSON.parse(localStorage.getItem(key) || "[]");

  const t = tournaments.find(t => t.tournamentId === tournamentId);
  if (t) {
    t.finishedAt = new Date().toISOString();
    t.result = finalResult;
    localStorage.setItem(key, JSON.stringify(tournaments));
  }
}

// --- 全トーナメント履歴を取得 ---
export function loadTournaments() {
  const key = "badugi_tournaments";
  return JSON.parse(localStorage.getItem(key) || "[]");
}

// --- 削除 ---
export function clearTournaments() {
  localStorage.removeItem("badugi_tournaments");
}
