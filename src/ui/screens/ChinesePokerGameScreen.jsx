import React, { useState } from "react";
import {TableCard} from "./layouts/MobileTableSeat.jsx";
import "../../styles/mobile-table.css";
import ChinesePokerController from "../../games/chinese/ChinesePokerController.js";
import {
  persistChinesePokerHistory,
  replayChinesePokerHistory,
} from "../../games/chinese/chinesePokerHistory.js";

const ROWS = [
  { key: "front", size: 3 },
  { key: "middle", size: 5 },
  { key: "back", size: 5 },
];

const DEFAULT_SEATS = [
  { id: "hero", name: "You", isHero: true, stack: 0 },
  { id: "mina", name: "Mina", stack: 0 },
];

const COPY = {
  ja: {
    title: "Chinese Poker",
    you: "あなた",
    subtitle: "13枚をフロント3枚、ミドル5枚、バック5枚に並べます。バックはミドル以上、ミドルはフロント以上の強さでないとファウルです。",
    back: "ゲーム選択へ戻る",
    hand: "ハンド",
    setting: "配置",
    showdown: "ショーダウン",
    auto: "自動配置",
    clear: "配置をクリア",
    submit: "配置を確定して採点",
    next: "次のハンド",
    finishTrial: "体験を終了",
    unassigned: "未配置カード",
    selectHint: "カードを選び、配置先の行ボタンを押してください。",
    scoredHint: "配置と採点が確定しました。各行の役と結果を確認できます。",
    fullRow: "この行は上限枚数です。",
    results: "結果",
    matchup: "対戦別スコア",
    total: "合計",
    royalties: "ロイヤリティ",
    foul: "ファウル",
    ready: "準備完了",
    hidden: "相手の手はショーダウンまで非表示です。",
    history: "ハンド履歴",
    replayVerified: "同じ配置・採点を再現済み",
    historyEvents: { HAND_START: "開始", ROWS_SET: "配置を確定", SHOWDOWN: "採点" },
    rowLabels: {
      front: "フロント 3枚",
      middle: "ミドル 5枚",
      back: "バック 5枚",
    },
  },
  en: {
    title: "Chinese Poker",
    you: "You",
    subtitle: "Arrange 13 cards into Front 3, Middle 5, and Back 5. Back must be at least as strong as Middle, and Middle at least as strong as Front.",
    back: "Back to Game Select",
    hand: "Hand",
    setting: "Setting",
    showdown: "Showdown",
    auto: "Auto Arrange",
    clear: "Clear Rows",
    submit: "Score Hand",
    next: "Next Hand",
    finishTrial: "Finish trial",
    unassigned: "Unassigned Cards",
    selectHint: "Select a card, then choose a row.",
    scoredHint: "The rows and score are final. Review each row and the result.",
    fullRow: "That row is already full.",
    results: "Results",
    matchup: "Matchup Scores",
    total: "Total",
    royalties: "Royalties",
    foul: "Foul",
    ready: "Ready",
    hidden: "Opponent hands are hidden until showdown.",
    history: "Hand History",
    replayVerified: "Exact rows and scoring replay verified",
    historyEvents: { HAND_START: "Hand started", ROWS_SET: "Rows set", SHOWDOWN: "Scored" },
    rowLabels: {
      front: "Front 3",
      middle: "Middle 5",
      back: "Back 5",
    },
  },
};

function getCopy(language) {
  return COPY[language] ?? COPY.en;
}

function Card({ card, selected = false, onClick = null }) {
  return <TableCard card={card} selected={selected} onClick={onClick} testId={`chinese-card-${card}`} />;
}
function BackCard() { return <TableCard hidden />; }

function scoreName(evaluation, rowKey) {
  return evaluation?.[rowKey]?.handName ?? "-";
}

function PlayerRows({ player, copy, phase }) {
  const showCards = player.isHero || phase === "showdown";
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-white">{player.isHero ? copy.you : player.name}</h3>
          <p className="text-xs text-slate-400">
            {player.ready ? copy.ready : copy.setting}
            {player.evaluation?.foul ? ` / ${copy.foul}` : ""}
          </p>
        </div>
        {player.evaluation?.royalties?.total > 0 && (
          <span className="rounded-full bg-amber-400/20 px-2 py-1 text-xs font-semibold text-amber-200">
            +{player.evaluation.royalties.total}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {ROWS.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>{copy.rowLabels[row.key]}</span>
              <span>{scoreName(player.evaluation, row.key)}</span>
            </div>
            <div className="flex min-h-16 gap-1.5 rounded-xl border border-white/10 bg-slate-900/70 p-2">
              {showCards
                ? (player.rows?.[row.key] ?? []).map((card) => <Card key={card} card={card} />)
                : Array.from({ length: row.size }, (_, index) => <BackCard key={`${row.key}-${index}`} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultPanel({ snapshot, copy, completedHistory, replayAudit }) {
  if (snapshot.phase !== "showdown" || !snapshot.results) return null;
  const totals = snapshot.results.totals ?? {};
  const nameById = Object.fromEntries(snapshot.players.map((player) => [player.id, player.isHero ? copy.you : player.name]));
  return (
    <section className="rounded-3xl border border-emerald-400/25 bg-slate-950/85 p-4" data-testid="chinese-results">
      <h2 className="text-lg font-bold text-white">{copy.results}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(totals).map(([playerId, points]) => (
          <div key={playerId} className="rounded-2xl bg-slate-900 p-3">
            <p className="text-xs text-slate-400">{nameById[playerId] ?? playerId}</p>
            <p className={`text-2xl font-black ${points >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {points > 0 ? `+${points}` : points}
            </p>
          </div>
        ))}
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-200">{copy.matchup}</h3>
      <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-white/10">
        {snapshot.results.matchups.map((matchup) => (
          <div
            key={`${matchup.playerA}-${matchup.playerB}`}
            className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/10 px-3 py-2 text-xs text-slate-300 last:border-b-0"
          >
            <span>
              {nameById[matchup.playerA]} vs {nameById[matchup.playerB]}
              {matchup.foul ? ` / ${copy.foul}: ${nameById[matchup.foul] ?? matchup.foul}` : ""}
            </span>
            <span className="font-bold text-white">
              {matchup.points > 0 ? `+${matchup.points}` : matchup.points}
              {matchup.royalties ? ` (${copy.royalties} ${matchup.royalties})` : ""}
            </span>
          </div>
        ))}
      </div>
      {completedHistory ? (
        <div className="mt-4 rounded-2xl border border-sky-300/25 bg-sky-400/10 p-3" data-testid="chinese-history-replay">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-sky-100">{copy.history} · {copy.hand} #{snapshot.handId}</span>
            <span className={replayAudit?.valid ? "text-emerald-300" : "text-red-300"} data-testid="chinese-replay-integrity">
              {replayAudit?.valid ? copy.replayVerified : replayAudit?.errors?.join(", ")}
            </span>
          </div>
          <ol className="mt-2 space-y-1 text-xs text-slate-300">
            {(completedHistory.events ?? []).map((event) => (
              <li key={`${event.sequence}-${event.type}`}>#{event.sequence} · {copy.historyEvents[event.type] ?? event.type}{event.playerId ? ` · ${nameById[event.playerId] ?? event.playerId}` : ""}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

export default function ChinesePokerGameScreen({ language = "ja", onBack = null, guest = false }) {
  const copy = getCopy(language);
  const [controllerState] = useState(() => {
    const controller = new ChinesePokerController({ seats: DEFAULT_SEATS });
    return {
      controller,
      snapshot: controller.startNewHand(),
    };
  });
  const controller = controllerState.controller;
  const [snapshot, setSnapshot] = useState(controllerState.snapshot);
  const [selectedCard, setSelectedCard] = useState(null);
  const [rowError, setRowError] = useState("");
  const [completedHistory, setCompletedHistory] = useState(null);
  const [replayAudit, setReplayAudit] = useState(null);
  const hero = snapshot.players.find((player) => player.isHero) ?? snapshot.players[0];
  const [rows, setRows] = useState(hero?.rows ?? { front: [], middle: [], back: [] });
  const assignedCards = new Set([...rows.front, ...rows.middle, ...rows.back]);
  const unassignedCards = (hero?.hand ?? []).filter((card) => !assignedCards.has(card));
  const canSubmit = ROWS.every((row) => rows[row.key].length === row.size);

  const refresh = (nextSnapshot, { syncRows = true } = {}) => {
    setSnapshot(nextSnapshot);
    const nextHero = nextSnapshot.players.find((player) => player.isHero) ?? nextSnapshot.players[0];
    if (syncRows && nextHero?.rows) {
      setRows(nextHero.rows);
    }
    setSelectedCard(null);
    setRowError("");
  };

  const moveSelectedToRow = (rowKey) => {
    if (!selectedCard) return;
    const rowSpec = ROWS.find((row) => row.key === rowKey);
    const nextRows = Object.fromEntries(
      ROWS.map((row) => [row.key, rows[row.key].filter((card) => card !== selectedCard)]),
    );
    if ((nextRows[rowKey]?.length ?? 0) >= rowSpec.size) {
      setRowError(copy.fullRow);
      return;
    }
    nextRows[rowKey] = [...nextRows[rowKey], selectedCard];
    setRows(nextRows);
    setSelectedCard(null);
    setRowError("");
  };

  const handleAutoArrange = () => {
    refresh(controller.autoSetRows(hero.id));
  };

  const handleClear = () => {
    setRows({ front: [], middle: [], back: [] });
    setSelectedCard(null);
    setRowError("");
  };

  const handleSubmit = () => {
    try {
      const rowsAlreadyRecorded =
        hero?.ready &&
        ROWS.every((row) =>
          JSON.stringify(hero?.rows?.[row.key] ?? []) === JSON.stringify(rows[row.key] ?? []),
        );
      if (!rowsAlreadyRecorded) {
        controller.setRows(hero.id, rows);
      }
      const result = controller.resolveShowdown();
      const history = controller.getHandHistory();
      const audit = replayChinesePokerHistory(history);
      if (!guest) persistChinesePokerHistory(history);
      setCompletedHistory(history);
      setReplayAudit(audit);
      refresh(result);
    } catch (error) {
      setRowError(error?.message ?? "Unable to score hand");
    }
  };

  const handleNextHand = () => {
    setCompletedHistory(null);
    setReplayAudit(null);
    if (guest) { onBack?.(); return; }
    refresh(controller.nextHand());
  };

  return (
    <div className="mgx-arrange-page min-h-screen bg-slate-950 px-4 pb-28 pt-5 text-slate-100 sm:px-6" data-testid="chinese-poker-screen">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">MGX / Chinese</p>
          <h1 className="text-3xl font-black">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
        >
          {copy.back}
        </button>
      </header>

      <main className="mx-auto mt-5 grid max-w-7xl gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {snapshot.phase === "showdown" && (
          <div className="xl:col-span-2">
            <ResultPanel snapshot={snapshot} copy={copy} completedHistory={completedHistory} replayAudit={replayAudit} />
          </div>
        )}
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-950/20 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                {copy.hand} #{snapshot.handId}
              </p>
              <h2 className="text-xl font-bold">
                {snapshot.phase === "showdown" ? copy.showdown : copy.setting}
              </h2>
            </div>
            {snapshot.phase !== "showdown" && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleAutoArrange} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950">
                  {copy.auto}
                </button>
                <button type="button" onClick={handleClear} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white">
                  {copy.clear}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40"
                  data-testid="chinese-submit"
                >
                  {copy.submit}
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/25 bg-slate-950/70 p-4" data-testid="chinese-hero-arrange">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{copy.you}</h2>
                  <p className="text-xs text-slate-400">{snapshot.phase === "showdown" ? copy.scoredHint : copy.selectHint}</p>
                </div>
                {hero?.evaluation?.foul && (
                  <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-bold text-red-200">
                    {copy.foul}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {ROWS.map((row) => (
                  <div key={row.key}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>{copy.rowLabels[row.key]}</span>
                      {snapshot.phase !== "showdown" && (
                        <button
                          type="button"
                          onClick={() => moveSelectedToRow(row.key)}
                          className="rounded-full border border-white/15 px-3 py-1 font-semibold text-slate-100 hover:border-emerald-300"
                        >
                          + {copy.rowLabels[row.key]}
                        </button>
                      )}
                    </div>
                    <div className="flex min-h-20 flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-900/75 p-2">
                      {rows[row.key].map((card) => (
                        <Card
                          key={card}
                          card={card}
                          selected={selectedCard === card}
                          onClick={snapshot.phase === "showdown" ? null : () => setSelectedCard((current) => (current === card ? null : card))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {snapshot.phase !== "showdown" && <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{copy.unassigned}</p>
                <div className="flex min-h-20 flex-wrap gap-2 rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-2">
                  {unassignedCards.map((card) => (
                    <Card
                      key={card}
                      card={card}
                      selected={selectedCard === card}
                      onClick={() => setSelectedCard((current) => (current === card ? null : card))}
                    />
                  ))}
                </div>
              </div>}
              {rowError && <p className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{rowError}</p>}
            </div>

            <div className="grid gap-3">
              {snapshot.players
                .filter((player) => !player.isHero)
                .map((player) => (
                  <PlayerRows key={player.id} player={player} copy={copy} phase={snapshot.phase} />
                ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          {snapshot.phase !== "showdown" && <PlayerRows player={{ ...hero, rows, evaluation: hero?.evaluation }} copy={copy} phase="showdown" />}
          {snapshot.phase !== "showdown" && (
            <div className="rounded-3xl border border-white/10 bg-slate-950/75 p-4 text-sm text-slate-300">
              {copy.hidden}
            </div>
          )}
        </aside>
      </main>
      {snapshot.phase === "showdown" && <footer className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-center gap-3 border-t border-emerald-300/30 bg-slate-950/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <p role="status" data-testid="chinese-result-summary" className="font-bold text-emerald-100">{copy.you}: {snapshot.results.totals[hero?.id] > 0 ? '+' : ''}{snapshot.results.totals[hero?.id]} · {hero?.evaluation?.foul ? copy.foul : copy.results}</p>
        <button type="button" onClick={handleNextHand} className="min-h-11 rounded-xl bg-amber-400 px-6 py-2 text-sm font-bold text-slate-950" data-testid="chinese-next-hand">{guest ? copy.finishTrial : copy.next}</button>
      </footer>}
    </div>
  );
}
