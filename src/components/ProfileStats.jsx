// src/components/ProfileStats.jsx
import React, { useEffect, useState } from "react";
import { loadStats } from "../utils/storage";

export default function ProfileStats() {
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    vpip: 0,
    pfr: 0,
    winnings: 0,
  });

  useEffect(() => {
    setStats(loadStats());
  }, []);

  return (
    <div className="p-4 bg-gray-800 text-white rounded-2xl shadow-lg">
      <h2 className="text-xl font-bold mb-3">📊 プロフィール統計</h2>
      <p>プレイ数: {stats.gamesPlayed}</p>
      <p>VPIP: {(stats.vpip * 100).toFixed(1)}%</p>
      <p>PFR: {(stats.pfr * 100).toFixed(1)}%</p>
      <p>獲得チップ: {stats.winnings}</p>
    </div>
  );
}
