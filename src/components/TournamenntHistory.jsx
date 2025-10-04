// src/components/TournamentHistory.jsx
import React, { useEffect, useState } from "react";
import { getTournamentHistory, clearTournamentHistory } from "../utils/history";

export default function TournamentHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(getTournamentHistory());
  }, []);

  const handleClear = () => {
    if (window.confirm("履歴をすべて削除しますか？")) {
      clearTournamentHistory();
      setHistory([]);
    }
  };

  return (
    <div className="p-4 bg-gray-800 text-white rounded-2xl shadow-lg">
      <h2 className="text-xl font-bold mb-3">🕓 トーナメント履歴</h2>
      <button
        onClick={handleClear}
        className="bg-red-500 text-white px-3 py-1 rounded mb-3"
      >
        全削除
      </button>
      {history.length === 0 ? (
        <p>履歴がありません。</p>
      ) : (
        <ul className="space-y-2">
          {history.map((t, i) => (
            <li key={i} className="bg-gray-700 p-3 rounded-lg">
              <div className="flex justify-between">
                <span>{new Date(t.date).toLocaleString()}</span>
                <span>結果: {t.result?.place ?? "-"}位</span>
              </div>
              <div className="text-sm text-gray-300">
                {t.stats?.vpip && <>VPIP {(t.stats.vpip * 100).toFixed(1)}%</>}
                {t.stats?.pfr && <> / PFR {(t.stats.pfr * 100).toFixed(1)}%</>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
