import { useMemo, useState } from "react";
import { getTournaments, getTournamentHands } from "../utils/history";

const fmt = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function TournamentHistory() {
  const tournaments = useMemo(() => getTournaments({ limit: 200 }), []);
  const [selectedId, setSelectedId] = useState(tournaments[0]?.tournamentId ?? null);
  const hands = useMemo(
    () => getTournamentHands({ tournamentId: selectedId, limit: 50 }),
    [selectedId]
  );

  return (
    <div className="p-4 space-y-6">
      <section>
        <h2 className="text-xl font-bold mb-3">トーナメント履歴</h2>
        {tournaments.length === 0 ? (
          <div className="p-6 text-sm opacity-80">まだトーナメント履歴がありません。</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">日付</th>
                  <th className="text-right p-2">Buy-in</th>
                  <th className="text-right p-2">参加数</th>
                  <th className="text-right p-2">着順</th>
                  <th className="text-right p-2">賞金</th>
                  <th className="text-left p-2">Tier</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => {
                  const active = t.tournamentId === selectedId;
                  return (
                    <tr
                      key={t.tournamentId}
                      className={`border-t cursor-pointer ${active ? "bg-yellow-50" : ""}`}
                      onClick={() => setSelectedId(t.tournamentId)}
                    >
                      <td className="p-2">{fmt.format(new Date(t.tsEnd ?? t.tsStart))}</td>
                      <td className="p-2 text-right">{t.buyIn?.toLocaleString?.() ?? "-"}</td>
                      <td className="p-2 text-right">{t.entries ?? "-"}</td>
                      <td className="p-2 text-right font-semibold">{t.finish ?? "-"}</td>
                      <td className="p-2 text-right">{t.prize?.toLocaleString?.() ?? 0}</td>
                      <td className="p-2">{t.tier ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">ハンド振り返り</h3>
          {selectedId && (
            <span className="text-sm text-slate-500">
              Tournament ID: <code>{selectedId}</code>
            </span>
          )}
        </div>
        {selectedId == null ? (
          <p className="text-sm opacity-80">トーナメントを選択するとハンド履歴が表示されます。</p>
        ) : hands.length === 0 ? (
          <p className="text-sm opacity-80">ハンド履歴がまだありません。</p>
        ) : (
          <div className="space-y-3">
            {hands.map((hand) => (
              <details key={hand.handId} className="bg-white/80 rounded-2xl shadow border border-slate-200">
                <summary className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2 cursor-pointer">
                  <div>
                    <span className="font-semibold">Hand ID: </span>
                    <code>{hand.handId}</code>
                    <span className="ml-3 text-sm text-slate-500">{fmt.format(new Date(hand.ts))}</span>
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
                <div className="px-4 pb-4 space-y-3 text-sm">
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-2 text-left">Seat</th>
                          <th className="p-2 text-left">Player</th>
                          <th className="p-2 text-right">Bet</th>
                          <th className="p-2 text-right">Stack (before -&gt; after)</th>
                          <th className="p-2 text-right">Draw</th>
                          <th className="p-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(hand.playerSummaries ?? []).map((player) => (
                          <tr key={`${hand.handId}-${player.name}`} className="border-t">
                            <td className="p-2">{player.seat}</td>
                            <td className="p-2">{player.name}</td>
                            <td className="p-2 text-right">{player.bet ?? 0}</td>
                            <td className="p-2 text-right">
                              {player.stackBefore} -&gt; <b>{player.stackAfter}</b>
                            </td>
                            <td className="p-2 text-right">{player.drawCount ?? 0}</td>
                            <td className="p-2">{player.action || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hand.actionLog && hand.actionLog.length > 0 && (
                    <div className="bg-slate-100 rounded-xl p-3 text-xs max-h-48 overflow-y-auto">
                      <div className="font-semibold mb-1">Action Log</div>
                      <ol className="space-y-1 list-decimal list-inside">
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
    </div>
  );
}
