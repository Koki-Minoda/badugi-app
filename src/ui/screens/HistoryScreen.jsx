import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { designTokens } from "../../styles/designTokens.js";
import { getTournaments, getTournamentHands } from "../../utils/history.js";

const fmt = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function HistoryScreen() {
  const navigate = useNavigate();
  const tournaments = useMemo(() => getTournaments({ limit: 200 }), []);
  const [selectedId, setSelectedId] = useState(tournaments[0]?.tournamentId ?? null);
  const [search, setSearch] = useState("");
  const filtered = tournaments.filter((entry) => {
    if (!search.trim()) return true;
    return (
      entry.tournamentId?.toLowerCase().includes(search.toLowerCase()) ||
      entry.tier?.toLowerCase().includes(search.toLowerCase())
    );
  });
  const hands = useMemo(
    () => (selectedId ? getTournamentHands({ tournamentId: selectedId, limit: 50 }) : []),
    [selectedId]
  );

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, ${designTokens.colors.surface} 0%, ${designTokens.colors.background} 65%)`,
        color: designTokens.colors.textStrong,
      }}
    >
      <header className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">History</p>
          <h1 className="text-3xl font-extrabold">トーナメント & ハンド履歴</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate("/menu")}
          className="px-4 py-2 rounded-full border border-white/20 hover:bg-white/10 transition text-sm"
        >
          Main Menu
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-10">
        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">トーナメント一覧</h2>
            <input
              type="search"
              placeholder="ID / Tier を検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full bg-slate-950/40 border border-white/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">まだトーナメント履歴がありません。</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/5">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950/60 text-slate-300">
                  <tr>
                    <th className="text-left p-3">日付</th>
                    <th className="text-right p-3">Buy-in</th>
                    <th className="text-right p-3">参加数</th>
                    <th className="text-right p-3">着順</th>
                    <th className="text-right p-3">賞金</th>
                    <th className="text-left p-3">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const active = t.tournamentId === selectedId;
                    return (
                      <tr
                        key={t.tournamentId}
                        className={`border-t border-white/5 cursor-pointer ${
                          active ? "bg-emerald-500/10" : ""
                        }`}
                        onClick={() => setSelectedId(t.tournamentId)}
                      >
                        <td className="p-3">{fmt.format(new Date(t.tsEnd ?? t.tsStart))}</td>
                        <td className="p-3 text-right">{t.buyIn?.toLocaleString?.() ?? "-"}</td>
                        <td className="p-3 text-right">{t.entries ?? "-"}</td>
                        <td className="p-3 text-right font-semibold">{t.finish ?? "-"}</td>
                        <td className="p-3 text-right">{t.prize?.toLocaleString?.() ?? 0}</td>
                        <td className="p-3">{t.tier ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">ハンド振り返り</h3>
            {selectedId && (
              <span className="text-xs text-slate-400">
                Tournament ID:
                <code className="ml-2 text-slate-200">{selectedId}</code>
              </span>
            )}
          </div>
          {!selectedId ? (
            <p className="text-sm text-slate-400">トーナメントを選択するとハンド履歴が表示されます。</p>
          ) : hands.length === 0 ? (
            <p className="text-sm text-slate-400">このトーナメントのハンド履歴はまだありません。</p>
          ) : (
            <div className="space-y-3">
              {hands.map((hand) => (
                <details
                  key={hand.handId}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
                >
                  <summary className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 cursor-pointer">
                    <div>
                      <span className="font-semibold">Hand ID:</span>{" "}
                      <code>{hand.handId}</code>
                      <span className="ml-3 text-xs text-slate-400">
                        {fmt.format(new Date(hand.ts))}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span>
                        Pot: <b>{hand.pot}</b>
                      </span>
                      <span>
                        Winner: <b>{(hand.winners ?? []).join(", ") || "-"}</b>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3 text-sm text-slate-200">
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-900/70 text-slate-400">
                          <tr>
                            <th className="p-2 text-left">Seat</th>
                            <th className="p-2 text-left">Player</th>
                            <th className="p-2 text-right">Bet</th>
                            <th className="p-2 text-right">Stack (before → after)</th>
                            <th className="p-2 text-right">Draw</th>
                            <th className="p-2 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(hand.playerSummaries ?? []).map((player) => (
                            <tr key={`${hand.handId}-${player.name}`} className="border-t border-white/5">
                              <td className="p-2">{player.seat}</td>
                              <td className="p-2">{player.name}</td>
                              <td className="p-2 text-right">{player.bet ?? 0}</td>
                              <td className="p-2 text-right">
                                {player.stackBefore} → <b>{player.stackAfter}</b>
                              </td>
                              <td className="p-2 text-right">{player.drawCount ?? 0}</td>
                              <td className="p-2">{player.action || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {hand.actionLog && hand.actionLog.length > 0 && (
                      <div className="bg-slate-900/40 rounded-xl p-3 text-xs max-h-48 overflow-y-auto border border-white/5">
                        <div className="font-semibold mb-1">Action Log</div>
                        <ol className="space-y-1 list-decimal list-inside text-slate-300">
                          {hand.actionLog.map((entry, idx) => (
                            <li key={`${hand.handId}-log-${idx}`}>
                              [{entry.phase}] Seat {entry.seatName ?? entry.seat} : {entry.type}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
