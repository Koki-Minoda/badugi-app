import { useMemo } from "react";
import { getTournaments } from "../utils/history";

export default function TournamentHistory() {
  const rows = useMemo(() => getTournaments({ limit: 200 }), []);
  if (!rows.length) {
    return <div className="p-6 text-sm opacity-80">まだトーナメント履歴がありません。</div>;
  }
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-3">トーナメント履歴</h2>
      <div className="overflow-x-auto rounded-2xl shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">日時</th>
              <th className="text-right p-2">Buy-in</th>
              <th className="text-right p-2">参加数</th>
              <th className="text-right p-2">着順</th>
              <th className="text-right p-2">賞金</th>
              <th className="text-left p-2">Tier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.tournamentId} className="border-t">
                <td className="p-2">{new Date(t.tsEnd ?? t.tsStart).toLocaleString()}</td>
                <td className="p-2 text-right">{t.buyIn?.toLocaleString?.() ?? "-"}</td>
                <td className="p-2 text-right">{t.entries ?? "-"}</td>
                <td className="p-2 text-right">{t.finish ?? "-"}</td>
                <td className="p-2 text-right">{t.prize?.toLocaleString?.() ?? 0}</td>
                <td className="p-2">{t.tier ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
